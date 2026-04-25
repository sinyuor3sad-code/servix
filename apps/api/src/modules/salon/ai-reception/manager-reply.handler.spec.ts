import type { PlatformPrismaClient } from '../../../shared/database/platform.client';
import type { WhatsAppEvolutionService } from '../whatsapp-evolution/whatsapp-evolution.service';
import { ManagerReplyHandler } from './manager-reply.handler';

const managerPhone = '966511111111';
const customerPhone = '966500000000';

function makeHarness(actionOverrides: Record<string, unknown> = {}) {
  let conversation: any = {
    id: 'conv-1',
    phone: customerPhone,
    state: {
      currentIntent: 'booking',
      bookingStep: 'awaiting_owner_approval',
      selectedServiceName: 'قص وتصفيف',
      selectedDate: 'بكرة',
      selectedTime: '2 الظهر',
      customerName: 'سعد',
      quotedPrice: 80,
      requestId: 123,
      awaitingOwnerApproval: true,
      tonePreference: 'formal',
    },
  };
  const action: any = {
    id: 123,
    conversationId: conversation.id,
    type: 'book_appointment',
    payload: {
      serviceId: 'svc-cut-style',
      serviceName: 'قص وتصفيف',
      date: 'بكرة',
      time: '2 الظهر',
      clientName: 'سعد',
      quotedPrice: 80,
      employeeId: 'emp-1',
    },
    status: 'awaiting_manager',
    customerPhone,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    doNotDisturb: false,
    ...actionOverrides,
  };

  const tenantDb = {
    aIPendingAction: {
      findFirst: jest.fn(({ where }: any) => {
        if (where.id !== action.id) return null;
        return action;
      }),
      updateMany: jest.fn(({ where, data }: any) => {
        const matches =
          where.id === action.id &&
          (!where.status || where.status === action.status) &&
          (!where.doNotDisturb || action.doNotDisturb === where.doNotDisturb) &&
          (!where.expiresAt?.gt || action.expiresAt > where.expiresAt.gt);
        if (!matches) return { count: 0 };
        Object.assign(action, data);
        return { count: 1 };
      }),
    },
    aIConversation: {
      findUnique: jest.fn(({ where }: any) => (
        where.id === conversation.id ? conversation : null
      )),
      update: jest.fn(({ data }: any) => {
        conversation = { ...conversation, ...data };
        return conversation;
      }),
    },
    aIEscalation: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };

  const sendText = jest.fn().mockResolvedValue(undefined);
  const booking: { createConfirmedAppointmentFromAction: jest.Mock } = {
    createConfirmedAppointmentFromAction: jest.fn(async (_db: unknown, params: any) => {
      params.action.status = 'approved';
      params.action.resolvedBy = params.actorPhone;
      params.action.payload = {
        ...params.action.payload,
        appointmentId: 'appt-1',
        appointmentDate: '2026-04-25',
        appointmentStartTime: '14:00',
        employeeId: 'emp-1',
      };
      return {
        status: 'created',
        appointmentId: 'appt-1',
        serviceName: 'قص وتصفيف',
        dateIso: '2026-04-25',
        startTime: '14:00',
        displayTime: '2:00 ظهرًا',
        price: 80,
        employeeId: 'emp-1',
        payload: params.action.payload,
      };
    }),
  };
  const handler = new ManagerReplyHandler(
    {} as PlatformPrismaClient,
    { sendText } as unknown as WhatsAppEvolutionService,
    booking as never,
  );

  async function handle(text: string) {
    await handler.handle({
      tenantDb: tenantDb as any,
      tenantId: 'tenant-1',
      instanceName: 'salon-test',
      instanceToken: 'token',
      text,
      managerPhone,
    });
  }

  function messagesTo(phone: string) {
    return sendText.mock.calls
      .map((call) => call[0])
      .filter((payload) => payload.to === phone)
      .map((payload) => payload.message as string);
  }

  return {
    handler,
    tenantDb,
    action,
    sendText,
    booking,
    handle,
    messagesTo,
    get conversation() {
      return conversation;
    },
  };
}

