import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantClientFactory } from '../../../shared/database/tenant-client.factory';
import { PlatformPrismaClient } from '../../../shared/database/platform.client';
import { CacheService } from '../../../shared/cache/cache.service';
import { WhatsAppEvolutionService } from '../whatsapp-evolution/whatsapp-evolution.service';
import { WhatsAppAntiBanService } from '../whatsapp-evolution/whatsapp-anti-ban.service';
import { FeaturesService } from '../../../core/features/features.service';
import { AIContextBuilder } from './ai-context.builder';
import { N8nClient } from './n8n.client';
import type { TenantPrismaClient } from '../../../shared/types';

// ─────────────────── Constants ───────────────────

const MAX_CONVERSATION_MESSAGES = 10;
const REPLY_COOLDOWN_PREFIX = 'servix:ai_reception_cd:';
const REPLY_COOLDOWN_SECONDS = 3;
const DEFAULT_APPROVAL_TIMEOUT_MINUTES = 30;

/**
 * AI Reception Service — Main orchestrator for the smart receptionist.
 *
 * Flow:
 *  1. Upsert conversation (append user message)
 *  2. Build salon context via AIContextBuilder
 *  3. Call n8n workflow (Gemini) via N8nClient
 *  4. Route response:
 *     - proposedAction present → create AIPendingAction + notify manager + interim reply
 *     - no action → send reply directly to customer
 */
@Injectable()
export class AIReceptionService {
  private readonly logger = new Logger(AIReceptionService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly platformDb: PlatformPrismaClient,
    private readonly tenantFactory: TenantClientFactory,
    private readonly cache: CacheService,
    private readonly features: FeaturesService,
    private readonly evolutionService: WhatsAppEvolutionService,
    private readonly antiBan: WhatsAppAntiBanService,
    private readonly contextBuilder: AIContextBuilder,
    private readonly n8n: N8nClient,
  ) {}

  /**
   * Handle an incoming customer message — main entry point.
   * Called from the webhook controller (fire-and-forget).
   */
  async handleCustomerMessage(params: {
    tenantId: string;
    databaseName: string;
    instanceName: string;
    instanceToken: string;
    phone: string;
    text: string;
  }): Promise<void> {
    const { tenantId, databaseName, instanceName, instanceToken, phone, text } = params;

    this.logger.log(`📨 AI Reception: ${phone} → "${text.slice(0, 60)}..."`);

    // ── Per-phone cooldown ──
    const cooldownKey = `${REPLY_COOLDOWN_PREFIX}${instanceName}:${phone}`;
    const count = await this.cache.incrementRateLimit(cooldownKey, REPLY_COOLDOWN_SECONDS);
    if (count > 1) {
      this.logger.debug(`⏳ Cooldown active for ${phone} — skipping`);
      return;
    }

    const tenantDb = this.tenantFactory.getTenantClient(databaseName) as unknown as TenantPrismaClient;

    // ── 1. Upsert conversation (append user message) ──
    const now = new Date();
    const conversation = await this.upsertConversation(tenantDb, phone, {
      role: 'user',
      text,
      ts: now.toISOString(),
    });

    // ── 2. Build salon context ──
    const salonContext = await this.contextBuilder.buildForTenant(databaseName, phone);

    // ── 3. Get AI settings ──
    const settings = await this.getAISettings(tenantDb);

    // ── 4. Get conversation history (last N messages) ──
    const history = (conversation.messages as Array<{ role: string; text: string; ts: string }>)
      .slice(-MAX_CONVERSATION_MESSAGES);

    // ── 5. Call n8n (Gemini) ──
    const response = await this.n8n.callAIReception({
      tenantId,
      phone,
      message: text,
      salonContext,
      history: history as Array<{ role: 'user' | 'assistant'; text: string; ts: string }>,
      tone: (settings.ai_tone as 'formal' | 'friendly') || 'friendly',
      systemPrompt: settings.ai_system_prompt_override || undefined,
    });

    // ── 6. Route response ──
    if (response.proposedAction) {
      await this.handleProposedAction({
        tenantDb,
        tenantId,
        instanceName,
        instanceToken,
        phone,
        response,
        settings,
        conversationId: conversation.id,
      });
    } else {
      // Direct reply — no manager approval needed
      await this.sendReply(instanceName, instanceToken, phone, response.reply);
    }

    // ── 7. Append assistant message to conversation ──
    await this.upsertConversation(tenantDb, phone, {
      role: 'assistant',
      text: response.reply,
      ts: new Date().toISOString(),
    });
  }

  // ═══════════════════════════════════════════
  // Proposed Action → Manager Approval Flow
  // ═══════════════════════════════════════════

