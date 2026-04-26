import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantClientFactory } from '../../../shared/database/tenant-client.factory';
import { PlatformPrismaClient } from '../../../shared/database/platform.client';
import { CacheService } from '../../../shared/cache/cache.service';
import { WhatsAppEvolutionService } from '../whatsapp-evolution/whatsapp-evolution.service';
import { WhatsAppAntiBanService } from '../whatsapp-evolution/whatsapp-anti-ban.service';
import { WhatsAppRichMediaService } from '../whatsapp-evolution/whatsapp-rich-media.service';
import { FeaturesService } from '../../../core/features/features.service';
import { GeminiService, hasProposedAction } from '../../../shared/ai/gemini.service';
import { AIProviderService, AIProviderResponse } from '../../../shared/ai/ai-provider.service';
import { AIContextBuilder, SalonContextForAI } from './ai-context.builder';
import { AIReceptionBookingService, AvailabilityResult } from './ai-reception-booking.service';
import { AIReceptionRuntimeSettings, AIReceptionSettingsService } from './ai-reception-settings.service';
import { AISafetyNetService } from './ai-safety-net.service';
import { AIClientMemoryService } from './ai-client-memory.service';
import { AISemanticCacheService } from './ai-semantic-cache.service';
import { AIAnalyticsService, AIModelUsed } from './ai-analytics.service';
import type { TenantPrismaClient } from '../../../shared/types';

// ─────────────────── Constants ───────────────────

const MAX_CONVERSATION_MESSAGES = 10;
const REPLY_COOLDOWN_PREFIX = 'servix:ai_reception_cd:';
const REPLY_COOLDOWN_SECONDS = 3;
const PENDING_APPROVAL_REPLY = 'وصل طلبك، بانتظار تأكيد الصالون. بنرسل لك التأكيد النهائي هنا.';
const STOP_FOLLOW_UP_REPLY = 'تم، أوقفنا المتابعة لهذا الطلب.';
const MSG_COUNTER_PREFIX = 'servix:ai_msg_count:';
// 35 days = whole month + buffer; Redis auto-resets the bucket each month.
const MSG_COUNTER_TTL_SECONDS = 35 * 24 * 60 * 60;
const TIER_BASIC_REPLY = 'حياك الله! للحجز أو الاستفسار تواصلي مع الصالون مباشرة.';
const TIER_LIMIT_REACHED_REPLY = 'عذراً، المساعد غير متاح حالياً. تواصلي مع الصالون مباشرة.';

type StopFollowUpResult = 'not_stop' | 'stopped' | 'no_active_request';
type ReceptionServiceItem = SalonContextForAI['services'][number];
type EscalationType =
  | 'complaint'
  | 'unclear'
  | 'special_discount'
  | 'unavailable_service'
  | 'billing_issue'
  | 'angry_customer'
  | 'abuse_or_threat';

type BookingStep =
  | 'idle'
  | 'ask_service'
  | 'ask_date'
  | 'ask_time'
  | 'ask_customer_name'
  | 'show_summary'
  | 'ask_confirm_send_request'
  | 'awaiting_owner_approval'
  | 'awaiting_customer_alternative_confirmation'
  | 'awaiting_final_fixation'
  | 'completed'
  | 'cancelled'
  | 'expired';

interface AIConversationState {
  currentIntent?: string;
  bookingStep?: BookingStep;
  selectedServiceId?: string;
  selectedServiceName?: string;
  selectedDate?: string;
  selectedTime?: string;
  selectedEmployeeId?: string;
  customerName?: string;
  quotedPrice?: number;
  discountApplied?: boolean;
  requestId?: number;
  appointmentId?: string;
  awaitingOwnerApproval?: boolean;
  alternativeTime?: string;
  lastOwnerDecision?: 'approved' | 'rejected' | 'alternative';
  timeoutNotificationSent?: boolean;
  doNotDisturb?: boolean;
  tonePreference?: 'formal' | 'friendly';
  lastBotQuestion?: string;
  failedUnderstandingCount?: number;
  lastUserMessageAt?: string;
  privacyMessageSent?: boolean;
  updatedAt?: string;
}

