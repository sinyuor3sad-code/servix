import {
  Controller,
  Post,
  Body,
  Param,
  Logger,
  HttpCode,
  UnauthorizedException,
  Headers,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../../shared/decorators';
import { PlatformPrismaClient } from '../../../shared/database/platform.client';
import { TenantClientFactory } from '../../../shared/database/tenant-client.factory';
import { WhatsAppAntiBanService } from './whatsapp-anti-ban.service';
import { EVOLUTION_WEBHOOK_BASE } from './webhook-path.constant';
import { AIReceptionService } from '../ai-reception/ai-reception.service';
import { ManagerReplyHandler } from '../ai-reception/manager-reply.handler';
import { FeaturesService } from '../../../core/features/features.service';
import { ReviewRequestsService } from './review-requests.service';
import type { WhatsAppInstanceStatus } from '../../../../generated/platform';
import type { TenantPrismaClient } from '../../../shared/types';

interface EvolutionWebhookBody {
  event?: string;
  instance?: string;
  data?: Record<string, unknown>;
}

@Controller({ path: EVOLUTION_WEBHOOK_BASE, version: VERSION_NEUTRAL })
export class WhatsAppEvolutionWebhookController {
  private readonly logger = new Logger(WhatsAppEvolutionWebhookController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly platformDb: PlatformPrismaClient,
    private readonly tenantFactory: TenantClientFactory,
    private readonly antiBan: WhatsAppAntiBanService,
    private readonly aiReception: AIReceptionService,
    private readonly managerReply: ManagerReplyHandler,
    private readonly reviewRequests: ReviewRequestsService,
    private readonly features: FeaturesService,
  ) {}

  /**
   * Evolution API webhook receiver.
   *
   * Events we handle:
   *   - connection.update → update WhatsAppInstance.status
   *   - messages.upsert   → message dispatch (opt-out → manager → AI reception)
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
      const event = this.normalizeEvolutionEvent(body.event);
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

  private normalizeEvolutionEvent(event: string | undefined): string {
    return String(event || '').toLowerCase().replace(/_/g, '.');
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

  /**
   * Message dispatcher — order matters (per AI_RECEPTION_PLAN.md Gotcha I):
   *   1. customer stop-follow-up command → cancel active pending action
   *   2. opt-out keyword → record opt-out
   *   3. sender == manager phone → ManagerReplyHandler (before AI)
   *   4. else → AIReceptionService (fire-and-forget)
   */
  private async handleIncomingMessage(
    instanceName: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const key = data['key'] as { fromMe?: boolean; remoteJid?: string; id?: string } | undefined;
    if (!key || key.fromMe) return;

    const remoteJid = key.remoteJid || '';
    if (remoteJid.endsWith('@g.us') || remoteJid.includes('@broadcast')) return;

    const phone = remoteJid.split('@')[0];
    if (!phone) return;

    const message = data['message'] as Record<string, unknown> | undefined;
    if (!message) return;

    const text =
      (message['conversation'] as string) ||
      ((message['extendedTextMessage'] as Record<string, unknown> | undefined)?.['text'] as string) ||
      '';

    // ── Resolve tenant ──
    const instanceRecord = await this.platformDb.whatsAppInstance.findUnique({
      where: { instanceName },
      include: {
        tenant: {
          select: { id: true, slug: true, databaseName: true, status: true },
        },
      },
    });

    if (!instanceRecord?.tenant?.databaseName) return;
    const tenant = instanceRecord.tenant;
    if (tenant.status !== 'active' && tenant.status !== 'trial') return;

    const tenantDb = this.tenantFactory.getTenantClient(tenant.databaseName) as unknown as TenantPrismaClient;

    // ────────────────────────────────────────────
    // [1] STOP FOLLOW-UP — cancels active AI pending action before generic opt-out
    // ────────────────────────────────────────────
    if (text) {
      const stopResult = await this.aiReception.handleStopFollowUpRequest({
        tenantDb,
        instanceName,
        instanceToken: instanceRecord.instanceToken,
        phone,
        text,
      });
      if (stopResult === 'stopped') return;
      if (stopResult === 'no_active_request' && !this.antiBan.isOptOutKeyword(text)) return;
    }

    // ────────────────────────────────────────────
    // [2] OPT-OUT
    // ────────────────────────────────────────────
    if (text && this.antiBan.isOptOutKeyword(text)) {
      await this.antiBan.addOptOut(tenantDb, phone, `auto: ${text.slice(0, 100)}`);
      this.logger.log(`Auto opt-out recorded for ${phone} (tenant=${tenant.id})`);
      return;
    }

    // ────────────────────────────────────────────
    // [3] MANAGER REPLY — before AI processing
    // ────────────────────────────────────────────
    if (text) {
      const managerPhone = await this.getManagerPhone(tenantDb);
      if (managerPhone && this.normalizePhone(phone) === this.normalizePhone(managerPhone)) {
        this.managerReply.handle({
          tenantDb,
          tenantId: tenant.id,
          instanceName,
          instanceToken: instanceRecord.instanceToken,
          text,
          managerPhone: phone,
        }).catch((err: unknown) => {
          this.logger.error(`Manager reply error: ${(err as Error).message}`, (err as Error).stack);
        });
        return;
      }
    }

    // ────────────────────────────────────────────
    // [4] AI RECEPTION — fire-and-forget
    // ────────────────────────────────────────────
    if (text) {
      try {
        const handledReview = await this.reviewRequests.handleIncomingRating({
          tenantDb,
          instanceName,
          instanceToken: instanceRecord.instanceToken,
          phone,
          text,
        });
        if (handledReview) return;
      } catch (err) {
        this.logger.error(`Review rating handler error: ${(err as Error).message}`, (err as Error).stack);
      }
    }

    if (!text) return; // Only text messages for now (audio/image in future phases)

    // Check feature gate
    const featureCheck = await this.features.isFeatureEnabled(tenant.id, 'whatsapp-bot');
    if (!featureCheck.isEnabled) return;

    // Anti-ban check
    const antiBanResult = await this.antiBan.check({
      tenantId: tenant.id,
      tenantDb: tenantDb as any,
      phone,
      isMarketing: false,
    });
    if (!antiBanResult.allowed) {
      this.logger.log(`🚫 Anti-ban blocked: ${antiBanResult.reason} for ${phone}`);
      return;
    }

    // Fire-and-forget to AI reception
    this.aiReception.handleCustomerMessage({
      tenantId: tenant.id,
      databaseName: tenant.databaseName,
      instanceName,
      instanceToken: instanceRecord.instanceToken,
      phone,
      text,
    }).catch((err: unknown) => {
      this.logger.error(
        `AI Reception error for ${phone}: ${(err as Error).message}`,
        (err as Error).stack,
      );
    });
  }

  // ═══════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════

  private async getManagerPhone(tenantDb: TenantPrismaClient): Promise<string | null> {
    try {
      const setting = await (tenantDb as any).setting.findUnique({
        where: { key: 'ai_manager_phone' },
      });
      return setting?.value || null;
    } catch {
      return null;
    }
  }

  private async isAIReceptionEnabled(tenantDb: TenantPrismaClient): Promise<boolean> {
    try {
      const setting = await (tenantDb as any).setting.findUnique({
        where: { key: 'ai_reception_enabled' },
      });
      // Default to true (opt-out model) — per plan spec
      return !setting || setting.value === 'true';
    } catch {
      return true;
    }
  }

  private normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('966')) return digits;
    if (digits.startsWith('0')) return '966' + digits.slice(1);
    return '966' + digits;
  }
}
