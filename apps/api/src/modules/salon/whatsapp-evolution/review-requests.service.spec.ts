import { ReviewRequestsService } from './review-requests.service';
import { validateSetting } from '../settings/settings.schema';

function makeHarness(options: {
  settings?: Record<string, string>;
  invoices?: any[];
  reviewRequests?: any[];
  salonInfo?: any;
  antiBanAllowed?: boolean;
  antiBanReason?: string;
} = {}) {
  const now = new Date();
  const invoices = options.invoices ?? [];
  const reviewRequests = options.reviewRequests ?? [];
  const invoiceFeedbacks: any[] = [];
  const conversations: any[] = [];
  const escalations: any[] = [];

  const settings = {
    review_request_enabled: 'true',
    review_request_delay_minutes: '60',
    google_review_url: '',
    low_rating_threshold: '3',
    high_rating_threshold: '4',
    review_request_message: 'نسعد بمعرفة تقييمك لتجربتك من 1 إلى 5.',
    low_rating_response_message: 'نعتذر عن تجربتك. تم رفع ملاحظتك للإدارة لتحسين الخدمة.',
    high_rating_response_message: 'شكرًا لتقييمك. يسعدنا دعمك بتقييمنا على Google: [googleReviewUrl]',
    ai_manager_phone: '966511111111',
    ...(options.settings ?? {}),
  };

  const db: any = {
    invoice: {
      findUnique: jest.fn(({ where }) => invoices.find((item) => item.id === where.id) ?? null),
      findMany: jest.fn(() => invoices.filter((item) =>
        item.status === 'paid' &&
        !reviewRequests.some((request) => request.invoiceId === item.id),
      )),
    },
    reviewRequest: {
      findFirst: jest.fn(({ where, orderBy }) => {
        let result = reviewRequests.filter((item) => {
          if (where?.OR) {
            return where.OR.some((clause: any) =>
              (clause.invoiceId && item.invoiceId === clause.invoiceId) ||
              (clause.appointmentId && item.appointmentId === clause.appointmentId),
            );
          }
          if (where?.customerPhone && item.customerPhone !== where.customerPhone) return false;
          if (where?.status && item.status !== where.status) return false;
          if (where?.expiresAt?.gt && !(item.expiresAt > where.expiresAt.gt)) return false;
          if (where?.respondedAt?.gte && !(item.respondedAt >= where.respondedAt.gte)) return false;
          if (where?.rating?.lte && !(item.rating <= where.rating.lte)) return false;
          if (where?.feedbackText === null && item.feedbackText !== null && item.feedbackText !== undefined) return false;
          return true;
        });
        if (orderBy?.requestSentAt === 'desc') {
          result = result.sort((a, b) => Number(b.requestSentAt ?? 0) - Number(a.requestSentAt ?? 0));
        }
        if (orderBy?.respondedAt === 'desc') {
          result = result.sort((a, b) => Number(b.respondedAt ?? 0) - Number(a.respondedAt ?? 0));
        }
        return result[0] ?? null;
      }),
      create: jest.fn(({ data }) => {
        const created = { id: `rr-${reviewRequests.length + 1}`, ...data, createdAt: now, updatedAt: now };
        reviewRequests.push(created);
        return created;
      }),
      update: jest.fn(({ where, data }) => {
        const item = reviewRequests.find((request) => request.id === where.id);
        if (!item) throw new Error('missing review request');
        Object.assign(item, data);
        return item;
      }),
      updateMany: jest.fn(({ where, data }) => {
        let count = 0;
        for (const item of reviewRequests) {
          if (where?.status?.in && !where.status.in.includes(item.status)) continue;
          if (where?.expiresAt?.lt && !(item.expiresAt < where.expiresAt.lt)) continue;
          Object.assign(item, data);
          count += 1;
        }
        return { count };
      }),
    },
    invoiceFeedback: {
      upsert: jest.fn(({ where, create, update }) => {
        let feedback = invoiceFeedbacks.find((item) => item.invoiceId === where.invoiceId);
        if (!feedback) {
          feedback = { id: `fb-${invoiceFeedbacks.length + 1}`, ...create };
          invoiceFeedbacks.push(feedback);
        } else {
          Object.assign(feedback, update);
        }
        return feedback;
      }),
      updateMany: jest.fn(({ where, data }) => {
        let count = 0;
        for (const item of invoiceFeedbacks) {
          if (item.invoiceId !== where.invoiceId) continue;
          Object.assign(item, data);
          count += 1;
        }
        return { count };
      }),
    },
    aIConversation: {
      findUnique: jest.fn(({ where }) => conversations.find((item) => item.phone === where.phone) ?? null),
      create: jest.fn(({ data, select }) => {
        const created = { id: `conv-${conversations.length + 1}`, ...data };
        conversations.push(created);
        return select?.id ? { id: created.id } : created;
      }),
      update: jest.fn(({ where, data, select }) => {
        const item = conversations.find((conversation) => conversation.phone === where.phone);
        Object.assign(item, data);
        return select?.id ? { id: item.id } : item;
      }),
    },
    aIEscalation: {
      create: jest.fn(({ data }) => {
        const created = { id: escalations.length + 1, ...data };
        escalations.push(created);
        return created;
      }),
      update: jest.fn(({ where, data }) => {
        const item = escalations.find((escalation) => escalation.id === where.id);
        Object.assign(item, data);
        return item;
      }),
    },
    salonInfo: {
      findFirst: jest.fn(({ select }) => {
        const info = options.salonInfo ?? { nameAr: 'صالون دنتيلا', googleMapsUrl: null };
        if (!select) return info;
        return Object.fromEntries(Object.keys(select).map((key) => [key, info[key]]));
      }),
    },
    $queryRawUnsafe: jest.fn(() => {
      const due = reviewRequests
        .filter((item) => item.status === 'pending' && item.dueAt <= new Date() && item.expiresAt > new Date())
        .slice(0, 50);
      for (const item of due) item.status = 'sending';
      return due.map((item) => ({
        id: item.id,
        appointmentId: item.appointmentId ?? null,
        invoiceId: item.invoiceId ?? null,
        customerPhone: item.customerPhone,
        customerName: item.customerName ?? null,
      }));
    }),
  };

  const sendText = jest.fn().mockResolvedValue(undefined);
  const service = new ReviewRequestsService(
    { whatsAppInstance: { findMany: jest.fn() } } as any,
    { getTenantClient: jest.fn() } as any,
    { getAll: jest.fn().mockResolvedValue(settings) } as any,
    {
      check: jest.fn().mockResolvedValue({
        allowed: options.antiBanAllowed ?? true,
        reason: options.antiBanReason,
        delayMs: 0,
      }),
    } as any,
    { sendText } as any,
  );

  return { service, db, invoices, reviewRequests, invoiceFeedbacks, conversations, escalations, sendText };
}