/**
 * AI Reception Service — Main orchestrator for the smart receptionist (V2).
 *
 * Flow:
 *  1. Upsert conversation (append user message)
 *  2. Build salon context via AIContextBuilder
 *  3. Call AIProviderService (GPT-5-nano/mini → Gemini fallback)
 *  4. Route response by AI's `action`:
 *     - proposedAction / submit_booking → AIPendingAction + notify manager
 *     - escalate / needs_human → handleEscalation
 *     - cancel → reset state + cancel pending actions
 *     - default → reply via WhatsApp (text / buttons / list)
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
    private readonly richMedia: WhatsAppRichMediaService,
    private readonly contextBuilder: AIContextBuilder,
    private readonly gemini: GeminiService,
    private readonly aiProvider: AIProviderService,
    private readonly safetyNet: AISafetyNetService,
    private readonly booking: AIReceptionBookingService,
    private readonly receptionSettings: AIReceptionSettingsService,
    private readonly clientMemory: AIClientMemoryService,
    private readonly semanticCache: AISemanticCacheService,
    private readonly analytics: AIAnalyticsService,
  ) {}

  /**
   * V2 entry point. Order of operations:
   *  1. Cooldown + AI-enabled check
   *  2. Upsert user message
   *  3. Build salon context + state
   *  4. Code Router fast paths (no AI call):
   *     - awaiting owner approval     → static reply
   *     - awaiting final fixation     → static reply
   *     - awaiting alt confirmation   → handleCustomerAlternativeDecision
   *  5. AI call (AIProvider with V2 envelope)
   *  6. Safety net on the reply
   *  7. Route by AI's `action`: cancel | escalate | submit_booking | answer_only/collect_info
   */
  async handleCustomerMessage(params: {
    tenantId: string;
    databaseName: string;
    instanceName: string;
    instanceToken: string;
    phone: string;
    text: string;
    voiceMetadata?: { isVoiceMessage: true; durationSeconds?: number };
  }): Promise<void> {
    const { tenantId, databaseName, instanceName, instanceToken, phone, text, voiceMetadata } = params;
    const startTime = Date.now();

    this.logger.log(
      `📨 AI Reception V2: ${phone}${voiceMetadata ? ' [voice]' : ''} → "${text.slice(0, 60)}..."`,
    );

    const tenantDb = this.tenantFactory.getTenantClient(databaseName) as unknown as TenantPrismaClient;

    const cooldownKey = `${REPLY_COOLDOWN_PREFIX}${instanceName}:${phone}`;
    const count = await this.cache.incrementRateLimit(cooldownKey, REPLY_COOLDOWN_SECONDS);
    if (count > 1) {
      this.logger.debug(`⏳ Cooldown active for ${phone} — skipping`);
      return;
    }

    const settings = await this.receptionSettings.get(tenantDb, tenantId);
    if (!settings.aiReceptionEnabled) {
      await this.sendReply(
        instanceName,
        instanceToken,
        phone,
        'الاستقبال الذكي غير مفعّل حاليًا. يرجى التواصل مع الصالون مباشرة.',
      );
      return;
    }

    const now = new Date();

    // ── Operating mode (V2 §4.1): vacation / custom short-circuit before AI ──
    const modeReply = this.resolveModeShortCircuit(settings, now);
    if (modeReply) {
      const conversation = await this.upsertConversation(tenantDb, phone, {
        role: 'user',
        text,
        ts: now.toISOString(),
      });
      void conversation;
      await this.sendAndPersistAssistant({
        tenantDb,
        instanceName,
        instanceToken,
        phone,
        reply: modeReply,
      });
      return;
    }

    // ── Tier gate (V2 §5.2): basic plan = no AI ──
    if (settings.tier === 'basic') {
      await this.upsertConversation(tenantDb, phone, { role: 'user', text, ts: now.toISOString() });
      await this.sendAndPersistAssistant({
        tenantDb,
        instanceName,
        instanceToken,
        phone,
        reply: settings.welcomeMessage || TIER_BASIC_REPLY,
      });
      return;
    }

    // ── Monthly message limit ──
    if (settings.monthlyMessageLimit > 0) {
      const used = await this.getMonthlyUsage(tenantId, now);
      if (used >= settings.monthlyMessageLimit) {
        await this.upsertConversation(tenantDb, phone, { role: 'user', text, ts: now.toISOString() });
        await this.sendAndPersistAssistant({
          tenantDb,
          instanceName,
          instanceToken,
          phone,
          reply: TIER_LIMIT_REACHED_REPLY,
        });
        this.logger.warn(`Monthly AI limit reached for tenant ${tenantId} (${used}/${settings.monthlyMessageLimit})`);
        return;
      }
    }

    const conversation = await this.upsertConversation(tenantDb, phone, {
      role: 'user',
      text,
      ts: now.toISOString(),
    });

    const salonContext = await this.contextBuilder.buildForTenant(databaseName, phone);
    let state = this.normalizeConversationState(conversation.state);

    // ── Router fast paths (code-only, no AI call) ──
    if (state.bookingStep === 'awaiting_customer_alternative_confirmation') {
      const accepted = this.isAffirmativeText(text) || this.isAlternativeAcceptedText(text);
      const rejected = this.isNegativeText(text) || this.isAlternativeRejectedText(text);
      if (accepted || rejected) {
        await this.handleCustomerAlternativeDecision({
          tenantDb,
          instanceName,
          instanceToken,
          phone,
          state,
          settings,
          accepted,
        });
        return;
      }
      const reply = state.alternativeTime
        ? `الصالون اقترح وقتًا بديلًا: ${state.alternativeTime}.\nيناسبك هذا الموعد؟`
        : 'يناسبك الوقت البديل المقترح؟';
      await this.sendAndPersistAssistant({ tenantDb, instanceName, instanceToken, phone, reply });
      return;
    }

    if (state.bookingStep === 'awaiting_owner_approval' && state.requestId) {
      const reply = 'طلبك بانتظار تأكيد الصالون.';
      await this.sendAndPersistAssistant({ tenantDb, instanceName, instanceToken, phone, reply });
      return;
    }

    if (state.bookingStep === 'awaiting_final_fixation') {
      const reply = 'موافقتك وصلت للصالون، وبانتظار تثبيت الموعد من الفريق.';
      await this.sendAndPersistAssistant({ tenantDb, instanceName, instanceToken, phone, reply });
      return;
    }

    // ── AI path ──
    const history = (conversation.messages as Array<{ role: string; text: string; ts: string }>)
      .slice(-MAX_CONVERSATION_MESSAGES, -1);
    const memoryContext = await this.clientMemory.buildMemoryContext(tenantId, phone);
    const baseStateContext = this.buildStateContextBlock(state);
    const voiceLine = voiceMetadata
      ? `\n- ملاحظة: هذه رسالة صوتية مفرّغة عبر Whisper${voiceMetadata.durationSeconds ? ` (${voiceMetadata.durationSeconds} ثانية)` : ''}، قد تحتوي أخطاء بسيطة في النص.`
      : '';
    const modeLine = settings.mode === 'reply_only'
      ? `\n- وضع التشغيل: رد فقط — الحجز معطّل. لا تقترح proposedAction أبداً، ولا تستخدم action="submit_booking". وجّه العميل لزيارة الصالون مباشرة لو سأل عن الحجز.`
      : '';
    const assistantLine = settings.assistantName
      ? `- اسم المساعد: ${settings.assistantName}`
      : '';
    const stateContext = [baseStateContext, assistantLine, voiceLine.trim(), modeLine.trim(), '', memoryContext]
      .filter(Boolean)
      .join('\n');
    const systemPrompt = this.gemini.buildReceptionV2SystemPrompt({
      salonContext,
      tone: settings.tone,
      stateContext,
      systemPromptOverride: settings.systemPromptOverride,
    });

    // ── Semantic cache — short-circuit common questions before paying for AI ──
    const cached = await this.semanticCache.findCachedResponse(tenantId, text);
    if (cached) {
      const safeCached = this.safetyNet.sanitize(cached.reply, {
        services: salonContext.services,
        settings,
      }).reply;
      await this.sendAndPersistAssistant({
        tenantDb,
        instanceName,
        instanceToken,
        phone,
        reply: safeCached,
      });
      await this.analytics.trackConversation(tenantId, {
        intent: cached.intent,
        wasEscalated: false,
        wasBooked: false,
        responseTimeMs: Date.now() - startTime,
        modelUsed: 'cached',
        wasVoice: !!voiceMetadata,
        wasCached: true,
        serviceName: null,
      });
      // Cache hits don't burn AI tokens, but they still count against the
      // monthly message budget so a runaway tenant can't bypass the limit.
      await this.incrementMessageCount(tenantId, now);
      return;
    }

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...history.map((h) => ({
        role: (h.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: h.text,
      })),
      { role: 'user' as const, content: text },
    ];

    // Tier comes from the explicit ai_tier setting (V2 §5.2). The basic plan
    // has already been short-circuited above, so only standard/premium reach
    // the model — premium picks up GPT-5-mini when the turn looks complex.
    const tier: 'standard' | 'premium' = settings.tier === 'premium' ? 'premium' : 'standard';
    const complexity = this.estimateComplexity(state, text);

    const response: AIProviderResponse = await this.aiProvider.chat({
      messages,
      complexity,
      tier,
      fallbackContext: {
        salonContext,
        phone,
        message: text,
        history: history as Array<{ role: 'user' | 'assistant'; text: string; ts: string }>,
        tone: settings.tone,
        systemPromptOverride: systemPrompt,
      },
    });

    // Persist learnings + cacheable Q/A — both are tolerant of failures so we
    // don't await-block the customer reply if Redis is down.
    await this.clientMemory.updateFromAIResponse(tenantId, phone, response).catch((err: unknown) => {
      this.logger.warn(`Memory update failed for ${phone}: ${(err as Error).message}`);
    });
    await this.semanticCache.cacheResponse(tenantId, text, response).catch((err: unknown) => {
      this.logger.warn(`Cache update failed for ${tenantId}: ${(err as Error).message}`);
    });
    // Bump monthly usage now that the AI call succeeded (or its safety-net
    // fallback ran); failures are silent — better to under-count than block.
    await this.incrementMessageCount(tenantId, now);

    const trackAnalytics = (overrides: Partial<{
      wasEscalated: boolean;
      wasBooked: boolean;
      intent: string;
    }> = {}) =>
      this.analytics.trackConversation(tenantId, {
        intent: overrides.intent ?? response.intent,
        wasEscalated: overrides.wasEscalated ?? false,
        wasBooked: overrides.wasBooked ?? false,
        responseTimeMs: Date.now() - startTime,
        modelUsed: this.modelLabel(response.modelUsed),
        wasVoice: !!voiceMetadata,
        wasCached: false,
        serviceName: response.extractedData?.serviceName ?? null,
      });

    const safe = this.safetyNet.sanitize(response.reply, {
      services: salonContext.services,
      settings,
    });
    let assistantReplyText = safe.reply;

    // Merge any data the AI extracted into conversation state (so the next
    // turn has it), even before deciding the route.
    state = this.mergeExtractedDataIntoState(state, response.extractedData, salonContext.services);

    // ── 1. cancel ──
    if (response.wantsToCancel || response.action === 'cancel') {
      const cancelled = this.resetBookingState({
        ...state,
        currentIntent: 'cancelled_by_customer',
        bookingStep: 'cancelled',
        doNotDisturb: true,
      });
      await this.persistConversationState(tenantDb, phone, cancelled);
      await this.cancelLatestAwaitingActionByCustomer(tenantDb, phone);
      const reply = assistantReplyText || STOP_FOLLOW_UP_REPLY;
      await this.sendAndPersistAssistant({ tenantDb, instanceName, instanceToken, phone, reply });
      await trackAnalytics({ intent: 'cancel' });
      return;
    }

    // ── 2. escalate ──
    const needsEscalation =
      response.needsEscalation === true ||
      response.action === 'escalate' ||
      response.intent === 'needs_human' ||
      !!(response.uncertainReason && response.uncertainReason.trim());
    if (needsEscalation) {
      await this.persistConversationState(tenantDb, phone, {
        ...state,
        currentIntent: 'needs_human',
        updatedAt: new Date().toISOString(),
      });
      await this.handleEscalation({
        tenantDb,
        tenantId,
        instanceName,
        instanceToken,
        phone,
        customerQuestion: text,
        replyToCustomer: assistantReplyText,
        uncertainReason: response.escalationReason || response.uncertainReason || 'ai_uncertain',
        escalationType: 'unclear',
        settings,
        conversationId: conversation.id,
        historyForContext: history as Array<{ role: string; text: string; ts: string }>,
        state,
      });
      await this.upsertConversation(tenantDb, phone, {
        role: 'assistant',
        text: assistantReplyText,
        ts: new Date().toISOString(),
      });
      await trackAnalytics({ wasEscalated: true });
      return;
    }

    // ── 3. submit_booking ──
    const proposedAction = response.proposedAction
      || this.buildProposedActionFromExtractedData(response.extractedData, state);
    if (proposedAction && (response.action === 'submit_booking' || hasProposedAction(response))) {
      const guardedPayload = this.applyOfficialPricingToPayload(proposedAction.payload, salonContext.services);
      const missing = this.getMissingActionReply(proposedAction.type, guardedPayload);
      if (missing) {
        await this.sendAndPersistAssistant({ tenantDb, instanceName, instanceToken, phone, reply: missing });
        await trackAnalytics();
        return;
      }

      const actionId = await this.handleProposedAction({
        tenantDb,
        tenantId,
        instanceName,
        instanceToken,
        phone,
        reply: PENDING_APPROVAL_REPLY,
        proposedAction: { ...proposedAction, payload: guardedPayload },
        settings,
        conversationId: conversation.id,
        services: salonContext.services,
      });
      await this.persistConversationState(tenantDb, phone, {
        ...state,
        currentIntent: 'booking',
        bookingStep: actionId ? 'awaiting_owner_approval' : state.bookingStep,
        requestId: actionId ?? state.requestId,
        awaitingOwnerApproval: Boolean(actionId),
        timeoutNotificationSent: false,
        updatedAt: new Date().toISOString(),
      });
      await this.upsertConversation(tenantDb, phone, {
        role: 'assistant',
        text: actionId ? PENDING_APPROVAL_REPLY : 'تعذر إرسال الطلب للصالون حاليًا.',
        ts: new Date().toISOString(),
      });
      await trackAnalytics({ wasBooked: Boolean(actionId), intent: 'book_appointment' });
      return;
    }

    // ── 4. collect_info / answer_only / general ──
    await this.persistConversationState(tenantDb, phone, state);
    await this.sendAIReply({
      tenantDb,
      instanceName,
      instanceToken,
      phone,
      reply: assistantReplyText,
      response,
      salonContext,
    });
    await trackAnalytics();
  }

  /**
   * V2: cancel intent is now detected by the AI via `wantsToCancel`. The
   * webhook still calls this for backwards compatibility, so it stays a
   * no-op — `not_stop` lets the message fall through to the AI flow.
   */
  async handleStopFollowUpRequest(_params: {
    tenantDb: TenantPrismaClient;
    instanceName: string;
    instanceToken: string;
    phone: string;
    text: string;
  }): Promise<StopFollowUpResult> {
    return 'not_stop';
  }

  // ═══════════════════════════════════════════
  // V2 Helpers — Router, prompt context, extraction
  // ═══════════════════════════════════════════

  /**
   * V2 §4.1 — bypass the AI entirely for `vacation` and `custom` modes.
   * Returns the static reply when the mode short-circuits, or null for
   * `full` / `reply_only` (which still flow through the AI, with the prompt
   * instructing the model to disable booking in `reply_only`).
   *
   * Vacation respects the [start, end] window from the existing
   * `vacation_start_date` / `vacation_end_date` settings — out-of-window
   * vacation mode falls through to normal AI handling.
   */
  private resolveModeShortCircuit(
    settings: AIReceptionRuntimeSettings,
    now: Date,
  ): string | null {
    if (settings.mode === 'vacation') {
      const start = settings.vacationStartDate ? new Date(settings.vacationStartDate) : null;
      const end = settings.vacationEndDate ? new Date(settings.vacationEndDate) : null;
      const startedOk = !start || Number.isNaN(start.getTime()) || now >= start;
      const notEndedYet = !end || Number.isNaN(end.getTime()) || now <= end;
      if (startedOk && notEndedYet) {
        return settings.vacationMessage || 'الصالون مغلق حالياً، نرحّب بك بعد العودة.';
      }
      return null;
    }
    if (settings.mode === 'custom') {
      return settings.customRedirectMessage
        || 'تواصلي معنا مباشرة لأي طلب، شكراً لك.';
    }
    return null;
  }

  /** State block injected into the AI's system prompt (V2 plan §1.4). */
  private buildStateContextBlock(state: AIConversationState): string {
    return [
      `- المرحلة: ${state.bookingStep || 'بداية'}`,
      `- الخدمة المختارة: ${state.selectedServiceName || 'لم تُختر'}`,
      `- التاريخ: ${state.selectedDate || 'لم يُحدد'}`,
      `- الوقت: ${state.selectedTime || 'لم يُحدد'}`,
      `- اسم العميل: ${state.customerName || 'غير معروف'}`,
      `- رقم الطلب: ${state.requestId || 'لا يوجد'}`,
      `- ينتظر موافقة: ${state.awaitingOwnerApproval ? 'نعم' : 'لا'}`,
    ].join('\n');
  }

  /** V2 plan §1.3 — when to bump to GPT-5-mini instead of GPT-5-nano. */
  private estimateComplexity(
    state: AIConversationState,
    text: string,
  ): 'simple' | 'complex' {
    if ((state.failedUnderstandingCount ?? 0) > 0) return 'complex';
    if (text.length > 200) return 'complex';
    return 'simple';
  }

  /** Map AIProvider's `modelUsed` string into the analytics enum. */
  private modelLabel(modelUsed?: string): AIModelUsed {
    if (!modelUsed) return 'unknown';
    if (modelUsed.includes('mini')) return 'mini';
    if (modelUsed.includes('nano')) return 'nano';
    if (modelUsed.includes('gemini')) return 'gemini';
    return 'unknown';
  }

  /**
   * Monthly message counter — Redis-backed with a 35-day TTL so the bucket
   * resets itself at the start of each calendar month without a cron.
   */
  private monthlyCounterKey(tenantId: string, when: Date): string {
    const yyyy = when.getUTCFullYear();
    const mm = String(when.getUTCMonth() + 1).padStart(2, '0');
    return `${MSG_COUNTER_PREFIX}${tenantId}:${yyyy}-${mm}`;
  }

  private async getMonthlyUsage(tenantId: string, when: Date): Promise<number> {
    const value = await this.cache.getJson<number>(this.monthlyCounterKey(tenantId, when));
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }

  private async incrementMessageCount(tenantId: string, when: Date): Promise<void> {
    try {
      await this.cache.incrementInt(this.monthlyCounterKey(tenantId, when), MSG_COUNTER_TTL_SECONDS);
    } catch (err) {
      this.logger.warn(`Monthly counter increment failed for ${tenantId}: ${(err as Error).message}`);
    }
  }

  /**
   * Folds the model's `extractedData` into the conversation state so the next
   * turn already has it. Service is matched against the official catalogue;
   * unknown names are ignored so the model can't invent services.
   */
  private mergeExtractedDataIntoState(
    state: AIConversationState,
    data: AIProviderResponse['extractedData'],
    services: ReceptionServiceItem[],
  ): AIConversationState {
    if (!data) return state;
    const next: AIConversationState = { ...state, updatedAt: new Date().toISOString() };
    if (data.serviceName) {
      const matched = this.findServiceInText(data.serviceName, services);
      if (matched) {
        next.selectedServiceId = matched.id;
        next.selectedServiceName = matched.name;
        next.quotedPrice = matched.price;
      }
    }
    if (data.date) next.selectedDate = data.date;
    if (data.time) next.selectedTime = data.time;
    if (data.customerName) next.customerName = data.customerName;
    return next;
  }

  /**
   * If the model emitted `extractedData` but no `proposedAction`, build the
   * action from state + extracted fields so a complete booking can still be
   * submitted on this turn.
   */
  private buildProposedActionFromExtractedData(
    data: AIProviderResponse['extractedData'],
    state: AIConversationState,
  ): { type: string; payload: Record<string, unknown> } | null {
    const merged = {
      serviceName: data?.serviceName || state.selectedServiceName,
      date: data?.date || state.selectedDate,
      time: data?.time || state.selectedTime,
      clientName: data?.customerName || state.customerName,
    };
    if (!merged.serviceName || !merged.date || !merged.time) return null;
    return {
      type: 'book_appointment',
      payload: {
        serviceId: state.selectedServiceId,
        serviceName: merged.serviceName,
        date: merged.date,
        time: merged.time,
        appointmentDate: merged.date,
        appointmentStartTime: merged.time,
        clientName: merged.clientName,
        price: state.quotedPrice,
        quotedPrice: state.quotedPrice,
        discountApplied: false,
      },
    };
  }

  /** Send a reply and append it to the conversation in one shot. */
  private async sendAndPersistAssistant(params: {
    tenantDb: TenantPrismaClient;
    instanceName: string;
    instanceToken: string;
    phone: string;
    reply: string;
  }): Promise<void> {
    const { tenantDb, instanceName, instanceToken, phone, reply } = params;
    await this.sendReply(instanceName, instanceToken, phone, reply);
    await this.upsertConversation(tenantDb, phone, {
      role: 'assistant',
      text: reply,
      ts: new Date().toISOString(),
    });
  }

  /**
   * Sends the AI's reply choosing the WhatsApp surface based on `messageType`:
   *   - "buttons" + non-empty buttons → WhatsApp quick-reply buttons (max 3)
   *   - "list"                       → interactive list of services from salon context
   *   - anything else                → plain text
   *
   * Falls back to plain text if the chosen surface fails or required fields
   * are missing — the customer must always get *some* reply.
   */
  private async sendAIReply(params: {
    tenantDb: TenantPrismaClient;
    instanceName: string;
    instanceToken: string;
    phone: string;
    reply: string;
    response: AIProviderResponse;
    salonContext: SalonContextForAI;
  }): Promise<void> {
    const { tenantDb, instanceName, instanceToken, phone, reply, response, salonContext } = params;
    const { messageType, buttons } = response;
    const persistAssistantText = () => this.upsertConversation(tenantDb, phone, {
      role: 'assistant',
      text: reply,
      ts: new Date().toISOString(),
    });

    if (messageType === 'buttons' && buttons && buttons.length > 0) {
      try {
        await this.richMedia.sendButtons({
          instanceName,
          instanceToken,
          to: phone,
          body: reply,
          buttons,
          delayMs: this.randomDelay(),
        });
        await persistAssistantText();
        return;
      } catch (err) {
        this.logger.warn(`Buttons send failed for ${phone}, falling back to text: ${(err as Error).message}`);
      }
    }

    if (messageType === 'list') {
      const services = salonContext.services.slice(0, 10);
      if (services.length > 0) {
        try {
          await this.richMedia.sendList({
            instanceName,
            instanceToken,
            to: phone,
            body: reply,
            buttonText: 'عرض الخدمات',
            sections: [{
              title: 'خدماتنا',
              rows: services.map((s, i) => ({
                rowId: `service_${s.id || i}`,
                title: s.name,
                description: this.formatPrice(s.price),
              })),
            }],
            delayMs: this.randomDelay(),
          });
          await persistAssistantText();
          return;
        } catch (err) {
          this.logger.warn(`List send failed for ${phone}, falling back to text: ${(err as Error).message}`);
        }
      } else {
        this.logger.debug(`AI requested list for ${phone} but no services available — sending text`);
      }
    }

    await this.sendAndPersistAssistant({ tenantDb, instanceName, instanceToken, phone, reply });
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
    reply: string;
    proposedAction: { type: string; payload: Record<string, unknown> };
    settings: AIReceptionRuntimeSettings;
    conversationId: string;
    services: ReceptionServiceItem[];
  }): Promise<number | null> {
    const { tenantDb, tenantId, instanceName, instanceToken, phone, reply, proposedAction, settings, conversationId, services } = params;

    const managerPhone = settings.aiManagerPhone;
    if (!managerPhone) {
      this.logger.warn(`No manager phone configured for tenant ${tenantId} — sending fallback`);
      await this.sendReply(
        instanceName, instanceToken, phone,
        'عذراً، الصالون لم يكمل إعداد الاستقبال الذكي بعد. يرجى التواصل مباشرة. 🙏',
      );
      return null;
    }

    // Create pending action
    const expiresAt = new Date(Date.now() + settings.managerApprovalTimeoutMinutes * 60 * 1000);

    const action = await (tenantDb as any).aIPendingAction.create({
      data: {
        conversationId,
        type: proposedAction.type as any,
        payload: this.applyOfficialPricingToPayload(proposedAction.payload, services),
        customerPhone: phone,
        expiresAt,
      },
    });

    this.logger.log(`📋 Created pending action #${action.id} (${proposedAction.type}) for ${phone}`);

    // Build manager notification
    const payload = action.payload as Record<string, unknown>;
    const serviceName = (payload.serviceName as string) || 'خدمة';
    const date = (payload.date as string) || 'غير محدد';
    const time = (payload.time as string) || 'غير محدد';
    const clientName = (payload.clientName as string) || phone;
    const price = payload.quotedPrice ?? payload.price;

    const managerMessage =
      `طلب حجز جديد #${action.id}\n\n` +
      `الخدمة: ${serviceName}\n` +
      `العميل: ${clientName}\n` +
      `التاريخ: ${date}\n` +
      `الوقت: ${time}\n` +
      (price !== undefined && price !== null ? `السعر: ${this.formatPrice(Number(price))}\n` : '') +
      `\n` +
      `للقبول وتثبيت الموعد: موافق ${action.id}\n` +
      `للرفض: رفض ${action.id}\n` +
      `لاقتراح وقت بديل: بديل ${action.id} [الوقت]`;

    // Send to manager
    await this.sendReply(instanceName, instanceToken, managerPhone, managerMessage);

    // Send interim reply to customer
    await this.sendReply(instanceName, instanceToken, phone, reply);
    return action.id as number;
  }

  // ═══════════════════════════════════════════
  // Escalation (needs_human) → Owner Training Flow
  // ═══════════════════════════════════════════

  /**
   * When the AI couldn't confidently answer, we:
   *  1. Persist an AIEscalation row (pending).
   *  2. Send the customer the AI's stall message (natural, non-bot-sounding).
   *  3. Ping the owner on her personal WhatsApp with the question + context.
   *     Her next plain-text message (not "موافق"/"رفض") is captured by
   *     ManagerReplyHandler as the answer — forwarded to the customer AND
   *     saved as an AIKnowledgeSnippet so future similar questions self-serve.
   */
  private async handleEscalation(params: {
    tenantDb: TenantPrismaClient;
    tenantId: string;
    instanceName: string;
    instanceToken: string;
    phone: string;
    customerQuestion: string;
    replyToCustomer: string;
    uncertainReason: string | null;
    escalationType: EscalationType;
    settings: AIReceptionRuntimeSettings;
    conversationId: string;
    historyForContext: Array<{ role: string; text: string; ts: string }>;
    state?: AIConversationState;
  }): Promise<void> {
    const {
      tenantDb, tenantId, instanceName, instanceToken, phone,
      customerQuestion, replyToCustomer, uncertainReason, settings,
      conversationId, historyForContext, escalationType, state,
    } = params;

    const managerPhone = settings.aiManagerPhone;

    // Build a short context excerpt (last 4 messages before the question).
    const recent = historyForContext
      .slice(-5, -1)
      .map(m => `${m.role === 'user' ? 'العميلة' : 'نحن'}: ${m.text}`)
      .join('\n');

    // Persist the escalation (even if manager phone is missing — so the owner
    // can see it later in the dashboard).
    const escalation = await this.upsertEscalationRecord({
      tenantDb,
      conversationId,
      phone,
      customerQuestion,
      customerContext: recent || null,
      uncertainReason,
      escalationType,
      state,
      managerPhone,
      cooldownMinutes: settings.escalationCooldownMinutes,
    });

    this.logger.log(`Escalation #${escalation.id} ${escalation.isDuplicate ? 'updated' : 'created'} - type: ${escalationType}`);

    // Send stall reply to customer (must feel natural — not "I don't know").
    await this.sendReply(instanceName, instanceToken, phone, replyToCustomer);

    if (!managerPhone) {
      this.logger.warn(`Tenant ${tenantId} has no ai_manager_phone — escalation #${escalation.id} parked without notification`);
      return;
    }

    if (!escalation.shouldNotifyManager) {
      this.logger.debug(`Escalation #${escalation.id} is inside cooldown; manager notification skipped`);
      return;
    }

    const ownerMessage = this.buildEscalationOwnerMessage({
      escalationType,
      phone,
      state,
      customerQuestion,
    });

    await this.sendReply(instanceName, instanceToken, managerPhone, ownerMessage);
  }

  private async upsertEscalationRecord(params: {
    tenantDb: TenantPrismaClient;
    conversationId: string;
    phone: string;
    customerQuestion: string;
    customerContext: string | null;
    uncertainReason: string | null;
    escalationType: EscalationType;
    state?: AIConversationState;
    managerPhone?: string;
    cooldownMinutes: number;
  }): Promise<{ id: number; isDuplicate: boolean; shouldNotifyManager: boolean }> {
    const {
      tenantDb,
      conversationId,
      phone,
      customerQuestion,
      customerContext,
      uncertainReason,
      escalationType,
      state,
      managerPhone,
      cooldownMinutes,
    } = params;
    const now = new Date();
    const cutoff = new Date(now.getTime() - cooldownMinutes * 60 * 1000);
    const relatedRequestId = typeof state?.requestId === 'number' ? state.requestId : null;

    const existing = await (tenantDb as any).aIEscalation.findFirst({
      where: {
        conversationId,
        escalationType,
        status: 'pending',
        createdAt: { gte: cutoff },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      const updated = await (tenantDb as any).aIEscalation.update({
        where: { id: existing.id },
        data: {
          lastCustomerMessage: customerQuestion,
          customerContext,
          uncertainReason: this.truncate(uncertainReason, 200),
          customerName: state?.customerName || existing.customerName || null,
          relatedRequestId: relatedRequestId ?? existing.relatedRequestId ?? null,
          occurrenceCount: { increment: 1 },
        },
      });

      return {
        id: updated.id,
        isDuplicate: true,
        shouldNotifyManager: false,
      };
    }

    const created = await (tenantDb as any).aIEscalation.create({
      data: {
        conversationId,
        customerPhone: phone,
        customerName: state?.customerName || null,
        customerQuestion,
        lastCustomerMessage: customerQuestion,
        customerContext,
        escalationType,
        uncertainReason: this.truncate(uncertainReason, 200),
        relatedRequestId,
        notifiedManager: Boolean(managerPhone),
        lastNotifiedAt: managerPhone ? now : null,
        occurrenceCount: 1,
        status: 'pending',
      },
    });

    return {
      id: created.id,
      isDuplicate: false,
      shouldNotifyManager: Boolean(managerPhone),
    };
  }

  private buildEscalationOwnerMessage(params: {
    escalationType: EscalationType;
    phone: string;
    state?: AIConversationState;
    customerQuestion: string;
  }): string {
    const { escalationType, phone, state, customerQuestion } = params;
    const customerLabel = state?.customerName ? `${state.customerName} (${phone})` : phone;
    const stateLabel = state?.bookingStep || state?.currentIntent || 'غير محدد';
    const timestamp = new Intl.DateTimeFormat('ar-SA', {
      timeZone: 'Asia/Riyadh',
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date());

    return [
      'تصعيد من الاستقبال الذكي',
      '',
      `النوع: ${escalationType}`,
      `العميل: ${customerLabel}`,
      `الرسالة: ${this.truncate(customerQuestion, 500)}`,
      `الحالة الحالية: ${stateLabel}`,
      `الوقت: ${timestamp}`,
      '',
      'يرجى التواصل مع العميل أو الرد من هنا إن كان النظام يدعم ذلك.',
    ].join('\n');
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
      // Keep only last N messages (conversation rotation)
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
  // Helpers
  // ═══════════════════════════════════════════

  private normalizeConversationState(raw: unknown): AIConversationState {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { bookingStep: 'idle', failedUnderstandingCount: 0 };
    }

    const state = raw as AIConversationState;
    return {
      ...state,
      bookingStep: state.bookingStep || 'idle',
      failedUnderstandingCount: state.failedUnderstandingCount || 0,
    };
  }

  private mergeActionPayloadMetadata(
    payload: unknown,
    metadata: Record<string, unknown>,
  ): Record<string, unknown> {
    const base = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload as Record<string, unknown>
      : {};
    const existingMetadata = base.metadata && typeof base.metadata === 'object' && !Array.isArray(base.metadata)
      ? base.metadata as Record<string, unknown>
      : {};

    return {
      ...base,
      metadata: {
        ...existingMetadata,
        ...metadata,
      },
    };
  }

  private async handleCustomerAlternativeDecision(params: {
    tenantDb: TenantPrismaClient;
    instanceName: string;
    instanceToken: string;
    phone: string;
    state: AIConversationState;
    settings: AIReceptionRuntimeSettings;
    accepted: boolean;
  }): Promise<boolean> {
    const {
      tenantDb,
      instanceName,
      instanceToken,
      phone,
      state,
      settings,
      accepted,
    } = params;

    if (!state.requestId || !state.alternativeTime) {
      return false;
    }

    const action = await (tenantDb as any).aIPendingAction.findFirst({
      where: {
        id: state.requestId,
        customerPhone: phone,
        status: 'awaiting_customer',
        doNotDisturb: false,
      },
    });

    if (!action) {
      const reply = 'هذا الطلب لم يعد بانتظار الموافقة.';
      await this.sendReply(instanceName, instanceToken, phone, reply);
      await this.upsertConversation(tenantDb, phone, {
        role: 'assistant',
        text: reply,
        ts: new Date().toISOString(),
      });
      return true;
    }

    if (accepted) {
      const managerPhone = settings.aiManagerPhone;
      const result = await this.booking.createConfirmedAppointmentFromAction(tenantDb, {
        action,
        allowedStatuses: ['awaiting_customer'],
        claimStatus: 'customer_accepted_alternative',
        actorPhone: phone,
        timeTextOverride: state.alternativeTime,
      });

      if (result.status === 'created' && result.appointmentId) {
        const reply = this.buildConfirmedCustomerMessage(result);
        await this.persistConversationState(tenantDb, phone, {
          ...state,
          selectedTime: result.startTime || state.alternativeTime,
          selectedDate: result.dateIso || state.selectedDate,
          selectedEmployeeId: result.employeeId || state.selectedEmployeeId,
          appointmentId: result.appointmentId,
          bookingStep: 'completed',
          awaitingOwnerApproval: false,
          lastOwnerDecision: 'alternative',
          updatedAt: new Date().toISOString(),
        });
        await this.sendReply(instanceName, instanceToken, phone, reply);
        if (managerPhone) {
          await this.sendReply(
            instanceName,
            instanceToken,
            managerPhone,
            `وافق العميل على الوقت البديل وتم تثبيت الحجز #${action.id}.`,
          );
        }
        await this.upsertConversation(tenantDb, phone, {
          role: 'assistant',
          text: reply,
          ts: new Date().toISOString(),
        });
        return true;
      }

      const reply = result.status === 'conflict'
        ? 'نعتذر، الوقت البديل لم يعد متاحًا. سيتم إرسال وقت آخر من الصالون.'
        : 'وصلت موافقتك، لكن نحتاج تثبيت الموعد يدويًا. سيتم إشعارك قريبًا.';
      await this.persistConversationState(tenantDb, phone, {
        ...state,
        bookingStep: 'awaiting_customer_alternative_confirmation',
        awaitingOwnerApproval: false,
        lastOwnerDecision: 'alternative',
        updatedAt: new Date().toISOString(),
      });
      await this.sendReply(instanceName, instanceToken, phone, reply);
      if (managerPhone) {
        const managerMessage = result.status === 'conflict'
          ? `الوقت البديل للطلب #${action.id} لم يعد متاحًا. فضلاً اقترح وقتًا آخر.`
          : `تعذر تثبيت الوقت البديل للطلب #${action.id}. يرجى تثبيته يدويًا أو اقتراح وقت آخر.`;
        await this.sendReply(instanceName, instanceToken, managerPhone, managerMessage);
      }
      await this.upsertConversation(tenantDb, phone, {
        role: 'assistant',
        text: reply,
        ts: new Date().toISOString(),
      });
      return true;
    }

    const now = new Date().toISOString();
    const payload = this.mergeActionPayloadMetadata(action.payload, {
      customerRejectedAlternativeAt: now,
      rejectedAlternativeTime: state.alternativeTime,
    });

    const updateResult = await (tenantDb as any).aIPendingAction.updateMany({
      where: {
        id: action.id,
        customerPhone: phone,
        status: 'awaiting_customer',
        doNotDisturb: false,
      },
      data: {
        status: 'alternative_rejected',
        payload,
        resolvedAt: new Date(),
      },
    });

    if (updateResult.count !== 1) {
      const reply = 'هذا الطلب لم يعد بانتظار الموافقة.';
      await this.sendReply(instanceName, instanceToken, phone, reply);
      await this.upsertConversation(tenantDb, phone, {
        role: 'assistant',
        text: reply,
        ts: new Date().toISOString(),
      });
      return true;
    }

    const reply = 'تمام، أي وقت آخر يناسبك؟';
    await this.persistConversationState(tenantDb, phone, {
      ...state,
      selectedTime: undefined,
      bookingStep: 'ask_time',
      awaitingOwnerApproval: false,
      lastOwnerDecision: 'alternative',
      updatedAt: new Date().toISOString(),
    });
    await this.sendReply(instanceName, instanceToken, phone, reply);
    await this.upsertConversation(tenantDb, phone, {
      role: 'assistant',
      text: reply,
      ts: new Date().toISOString(),
    });
    return true;
  }

  private async applyAvailabilitySafeguard(
    tenantDb: TenantPrismaClient,
    state: AIConversationState,
    settings: AIReceptionRuntimeSettings,
    finalCheck = false,
  ): Promise<{ state: AIConversationState; reply: string | null }> {
    if (!state.selectedServiceId || !state.selectedDate) {
      return { state, reply: null };
    }

    if (!state.selectedTime) {
      const availability = await this.booking.getAvailableSlotsForConversation(tenantDb, {
        serviceId: state.selectedServiceId,
        dateText: state.selectedDate,
        limit: settings.availableSlotsLimit,
      });
      return this.applyAvailabilityResult(state, availability, 'list_slots');
    }

    const availability = await this.booking.verifyRequestedSlot(tenantDb, {
      serviceId: state.selectedServiceId,
      dateText: state.selectedDate,
      timeText: state.selectedTime,
      employeeId: state.selectedEmployeeId,
    });

    if (availability.status === 'available') {
      const slot = availability.slots?.[0];
      return {
        state: {
          ...state,
          selectedDate: availability.dateIso || state.selectedDate,
          selectedTime: availability.time || slot?.time || state.selectedTime,
          selectedEmployeeId: slot?.employeeId || state.selectedEmployeeId,
          bookingStep: finalCheck ? state.bookingStep : this.getNextBookingStep(state),
          updatedAt: new Date().toISOString(),
        },
        reply: null,
      };
    }

    return this.applyAvailabilityResult(state, availability, 'verify_slot');
  }

  private applyAvailabilityResult(
    state: AIConversationState,
    availability: AvailabilityResult,
    mode: 'list_slots' | 'verify_slot',
  ): { state: AIConversationState; reply: string | null } {
    const now = new Date().toISOString();

    if (availability.status === 'ambiguous_date') {
      return {
        state: { ...state, selectedDate: undefined, selectedTime: undefined, selectedEmployeeId: undefined, bookingStep: 'ask_date', updatedAt: now },
        reply: 'تقصد أي يوم بالضبط؟',
      };
    }

    if (availability.status === 'ambiguous_time') {
      return {
        state: { ...state, selectedTime: undefined, selectedEmployeeId: undefined, bookingStep: 'ask_time', updatedAt: now },
        reply: 'تقصد ٢ ظهرًا أو ٢ ليلًا؟',
      };
    }

    if (availability.status === 'available' && availability.slots?.length && mode === 'list_slots') {
      return {
        state: {
          ...state,
          selectedDate: availability.dateIso || state.selectedDate,
          bookingStep: 'ask_time',
          lastBotQuestion: 'ask_time',
          updatedAt: now,
        },
        reply: this.formatAvailableSlotsReply(availability.dateIso || state.selectedDate || 'هذا اليوم', availability.slots),
      };
    }

    if (availability.status === 'unavailable') {
      const alternatives = availability.slots?.length
        ? `\n\n${this.formatAvailableSlotsReply(availability.dateIso || state.selectedDate || 'هذا اليوم', availability.slots)}`
        : '';
      return {
        state: {
          ...state,
          selectedDate: availability.dateIso || state.selectedDate,
          selectedTime: undefined,
          selectedEmployeeId: undefined,
          bookingStep: 'ask_time',
          lastBotQuestion: 'ask_time',
          updatedAt: now,
        },
        reply: alternatives
          ? `الوقت المطلوب غير متاح.${alternatives}`
          : 'لا يوجد وقت متاح في هذا اليوم. أقدر أعرض لك أقرب مواعيد بديلة.',
      };
    }

    if (availability.status === 'incomplete_availability_data' || availability.status === 'error') {
      return {
        state: { ...state, updatedAt: now },
        reply: 'أقدر أرسل طلبك للصالون لتأكيد التوفر.',
      };
    }

    return { state, reply: null };
  }

  private formatAvailableSlotsReply(dateLabel: string, slots: Array<{ displayTime: string }>): string {
    const lines = slots.slice(0, 3).map((slot, index) => `${index + 1}) ${slot.displayTime}`);
    return [`المتاح يوم ${dateLabel}:`, ...lines, '', 'أي وقت يناسبك؟'].join('\n');
  }

  private buildConfirmedCustomerMessage(result: {
    serviceName?: string;
    dateIso?: string;
    displayTime?: string;
    startTime?: string;
    price?: number;
  }): string {
    return [
      'تم تأكيد حجزك ✅',
      `الخدمة: ${result.serviceName || 'الخدمة'}`,
      `التاريخ: ${result.dateIso || 'غير محدد'}`,
      `الوقت: ${result.displayTime || result.startTime || 'غير محدد'}`,
      `السعر: ${this.formatPrice(Number(result.price || 0))}`,
      'ننتظرك.',
    ].join('\n');
  }

  private async persistConversationState(
    tenantDb: TenantPrismaClient,
    phone: string,
    state: AIConversationState,
  ): Promise<void> {
    await (tenantDb as any).aIConversation.update({
      where: { phone },
      data: { state },
    });
  }

  private isActiveBookingStep(step?: BookingStep): boolean {
    return !!step && !['idle', 'completed', 'cancelled', 'expired'].includes(step);
  }

  private getNextBookingStep(state: AIConversationState): BookingStep {
    if (!state.selectedServiceName) return 'ask_service';
    if (!state.selectedDate) return 'ask_date';
    if (!state.selectedTime) return 'ask_time';
    if (!state.customerName) return 'ask_customer_name';
    return 'show_summary';
  }

  private getMissingActionReply(
    type: string,
    payload: Record<string, unknown>,
  ): string | null {
    if (type !== 'book_appointment') {
      return null;
    }
    if (!payload.serviceName) return 'أكيد، وش الخدمة المطلوبة؟';
    if (!payload.date) return 'متى يناسبك الموعد؟';
    if (!payload.time) return 'أي وقت يناسبك؟';
    if (!payload.clientName && !payload.customerName) return 'ممكن الاسم للتأكيد؟';
    return null;
  }

  private resetBookingState(state: AIConversationState): AIConversationState {
    return {
      ...state,
      selectedServiceId: undefined,
      selectedServiceName: undefined,
      selectedDate: undefined,
      selectedTime: undefined,
      selectedEmployeeId: undefined,
      customerName: undefined,
      quotedPrice: undefined,
      discountApplied: false,
      requestId: undefined,
      appointmentId: undefined,
      awaitingOwnerApproval: false,
      alternativeTime: undefined,
      lastOwnerDecision: undefined,
      timeoutNotificationSent: false,
      failedUnderstandingCount: 0,
      lastBotQuestion: undefined,
      updatedAt: new Date().toISOString(),
    };
  }

  private isAffirmativeText(text: string): boolean {
    const normalized = this.normalizeArabicText(text);
    const phrases = ['نعم', 'اي', 'ايه', 'اوكي', 'تمام', 'موافق', 'ارسله', 'ارسلي', 'yes', 'ok'];
    return phrases.some((phrase) => normalized === this.normalizeArabicText(phrase) || normalized.includes(this.normalizeArabicText(phrase)));
  }

  private isAlternativeAcceptedText(text: string): boolean {
    if (this.isAlternativeRejectedText(text)) {
      return false;
    }
    const normalized = this.normalizeArabicText(text);
    const phrases = ['مناسب', 'يناسب', 'اوكي', 'ok'];
    return phrases.some((phrase) => normalized.includes(this.normalizeArabicText(phrase)));
  }

  private isAlternativeRejectedText(text: string): boolean {
    const normalized = this.normalizeArabicText(text);
    const phrases = ['ما يناسب', 'غير مناسب', 'ابي وقت ثاني', 'ابغى وقت ثاني', 'وقت ثاني'];
    return phrases.some((phrase) => normalized.includes(this.normalizeArabicText(phrase)));
  }

  private isNegativeText(text: string): boolean {
    const normalized = this.normalizeArabicText(text);
    const phrases = ['لا', 'ما ابي', 'لا ترسل', 'الغاء', 'كنسل', 'no'];
    return phrases.some((phrase) => normalized === this.normalizeArabicText(phrase) || normalized.includes(this.normalizeArabicText(phrase)));
  }

  private async cancelLatestAwaitingActionByCustomer(
    tenantDb: TenantPrismaClient,
    phone: string,
  ): Promise<{ id: number } | null> {
    const rows = await (tenantDb as any).$queryRawUnsafe(
      `
        UPDATE "ai_pending_actions"
        SET
          "status" = 'cancelled_by_customer'::"AIPendingActionStatus",
          "resolved_at" = NOW(),
          "resolved_by" = $1,
          "do_not_disturb" = TRUE,
          "cancelled_at" = NOW(),
          "cancel_reason" = 'customer_stop'
        WHERE "id" = (
          SELECT "id"
          FROM "ai_pending_actions"
          WHERE "customer_phone" = $1
            AND "status" = 'awaiting_manager'::"AIPendingActionStatus"
          ORDER BY "created_at" DESC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        RETURNING "id"
      `,
      phone,
    ) as Array<{ id: number }>;

    return rows[0] || null;
  }

  private applyOfficialPricingToPayload(
    payload: Record<string, unknown>,
    services: ReceptionServiceItem[],
  ): Record<string, unknown> {
    const guarded = { ...payload };
    const serviceName = typeof guarded.serviceName === 'string' ? guarded.serviceName : '';
    const service = this.findServiceInText(serviceName, services);

    delete guarded.discountApplied;
    delete guarded.discount;

    if (!service) {
      delete guarded.price;
      delete guarded.quotedPrice;
      return guarded;
    }

    guarded.serviceName = service.name;
    guarded.price = service.price;
    guarded.quotedPrice = service.price;
    guarded.discountApplied = false;
    return guarded;
  }

  private sanitizePrematureConfirmation(message: string, replacement: string): string {
    const normalized = this.normalizeArabicText(message);
    const blockedPhrases = [
      'تم الحجز',
      'تم حجزك',
      'تم تاكيد حجزك',
      'حجزك مؤكد',
      'موعدك مؤكد',
    ];

    return blockedPhrases.some((phrase) => normalized.includes(this.normalizeArabicText(phrase)))
      ? replacement
      : message;
  }

  private findServiceInText(
    text: string,
    services: ReceptionServiceItem[],
  ): ReceptionServiceItem | null {
    const normalizedText = this.normalizeArabicText(text);
    if (!normalizedText) return null;

    const sorted = [...services].sort((a, b) => b.name.length - a.name.length);
    return sorted.find((service) => {
      const serviceName = this.normalizeArabicText(service.name);
      return !!serviceName && normalizedText.includes(serviceName);
    }) || null;
  }

  private normalizeArabicText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private truncate(value: string | null | undefined, maxLength: number): string | null {
    if (!value) return null;
    return value.length > maxLength ? value.slice(0, maxLength) : value;
  }

  private formatPrice(price: number): string {
    const amount = Number.isInteger(price) ? String(price) : price.toFixed(2);
    return `${amount} ر.س`;
  }

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
