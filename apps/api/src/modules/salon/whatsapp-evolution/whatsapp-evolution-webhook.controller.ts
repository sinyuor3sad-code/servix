import {
  Controller,
  Post,
  Body,
  Param,
  Logger,
  HttpCode,
  UnauthorizedException,
  Headers,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../../shared/decorators';
import { PlatformPrismaClient } from '../../../shared/database/platform.client';
import { TenantClientFactory } from '../../../shared/database/tenant-client.factory';
import { WhatsAppAntiBanService } from './whatsapp-anti-ban.service';
import type { WhatsAppInstanceStatus } from '../../../../generated/platform';

interface EvolutionWebhookBody {
  event?: string;
  instance?: string;
  data?: Record<string, unknown>;
}

@Controller('webhooks/evolution')
export class WhatsAppEvolutionWebhookController {
  private readonly logger = new Logger(WhatsAppEvolutionWebhookController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly platformDb: PlatformPrismaClient,
    private readonly tenantFactory: TenantClientFactory,
    private readonly antiBan: WhatsAppAntiBanService,
  ) {}

  /**
   * Evolution API webhook receiver.
   *
   * Events we handle:
   *   - connection.update → update WhatsAppInstance.status
   *   - messages.upsert   → detect opt-out keywords from incoming text
   *
   * Shared-secret auth via `apikey` header (same master key used for admin calls).
   */
  @Public()
  @Post(':instanceName')
  @HttpCode(200)
  async handle(
    @Param('instanceName') instanceName: string,
    @Headers('apikey') apiKey: string | undefined,
    @Body() body: EvolutionWebhookBody,
  ): Promise<string> {
    const masterKey = this.configService.get<string>('EVOLUTION_API_KEY');
    if (!masterKey || apiKey !== masterKey) {
      throw new UnauthorizedException();
    }

    try {
      const event = body.event || '';
      if (event.startsWith('connection.update')) {
        await this.handleConnectionUpdate(instanceName, body.data ?? {});
      } else if (event.startsWith('messages.upsert')) {
        await this.handleIncomingMessage(instanceName, body.data ?? {});
      }
    } catch (err) {
      this.logger.error(
        `Webhook error for ${instanceName}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      // Always return 200 so Evolution doesn't retry-storm
    }
    return 'OK';
  }

  private async handleConnectionUpdate(
    instanceName: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const record = await this.platformDb.whatsAppInstance.findUnique({
      where: { instanceName },
    });
    if (!record) return;

    const raw = String(data['state'] ?? data['connectionStatus'] ?? '').toLowerCase();
    const status: WhatsAppInstanceStatus =
      raw === 'open' || raw === 'connected' ? 'connected'
      : raw === 'connecting' ? 'connecting'
      : raw === 'close' || raw === 'closed' ? 'disconnected'
      : record.status;

    const now = new Date();
    await this.platformDb.whatsAppInstance.update({
      where: { instanceName },
      data: {
        status,
        lastConnectedAt: status === 'connected' ? now : record.lastConnectedAt,
        lastDisconnectedAt:
          status === 'disconnected' && record.status === 'connected'
            ? now
            : record.lastDisconnectedAt,
      },
    });
    this.logger.log(`Instance ${instanceName} status → ${status}`);
  }

  private async handleIncomingMessage(
    instanceName: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const key = data['key'] as { fromMe?: boolean; remoteJid?: string } | undefined;
    if (!key || key.fromMe) return; // ignore our own echo

    const remoteJid = key.remoteJid || '';
    const phone = remoteJid.split('@')[0];
    if (!phone) return;

    const message = data['message'] as Record<string, unknown> | undefined;
    const text =
      (message?.['conversation'] as string) ||
      ((message?.['extendedTextMessage'] as Record<string, unknown> | undefined)?.['text'] as string) ||
      '';
    if (!text || !this.antiBan.isOptOutKeyword(text)) return;

    // Resolve tenant from instance → tenant_id → database_name
    const instanceRecord = await this.platformDb.whatsAppInstance.findUnique({
      where: { instanceName },
      include: { tenant: { select: { databaseName: true } } },
    });
    if (!instanceRecord?.tenant?.databaseName) return;

    const tenantDb = this.tenantFactory.getTenantClient(instanceRecord.tenant.databaseName);
    await this.antiBan.addOptOut(tenantDb, phone, `auto: ${text.slice(0, 100)}`);
    this.logger.log(`Auto opt-out recorded for ${phone} (tenant=${instanceRecord.tenantId})`);
  }
}
