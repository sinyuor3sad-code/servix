import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantClientFactory } from '../../../shared/database/tenant-client.factory';
import { PlatformPrismaClient } from '../../../shared/database/platform.client';
import { CacheService } from '../../../shared/cache/cache.service';
import { WhatsAppEvolutionService } from '../whatsapp-evolution/whatsapp-evolution.service';
import { WhatsAppAntiBanService } from '../whatsapp-evolution/whatsapp-anti-ban.service';
import { FeaturesService } from '../../../core/features/features.service';
import { GeminiService, AIReceptionResponse, hasProposedAction } from '../../../shared/ai/gemini.service';
import { AIContextBuilder, SalonContextForAI } from './ai-context.builder';
import { N8nClient } from './n8n.client';
import { AIReceptionBookingService, AvailabilityResult } from './ai-reception-booking.service';
import { AIReceptionRuntimeSettings, AIReceptionSettingsService } from './ai-reception-settings.service';
import type { TenantPrismaClient } from '../../../shared/types';

// ─────────────────── Constants ───────────────────

const MAX_CONVERSATION_MESSAGES = 10;
const REPLY_COOLDOWN_PREFIX = 'servix:ai_reception_cd:';
const REPLY_COOLDOWN_SECONDS = 3;
const BOOKING_CANCELLED_REPLY = 'تم إلغاء طلب الحجز الحالي.';
const FORMAL_TONE_REPLY = 'تمام، أعتذر. راح أستخدم أسلوبًا رسميًا.';
const AMBIGUOUS_REPLY = 'كيف أقدر أساعدك؟ تبغى حجز، أسعار، أو تعديل موعد؟';
const PENDING_APPROVAL_REPLY = 'وصل طلبك، بانتظار تأكيد الصالون. بنرسل لك التأكيد النهائي هنا.';
const STOP_FOLLOW_UP_REPLY = 'تم، أوقفنا المتابعة لهذا الطلب.';

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

