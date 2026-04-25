import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PlatformPrismaClient } from '../../../shared/database/platform.client';
import { TenantClientFactory } from '../../../shared/database/tenant-client.factory';
import { WhatsAppEvolutionService } from '../whatsapp-evolution/whatsapp-evolution.service';

/**
 * AI Reception Expirer — Cron job that expires pending actions after their timeout.
 *
 * Runs every 5 minutes. For each tenant with WhatsApp instances:
 *   1. Atomically claim expired AIPendingActions.
 *   2. Mark them as expired + timeout-notified.
 *   3. Send apology message to the customer only for claimed rows.
 */
@Injectable()
export class AIReceptionExpirer {
  private readonly logger = new Logger(AIReceptionExpirer.name);
  private static readonly EXPIRE_BATCH_SIZE = 50;

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

    const expired = await this.claimExpiredActions(tenantDb);

    if (expired.length === 0) return;

    this.logger.log(`⏰ Claimed ${expired.length} expired actions in ${databaseName}`);

    for (const action of expired) {
      await this.markConversationExpired(tenantDb, action.conversationId);

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

  private async claimExpiredActions(
    tenantDb: any,
  ): Promise<Array<{ id: number; customerPhone: string; conversationId: string }>> {
    return tenantDb.$queryRawUnsafe(
      `
        UPDATE "ai_pending_actions"
        SET
          "status" = 'expired'::"AIPendingActionStatus",
          "resolved_at" = NOW(),
          "timeout_notification_sent" = TRUE,
          "timeout_notified_at" = NOW()
        WHERE "id" IN (
          SELECT "id"
          FROM "ai_pending_actions"
          WHERE "status" = 'awaiting_manager'::"AIPendingActionStatus"
            AND "expires_at" < NOW()
            AND "timeout_notification_sent" = FALSE
            AND "do_not_disturb" = FALSE
          ORDER BY "expires_at" ASC
          LIMIT ${AIReceptionExpirer.EXPIRE_BATCH_SIZE}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING "id", "customer_phone" AS "customerPhone", "conversation_id" AS "conversationId"
      `,
    );
  }

  private async markConversationExpired(
    tenantDb: any,
    conversationId: string,
  ): Promise<void> {
    const conversation = await tenantDb.aIConversation.findUnique({
      where: { id: conversationId },
    });
    const state = conversation?.state && typeof conversation.state === 'object' && !Array.isArray(conversation.state)
      ? conversation.state as Record<string, unknown>
      : {};

    await tenantDb.aIConversation.update({
      where: { id: conversationId },
      data: {
        state: {
          ...state,
          currentIntent: 'booking',
          bookingStep: 'expired',
          awaitingOwnerApproval: false,
          timeoutNotificationSent: true,
          updatedAt: new Date().toISOString(),
        },
      },
    });
  }
}
