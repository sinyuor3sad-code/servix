import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CacheService } from '../../../shared/cache/cache.service';
import { PlatformPrismaClient } from '../../../shared/database/platform.client';
import { TenantClientFactory } from '../../../shared/database/tenant-client.factory';
import { WhatsAppEvolutionService } from '../whatsapp-evolution/whatsapp-evolution.service';
import { AIReceptionSettingsService } from './ai-reception-settings.service';
import type { TenantPrismaClient } from '../../../shared/types';

const FOLLOW_UP_MIN_MINUTES = 20;
const FOLLOW_UP_MAX_MINUTES = 30;
const FOLLOW_UP_REPLY = 'هلا! لسه مهتمة بالحجز؟ أقدر أساعدك لو تبين 😊';
const RE_ENGAGEMENT_FLAG_PREFIX = 'servix:re_engagement_run:';
const RE_ENGAGEMENT_TTL_SECONDS = 24 * 60 * 60;

const ACTIVE_BOOKING_STEPS = new Set([
  'ask_service',
  'ask_date',
  'ask_time',
  'ask_customer_name',
  'show_summary',
  'ask_confirm_send_request',
]);

interface ConversationRow {
  id: string;
  phone: string;
  state: unknown;
  messages: unknown;
  lastActiveAt: Date;
}

/**
 * Proactive nudges for the AI reception:
 *   - Follow-up: if a customer dropped off mid-booking, send one polite ping.
 *   - Re-engagement: placeholder for win-back campaigns (template messages
 *     are paid + need 24h-window exemption, so we only log intent for now).
 */
@Injectable()
export class AIProactiveService {
  private readonly logger = new Logger(AIProactiveService.name);

  constructor(
    private readonly cache: CacheService,
    private readonly platformDb: PlatformPrismaClient,
    private readonly tenantFactory: TenantClientFactory,
    private readonly evolutionService: WhatsAppEvolutionService,
    private readonly receptionSettings: AIReceptionSettingsService,
  ) {}

  // ═══════════════════════════════════════════
  // Follow-up — fires every 10 minutes
  // ═══════════════════════════════════════════

  @Cron(CronExpression.EVERY_10_MINUTES)
  async checkPendingFollowUps(): Promise<void> {
    try {
      const instances = await this.platformDb.whatsAppInstance.findMany({
        where: { status: 'connected' },
        include: { tenant: { select: { id: true, databaseName: true, status: true } } },
      });

      for (const instance of instances) {
        const tenant = instance.tenant;
        if (!tenant || (tenant.status !== 'active' && tenant.status !== 'trial')) continue;

        try {
          await this.followUpForTenant(
            tenant.id,
            tenant.databaseName,
            instance.instanceName,
            instance.instanceToken,
          );
        } catch (err) {
          this.logger.error(`Follow-up failed for tenant ${tenant.id}: ${(err as Error).message}`);
        }
      }
    } catch (err) {
      this.logger.error(`checkPendingFollowUps cron failed: ${(err as Error).message}`);
    }
  }

  private async followUpForTenant(
    tenantId: string,
    databaseName: string,
    instanceName: string,
    instanceToken: string,
  ): Promise<void> {
    const tenantDb = this.tenantFactory.getTenantClient(databaseName) as unknown as TenantPrismaClient;
    const settings = await this.receptionSettings.get(tenantDb, tenantId);

    if (!settings.aiReceptionEnabled || !settings.proactiveFollowUpEnabled) return;
    if (settings.mode !== 'full') return; // Only full mode collects bookings

    const now = Date.now();
    const startCutoff = new Date(now - FOLLOW_UP_MAX_MINUTES * 60 * 1000);
    const endCutoff = new Date(now - FOLLOW_UP_MIN_MINUTES * 60 * 1000);

    const candidates = await (tenantDb as any).aIConversation.findMany({
      where: {
        lastActiveAt: { gte: startCutoff, lte: endCutoff },
      },
      take: 50,
      orderBy: { lastActiveAt: 'asc' },
    }) as ConversationRow[];

    for (const conversation of candidates) {
      if (!this.shouldFollowUp(conversation)) continue;

      try {
        await this.evolutionService.sendText({
          instanceName,
          instanceToken,
          to: conversation.phone,
          message: FOLLOW_UP_REPLY,
          delayMs: Math.floor(1000 + Math.random() * 2000),
        });

        await this.markFollowUpSent(tenantDb, conversation);
        this.logger.log(`📩 Follow-up sent to ${conversation.phone} (tenant=${tenantId})`);
      } catch (err) {
        this.logger.error(
          `Follow-up send failed to ${conversation.phone}: ${(err as Error).message}`,
        );
      }
    }
  }

