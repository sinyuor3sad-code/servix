import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PlatformPrismaClient } from '../../../shared/database/platform.client';
import { TenantClientFactory } from '../../../shared/database/tenant-client.factory';
import { WhatsAppEvolutionService } from '../whatsapp-evolution/whatsapp-evolution.service';

/**
 * AI Reception Expirer — Cron job that expires pending actions after their timeout.
 *
 * Runs every 5 minutes. For each tenant with WhatsApp instances:
 *   1. Find AIPendingActions where status=awaiting_manager AND expiresAt < now()
 *   2. Mark them as expired
 *   3. Send apology message to the customer
 */
@Injectable()
export class AIReceptionExpirer {
  private readonly logger = new Logger(AIReceptionExpirer.name);

  constructor(
    private readonly platformDb: PlatformPrismaClient,
    private readonly tenantFactory: TenantClientFactory,
    private readonly evolutionService: WhatsAppEvolutionService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleExpiredActions(): Promise<void> {
    try {
      // Get all tenants with active WhatsApp instances
      const instances = await this.platformDb.whatsAppInstance.findMany({
        where: { status: 'connected' },
        include: {
          tenant: { select: { id: true, databaseName: true, status: true } },
        },
      });

      for (const instance of instances) {
        if (!instance.tenant || (instance.tenant.status !== 'active' && instance.tenant.status !== 'trial')) {
          continue;
        }

        try {
          await this.expireForTenant(
            instance.tenant.databaseName,
            instance.instanceName,
            instance.instanceToken,
          );
        } catch (err) {
          this.logger.error(
            `Expirer error for tenant ${instance.tenant.id}: ${(err as Error).message}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(`Expirer cron failed: ${(err as Error).message}`);
    }
  }

  private async expireForTenant(
    databaseName: string,
    instanceName: string,
    instanceToken: string,
  ): Promise<void> {
    const tenantDb = this.tenantFactory.getTenantClient(databaseName) as any;

    // Find expired actions
    const expired = await tenantDb.aIPendingAction.findMany({
      where: {
        status: 'awaiting_manager',
        expiresAt: { lt: new Date() },
      },
    });

    if (expired.length === 0) return;

    this.logger.log(`⏰ Expiring ${expired.length} actions in ${databaseName}`);

    for (const action of expired) {
      // Mark as expired
      await tenantDb.aIPendingAction.update({
        where: { id: action.id },
        data: { status: 'expired', resolvedAt: new Date() },
      });

      // Notify customer
      try {
        await this.evolutionService.sendText({
          instanceName,
          instanceToken,
          to: action.customerPhone,
          message: 'نعتذر، لم نتمكن من تأكيد طلبك في الوقت المحدد. يرجى التواصل مع الصالون مباشرة لترتيب موعد. 🙏',
          delayMs: Math.floor(1000 + Math.random() * 2000),
        });
      } catch (err) {
        this.logger.error(`Failed to notify ${action.customerPhone}: ${(err as Error).message}`);
      }
    }
  }
}
