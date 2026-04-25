import type { ConfigService } from '@nestjs/config';
import type { TenantClientFactory } from '../../../shared/database/tenant-client.factory';
import type { PlatformPrismaClient } from '../../../shared/database/platform.client';
import type { CacheService } from '../../../shared/cache/cache.service';
import type { WhatsAppEvolutionService } from '../whatsapp-evolution/whatsapp-evolution.service';
import type { WhatsAppAntiBanService } from '../whatsapp-evolution/whatsapp-anti-ban.service';
import type { FeaturesService } from '../../../core/features/features.service';
import type { AIContextBuilder, SalonContextForAI } from './ai-context.builder';
import type { N8nClient } from './n8n.client';
import type { GeminiService } from '../../../shared/ai/gemini.service';
import { AIReceptionService } from './ai-reception.service';
import type { AIReceptionRuntimeSettings } from './ai-reception-settings.service';

type Mock = jest.Mock;

const customerPhone = '966500000000';
const managerPhone = '966511111111';

const salonContext: SalonContextForAI = {
  salonName: 'Salon',
  employeeName: 'Sara',
  workingHours: '10:00-22:00',
  workingDays: {},
  services: [
    { id: 'svc-cut-style', name: 'قص وتصفيف', price: 80, duration: 60, category: 'hair' },
    { id: 'svc-dye', name: 'صبغة كاملة', price: 150, duration: 120, category: 'hair' },
  ],
  employees: [],
  policies: { cancellationNotice: '24h', currency: 'SAR', taxPercentage: 15 },
  knowledgeSnippets: [],
};

