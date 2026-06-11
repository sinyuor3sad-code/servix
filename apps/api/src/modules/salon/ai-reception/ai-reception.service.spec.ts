import type { ConfigService } from '@nestjs/config';
import type { TenantClientFactory } from '../../../shared/database/tenant-client.factory';
import type { PlatformPrismaClient } from '../../../shared/database/platform.client';
import type { CacheService } from '../../../shared/cache/cache.service';
import type { WhatsAppEvolutionService } from '../whatsapp-evolution/whatsapp-evolution.service';
import type { WhatsAppAntiBanService } from '../whatsapp-evolution/whatsapp-anti-ban.service';
import type { FeaturesService } from '../../../core/features/features.service';
import type { AIContextBuilder, SalonContextForAI } from './ai-context.builder';
import type { GeminiService } from '../../../shared/ai/gemini.service';
import type { AIProviderResponse } from '../../../shared/ai/ai-provider.service';
import { AIReceptionService } from './ai-reception.service';
import type { AIReceptionRuntimeSettings } from './ai-reception-settings.service';

const customerPhone = '966500000000';
const managerPhone = '966511111111';

const salonContext: SalonContextForAI = {
  salonName: 'Salon',
  employeeName: 'Sara',
  workingHours: '10:00-22:00',
  workingDays: {},
  services: [
    { id: 'svc-cut', name: 'قص وتصفيف', price: 80, duration: 60, category: 'hair' },
    { id: 'svc-dye', name: 'صبغة كاملة', price: 150, duration: 120, category: 'hair' },
  ],
  employees: [],
  policies: { cancellationNotice: '24h', currency: 'SAR', taxPercentage: 15 },
  knowledgeSnippets: [],
};

function defaultAIResponse(overrides: Partial<AIProviderResponse> = {}): AIProviderResponse {
  return {
    intent: 'general_reply',
    reply: 'حياك الله!',
    proposedAction: null,
    success: true,
    action: 'answer_only',
    extractedData: null,
    needsEscalation: false,
    sentiment: 'positive',
    confidence: 0.95,
    wantsToCancel: false,
    isNegotiatingPrice: false,
    messageType: 'text',
    buttons: null,
    modelUsed: 'gpt-5-nano',
    ...overrides,
  };
}