  private shouldFollowUp(conversation: ConversationRow): boolean {
    const state = (conversation.state && typeof conversation.state === 'object' && !Array.isArray(conversation.state))
      ? conversation.state as Record<string, unknown>
      : {};

    const bookingStep = String(state.bookingStep || '');
    if (!ACTIVE_BOOKING_STEPS.has(bookingStep)) return false;
    if (state.followUpSentAt) return false; // already nudged once
    if (state.doNotDisturb) return false;
    if (state.awaitingOwnerApproval) return false; // ball is on the salon's side

    const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
    const last = messages[messages.length - 1];
    if (!last || typeof last !== 'object') return false;
    const lastRole = (last as { role?: unknown }).role;
    return lastRole === 'assistant'; // only nudge if customer went silent
  }

  private async markFollowUpSent(
    tenantDb: TenantPrismaClient,
    conversation: ConversationRow,
  ): Promise<void> {
    const state = (conversation.state && typeof conversation.state === 'object' && !Array.isArray(conversation.state))
      ? conversation.state as Record<string, unknown>
      : {};

    await (tenantDb as any).aIConversation.update({
      where: { id: conversation.id },
      data: {
        state: {
          ...state,
          followUpSentAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    });
  }

  // ═══════════════════════════════════════════
  // Re-engagement — daily, placeholder
  // ═══════════════════════════════════════════

  /**
   * Win-back loop. Real implementation requires WhatsApp template messages
   * (Meta's paid Business API path) because the 24h customer-initiated window
   * has long since closed. For now we log + record per-tenant intent in Redis
   * so a future template-aware sender can pick it up.
   */
  @Cron('0 10 * * *')
  async checkReEngagement(): Promise<void> {
    try {
      const instances = await this.platformDb.whatsAppInstance.findMany({
        where: { status: 'connected' },
        include: { tenant: { select: { id: true, databaseName: true, status: true } } },
      });

      for (const instance of instances) {
        const tenant = instance.tenant;
        if (!tenant || (tenant.status !== 'active' && tenant.status !== 'trial')) continue;

        const tenantDb = this.tenantFactory.getTenantClient(tenant.databaseName) as unknown as TenantPrismaClient;
        const settings = await this.receptionSettings.get(tenantDb, tenant.id).catch(() => null);
        if (!settings?.proactiveReEngagementEnabled) continue;

        const flagKey = `${RE_ENGAGEMENT_FLAG_PREFIX}${tenant.id}:${new Date().toISOString().slice(0, 10)}`;
        const alreadyRan = await this.cache.getJson<{ ranAt: string }>(flagKey);
        if (alreadyRan) continue;

        await this.cache.setJson(flagKey, { ranAt: new Date().toISOString() }, RE_ENGAGEMENT_TTL_SECONDS);
        this.logger.log(
          `[placeholder] Re-engagement window for tenant ${tenant.id} — would scan client_memory and send template messages here.`,
        );
      }
    } catch (err) {
      this.logger.error(`checkReEngagement cron failed: ${(err as Error).message}`);
    }
  }
}