function makeHarness(options: {
  settings?: Partial<AIReceptionRuntimeSettings>;
  n8nResponse?: unknown;
  n8nRejects?: boolean;
} = {}) {
  let conversation: any = null;
  const pendingActions: any[] = [];
  const escalations: any[] = [];
  const runtimeSettings: AIReceptionRuntimeSettings = {
    aiReceptionEnabled: true,
    aiManagerPhone: managerPhone,
    tone: 'light_gulf',
    welcomeMessage: 'حياك الله، كيف أقدر أساعدك؟ للحجز أو الأسعار أو تعديل موعد.',
    managerApprovalTimeoutMinutes: 30,
    maxUnderstandingFailures: 2,
    escalationCooldownMinutes: 10,
    bookingConfirmationMode: 'manual',
    privacyMessageEnabled: false,
    privacyMessage: 'سيتم استخدام بياناتك فقط لإدارة الحجز والتواصل بخصوص الموعد.',
    avoidedPhrases: ['حبيبتي', 'الغالية'],
    customEscalationKeywords: [],
    showEmployeeNamesToCustomers: false,
    availableSlotsLimit: 3,
    ...options.settings,
  };

  const tenantDb = {
    aIConversation: {
      findUnique: jest.fn(({ where }: any) => {
        if (!conversation) return null;
        if (where.phone) return conversation.phone === where.phone ? conversation : null;
        if (where.id) return conversation.id === where.id ? conversation : null;
        return null;
      }),
      create: jest.fn(({ data }: any) => {
        conversation = {
          id: 'conv-1',
          state: {},
          createdAt: new Date(),
          ...data,
        };
        return conversation;
      }),
      update: jest.fn(({ data }: any) => {
        conversation = {
          ...conversation,
          ...data,
        };
        return conversation;
      }),
    },
    aIPendingAction: {
      create: jest.fn(({ data }: any) => {
        const action = {
          id: pendingActions.length + 1,
          status: 'awaiting_manager',
          createdAt: new Date(),
          payload: data.payload,
          doNotDisturb: false,
          ...data,
        };
        pendingActions.push(action);
        return action;
      }),
      updateMany: jest.fn(({ where, data }: any) => {
        let count = 0;
        for (const action of pendingActions) {
          const matches =
            (!where.id || action.id === where.id) &&
            (!where.customerPhone || action.customerPhone === where.customerPhone) &&
            (!where.status || action.status === where.status) &&
            (where.doNotDisturb === undefined || action.doNotDisturb === where.doNotDisturb);
          if (matches) {
            Object.assign(action, data);
            count += 1;
          }
        }
        return { count };
      }),
      findFirst: jest.fn(({ where }: any) => (
        pendingActions.find((action) =>
          (!where?.customerPhone || action.customerPhone === where.customerPhone) &&
          (!where?.status || action.status === where.status)
        ) || null
      )),
    },
    aIEscalation: {
      findFirst: jest.fn(({ where }: any) => {
        const createdAt = where?.createdAt || {};
        return escalations
          .filter((item) =>
            (!where?.conversationId || item.conversationId === where.conversationId) &&
            (!where?.escalationType || item.escalationType === where.escalationType) &&
            (!where?.status || item.status === where.status) &&
            (!createdAt.gte || item.createdAt >= createdAt.gte) &&
            (!createdAt.gt || item.createdAt > createdAt.gt)
          )
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] || null;
      }),
      create: jest.fn(({ data }: any) => {
        const escalation = {
          id: escalations.length + 1,
          createdAt: new Date(),
          ...data,
        };
        escalations.push(escalation);
        return escalation;
      }),
      update: jest.fn(({ where, data }: any) => {
        const escalation = escalations.find((item) => item.id === where.id);
        if (!escalation) return null;
        for (const [key, value] of Object.entries(data)) {
          if (value && typeof value === 'object' && 'increment' in value) {
            escalation[key] = (escalation[key] || 0) + Number((value as any).increment);
          } else {
            escalation[key] = value;
          }
        }
        return escalation;
      }),
    },
    setting: {
      findMany: jest.fn().mockResolvedValue([
        { key: 'ai_manager_phone', value: managerPhone },
        { key: 'ai_tone', value: 'friendly' },
        { key: 'ai_approval_timeout_minutes', value: '30' },
      ]),
    },
    $queryRawUnsafe: jest.fn(async (_query: string, phone: string) => {
      const action = pendingActions.find((item) =>
        item.customerPhone === phone && item.status === 'awaiting_manager'
      );
      if (!action) return [];
      action.status = 'cancelled_by_customer';
      action.doNotDisturb = true;
      return [{ id: action.id }];
    }),
  };

  const sendText = jest.fn().mockResolvedValue(undefined);
  const booking = {
    getAvailableSlotsForConversation: jest.fn().mockResolvedValue({
      status: 'available',
      dateIso: '2026-04-25',
      slots: [
        { time: '14:00', displayTime: '2:00 ظهرًا', employeeId: 'emp-1' },
        { time: '16:30', displayTime: '4:30 مساءً', employeeId: 'emp-1' },
        { time: '18:00', displayTime: '6:00 مساءً', employeeId: 'emp-2' },
      ],
    }),
    verifyRequestedSlot: jest.fn().mockResolvedValue({
      status: 'available',
      dateIso: '2026-04-25',
      time: '14:00',
      slots: [{ time: '14:00', displayTime: '2:00 ظهرًا', employeeId: 'emp-1' }],
    }),
    createConfirmedAppointmentFromAction: jest.fn(async (_db: unknown, params: any) => {
      const action = params.action;
      action.status = 'approved';
      action.payload = {
        ...action.payload,
        appointmentId: 'appt-1',
        appointmentDate: '2026-04-25',
        appointmentStartTime: '17:30',
        employeeId: 'emp-1',
      };
      return {
        status: 'created',
        appointmentId: 'appt-1',
        serviceName: 'قص وتصفيف',
        dateIso: '2026-04-25',
        startTime: '17:30',
        displayTime: '5:30 مساءً',
        price: 80,
        employeeId: 'emp-1',
        payload: action.payload,
      };
    }),
  };
  const service = new AIReceptionService(
    {} as ConfigService,
    {} as PlatformPrismaClient,
    { getTenantClient: jest.fn(() => tenantDb) } as unknown as TenantClientFactory,
    { incrementRateLimit: jest.fn().mockResolvedValue(1) } as unknown as CacheService,
    {} as FeaturesService,
    { sendText } as unknown as WhatsAppEvolutionService,
    {} as WhatsAppAntiBanService,
    { buildForTenant: jest.fn().mockResolvedValue(salonContext) } as unknown as AIContextBuilder,
    {
      callAIReception: options.n8nRejects === false
        ? jest.fn().mockResolvedValue(options.n8nResponse)
        : jest.fn().mockRejectedValue(new Error('should not call n8n for booking state')),
    } as unknown as N8nClient,
    {
      buildReceptionSystemPrompt: jest.fn().mockReturnValue('phase-2-system-prompt'),
      receptionChat: jest.fn(),
    } as unknown as GeminiService,
    booking as never,
    { get: jest.fn().mockResolvedValue(runtimeSettings) } as never,
  );

  async function receive(text: string) {
    await service.handleCustomerMessage({
      tenantId: 'tenant-1',
      databaseName: 'tenant_db',
      instanceName: 'salon-test',
      instanceToken: 'token',
      phone: customerPhone,
      text,
    });
  }

  function customerMessages() {
    return sendText.mock.calls
      .map((call) => call[0])
      .filter((payload) => payload.to === customerPhone)
      .map((payload) => payload.message as string);
  }

  function lastCustomerMessage() {
    const messages = customerMessages();
    return messages[messages.length - 1] || '';
  }

  function messagesTo(phone: string) {
    return sendText.mock.calls
      .map((call) => call[0])
      .filter((payload) => payload.to === phone)
      .map((payload) => payload.message as string);
  }

  return {
    service,
    tenantDb,
    sendText,
    booking,
    receive,
    customerMessages,
    lastCustomerMessage,
    messagesTo,
    get conversation() {
      return conversation;
    },
    get pendingActions() {
      return pendingActions;
    },
    get escalations() {
      return escalations;
    },
  };
}