function makeHarness(options: {
  settings?: Partial<AIReceptionRuntimeSettings>;
  aiResponse?: Partial<AIProviderResponse>;
  cachedResponse?: { reply: string; intent: string; similarity: number } | null;
  monthlyUsage?: number;
} = {}) {
  let conversation: any = null;
  const pendingActions: any[] = [];
  const escalations: any[] = [];

  const runtimeSettings: AIReceptionRuntimeSettings = {
    aiReceptionEnabled: true,
    aiManagerPhone: managerPhone,
    tone: 'light_gulf',
    welcomeMessage: 'حياك الله، كيف أقدر أساعدك؟',
    managerApprovalTimeoutMinutes: 30,
    maxUnderstandingFailures: 2,
    escalationCooldownMinutes: 10,
    bookingConfirmationMode: 'manual',
    privacyMessageEnabled: false,
    privacyMessage: '',
    avoidedPhrases: ['حبيبتي'],
    customEscalationKeywords: [],
    showEmployeeNamesToCustomers: false,
    availableSlotsLimit: 3,
    mode: 'full',
    walkInMessage: 'ما نحجز عبر واتساب — تقدرين تزورينا.',
    customRedirectMessage: '',
    assistantName: 'مساعد الصالون',
    voiceEnabled: true,
    richMediaEnabled: true,
    clientMemoryEnabled: true,
    weeklyReportEnabled: true,
    tier: 'premium',
    monthlyMessageLimit: 5000,
    messagesUsedThisMonth: 0,
    vacationStartDate: '',
    vacationEndDate: '',
    vacationMessage: '',
    proactiveFollowUpEnabled: true,
    proactiveReEngagementEnabled: false,
    ...options.settings,
  };

  const tenantDb = {
    aIConversation: {
      findUnique: jest.fn(({ where }: any) => {
        if (!conversation) return null;
        if (where.phone) return conversation.phone === where.phone ? conversation : null;
        return null;
      }),
      create: jest.fn(({ data }: any) => {
        conversation = { id: 'conv-1', state: {}, ...data };
        return conversation;
      }),
      update: jest.fn(({ data }: any) => {
        conversation = { ...conversation, ...data };
        return conversation;
      }),
    },
    aIPendingAction: {
      create: jest.fn(({ data }: any) => {
        const action = {
          id: pendingActions.length + 1,
          status: 'awaiting_manager',
          createdAt: new Date(),
          doNotDisturb: false,
          ...data,
        };
        pendingActions.push(action);
        return action;
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findFirst: jest.fn(() => null),
    },
    aIEscalation: {
      findFirst: jest.fn(() => null),
      create: jest.fn(({ data }: any) => {
        const e = { id: escalations.length + 1, createdAt: new Date(), ...data };
        escalations.push(e);
        return e;
      }),
      update: jest.fn(({ where, data }: any) => {
        const e = escalations.find((x) => x.id === where.id);
        if (e) Object.assign(e, data);
        return e;
      }),
    },
    setting: { findMany: jest.fn().mockResolvedValue([]) },
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
  };

  const sendText = jest.fn().mockResolvedValue(undefined);
  const aiChat = jest.fn().mockResolvedValue(defaultAIResponse(options.aiResponse));
  const findCachedResponse = jest.fn().mockResolvedValue(options.cachedResponse ?? null);
  const cacheResponse = jest.fn().mockResolvedValue(undefined);
  const trackConversation = jest.fn().mockResolvedValue(undefined);
  const buildMemoryContext = jest.fn().mockResolvedValue('عميل جديد، لا توجد معلومات سابقة.');
  const updateFromAIResponse = jest.fn().mockResolvedValue(null);
  const buildReceptionV2SystemPrompt = jest.fn().mockReturnValue('SYSTEM_PROMPT_V2');
  const sanitize = jest.fn((reply: string) => ({
    reply,
    blockedConfirmation: false,
    pricesAdjusted: false,
    identityRedactions: 0,
    truncated: false,
    emojiTruncated: false,
  }));
  const sendButtons = jest.fn().mockResolvedValue(undefined);
  const sendList = jest.fn().mockResolvedValue(undefined);

  const monthlyUsage = options.monthlyUsage ?? 0;

  const cache = {
    incrementRateLimit: jest.fn().mockResolvedValue(1),
    getJson: jest.fn().mockResolvedValue(monthlyUsage),
    setJson: jest.fn().mockResolvedValue(undefined),
    incrementInt: jest.fn().mockResolvedValue(monthlyUsage + 1),
  } as unknown as CacheService;

  const service = new AIReceptionService(
    {} as ConfigService,
    {} as PlatformPrismaClient,
    { getTenantClient: jest.fn(() => tenantDb) } as unknown as TenantClientFactory,
    cache,
    {} as FeaturesService,
    { sendText } as unknown as WhatsAppEvolutionService,
    {} as WhatsAppAntiBanService,
    { sendButtons, sendList, sendImage: jest.fn(), sendLocation: jest.fn(), downloadMediaAsBuffer: jest.fn() } as never,
    { buildForTenant: jest.fn().mockResolvedValue(salonContext) } as unknown as AIContextBuilder,
    { buildReceptionV2SystemPrompt, buildReceptionSystemPrompt: jest.fn(), receptionChat: jest.fn() } as unknown as GeminiService,
    { chat: aiChat, transcribeVoice: jest.fn().mockResolvedValue('') } as never,
    { sanitize } as never,
    { getAvailableSlotsForConversation: jest.fn(), verifyRequestedSlot: jest.fn(), createConfirmedAppointmentFromAction: jest.fn() } as never,
    { get: jest.fn().mockResolvedValue(runtimeSettings) } as never,
    {
      getMemory: jest.fn().mockResolvedValue(null),
      updateMemory: jest.fn(),
      updateFromAIResponse,
      buildMemoryContext,
    } as never,
    { findCachedResponse, cacheResponse, normalizeQuestion: jest.fn((t: string) => t) } as never,
    { trackConversation, getWeeklyStats: jest.fn(), buildWeeklyReport: jest.fn(), sendWeeklyReports: jest.fn() } as never,
  );

  async function receive(text: string, voiceMetadata?: { isVoiceMessage: true; durationSeconds?: number }) {
    await service.handleCustomerMessage({
      tenantId: 'tenant-1',
      databaseName: 'tenant_db',
      instanceName: 'salon-test',
      instanceToken: 'token',
      phone: customerPhone,
      text,
      voiceMetadata,
    });
  }

  function customerMessages(): string[] {
    return sendText.mock.calls
      .map((call) => call[0])
      .filter((p) => p.to === customerPhone)
      .map((p) => p.message as string);
  }

  return {
    service,
    tenantDb,
    sendText,
    sendButtons,
    sendList,
    aiChat,
    findCachedResponse,
    cacheResponse,
    trackConversation,
    buildMemoryContext,
    updateFromAIResponse,
    buildReceptionV2SystemPrompt,
    sanitize,
    cache,
    receive,
    customerMessages,
    lastCustomerMessage: () => customerMessages().slice(-1)[0] || '',
    get conversation() { return conversation; },
    get pendingActions() { return pendingActions; },
    get escalations() { return escalations; },
  };
}

describe('AIReceptionService — V2 routing', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('mode short-circuits', () => {
    it('mode=vacation → sends vacation message and skips AI', async () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const h = makeHarness({
        settings: {
          mode: 'vacation',
          vacationStartDate: '2020-01-01',
          vacationEndDate: tomorrow,
          vacationMessage: 'الصالون مغلق للإجازة',
        },
      });

      await h.receive('السلام عليكم');

      expect(h.lastCustomerMessage()).toContain('الصالون مغلق');
      expect(h.aiChat).not.toHaveBeenCalled();
    });

    it('mode=vacation but window expired → falls through to AI', async () => {
      const h = makeHarness({
        settings: {
          mode: 'vacation',
          vacationStartDate: '2020-01-01',
          vacationEndDate: '2020-01-02', // long past
          vacationMessage: 'إجازة',
        },
      });

      await h.receive('السلام');

      expect(h.aiChat).toHaveBeenCalled();
    });

    it('mode=custom → sends custom redirect and skips AI', async () => {
      const h = makeHarness({
        settings: { mode: 'custom', customRedirectMessage: 'تواصلي على 0500' },
      });

      await h.receive('مرحبا');

      expect(h.lastCustomerMessage()).toBe('تواصلي على 0500');
      expect(h.aiChat).not.toHaveBeenCalled();
    });

    it('mode=reply_only → injects no-booking instruction into the system prompt', async () => {
      const h = makeHarness({ settings: { mode: 'reply_only' } });

      await h.receive('ابي حجز');

      expect(h.aiChat).toHaveBeenCalled();
      const promptArg = h.buildReceptionV2SystemPrompt.mock.calls[0][0];
      expect(promptArg.stateContext).toContain('رد فقط');
      expect(promptArg.stateContext).toContain('الحجز معطّل');
    });
  });

  describe('tier + monthly limit gates', () => {
    it('tier=basic → sends welcome message and skips AI entirely', async () => {
      const h = makeHarness({ settings: { tier: 'basic', welcomeMessage: 'حياك! تواصلي مباشرة.' } });

      await h.receive('السلام');

      expect(h.lastCustomerMessage()).toBe('حياك! تواصلي مباشرة.');
      expect(h.aiChat).not.toHaveBeenCalled();
    });

    it('monthly limit reached → sends apology and skips AI', async () => {
      const h = makeHarness({
        settings: { monthlyMessageLimit: 100 },
        monthlyUsage: 100,
      });

      await h.receive('سؤال');

      expect(h.lastCustomerMessage()).toContain('غير متاح');
      expect(h.aiChat).not.toHaveBeenCalled();
    });

    it('limit=0 → unlimited (gate disabled)', async () => {
      const h = makeHarness({
        settings: { monthlyMessageLimit: 0 },
        monthlyUsage: 999_999,
      });

      await h.receive('سؤال');

      expect(h.aiChat).toHaveBeenCalled();
    });

    it('AI call increments the monthly counter', async () => {
      const h = makeHarness();

      await h.receive('سؤال');

      expect(h.cache.incrementInt).toHaveBeenCalled();
    });
  });

  describe('semantic cache short-circuit', () => {
    it('cache hit → sends cached reply without calling AI but still bumps counter', async () => {
      const h = makeHarness({
        cachedResponse: { reply: 'سعر القص 80 ريال', intent: 'ask_price', similarity: 0.92 },
      });

      await h.receive('كم سعر القص؟');

      expect(h.lastCustomerMessage()).toBe('سعر القص 80 ريال');
      expect(h.aiChat).not.toHaveBeenCalled();
      expect(h.trackConversation).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({ wasCached: true, modelUsed: 'cached' }),
      );
      expect(h.cache.incrementInt).toHaveBeenCalled();
    });
  });

  describe('AI flow + safety net', () => {
    it('default AI reply → sanitizes, sends as text, persists conversation, tracks analytics', async () => {
      const h = makeHarness({
        aiResponse: { reply: 'تفضلي، نقدر نساعدك بالحجز.', intent: 'greeting' },
      });

      await h.receive('السلام');

      expect(h.sanitize).toHaveBeenCalled();
      expect(h.lastCustomerMessage()).toContain('نقدر نساعدك');
      expect(h.updateFromAIResponse).toHaveBeenCalledWith('tenant-1', customerPhone, expect.any(Object));
      expect(h.cacheResponse).toHaveBeenCalled();
      expect(h.trackConversation).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({ wasCached: false, intent: 'greeting' }),
      );
    });

    it('messageType=buttons → routes through Rich Media buttons surface', async () => {
      const h = makeHarness({
        aiResponse: {
          reply: 'تأكيد الحجز؟',
          intent: 'general',
          messageType: 'buttons',
          buttons: ['نعم', 'لا'],
        },
      });

      await h.receive('ابي أأكد');

      expect(h.sendButtons).toHaveBeenCalledWith(expect.objectContaining({
        to: customerPhone,
        body: 'تأكيد الحجز؟',
        buttons: ['نعم', 'لا'],
      }));
    });

    it('messageType=list → routes through Rich Media list with salon services', async () => {
      const h = makeHarness({
        aiResponse: { reply: 'اختاري خدمة', messageType: 'list' },
      });

      await h.receive('وش الخدمات؟');

      expect(h.sendList).toHaveBeenCalledWith(expect.objectContaining({
        to: customerPhone,
        body: 'اختاري خدمة',
      }));
    });

    it('action=submit_booking with full extractedData → creates pending action and notifies manager', async () => {
      const h = makeHarness({
        aiResponse: {
          intent: 'book_appointment',
          action: 'submit_booking',
          reply: 'وصل طلبك، بانتظار تأكيد الصالون.',
          extractedData: { serviceName: 'قص وتصفيف', date: 'بكرة', time: '5 مساء', customerName: 'سارة' },
        },
      });

      await h.receive('احجزي لي قص بكرة 5 مساء، أنا سارة');

      expect(h.tenantDb.aIPendingAction.create).toHaveBeenCalledTimes(1);
      const action = h.pendingActions[0];
      expect(action.payload).toEqual(expect.objectContaining({
        serviceName: 'قص وتصفيف',
        clientName: 'سارة',
      }));
      expect(h.sendText.mock.calls.some((c) => c[0].to === managerPhone)).toBe(true);
      expect(h.trackConversation).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({ wasBooked: true, intent: 'book_appointment' }),
      );
    });

    it('action=submit_booking missing fields → asks the missing question instead of creating action', async () => {
      const h = makeHarness({
        aiResponse: {
          action: 'submit_booking',
          extractedData: { serviceName: 'قص وتصفيف', date: null, time: null, customerName: null },
          proposedAction: { type: 'book_appointment', payload: { serviceName: 'قص وتصفيف' } },
        },
      });

      await h.receive('احجزي قص');

      expect(h.tenantDb.aIPendingAction.create).not.toHaveBeenCalled();
      expect(h.lastCustomerMessage()).toMatch(/متى|الموعد/);
    });

    it('wantsToCancel=true → resets state and acknowledges cancellation', async () => {
      const h = makeHarness({
        aiResponse: { wantsToCancel: true, action: 'cancel', reply: 'تم، أوقفنا الطلب.' },
      });

      await h.receive('خلاص');

      expect(h.lastCustomerMessage()).toContain('أوقفنا');
      expect(h.conversation.state.bookingStep).toBe('cancelled');
      expect(h.conversation.state.doNotDisturb).toBe(true);
    });

    it('needsEscalation=true → records escalation and notifies manager', async () => {
      const h = makeHarness({
        aiResponse: {
          needsEscalation: true,
          action: 'escalate',
          escalationReason: 'complaint about service',
          reply: 'نعتذر، حوّلت طلبك للفريق.',
        },
      });

      await h.receive('عندي شكوى');

      expect(h.escalations).toHaveLength(1);
      expect(h.escalations[0]).toEqual(expect.objectContaining({
        escalationType: 'unclear',
        uncertainReason: 'complaint about service',
      }));
      expect(h.trackConversation).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({ wasEscalated: true }),
      );
    });
  });

  describe('memory + voice context injection', () => {
    it('appends memory context to the system prompt input', async () => {
      const h = makeHarness();
      h.buildMemoryContext.mockResolvedValueOnce('عميلة متكررة (12 زيارة)');

      await h.receive('السلام');

      const promptArg = h.buildReceptionV2SystemPrompt.mock.calls[0][0];
      expect(promptArg.stateContext).toContain('عميلة متكررة');
    });

    it('voiceMetadata adds voice note + flags analytics as voice', async () => {
      const h = makeHarness();

      await h.receive('نص مفرّغ', { isVoiceMessage: true, durationSeconds: 7 });

      const promptArg = h.buildReceptionV2SystemPrompt.mock.calls[0][0];
      expect(promptArg.stateContext).toContain('Whisper');
      expect(promptArg.stateContext).toContain('7 ثانية');
      expect(h.trackConversation).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({ wasVoice: true }),
      );
    });
  });

  describe('disabled / cooldown', () => {
    it('aiReceptionEnabled=false → sends disabled notice', async () => {
      const h = makeHarness({ settings: { aiReceptionEnabled: false } });

      await h.receive('السلام');

      expect(h.lastCustomerMessage()).toContain('غير مفعّل');
      expect(h.aiChat).not.toHaveBeenCalled();
    });

    it('per-phone cooldown blocks rapid second message', async () => {
      const h = makeHarness();
      (h.cache.incrementRateLimit as jest.Mock).mockResolvedValueOnce(2);

      await h.receive('سؤال');

      expect(h.aiChat).not.toHaveBeenCalled();
      expect(h.sendText).not.toHaveBeenCalled();
    });
  });
});