describe('ManagerReplyHandler phase 4 owner decisions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('approves the correct request id only after creating an appointment', async () => {
    const h = makeHarness();

    await h.handle('موافق 123');

    expect(h.action.status).toBe('approved');
    expect(h.action.resolvedBy).toBe(managerPhone);
    expect(h.booking.createConfirmedAppointmentFromAction).toHaveBeenCalledWith(
      h.tenantDb,
      expect.objectContaining({
        allowedStatuses: ['awaiting_manager'],
        claimStatus: 'approved',
      }),
    );
    expect(h.conversation.state).toEqual(expect.objectContaining({
      bookingStep: 'completed',
      awaitingOwnerApproval: false,
      requestId: 123,
      appointmentId: 'appt-1',
      lastOwnerDecision: 'approved',
      tonePreference: 'formal',
    }));
    const customerMessage = h.messagesTo(customerPhone).join('\n');
    expect(customerMessage).toContain('تم تأكيد حجزك');
    expect(customerMessage).not.toContain('حجزك مؤكد');
    expect(h.messagesTo(managerPhone).join('\n')).toContain('تم تثبيت الحجز #123');
  });

  it('rejects the correct request id and updates state', async () => {
    const h = makeHarness();

    await h.handle('رفض 123');

    expect(h.action.status).toBe('rejected');
    expect(h.action.payload.metadata.rejectedBy).toBe(managerPhone);
    expect(h.conversation.state).toEqual(expect.objectContaining({
      bookingStep: 'cancelled',
      awaitingOwnerApproval: false,
      lastOwnerDecision: 'rejected',
      tonePreference: 'formal',
    }));
    expect(h.messagesTo(customerPhone).join('\n')).toContain('الوقت المطلوب غير متاح');
    expect(h.messagesTo(managerPhone).join('\n')).toContain('تم رفض الطلب #123');
  });

  it('does not send final confirmation when appointment creation has a conflict', async () => {
    const h = makeHarness();
    h.booking.createConfirmedAppointmentFromAction.mockResolvedValueOnce({
      status: 'conflict',
      reason: 'slot_unavailable',
    });

    await h.handle('موافق 123');

    const customerMessage = h.messagesTo(customerPhone).join('\n');
    expect(customerMessage).not.toContain('تم تأكيد حجزك');
    expect(customerMessage).toContain('لم يعد متاح');
    expect(h.messagesTo(managerPhone).join('\n')).toContain('تعذر تثبيت الطلب #123');
    expect(h.conversation.state).toEqual(expect.objectContaining({
      bookingStep: 'awaiting_owner_approval',
      awaitingOwnerApproval: true,
    }));
  });

  it('sends an alternative time to the customer without approving the booking', async () => {
    const h = makeHarness();

    await h.handle('بديل 123 5:30 مساءً');

    expect(h.action.status).toBe('awaiting_customer');
    expect(h.action.payload.alternativeTime).toBe('5:30 مساءً');
    expect(h.action.payload.metadata.alternativeSuggestedBy).toBe(managerPhone);
    expect(h.conversation.state).toEqual(expect.objectContaining({
      bookingStep: 'awaiting_customer_alternative_confirmation',
      awaitingOwnerApproval: false,
      requestId: 123,
      alternativeTime: '5:30 مساءً',
      lastOwnerDecision: 'alternative',
      tonePreference: 'formal',
    }));
    expect(h.messagesTo(customerPhone).join('\n')).toContain('الصالون اقترح وقتًا بديلًا: 5:30 مساءً');
    expect(h.messagesTo(customerPhone).join('\n')).not.toContain('تم تأكيد');
    expect(h.messagesTo(managerPhone).join('\n')).toContain('تم إرسال الوقت البديل');
  });

  it('asks the owner for request id when the command omits it', async () => {
    const h = makeHarness();

    await h.handle('موافق');

    expect(h.action.status).toBe('awaiting_manager');
    expect(h.messagesTo(managerPhone).join('\n')).toContain('فضلاً اكتب رقم الطلب');
    expect(h.messagesTo(customerPhone)).toEqual([]);
  });

  it('returns not found for an unknown request id', async () => {
    const h = makeHarness();

    await h.handle('موافق 999');

    expect(h.messagesTo(managerPhone).join('\n')).toContain('لم أجد طلبًا بهذا الرقم');
    expect(h.messagesTo(customerPhone)).toEqual([]);
  });

  it.each([
    ['approved'],
    ['expired'],
    ['cancelled_by_customer'],
  ])('does not process a request that is no longer awaiting approval: %s', async (status) => {
    const h = makeHarness({ status });

    await h.handle('موافق 123');

    expect(h.action.status).toBe(status);
    expect(h.messagesTo(managerPhone).join('\n')).toContain('هذا الطلب لم يعد بانتظار الموافقة');
    expect(h.messagesTo(customerPhone)).toEqual([]);
  });
});