describe('AIReceptionService conversation state machine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('asks only for the missing service when the customer asks to book tomorrow', async () => {
    const h = makeHarness();

    await h.receive('ابي حجز بكرة');

    expect(h.lastCustomerMessage()).toContain('وش الخدمة المطلوبة');
    expect(h.conversation.state.bookingStep).toBe('ask_service');
    expect(h.conversation.state.selectedDate).toBe('بكرة');
    expect(h.tenantDb.aIPendingAction.create).not.toHaveBeenCalled();
  });

  it('asks only for the missing time after service and date are known', async () => {
    const h = makeHarness();

    await h.receive('ابي حجز بكرة');
    await h.receive('قص وتصفيف');

    expect(h.lastCustomerMessage()).toContain('أي وقت يناسبك');
    expect(h.conversation.state.bookingStep).toBe('ask_time');
    expect(h.conversation.state.selectedServiceName).toBe('قص وتصفيف');
    expect(h.conversation.state.quotedPrice).toBe(80);
    expect(h.tenantDb.aIPendingAction.create).not.toHaveBeenCalled();
  });

  it('shows a summary after complete data and creates the pending action only after customer approval', async () => {
    const h = makeHarness();

    await h.receive('ابي حجز بكرة');
    await h.receive('قص وتصفيف');
    await h.receive('٢ الظهر');
    await h.receive('سعد');

    expect(h.lastCustomerMessage()).toContain('ملخص طلبك');
    expect(h.lastCustomerMessage()).toContain('قص وتصفيف');
    expect(h.lastCustomerMessage()).toContain('80');
    expect(h.tenantDb.aIPendingAction.create).not.toHaveBeenCalled();

    await h.receive('نعم');

    expect(h.tenantDb.aIPendingAction.create).toHaveBeenCalledTimes(1);
    expect(h.pendingActions[0].payload).toEqual(expect.objectContaining({
      serviceName: 'قص وتصفيف',
      date: '2026-04-25',
      time: '14:00',
      employeeId: 'emp-1',
      clientName: 'سعد',
      quotedPrice: 80,
    }));
    expect(h.conversation.state.bookingStep).toBe('awaiting_owner_approval');
    expect(h.conversation.state.requestId).toBe(1);
    expect(h.lastCustomerMessage()).toContain('بانتظار تأكيد');
    expect(h.sendText.mock.calls.some((call) => call[0].to === managerPhone)).toBe(true);
  });

  it('uses managerApprovalTimeoutMinutes for new pending action expiry', async () => {
    const h = makeHarness({ settings: { managerApprovalTimeoutMinutes: 7 } });
    const before = Date.now();

    await h.receive('ابي حجز بكرة');
    await h.receive('قص وتصفيف');
    await h.receive('٢ الظهر');
    await h.receive('سعد');
    await h.receive('نعم');

    const expiresAt = h.pendingActions[0].expiresAt as Date;
    const deltaMinutes = Math.round((expiresAt.getTime() - before) / 60000);
    expect(deltaMinutes).toBeGreaterThanOrEqual(6);
    expect(deltaMinutes).toBeLessThanOrEqual(8);
  });

  it('passes selected tone into the reception prompt builder', async () => {
    const h = makeHarness({ settings: { tone: 'luxury' } });
    const gemini = (h.service as any).gemini as { buildReceptionSystemPrompt: Mock };

    await h.receive('ابي حجز بكرة');

    expect(gemini.buildReceptionSystemPrompt).toHaveBeenCalledWith(
      expect.any(Object),
      'luxury',
      undefined,
    );
  });

  it('keeps booking state when the customer asks for the menu during booking', async () => {
    const h = makeHarness();

    await h.receive('ابي حجز');
    await h.receive('وش الخدمات؟');

    expect(h.lastCustomerMessage()).toContain('قص وتصفيف');
    expect(h.lastCustomerMessage()).toContain('ولإكمال الحجز');
    expect(h.conversation.state.bookingStep).toBe('ask_service');
  });

  it('answers price questions during booking without changing the official price', async () => {
    const h = makeHarness();

    await h.receive('ابي حجز بكرة');
    await h.receive('قص وتصفيف');
    await h.receive('كم السعر؟');

    expect(h.lastCustomerMessage()).toContain('80');
    expect(h.conversation.state.quotedPrice).toBe(80);
    expect(h.conversation.state.bookingStep).toBe('ask_time');
  });

  it('rejects price negotiation and does not change quotedPrice', async () => {
    const h = makeHarness();

    await h.receive('ابي حجز بكرة');
    await h.receive('قص وتصفيف ما يصير 50؟');

    expect(h.lastCustomerMessage()).toContain('السعر الحالي');
    expect(h.lastCustomerMessage()).toContain('80');
    expect(h.conversation.state.quotedPrice).toBe(80);
    expect(h.escalations[0]).toEqual(expect.objectContaining({
      escalationType: 'special_discount',
      lastCustomerMessage: 'قص وتصفيف ما يصير 50؟',
    }));
    expect(h.tenantDb.aIPendingAction.create).not.toHaveBeenCalled();
  });

  it('updates service and official price when the customer changes service', async () => {
    const h = makeHarness();

    await h.receive('ابي حجز بكرة');
    await h.receive('قص وتصفيف');
    await h.receive('صبغة كاملة');

    expect(h.conversation.state.selectedServiceName).toBe('صبغة كاملة');
    expect(h.conversation.state.quotedPrice).toBe(150);
    expect(h.lastCustomerMessage()).toContain('أي وقت يناسبك');
  });

  it('cancels the current booking state when the customer says cancel', async () => {
    const h = makeHarness();

    await h.receive('ابي حجز بكرة');
    await h.receive('إلغاء');

    expect(h.lastCustomerMessage()).toContain('تم إلغاء طلب الحجز الحالي');
    expect(h.conversation.state.bookingStep).toBe('cancelled');
    expect(h.conversation.state.selectedDate).toBeUndefined();
  });

  it('escalates after two failed understanding attempts during booking', async () => {
    const h = makeHarness();

    await h.receive('ابي حجز');
    await h.receive('ززز');
    await h.receive('ززز');

    expect(h.lastCustomerMessage()).toContain('ما قدرت أفهم طلبك');
    expect(h.conversation.state.currentIntent).toBe('needs_human');
    expect(h.conversation.state.failedUnderstandingCount).toBe(2);
    expect(h.escalations[0]).toEqual(expect.objectContaining({
      escalationType: 'unclear',
      relatedRequestId: null,
    }));
    expect(h.messagesTo(managerPhone).join('\n')).toContain('تصعيد من الاستقبال الذكي');
  });

  it('respects maxUnderstandingFailures before escalating', async () => {
    const h = makeHarness({ settings: { maxUnderstandingFailures: 3 } });

    await h.receive('ابي حجز');
    await h.receive('ززز');
    await h.receive('ززز');

    expect(h.escalations).toHaveLength(0);

    await h.receive('ززز');

    expect(h.escalations[0].escalationType).toBe('unclear');
  });

  it('stores formal tone preference after customer objection', async () => {
    const h = makeHarness();

    await h.receive('لا تقولين حبيبتي');

    expect(h.lastCustomerMessage()).toContain('راح أستخدم أسلوبًا رسميًا');
    expect(h.conversation.state.tonePreference).toBe('formal');
  });

  it('keeps phase 1 stop-follow-up safeguard and marks state as do-not-disturb', async () => {
    const h = makeHarness();

    await h.receive('ابي حجز بكرة');
    await h.receive('قص وتصفيف');
    await h.receive('٢ الظهر');
    await h.receive('سعد');
    await h.receive('نعم');
    await h.receive('توقف');

    expect(h.lastCustomerMessage()).toContain('أوقفنا المتابعة');
    expect(h.pendingActions[0].status).toBe('cancelled_by_customer');
    expect(h.conversation.state.doNotDisturb).toBe(true);
    expect(h.conversation.state.bookingStep).toBe('cancelled');
  });

  it('creates an internal escalation and notifies the manager for complaints before AI fallback', async () => {
    const h = makeHarness();

    await h.receive('أبغى أشتكي من التأخير');

    expect(h.lastCustomerMessage()).toContain('تم رفع ملاحظتك للإدارة');
    expect(h.escalations).toHaveLength(1);
    expect(h.escalations[0]).toEqual(expect.objectContaining({
      escalationType: 'complaint',
      customerPhone,
      lastCustomerMessage: 'أبغى أشتكي من التأخير',
      notifiedManager: true,
      occurrenceCount: 1,
    }));
    expect(h.messagesTo(managerPhone).join('\n')).toContain('النوع: complaint');
  });

  it('uses escalationCooldownMinutes to allow a fresh notification after the configured window', async () => {
    const h = makeHarness({ settings: { escalationCooldownMinutes: 1 } });

    await h.receive('أبغى أشتكي من التأخير');
    h.escalations[0].createdAt = new Date(Date.now() - 2 * 60 * 1000);
    await h.receive('أكرر الشكوى من التأخير');

    expect(h.escalations).toHaveLength(2);
    expect(h.messagesTo(managerPhone).filter((message) =>
      message.includes('تصعيد من الاستقبال الذكي')
    )).toHaveLength(2);
  });

  it('routes abuse or threats to the team without a marketing reply', async () => {
    const h = makeHarness();

    await h.receive('أنتم حرامية');

    expect(h.lastCustomerMessage()).toContain('تم تحويل المحادثة للفريق');
    expect(h.lastCustomerMessage()).not.toContain('الخدمات');
    expect(h.escalations[0].escalationType).toBe('abuse_or_threat');
  });

  it('does not invent unavailable services and escalates them internally', async () => {
    const h = makeHarness();

    await h.receive('عندكم مساج ملكي؟');

    expect(h.lastCustomerMessage()).toContain('ما عندي هذه الخدمة ضمن القائمة الحالية');
    expect(h.lastCustomerMessage()).not.toContain('سعر');
    expect(h.escalations[0]).toEqual(expect.objectContaining({
      escalationType: 'unavailable_service',
      lastCustomerMessage: 'عندكم مساج ملكي؟',
    }));
  });

  it('keeps one manager notification per conversation and escalation type during cooldown', async () => {
    const h = makeHarness();

    await h.receive('أبغى أشتكي من التأخير');
    await h.receive('أكرر الشكوى من التأخير');

    expect(h.escalations).toHaveLength(1);
    expect(h.escalations[0].occurrenceCount).toBe(2);
    expect(h.escalations[0].lastCustomerMessage).toBe('أكرر الشكوى من التأخير');
    expect(h.messagesTo(managerPhone).filter((message) =>
      message.includes('تصعيد من الاستقبال الذكي')
    )).toHaveLength(1);
  });

  it('stores relatedRequestId and preserves booking state fields when escalating during a booking', async () => {
    const h = makeHarness();

    await h.receive('ابي حجز بكرة');
    await h.receive('قص وتصفيف');
    await h.receive('٢ الظهر');
    await h.receive('سعد');
    await h.receive('نعم');
    h.conversation.state = {
      ...h.conversation.state,
      tonePreference: 'formal',
    };

    await h.receive('أبغى أشتكي من التأخير');

    expect(h.escalations[0]).toEqual(expect.objectContaining({
      escalationType: 'complaint',
      relatedRequestId: 1,
      customerName: 'سعد',
    }));
    expect(h.conversation.state.bookingStep).toBe('awaiting_owner_approval');
    expect(h.conversation.state.selectedServiceName).toBe('قص وتصفيف');
    expect(h.conversation.state.tonePreference).toBe('formal');
  });

  it('uses availableSlotsLimit when listing real availability', async () => {
    const h = makeHarness({ settings: { availableSlotsLimit: 5 } });

    await h.receive('ابي حجز قص وتصفيف بكرة');

    expect(h.booking.getAvailableSlotsForConversation).toHaveBeenCalledWith(
      h.tenantDb,
      expect.objectContaining({ limit: 5 }),
    );
  });

  it('sends privacy message only once at the first booking step when enabled', async () => {
    const h = makeHarness({ settings: { privacyMessageEnabled: true } });

    await h.receive('ابي حجز بكرة');
    expect(h.lastCustomerMessage()).toContain('سيتم استخدام بياناتك فقط');
    expect(h.conversation.state.privacyMessageSent).toBe(true);

    await h.receive('قص وتصفيف');
    expect(h.lastCustomerMessage()).not.toContain('سيتم استخدام بياناتك فقط');
  });

  it('post-processes avoided phrases from AI replies', async () => {
    const h = makeHarness({
      n8nRejects: false,
      n8nResponse: {
        intent: 'inquiry',
        reply: 'حبيبتي حياك الله، كيف أساعدك؟',
        proposedAction: null,
        success: true,
      },
    });

    await h.receive('السلام على الجميع');

    expect(h.lastCustomerMessage()).not.toContain('حبيبتي');
    expect(h.lastCustomerMessage()).toContain('حياك الله');
  });

  it('uses customEscalationKeywords before AI fallback', async () => {
    const h = makeHarness({ settings: { customEscalationKeywords: ['تأخير الموظفة'] } });

    await h.receive('عندي ملاحظة عن تأخير الموظفة');

    expect(h.escalations[0]).toEqual(expect.objectContaining({
      escalationType: 'complaint',
      uncertainReason: 'custom_escalation_keyword',
    }));
    expect(h.messagesTo(managerPhone).join('\n')).toContain('تصعيد من الاستقبال الذكي');
  });

  it('creates a real appointment when the customer accepts an alternative time', async () => {
    const h = makeHarness();

    await h.receive('ابي حجز بكرة');
    await h.receive('قص وتصفيف');
    await h.receive('٢ الظهر');
    await h.receive('سعد');
    await h.receive('نعم');

    h.pendingActions[0].status = 'awaiting_customer';
    h.pendingActions[0].payload = {
      ...h.pendingActions[0].payload,
      metadata: { alternativeTime: '5:30 مساءً' },
    };
    h.conversation.state = {
      ...h.conversation.state,
      bookingStep: 'awaiting_customer_alternative_confirmation',
      alternativeTime: '5:30 مساءً',
      awaitingOwnerApproval: false,
    };

    await h.receive('مناسب');

    expect(h.booking.createConfirmedAppointmentFromAction).toHaveBeenCalledWith(
      h.tenantDb,
      expect.objectContaining({
        allowedStatuses: ['awaiting_customer'],
        claimStatus: 'customer_accepted_alternative',
        timeTextOverride: '5:30 مساءً',
      }),
    );
    expect(h.pendingActions[0].status).toBe('approved');
    expect(h.conversation.state.selectedTime).toBe('17:30');
    expect(h.conversation.state.appointmentId).toBe('appt-1');
    expect(h.conversation.state.bookingStep).toBe('completed');
    expect(h.sendText.mock.calls.some((call) =>
      call[0].to === managerPhone &&
      String(call[0].message).includes('تم تثبيت الحجز')
    )).toBe(true);
    expect(h.lastCustomerMessage()).toContain('تم تأكيد حجزك');
  });

  it('returns to ask_time when the customer rejects an alternative time', async () => {
    const h = makeHarness();

    await h.receive('ابي حجز بكرة');
    await h.receive('قص وتصفيف');
    await h.receive('٢ الظهر');
    await h.receive('سعد');
    await h.receive('نعم');

    h.pendingActions[0].status = 'awaiting_customer';
    h.conversation.state = {
      ...h.conversation.state,
      bookingStep: 'awaiting_customer_alternative_confirmation',
      alternativeTime: '5:30 مساءً',
      awaitingOwnerApproval: false,
    };

    await h.receive('ما يناسب');

    expect(h.pendingActions[0].status).toBe('alternative_rejected');
    expect(h.conversation.state.bookingStep).toBe('ask_time');
    expect(h.conversation.state.selectedTime).toBeUndefined();
    expect(h.lastCustomerMessage()).toContain('أي وقت آخر يناسبك');
  });

  it('still builds the phase 2 system prompt before state handling', async () => {
    const h = makeHarness();
    const gemini = (h.service as any).gemini as { buildReceptionSystemPrompt: Mock };

    await h.receive('ابي حجز بكرة');

    expect(gemini.buildReceptionSystemPrompt).toHaveBeenCalledTimes(1);
  });
});