describe('ReviewRequestsService', () => {
  it('does not schedule review requests when disabled', async () => {
    const h = makeHarness({ settings: { review_request_enabled: 'false' } });
    await expect(h.service.scheduleForPaidInvoice(h.db, 'inv-1')).resolves.toEqual({ status: 'disabled' });
    expect(h.db.invoice.findUnique).not.toHaveBeenCalled();
  });

  it('schedules a paid invoice review request with the configured delay', async () => {
    const paidAt = new Date('2026-04-25T10:00:00.000Z');
    const h = makeHarness({
      invoices: [{
        id: 'inv-1',
        status: 'paid',
        paidAt,
        appointmentId: null,
        client: { fullName: 'سعد', phone: '0501234567' },
      }],
    });

    await h.service.scheduleForPaidInvoice(h.db, 'inv-1');

    expect(h.reviewRequests).toHaveLength(1);
    expect(h.reviewRequests[0]).toEqual(expect.objectContaining({
      invoiceId: 'inv-1',
      customerPhone: '966501234567',
      status: 'pending',
    }));
    expect(h.reviewRequests[0].dueAt.toISOString()).toBe('2026-04-25T11:00:00.000Z');
  });

  it('does not schedule cancelled or no-show linked appointments', async () => {
    const h = makeHarness({
      invoices: [{
        id: 'inv-1',
        status: 'paid',
        paidAt: new Date(),
        appointmentId: 'apt-1',
        appointment: { id: 'apt-1', status: 'cancelled' },
        client: { fullName: 'سعد', phone: '0501234567' },
      }],
    });

    await expect(h.service.scheduleForPaidInvoice(h.db, 'inv-1')).resolves.toEqual({ status: 'ineligible_appointment' });
    expect(h.reviewRequests).toHaveLength(0);
  });

  it('defers paid invoices linked to appointments that are not completed yet', async () => {
    const h = makeHarness({
      invoices: [{
        id: 'inv-1',
        status: 'paid',
        paidAt: new Date(),
        appointmentId: 'apt-1',
        appointment: { id: 'apt-1', status: 'confirmed' },
        client: { fullName: 'سعد', phone: '0501234567' },
      }],
    });

    await expect(h.service.scheduleForPaidInvoice(h.db, 'inv-1')).resolves.toEqual({ status: 'deferred_until_appointment_completed' });
    expect(h.reviewRequests).toHaveLength(0);
  });

  it('keeps one review request per invoice', async () => {
    const h = makeHarness({
      reviewRequests: [{ id: 'rr-existing', invoiceId: 'inv-1', status: 'pending' }],
      invoices: [{
        id: 'inv-1',
        status: 'paid',
        paidAt: new Date(),
        appointmentId: null,
        client: { fullName: 'سعد', phone: '0501234567' },
      }],
    });

    await h.service.scheduleForPaidInvoice(h.db, 'inv-1');
    expect(h.reviewRequests).toHaveLength(1);
  });

  it('sends due review requests and marks them sent', async () => {
    const h = makeHarness({
      reviewRequests: [{
        id: 'rr-1',
        invoiceId: 'inv-1',
        appointmentId: null,
        customerPhone: '966501234567',
        customerName: 'سعد',
        status: 'pending',
        dueAt: new Date(Date.now() - 1000),
        expiresAt: new Date(Date.now() + 100000),
      }],
    });

    await h.service.processDueForTenant({
      tenantDb: h.db,
      tenantId: 'tenant-1',
      instanceName: 'salon-acme',
      instanceToken: 'token',
    });

    expect(h.sendText).toHaveBeenCalledWith(expect.objectContaining({
      to: '966501234567',
      message: expect.stringContaining('1 إلى 5'),
    }));
    expect(h.reviewRequests[0].status).toBe('sent');
    expect(h.reviewRequests[0].requestSentAt).toBeInstanceOf(Date);
  });

  it('skips recipients who opted out', async () => {
    const h = makeHarness({
      antiBanAllowed: false,
      antiBanReason: 'recipient_opted_out',
      reviewRequests: [{
        id: 'rr-1',
        customerPhone: '966501234567',
        customerName: 'سعد',
        status: 'pending',
        dueAt: new Date(Date.now() - 1000),
        expiresAt: new Date(Date.now() + 100000),
      }],
    });

    await h.service.processDueForTenant({
      tenantDb: h.db,
      tenantId: 'tenant-1',
      instanceName: 'salon-acme',
      instanceToken: 'token',
    });

    expect(h.sendText).not.toHaveBeenCalled();
    expect(h.reviewRequests[0].status).toBe('skipped');
  });

  it('sends Google review link only for high ratings when URL exists', async () => {
    const h = makeHarness({
      settings: { google_review_url: 'https://maps.google.com/review' },
      reviewRequests: [{
        id: 'rr-1',
        invoiceId: 'inv-1',
        customerPhone: '966501234567',
        customerName: 'سعد',
        status: 'sent',
        requestSentAt: new Date(),
        expiresAt: new Date(Date.now() + 100000),
      }],
    });

    await h.service.handleIncomingRating({
      tenantDb: h.db,
      instanceName: 'salon-acme',
      instanceToken: 'token',
      phone: '0501234567',
      text: 'أعطيكم 5',
    });

    expect(h.reviewRequests[0]).toEqual(expect.objectContaining({ rating: 5, googleLinkSent: true, status: 'responded' }));
    expect(h.invoiceFeedbacks[0]).toEqual(expect.objectContaining({ rating: 5, googlePromptShown: true }));
    expect(h.sendText).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('https://maps.google.com/review'),
    }));
  });

  it('thanks high ratings without Google link when no URL exists', async () => {
    const h = makeHarness({
      reviewRequests: [{
        id: 'rr-1',
        customerPhone: '966501234567',
        customerName: 'سعد',
        status: 'sent',
        requestSentAt: new Date(),
        expiresAt: new Date(Date.now() + 100000),
      }],
      salonInfo: { nameAr: 'صالون دنتيلا', googleMapsUrl: null },
    });

    await h.service.handleIncomingRating({
      tenantDb: h.db,
      instanceName: 'salon-acme',
      instanceToken: 'token',
      phone: '0501234567',
      text: '٥',
    });

    expect(h.reviewRequests[0].googleLinkSent).toBe(false);
    expect(h.sendText).toHaveBeenCalledWith(expect.objectContaining({
      message: 'شكرًا لتقييمك. يسعدنا رضاك.',
    }));
  });

  it('does not send Google for low ratings and creates internal escalation', async () => {
    const h = makeHarness({
      settings: { google_review_url: 'https://maps.google.com/review' },
      reviewRequests: [{
        id: 'rr-1',
        invoiceId: 'inv-1',
        appointmentId: 'apt-1',
        customerPhone: '966501234567',
        customerName: 'سعد',
        status: 'sent',
        requestSentAt: new Date(),
        expiresAt: new Date(Date.now() + 100000),
      }],
    });

    await h.service.handleIncomingRating({
      tenantDb: h.db,
      instanceName: 'salon-acme',
      instanceToken: 'token',
      phone: '0501234567',
      text: '2',
    });

    expect(h.reviewRequests[0]).toEqual(expect.objectContaining({ rating: 2, googleLinkSent: false }));
    expect(h.escalations[0]).toEqual(expect.objectContaining({
      escalationType: 'low_rating',
      customerPhone: '966501234567',
      notifiedManager: true,
    }));
    expect(h.sendText.mock.calls.some((call) => call[0].message.includes('maps.google'))).toBe(false);
  });

  it('does not send Google for medium ratings', async () => {
    const h = makeHarness({
      settings: { low_rating_threshold: '2', high_rating_threshold: '4' },
      reviewRequests: [{
        id: 'rr-1',
        customerPhone: '966501234567',
        customerName: 'سعد',
        status: 'sent',
        requestSentAt: new Date(),
        expiresAt: new Date(Date.now() + 100000),
      }],
    });

    await h.service.handleIncomingRating({
      tenantDb: h.db,
      instanceName: 'salon-acme',
      instanceToken: 'token',
      phone: '0501234567',
      text: 'التقييم ٣',
    });

    expect(h.reviewRequests[0]).toEqual(expect.objectContaining({ rating: 3, googleLinkSent: false }));
    expect(h.sendText.mock.calls.some((call) => call[0].message.includes('Google'))).toBe(false);
  });

  it('asks for a number when reply is not a clear rating', async () => {
    const h = makeHarness({
      reviewRequests: [{
        id: 'rr-1',
        customerPhone: '966501234567',
        customerName: 'سعد',
        status: 'sent',
        requestSentAt: new Date(),
        expiresAt: new Date(Date.now() + 100000),
      }],
    });

    await h.service.handleIncomingRating({
      tenantDb: h.db,
      instanceName: 'salon-acme',
      instanceToken: 'token',
      phone: '0501234567',
      text: 'تمام',
    });

    expect(h.reviewRequests[0].status).toBe('sent');
    expect(h.sendText).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('رقمًا من 1 إلى 5'),
    }));
  });

  it('validates review settings boundaries and URL', () => {
    expect(validateSetting('review_request_enabled', 'maybe')).toBeTruthy();
    expect(validateSetting('review_request_delay_minutes', '1441')).toBeTruthy();
    expect(validateSetting('google_review_url', 'not-a-url')).toBeTruthy();
    expect(validateSetting('low_rating_threshold', '5')).toBeTruthy();
    expect(validateSetting('high_rating_threshold', '1')).toBeTruthy();

    expect(validateSetting('review_request_enabled', 'true')).toBeNull();
    expect(validateSetting('review_request_delay_minutes', '60')).toBeNull();
    expect(validateSetting('google_review_url', 'https://maps.google.com/review')).toBeNull();
  });
});