interface EscalationDetection {
  type: EscalationType;
  reply: string;
  reason: string;
}

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
 * AI Reception Service — Main orchestrator for the smart receptionist.
 *
 * Flow:
 *  1. Upsert conversation (append user message)
 *  2. Build salon context via AIContextBuilder
 *  3. Call n8n workflow (primary) → GeminiService (fallback)
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
    private readonly gemini: GeminiService,
    private readonly booking: AIReceptionBookingService,
    private readonly receptionSettings: AIReceptionSettingsService,
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

    const tenantDb = this.tenantFactory.getTenantClient(databaseName) as unknown as TenantPrismaClient;

    const stopResult = await this.handleStopFollowUpRequest({
      tenantDb,
      instanceName,
      instanceToken,
      phone,
      text,
    });
    if (stopResult !== 'not_stop') {
      return;
    }

    // ── Per-phone cooldown ──
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

    // ── 1. Upsert conversation (append user message) ──
    const now = new Date();
    const conversation = await this.upsertConversation(tenantDb, phone, {
      role: 'user',
      text,
      ts: now.toISOString(),
    });

    // ── 2. Build salon context ──
    const salonContext = await this.contextBuilder.buildForTenant(databaseName, phone);

    const systemPrompt = this.gemini.buildReceptionSystemPrompt(
      salonContext,
      settings.tone,
      settings.systemPromptOverride,
    );

    const currentState = this.normalizeConversationState(conversation.state);
    if (this.isGreetingOnlyText(text) && !this.hasPriorAssistantMessages(conversation.messages)) {
      const reply = this.applyAvoidedPhrases(settings.welcomeMessage, settings);
      await this.sendReply(instanceName, instanceToken, phone, reply);
      await this.upsertConversation(tenantDb, phone, {
        role: 'assistant',
        text: reply,
        ts: new Date().toISOString(),
      });
      return;
    }

    const directEscalation = this.detectDirectEscalation(text, currentState, salonContext.services, settings);
    if (directEscalation) {
      const escalationState = {
        ...(directEscalation.type === 'special_discount'
          ? this.applyBookingDetections(currentState, text, salonContext.services)
          : currentState),
        currentIntent: directEscalation.type,
        updatedAt: new Date().toISOString(),
      };
      await this.persistConversationState(tenantDb, phone, escalationState);
      await this.handleEscalation({
        tenantDb,
        tenantId,
        instanceName,
        instanceToken,
        phone,
        customerQuestion: text,
        replyToCustomer: this.applyAvoidedPhrases(directEscalation.reply, settings),
        uncertainReason: directEscalation.reason,
        escalationType: directEscalation.type,
        settings,
        conversationId: conversation.id,
        historyForContext: conversation.messages as Array<{ role: string; text: string; ts: string }>,
        state: escalationState,
      });
      await this.upsertConversation(tenantDb, phone, {
        role: 'assistant',
        text: this.applyAvoidedPhrases(directEscalation.reply, settings),
        ts: new Date().toISOString(),
      });
      return;
    }

    const stateHandled = await this.tryHandleConversationState({
      tenantDb,
      tenantId,
      instanceName,
      instanceToken,
      phone,
      text,
      conversation,
      salonContext,
      settings,
    });
    if (stateHandled) {
      return;
    }

    if (await this.handlePriceNegotiationRequest({
      tenantDb,
      instanceName,
      instanceToken,
      phone,
      text,
      salonContext,
    })) {
      return;
    }

    // ── 4. Get conversation history (last N messages) ──
    const history = (conversation.messages as Array<{ role: string; text: string; ts: string }>)
      .slice(-MAX_CONVERSATION_MESSAGES);

    // ── 5. Call AI (n8n primary → GeminiService fallback) ──
    let response: AIReceptionResponse;

    try {
      // Primary: n8n workflow (5 providers inside n8n)
      response = await this.n8n.callAIReception({
        tenantId,
        phone,
        message: text,
        salonContext,
        history: history as Array<{ role: 'user' | 'assistant'; text: string; ts: string }>,
        tone: settings.tone,
        systemPrompt,
      });
    } catch (n8nErr) {
      this.logger.warn(`n8n failed, falling back to GeminiService: ${(n8nErr as Error).message}`);

      // Fallback: GeminiService direct (5 providers in code)
      response = await this.gemini.receptionChat({
        salonContext,
        phone,
        message: text,
        history: history as Array<{ role: 'user' | 'assistant'; text: string; ts: string }>,
        tone: settings.tone,
        systemPromptOverride: systemPrompt,
      });
    }

    // ── 6. Route response ──
    // Escalate when the AI flagged uncertainty (either via the `needs_human`
    // intent or a non-empty uncertainReason — models aren't always consistent
    // about setting both, so we trust either signal).
    const shouldEscalate =
      response.intent === 'needs_human' ||
      !!(response.uncertainReason && response.uncertainReason.trim());
    let assistantReplyText = this.sanitizePrematureConfirmation(
      response.reply,
      'ما أقدر أؤكد الحجز قبل تأكيد الصالون. أرسل لي الخدمة والتاريخ والوقت وأرفع طلبك للتأكيد.',
    );
    assistantReplyText = this.applyAvoidedPhrases(assistantReplyText, settings);

    if (shouldEscalate) {
      await this.handleEscalation({
        tenantDb,
        tenantId,
        instanceName,
        instanceToken,
        phone,
        customerQuestion: text,
        replyToCustomer: assistantReplyText,
        uncertainReason: response.uncertainReason || null,
        escalationType: this.escalationTypeFromReason(response.uncertainReason || null),
        settings,
        conversationId: conversation.id,
        historyForContext: history as Array<{ role: string; text: string; ts: string }>,
        state: this.normalizeConversationState(conversation.state),
      });
    } else if (hasProposedAction(response)) {
      const guardedPayload = this.applyOfficialPricingToPayload(response.proposedAction.payload, salonContext.services);
      const missingActionReply = this.getMissingActionReply(response.proposedAction.type, guardedPayload);
      if (missingActionReply) {
        assistantReplyText = missingActionReply;
        await this.sendReply(instanceName, instanceToken, phone, assistantReplyText);
      } else {
        assistantReplyText = PENDING_APPROVAL_REPLY;
        await this.handleProposedAction({
          tenantDb,
          tenantId,
          instanceName,
          instanceToken,
          phone,
          reply: assistantReplyText,
          proposedAction: { ...response.proposedAction, payload: guardedPayload },
          settings,
          conversationId: conversation.id,
          services: salonContext.services,
        });
      }
    } else {
      // Direct reply — no manager approval needed
      await this.sendReply(instanceName, instanceToken, phone, assistantReplyText);
    }

    // ── 7. Append assistant message to conversation ──
    await this.upsertConversation(tenantDb, phone, {
      role: 'assistant',
      text: assistantReplyText,
      ts: new Date().toISOString(),
    });
  }

  async handleStopFollowUpRequest(params: {
    tenantDb: TenantPrismaClient;
    instanceName: string;
    instanceToken: string;
    phone: string;
    text: string;
  }): Promise<StopFollowUpResult> {
    const { tenantDb, instanceName, instanceToken, phone, text } = params;
    if (!this.isStopFollowUpText(text)) {
      return 'not_stop';
    }

    const stoppedAction = await this.cancelLatestAwaitingActionByCustomer(tenantDb, phone);
    if (!stoppedAction) {
      this.logger.debug(`Stop follow-up requested by ${phone}, but no active pending action was found.`);
      return 'no_active_request';
    }

    const now = new Date().toISOString();
    const conversation = await this.upsertConversation(tenantDb, phone, { role: 'user', text, ts: now });
    const state = this.resetBookingState({
      ...this.normalizeConversationState(conversation.state),
      currentIntent: 'cancelled_by_customer',
      bookingStep: 'cancelled',
      doNotDisturb: true,
    });
    await this.persistConversationState(tenantDb, phone, state);
    await this.sendReply(instanceName, instanceToken, phone, STOP_FOLLOW_UP_REPLY);
    await this.upsertConversation(tenantDb, phone, {
      role: 'assistant',
      text: STOP_FOLLOW_UP_REPLY,
      ts: new Date().toISOString(),
    });

    this.logger.log(`Customer ${phone} cancelled follow-up for pending action #${stoppedAction.id}`);
    return 'stopped';
  }

  // ═══════════════════════════════════════════
  // Proposed Action → Manager Approval Flow
  // ═══════════════════════════════════════════

  private async tryHandleConversationState(params: {
    tenantDb: TenantPrismaClient;
    tenantId: string;
    instanceName: string;
    instanceToken: string;
    phone: string;
    text: string;
    conversation: { id: string; state?: unknown; messages?: unknown };
    salonContext: SalonContextForAI;
    settings: AIReceptionRuntimeSettings;
  }): Promise<boolean> {
    const {
      tenantDb,
      tenantId,
      instanceName,
      instanceToken,
      phone,
      text,
      conversation,
      salonContext,
      settings,
    } = params;

    const now = new Date().toISOString();
    let state = this.normalizeConversationState(conversation.state);
    state = { ...state, lastUserMessageAt: now, updatedAt: now };

    if (this.isFormalToneRequest(text)) {
      state = {
        ...state,
        tonePreference: 'formal',
        failedUnderstandingCount: 0,
        updatedAt: new Date().toISOString(),
      };
      await this.persistConversationState(tenantDb, phone, state);
      await this.sendReply(instanceName, instanceToken, phone, FORMAL_TONE_REPLY);
      await this.upsertConversation(tenantDb, phone, {
        role: 'assistant',
        text: FORMAL_TONE_REPLY,
        ts: new Date().toISOString(),
      });
      return true;
    }

    const activeBooking = this.isActiveBookingStep(state.bookingStep);
    const bookingIntent = this.isBookingIntentText(text);
    const ambiguous = this.isAmbiguousText(text);

    if (!activeBooking && ambiguous) {
      state = {
        ...state,
        currentIntent: 'inquiry',
        failedUnderstandingCount: (state.failedUnderstandingCount || 0) + 1,
        updatedAt: new Date().toISOString(),
      };
      await this.persistConversationState(tenantDb, phone, state);
      await this.sendReply(instanceName, instanceToken, phone, AMBIGUOUS_REPLY);
      await this.upsertConversation(tenantDb, phone, {
        role: 'assistant',
        text: AMBIGUOUS_REPLY,
        ts: new Date().toISOString(),
      });
      return true;
    }

    if (!activeBooking && !bookingIntent) {
      return false;
    }

    if (state.bookingStep === 'awaiting_customer_alternative_confirmation') {
      if (this.isNegativeText(text) || this.isAlternativeRejectedText(text)) {
        const alternativeResult = await this.handleCustomerAlternativeDecision({
          tenantDb,
          instanceName,
          instanceToken,
          phone,
          state,
          settings,
          accepted: false,
        });
        return alternativeResult;
      }

      if (this.isAffirmativeText(text) || this.isAlternativeAcceptedText(text)) {
        const alternativeResult = await this.handleCustomerAlternativeDecision({
          tenantDb,
          instanceName,
          instanceToken,
          phone,
          state,
          settings,
          accepted: true,
        });
        return alternativeResult;
      }

      const reply = state.alternativeTime
        ? `الصالون اقترح وقتًا بديلًا: ${state.alternativeTime}.\nيناسبك هذا الموعد؟`
        : 'يناسبك الوقت البديل المقترح؟';
      await this.sendReply(instanceName, instanceToken, phone, reply);
      await this.upsertConversation(tenantDb, phone, {
        role: 'assistant',
        text: reply,
        ts: new Date().toISOString(),
      });
      return true;
    }

    if (state.bookingStep === 'awaiting_final_fixation') {
      const reply = 'موافقتك وصلت للصالون، وبانتظار تثبيت الموعد من الفريق.';
      await this.sendReply(instanceName, instanceToken, phone, reply);
      await this.upsertConversation(tenantDb, phone, {
        role: 'assistant',
        text: reply,
        ts: new Date().toISOString(),
      });
      return true;
    }

    if (this.isBookingCancelText(text)) {
      const cancelledState = this.resetBookingState({
        ...state,
        currentIntent: 'booking',
        bookingStep: 'cancelled',
      });
      await this.persistConversationState(tenantDb, phone, cancelledState);
      await this.sendReply(instanceName, instanceToken, phone, BOOKING_CANCELLED_REPLY);
      await this.upsertConversation(tenantDb, phone, {
        role: 'assistant',
        text: BOOKING_CANCELLED_REPLY,
        ts: new Date().toISOString(),
      });
      return true;
    }

    if (state.bookingStep === 'awaiting_owner_approval' && state.requestId) {
      const reply = 'طلبك بانتظار تأكيد الصالون.';
      await this.persistConversationState(tenantDb, phone, {
        ...state,
        currentIntent: 'booking',
        awaitingOwnerApproval: true,
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

    state = this.applyBookingDetections(state, text, salonContext.services);

    if (this.isPriceNegotiationText(text)) {
      const service = this.getSelectedService(state, salonContext.services) ||
        this.findServiceInText(text, salonContext.services);
      const reply = service
        ? `السعر الحالي هو ${this.formatPrice(service.price)}. لا أقدر أغيّر السعر، لكن أقدر أرسل طلبك للصالون إذا تحب/تحبين.`
        : 'لا أقدر أغيّر الأسعار أو أؤكد خصم غير موجود. أقدر أرسل طلبك للصالون للتأكيد إذا تحب/تحبين.';
      state = {
        ...state,
        currentIntent: 'booking',
        quotedPrice: service?.price ?? state.quotedPrice,
        discountApplied: false,
        failedUnderstandingCount: 0,
        updatedAt: new Date().toISOString(),
      };
      await this.persistConversationState(tenantDb, phone, state);
      await this.sendReply(instanceName, instanceToken, phone, reply);
      await this.upsertConversation(tenantDb, phone, {
        role: 'assistant',
        text: reply,
        ts: new Date().toISOString(),
      });
      return true;
    }

    if (this.isMenuRequestText(text)) {
      const nextStep = this.getNextBookingStep(state);
      const reply = `${this.formatServicesMenu(salonContext.services)}\n\n${this.getNextBookingQuestion(state)}`;
      state = {
        ...state,
        currentIntent: 'booking',
        bookingStep: nextStep,
        lastBotQuestion: nextStep,
        failedUnderstandingCount: 0,
        updatedAt: new Date().toISOString(),
      };
      await this.persistConversationState(tenantDb, phone, state);
      await this.sendReply(instanceName, instanceToken, phone, reply);
      await this.upsertConversation(tenantDb, phone, {
        role: 'assistant',
        text: reply,
        ts: new Date().toISOString(),
      });
      return true;
    }

    if (this.isPriceQuestionText(text)) {
      const service = this.getSelectedService(state, salonContext.services) ||
        this.findServiceInText(text, salonContext.services);
      if (service) {
        const nextStep = this.getNextBookingStep(state);
        const question = this.getNextBookingQuestion(state);
        const reply = `سعر ${service.name} هو ${this.formatPrice(service.price)}.\n\n${question}`;
        state = {
          ...state,
          currentIntent: 'booking',
          selectedServiceId: service.id,
          selectedServiceName: service.name,
          quotedPrice: service.price,
          bookingStep: nextStep,
          lastBotQuestion: nextStep,
          failedUnderstandingCount: 0,
          updatedAt: new Date().toISOString(),
        };
        await this.persistConversationState(tenantDb, phone, state);
        await this.sendReply(instanceName, instanceToken, phone, reply);
        await this.upsertConversation(tenantDb, phone, {
          role: 'assistant',
          text: reply,
          ts: new Date().toISOString(),
        });
        return true;
      }
    }

    const availabilityGuard = await this.applyAvailabilitySafeguard(tenantDb, state, settings);
    state = availabilityGuard.state;
    if (availabilityGuard.reply) {
      const prepared = this.prepareBookingReply(availabilityGuard.reply, state, settings);
      state = prepared.state;
      await this.persistConversationState(tenantDb, phone, state);
      await this.sendReply(instanceName, instanceToken, phone, prepared.reply);
      await this.upsertConversation(tenantDb, phone, {
        role: 'assistant',
        text: prepared.reply,
        ts: new Date().toISOString(),
      });
      return true;
    }

    if (this.isAwaitingSendConfirmation(state) && this.isAffirmativeText(text)) {
      const sendGuard = await this.applyAvailabilitySafeguard(tenantDb, state, settings, true);
      state = sendGuard.state;
      if (sendGuard.reply) {
        await this.persistConversationState(tenantDb, phone, state);
        await this.sendReply(instanceName, instanceToken, phone, sendGuard.reply);
        await this.upsertConversation(tenantDb, phone, {
          role: 'assistant',
          text: sendGuard.reply,
          ts: new Date().toISOString(),
        });
        return true;
      }

      const missingReply = this.getMissingStateReply(state);
      if (missingReply) {
        const nextStep = this.getNextBookingStep(state);
        await this.persistConversationState(tenantDb, phone, {
          ...state,
          bookingStep: nextStep,
          lastBotQuestion: nextStep,
          updatedAt: new Date().toISOString(),
        });
        await this.sendReply(instanceName, instanceToken, phone, missingReply);
        await this.upsertConversation(tenantDb, phone, {
          role: 'assistant',
          text: missingReply,
          ts: new Date().toISOString(),
        });
        return true;
      }

      const actionId = await this.handleProposedAction({
        tenantDb,
        tenantId,
        instanceName,
        instanceToken,
        phone,
        reply: PENDING_APPROVAL_REPLY,
        proposedAction: {
          type: 'book_appointment',
          payload: this.buildBookingActionPayload(state),
        },
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
        failedUnderstandingCount: 0,
        updatedAt: new Date().toISOString(),
      });
      await this.upsertConversation(tenantDb, phone, {
        role: 'assistant',
        text: actionId ? PENDING_APPROVAL_REPLY : 'تعذر إرسال الطلب للصالون حاليًا.',
        ts: new Date().toISOString(),
      });
      return true;
    }

    if (this.isAwaitingSendConfirmation(state) && this.isNegativeText(text)) {
      const cancelledState = this.resetBookingState({
        ...state,
        currentIntent: 'booking',
        bookingStep: 'cancelled',
      });
      await this.persistConversationState(tenantDb, phone, cancelledState);
      await this.sendReply(instanceName, instanceToken, phone, BOOKING_CANCELLED_REPLY);
      await this.upsertConversation(tenantDb, phone, {
        role: 'assistant',
        text: BOOKING_CANCELLED_REPLY,
        ts: new Date().toISOString(),
      });
      return true;
    }

    const nextReply = this.getMissingStateReply(state) || this.buildBookingSummary(state);
    const nextStep = this.getNextBookingStep(state);
    const understood = this.didUnderstandBookingMessage(text, state, salonContext.services) || bookingIntent;
    const failedUnderstandingCount = understood ? 0 : (state.failedUnderstandingCount || 0) + 1;

    if (!understood && failedUnderstandingCount >= settings.maxUnderstandingFailures) {
      const escalationState = {
        ...state,
        currentIntent: 'needs_human',
        bookingStep: nextStep,
        failedUnderstandingCount,
        updatedAt: new Date().toISOString(),
      };
      const reply = 'ما قدرت أفهم طلبك بشكل كافٍ. أحوّله للفريق لمساعدتك بشكل أفضل.';
      await this.persistConversationState(tenantDb, phone, escalationState);
      await this.handleEscalation({
        tenantDb,
        tenantId,
        instanceName,
        instanceToken,
        phone,
        customerQuestion: text,
        replyToCustomer: reply,
        uncertainReason: 'failed_understanding_twice',
        escalationType: 'unclear',
        settings,
        conversationId: conversation.id,
        historyForContext: conversation.messages as Array<{ role: string; text: string; ts: string }>,
        state: escalationState,
      });
      await this.upsertConversation(tenantDb, phone, {
        role: 'assistant',
        text: reply,
        ts: new Date().toISOString(),
      });
      return true;
    }

    const finalState = {
      ...state,
      currentIntent: 'booking',
      bookingStep: nextStep,
      lastBotQuestion: nextStep,
      failedUnderstandingCount,
      updatedAt: new Date().toISOString(),
    };
    const prepared = this.prepareBookingReply(nextReply, finalState, settings);
    await this.persistConversationState(tenantDb, phone, prepared.state);
    const preparedNextReply = prepared.reply;
    await this.sendReply(instanceName, instanceToken, phone, preparedNextReply);
    await this.upsertConversation(tenantDb, phone, {
      role: 'assistant',
      text: preparedNextReply,
      ts: new Date().toISOString(),
    });
    return true;
  }

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

  private detectDirectEscalation(
    text: string,
    state: AIConversationState,
    services: ReceptionServiceItem[],
    settings: AIReceptionRuntimeSettings,
  ): EscalationDetection | null {
    const normalized = this.normalizeArabicText(text);
    const selectedService = this.getSelectedService(state, services) || this.findServiceInText(text, services);

    if (settings.customEscalationKeywords.length > 0 && this.containsAny(normalized, settings.customEscalationKeywords)) {
      return {
        type: 'complaint',
        reply: 'أحوّل طلبك للفريق لأن فيه تفصيل يحتاج تأكيد مباشر.',
        reason: 'custom_escalation_keyword',
      };
    }

    if (this.containsAny(normalized, [
      'استرجاع', 'استرداد', 'فلوسي', 'تعويض', 'فاتوره', 'الفاتوره', 'مبلغ', 'خلاف مالي',
    ])) {
      return {
        type: 'billing_issue',
        reply: 'أحوّل طلبك للفريق لأن فيه تفصيل يحتاج تأكيد مباشر.',
        reason: 'billing_issue',
      };
    }

    if (this.containsAny(normalized, [
      'تهديد', 'ابلغ عليكم', 'بشتكي عليكم', 'حراميه', 'نصابين', 'سارقين',
    ])) {
      return {
        type: 'abuse_or_threat',
        reply: 'تم تحويل المحادثة للفريق للتعامل معها.',
        reason: 'abuse_or_threat',
      };
    }

    if (this.containsAny(normalized, [
      'شكوي', 'اشتكي', 'ابغي اشتكي', 'ابي اشتكي', 'زعلانه', 'زعلان', 'سيء', 'سيئه',
      'تاخير', 'ما عجبني', 'الموظفه اخطات', 'خدمه سيئه', 'ابي الاداره', 'ابي اكلم المسؤول',
      'ابي المدير', 'ابغي المدير', 'المسؤول',
    ])) {
      return {
        type: this.containsAny(normalized, ['زعلانه', 'زعلان', 'سيء', 'سيئه']) ? 'angry_customer' : 'complaint',
        reply: 'نعتذر عن تجربتك. تم رفع ملاحظتك للإدارة، وسيتم التواصل معك بأقرب وقت.',
        reason: 'complaint_or_angry_customer',
      };
    }

    if (this.isPriceNegotiationText(text)) {
      const reply = selectedService
        ? `السعر الحالي هو ${this.formatPrice(selectedService.price)}. لا أقدر أغيّر السعر، لكن أقدر أرفع طلبك للفريق للمراجعة.`
        : 'لا أقدر أغيّر الأسعار أو أؤكد خصم غير موجود. أقدر أرفع طلبك للفريق للمراجعة.';
      return {
        type: 'special_discount',
        reply,
        reason: 'special_discount_request',
      };
    }

    if (this.looksLikeUnavailableServiceRequest(normalized, services)) {
      return {
        type: 'unavailable_service',
        reply: 'ما عندي هذه الخدمة ضمن القائمة الحالية. أحوّل طلبك للفريق للتأكيد.',
        reason: 'unavailable_service',
      };
    }

    return null;
  }

  private escalationTypeFromReason(reason: string | null): EscalationType {
    const normalized = this.normalizeArabicText(reason || '');
    if (this.containsAny(normalized, ['خصم', 'discount', 'price'])) return 'special_discount';
    if (this.containsAny(normalized, ['شكوي', 'complaint'])) return 'complaint';
    if (this.containsAny(normalized, ['فاتوره', 'billing', 'refund', 'تعويض'])) return 'billing_issue';
    if (this.containsAny(normalized, ['خدمه غير', 'unavailable_service'])) return 'unavailable_service';
    if (this.containsAny(normalized, ['غضب', 'angry'])) return 'angry_customer';
    if (this.containsAny(normalized, ['تهديد', 'abuse', 'threat'])) return 'abuse_or_threat';
    return 'unclear';
  }

  private looksLikeUnavailableServiceRequest(
    normalizedText: string,
    services: ReceptionServiceItem[],
  ): boolean {
    if (!normalizedText || this.findServiceInText(normalizedText, services) || this.isMenuRequestText(normalizedText)) {
      return false;
    }

    const serviceLikeWords = [
      'مساج', 'ليزر', 'اظافر', 'مكياج', 'حمام', 'بروتين', 'كيراتين', 'تنظيف بشره',
      'حنه', 'بدكير', 'منكير', 'رموش', 'واكس', 'صبغ حواجب',
    ];
    const requestWords = ['عندكم', 'تسوون', 'تعملون', 'ابي', 'ابغي', 'ابغى', 'احتاج', 'خدمه'];

    return this.containsAny(normalizedText, serviceLikeWords) &&
      this.containsAny(normalizedText, requestWords);
  }

  private containsAny(normalizedText: string, phrases: string[]): boolean {
    return phrases.some((phrase) => normalizedText.includes(this.normalizeArabicText(phrase)));
  }

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

  private prepareBookingReply(
    reply: string,
    state: AIConversationState,
    settings: AIReceptionRuntimeSettings,
  ): { reply: string; state: AIConversationState } {
    let preparedReply = this.applyAvoidedPhrases(reply, settings);
    let preparedState = state;

    if (
      settings.privacyMessageEnabled &&
      settings.privacyMessage &&
      !state.privacyMessageSent &&
      this.isActiveBookingStep(state.bookingStep)
    ) {
      preparedReply = `${preparedReply}\n\n${settings.privacyMessage}`;
      preparedState = {
        ...state,
        privacyMessageSent: true,
      };
    }

    return { reply: preparedReply, state: preparedState };
  }

  private applyAvoidedPhrases(message: string, settings: AIReceptionRuntimeSettings): string {
    let sanitized = message;
    for (const phrase of settings.avoidedPhrases) {
      const normalizedPhrase = phrase.trim();
      if (!normalizedPhrase) continue;
      sanitized = sanitized.replace(new RegExp(this.escapeRegExp(normalizedPhrase), 'gi'), 'حياك الله');
    }
    return sanitized.replace(/\s{2,}/g, ' ').trim();
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private hasPriorAssistantMessages(messages: unknown): boolean {
    return Array.isArray(messages) &&
      messages.some((message) =>
        !!message &&
        typeof message === 'object' &&
        (message as { role?: unknown }).role === 'assistant',
      );
  }

  private isGreetingOnlyText(text: string): boolean {
    const normalized = this.normalizeArabicText(text);
    return ['هلا', 'مرحبا', 'السلام عليكم', 'السلام', 'هاي', 'hello', 'hi'].includes(normalized);
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

  private applyBookingDetections(
    state: AIConversationState,
    text: string,
    services: ReceptionServiceItem[],
  ): AIConversationState {
    const detectedService = this.findServiceInText(text, services);
    const detectedDate = this.extractDateText(text);
    const detectedTime = this.extractTimeText(text);
    const awaitingName = state.bookingStep === 'ask_customer_name';
    const detectedName = awaitingName && !this.isControlText(text) ? text.trim() : undefined;
    const serviceChanged = Boolean(detectedService && detectedService.id !== state.selectedServiceId);

    return {
      ...state,
      currentIntent: 'booking',
      selectedServiceId: detectedService?.id ?? state.selectedServiceId,
      selectedServiceName: detectedService?.name ?? state.selectedServiceName,
      selectedDate: detectedDate ?? state.selectedDate,
      selectedTime: detectedTime ?? state.selectedTime,
      selectedEmployeeId: serviceChanged ? undefined : state.selectedEmployeeId,
      customerName: detectedName || state.customerName,
      quotedPrice: detectedService?.price ?? state.quotedPrice,
      discountApplied: detectedService ? false : state.discountApplied,
      updatedAt: new Date().toISOString(),
    };
  }

  private getSelectedService(
    state: AIConversationState,
    services: ReceptionServiceItem[],
  ): ReceptionServiceItem | null {
    if (!state.selectedServiceName) return null;
    return services.find((service) => service.name === state.selectedServiceName) ||
      this.findServiceInText(state.selectedServiceName, services);
  }

  private getNextBookingStep(state: AIConversationState): BookingStep {
    if (!state.selectedServiceName) return 'ask_service';
    if (!state.selectedDate) return 'ask_date';
    if (!state.selectedTime) return 'ask_time';
    if (!state.customerName) return 'ask_customer_name';
    return 'show_summary';
  }

  private getNextBookingQuestion(state: AIConversationState): string {
    const nextStep = this.getNextBookingStep(state);
    switch (nextStep) {
      case 'ask_service':
        return 'ولإكمال الحجز، وش الخدمة المطلوبة؟';
      case 'ask_date':
        return 'متى يناسبك الموعد؟';
      case 'ask_time':
        return state.selectedDate
          ? `أي وقت يناسبك ${state.selectedDate}؟`
          : 'أي وقت يناسبك؟';
      case 'ask_customer_name':
        return 'ممكن الاسم للتأكيد؟';
      default:
        return 'أرسل الطلب للصالون للتأكيد؟';
    }
  }

  private getMissingStateReply(state: AIConversationState): string | null {
    const nextStep = this.getNextBookingStep(state);
    switch (nextStep) {
      case 'ask_service':
        return 'أكيد، وش الخدمة المطلوبة؟';
      case 'ask_date':
        return 'متى يناسبك الموعد؟';
      case 'ask_time':
        return state.selectedDate
          ? `أي وقت يناسبك ${state.selectedDate}؟`
          : 'أي وقت يناسبك؟';
      case 'ask_customer_name':
        return 'ممكن الاسم للتأكيد؟';
      default:
        return null;
    }
  }

  private buildBookingSummary(state: AIConversationState): string {
    return [
      'ملخص طلبك:',
      `الخدمة: ${state.selectedServiceName}`,
      `التاريخ: ${state.selectedDate}`,
      `الوقت: ${state.selectedTime}`,
      `السعر: ${this.formatPrice(Number(state.quotedPrice))}`,
      '',
      'أرسل الطلب للصالون للتأكيد؟',
    ].join('\n');
  }

  private buildBookingActionPayload(state: AIConversationState): Record<string, unknown> {
    return {
      serviceId: state.selectedServiceId,
      serviceName: state.selectedServiceName,
      date: state.selectedDate,
      time: state.selectedTime,
      employeeId: state.selectedEmployeeId,
      appointmentDate: state.selectedDate,
      appointmentStartTime: state.selectedTime,
      clientName: state.customerName,
      price: state.quotedPrice,
      quotedPrice: state.quotedPrice,
      discountApplied: false,
      previousRequestId: state.requestId,
    };
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

  private isAwaitingSendConfirmation(state: AIConversationState): boolean {
    return this.getNextBookingStep(state) === 'show_summary' &&
      (state.bookingStep === 'show_summary' || state.bookingStep === 'ask_confirm_send_request');
  }

  private didUnderstandBookingMessage(
    text: string,
    state: AIConversationState,
    services: ReceptionServiceItem[],
  ): boolean {
    return Boolean(
      this.findServiceInText(text, services) ||
      this.extractDateText(text) ||
      this.extractTimeText(text) ||
      (state.bookingStep === 'ask_customer_name' && !this.isControlText(text)) ||
      this.isMenuRequestText(text) ||
      this.isPriceQuestionText(text) ||
      this.isPriceNegotiationText(text),
    );
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

  private formatServicesMenu(services: ReceptionServiceItem[]): string {
    if (!services.length) {
      return 'ما عندي قائمة خدمات محدثة حاليًا.';
    }
    return services
      .slice(0, 8)
      .map((service) => `${service.name}: ${this.formatPrice(service.price)}`)
      .join('\n');
  }

  private extractDateText(text: string): string | null {
    const normalized = this.normalizeArabicText(text);
    const weekdays = [
      'الاحد',
      'الاثنين',
      'الثلاثاء',
      'الاربعاء',
      'الخميس',
      'الجمعه',
      'السبت',
    ];
    if (normalized.includes('بكره') || normalized.includes('غدا')) return 'بكرة';
    if (normalized.includes('اليوم')) return 'اليوم';
    const weekday = weekdays.find((day) => normalized.includes(day));
    if (weekday) return weekday;
    const dateMatch = text.match(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/);
    return dateMatch ? dateMatch[0] : null;
  }

  private extractTimeText(text: string): string | null {
    const normalized = this.normalizeArabicText(this.normalizeArabicDigits(text));
    const clockMatch = normalized.match(/\b([01]?\d|2[0-3])(?::([0-5]\d))?\s*(ص|صباحا|م|مساء|مساءا|الظهر|العصر|المغرب|الليل)?\b/);
    if (!clockMatch) return null;
    const suffix = clockMatch[3] ? ` ${clockMatch[3]}` : '';
    return `${clockMatch[1]}${clockMatch[2] ? `:${clockMatch[2]}` : ''}${suffix}`.trim();
  }

  private normalizeArabicDigits(text: string): string {
    const arabic = '٠١٢٣٤٥٦٧٨٩';
    const persian = '۰۱۲۳۴۵۶۷۸۹';
    return text.replace(/[٠-٩۰-۹]/g, (char) => {
      const arabicIndex = arabic.indexOf(char);
      if (arabicIndex >= 0) return String(arabicIndex);
      return String(persian.indexOf(char));
    });
  }

  private isBookingIntentText(text: string): boolean {
    const normalized = this.normalizeArabicText(text);
    const phrases = ['حجز', 'موعد', 'احجز', 'ابي احجز', 'ابغى احجز', 'ابغا حجز'];
    return phrases.some((phrase) => normalized.includes(this.normalizeArabicText(phrase)));
  }

  private isMenuRequestText(text: string): boolean {
    const normalized = this.normalizeArabicText(text);
    const phrases = ['وش الخدمات', 'ايش الخدمات', 'شنو الخدمات', 'الخدمات', 'المنيو', 'القائمه', 'الخدمات عندكم'];
    return phrases.some((phrase) => normalized.includes(this.normalizeArabicText(phrase)));
  }

  private isPriceQuestionText(text: string): boolean {
    const normalized = this.normalizeArabicText(text);
    const phrases = ['كم', 'بكم', 'سعر', 'الاسعار', 'اسعار'];
    return phrases.some((phrase) => normalized.includes(this.normalizeArabicText(phrase)));
  }

  private isBookingCancelText(text: string): boolean {
    const normalized = this.normalizeArabicText(text);
    const phrases = ['الغاء', 'الغي', 'كنسل', 'cancel'];
    return phrases.some((phrase) => normalized.includes(this.normalizeArabicText(phrase)));
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

  private isAmbiguousText(text: string): boolean {
    const normalized = this.normalizeArabicText(text);
    return ['ا', 'طيب', 'تمام', 'اوك', '؟', '?'].includes(normalized) || normalized.length <= 1;
  }

  private isFormalToneRequest(text: string): boolean {
    const normalized = this.normalizeArabicText(text);
    const phrases = ['لا تقول حبيبتي', 'لا تقولين حبيبتي', 'لا تكلمني كذا', 'تكلم رسمي', 'تكلمي رسمي', 'بدون دلع'];
    return phrases.some((phrase) => normalized.includes(this.normalizeArabicText(phrase)));
  }

  private isControlText(text: string): boolean {
    return this.isAffirmativeText(text) ||
      this.isNegativeText(text) ||
      this.isMenuRequestText(text) ||
      this.isPriceQuestionText(text) ||
      this.isBookingCancelText(text);
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

  private async handlePriceNegotiationRequest(params: {
    tenantDb: TenantPrismaClient;
    instanceName: string;
    instanceToken: string;
    phone: string;
    text: string;
    salonContext: SalonContextForAI;
  }): Promise<boolean> {
    const { tenantDb, instanceName, instanceToken, phone, text, salonContext } = params;
    if (!this.isPriceNegotiationText(text)) {
      return false;
    }

    const service =
      this.findServiceInText(text, salonContext.services) ||
      await this.findServiceFromLatestPendingAction(tenantDb, phone, salonContext.services);

    const reply = service
      ? `السعر الحالي هو ${this.formatPrice(service.price)}. لا أقدر أغيّر السعر، لكن أقدر أرسل طلبك للصالون إذا تحب/تحبين.`
      : 'لا أقدر أغيّر الأسعار أو أؤكد خصم غير موجود. أقدر أرسل طلبك للصالون للتأكيد إذا تحب/تحبين.';

    await this.sendReply(instanceName, instanceToken, phone, reply);
    await this.upsertConversation(tenantDb, phone, {
      role: 'assistant',
      text: reply,
      ts: new Date().toISOString(),
    });
    return true;
  }

  private async findServiceFromLatestPendingAction(
    tenantDb: TenantPrismaClient,
    phone: string,
    services: ReceptionServiceItem[],
  ): Promise<ReceptionServiceItem | null> {
    const action = await (tenantDb as any).aIPendingAction.findFirst({
      where: {
        customerPhone: phone,
        status: 'awaiting_manager',
      },
      orderBy: { createdAt: 'desc' },
    });
    const payload = action?.payload as Record<string, unknown> | undefined;
    const serviceName = typeof payload?.serviceName === 'string' ? payload.serviceName : '';
    return this.findServiceInText(serviceName, services);
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

  private isStopFollowUpText(text: string): boolean {
    const normalized = this.normalizeArabicText(text);
    const phrases = ['توقف', 'وقف', 'لا ترسل', 'ازعاج', 'خلاص', 'stop'];
    return phrases.some((phrase) => normalized.includes(this.normalizeArabicText(phrase)));
  }

  private isPriceNegotiationText(text: string): boolean {
    const normalized = this.normalizeArabicText(text);
    const phrases = [
      'خصم',
      'تخفيض',
      'ارخص',
      'اقل',
      'نزلي',
      'نزل',
      'ينزل',
      'اخر سعر',
      'سعر اقل',
      'يصير',
      'ما يصير',
      'سوي لي خصم',
      'غير السعر',
      'بسعر اقل',
      'discount',
      'cheaper',
      'lower price',
    ];
    return phrases.some((phrase) => normalized.includes(this.normalizeArabicText(phrase)));
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