  private async handleProposedAction(params: {
    tenantDb: TenantPrismaClient;
    tenantId: string;
    instanceName: string;
    instanceToken: string;
    phone: string;
    response: { reply: string; proposedAction: NonNullable<{ type: string; payload: Record<string, unknown> }> };
    settings: Record<string, string>;
    conversationId: string;
  }): Promise<void> {
    const { tenantDb, tenantId, instanceName, instanceToken, phone, response, settings, conversationId } = params;

    const managerPhone = settings.ai_manager_phone;
    if (!managerPhone) {
      this.logger.warn(`No manager phone configured for tenant ${tenantId} — sending fallback`);
      await this.sendReply(
        instanceName, instanceToken, phone,
        'عذراً، الصالون لم يكمل إعداد الاستقبال الذكي بعد. يرجى التواصل مباشرة. 🙏',
      );
      return;
    }

    // Create pending action
    const timeoutMinutes = parseInt(settings.ai_approval_timeout_minutes || String(DEFAULT_APPROVAL_TIMEOUT_MINUTES), 10);
    const expiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000);

    const action = await (tenantDb as any).aIPendingAction.create({
      data: {
        conversationId,
        type: response.proposedAction.type as any,
        payload: response.proposedAction.payload,
        customerPhone: phone,
        expiresAt,
      },
    });

    this.logger.log(`📋 Created pending action #${action.id} (${response.proposedAction.type}) for ${phone}`);

    // Build manager notification
    const payload = response.proposedAction.payload;
    const serviceName = (payload.serviceName as string) || 'خدمة';
    const date = (payload.date as string) || 'غير محدد';
    const time = (payload.time as string) || 'غير محدد';
    const clientName = (payload.clientName as string) || phone;

    const typeLabel =
      response.proposedAction.type === 'book_appointment' ? 'حجز' :
      response.proposedAction.type === 'cancel_appointment' ? 'إلغاء' :
      'تعديل';

    const managerMessage =
      `🔔 طلب #${action.id}\n\n` +
      `${typeLabel}: ${serviceName}\n` +
      `العميل: ${clientName}\n` +
      `التاريخ: ${date}\n` +
      `الوقت: ${time}\n\n` +
      `رد بـ:\n` +
      `• *موافق ${action.id}* للقبول\n` +
      `• *رفض ${action.id}* للرفض`;

    // Send to manager
    await this.sendReply(instanceName, instanceToken, managerPhone, managerMessage);

    // Send interim reply to customer
    await this.sendReply(instanceName, instanceToken, phone, response.reply);
  }

  // ═══════════════════════════════════════════
  // Conversation Management
  // ═══════════════════════════════════════════

  private async upsertConversation(
    tenantDb: TenantPrismaClient,
    phone: string,
    newMessage: { role: string; text: string; ts: string },
  ) {
    const existing = await (tenantDb as any).aIConversation.findUnique({
      where: { phone },
    });

    if (existing) {
      const messages = (existing.messages as Array<unknown>) || [];
      messages.push(newMessage);
      // Keep only last N messages (conversation rotation per Gotcha B)
      const trimmed = messages.slice(-MAX_CONVERSATION_MESSAGES);

      return (tenantDb as any).aIConversation.update({
        where: { phone },
        data: {
          messages: trimmed,
          lastActiveAt: new Date(),
        },
      });
    }

    return (tenantDb as any).aIConversation.create({
      data: {
        phone,
        messages: [newMessage],
        lastActiveAt: new Date(),
      },
    });
  }

  // ═══════════════════════════════════════════
  // AI Settings
  // ═══════════════════════════════════════════

  private async getAISettings(tenantDb: TenantPrismaClient): Promise<Record<string, string>> {
    try {
      const settings = await (tenantDb as any).setting.findMany({
        where: {
          key: {
            in: [
              'ai_reception_enabled',
              'ai_manager_phone',
              'ai_tone',
              'ai_system_prompt_override',
              'ai_approval_timeout_minutes',
            ],
          },
        },
      });

      const result: Record<string, string> = {};
      for (const s of settings) {
        result[s.key] = s.value;
      }
      return result;
    } catch {
      return {};
    }
  }

  // ═══════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════

  private async sendReply(
    instanceName: string,
    instanceToken: string,
    to: string,
    message: string,
  ): Promise<void> {
    try {
      await this.evolutionService.sendText({
        instanceName,
        instanceToken,
        to,
        message,
        delayMs: this.randomDelay(),
      });
    } catch (err) {
      this.logger.error(`Failed to send reply to ${to}: ${(err as Error).message}`);
    }
  }

  private randomDelay(): number {
    return Math.floor(1500 + Math.random() * 3000);
  }
}
