import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PosCheckoutService } from './pos-checkout.service';
import {
  PosCheckoutDiscountType,
  PosCheckoutDto,
  PosCheckoutLoyaltyType,
  PosCheckoutPaymentMethod,
} from './dto/pos-checkout.dto';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const CLIENT_ID = '22222222-2222-4222-8222-222222222222';
const SHIFT_ID = '33333333-3333-4333-8333-333333333333';
const SERVICE_ID = '44444444-4444-4444-8444-444444444444';
const EMPLOYEE_ID = '55555555-5555-4555-8555-555555555555';

describe('PosCheckoutService', () => {
  let service: PosCheckoutService;
  let auditService: { log: jest.Mock };

  const baseDto = (): PosCheckoutDto => ({
    idempotencyKey: 'idem-1',
    terminalId: 'terminal-1',
    shiftId: SHIFT_ID,
    clientId: CLIENT_ID,
    items: [
      {
        serviceId: SERVICE_ID,
        employeeId: EMPLOYEE_ID,
        quantity: 1,
      },
    ],
    payments: [
      {
        method: PosCheckoutPaymentMethod.card,
        amount: 115,
      },
    ],
  });

  const makeDb = () => {
    const attempt: any = {
      id: 'attempt-1',
      idempotencyKey: 'idem-1',
      requestHash: '',
      status: 'in_progress',
      invoiceId: null,
      responseJson: null,
      createdBy: USER_ID,
    };

    const tx: any = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      $queryRawUnsafe: jest.fn((query: string) => {
        if (query.includes('pos_checkout_attempts')) {
          return Promise.resolve([{ id: 'attempt-1' }]);
        }
        return Promise.resolve([{ invoice_number: 'INV-0001' }]);
      }),
      posCheckoutAttempt: {
        findUnique: jest.fn().mockResolvedValue(attempt),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({}),
      },
      posShift: {
        findUnique: jest.fn().mockResolvedValue({ id: SHIFT_ID, status: 'open' }),
      },
      client: {
        findFirst: jest.fn().mockResolvedValue({
          id: CLIENT_ID,
          fullName: 'Client One',
          phone: '0500000000',
          email: null,
        }),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      appointment: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      selfOrder: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      service: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: SERVICE_ID,
            nameAr: 'Haircut',
            nameEn: 'Haircut',
            price: 100,
          },
        ]),
      },
      employee: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: EMPLOYEE_ID,
            fullName: 'Employee One',
          },
        ]),
      },
      salonInfo: {
        findFirst: jest.fn().mockResolvedValue({ taxPercentage: 15 }),
      },
      coupon: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      loyaltyPoints: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        upsert: jest.fn().mockResolvedValue({}),
      },
      loyaltyTransaction: {
        create: jest.fn().mockResolvedValue({}),
      },
      setting: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      invoice: {
        create: jest.fn().mockResolvedValue({
          id: 'invoice-1',
          invoiceNumber: 'INV-0002',
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      invoiceItem: {
        create: jest.fn().mockResolvedValue({}),
      },
      discount: {
        create: jest.fn().mockResolvedValue({}),
      },
      payment: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    const db: any = {
      ...tx,
      $transaction: jest.fn(async (callback: (client: any) => Promise<unknown>) => callback(tx)),
    };

    return { db, tx, attempt };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    auditService = { log: jest.fn().mockResolvedValue({}) };
    service = new PosCheckoutService(auditService as any);
  });

  it('returns the stored response for duplicate same idempotencyKey and same body', async () => {
    const { db, tx, attempt } = makeDb();
    const dto = baseDto();
    const storedResponse = {
      invoice: { id: 'invoice-stored', total: 115 },
      receiptSnapshot: { total: 115 },
    };

    tx.$executeRawUnsafe.mockResolvedValue(0);
    attempt.requestHash = (service as any).hashRequest(dto);
    attempt.status = 'completed';
    attempt.responseJson = storedResponse;
    tx.posCheckoutAttempt.findUnique.mockResolvedValue(attempt);

    const result = await service.checkout(db, dto, USER_ID);

    expect(result).toBe(storedResponse);
    expect(tx.invoice.create).not.toHaveBeenCalled();
    expect(tx.payment.create).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('rejects same idempotencyKey with a different body', async () => {
    const { db, tx, attempt } = makeDb();
    const dto = baseDto();

    tx.$executeRawUnsafe.mockResolvedValue(0);
    attempt.requestHash = 'different-request-hash';
    attempt.status = 'completed';
    tx.posCheckoutAttempt.findUnique.mockResolvedValue(attempt);

    await expect(service.checkout(db, dto, USER_ID)).rejects.toThrow(ConflictException);
    expect(tx.invoice.create).not.toHaveBeenCalled();
  });

  it('ignores tampered service unitPrice and stores the DB price', async () => {
    const { db, tx, attempt } = makeDb();
    const dto = baseDto();
    (dto.items[0] as any).unitPrice = 1;
    attempt.requestHash = (service as any).hashRequest(dto);

    await service.checkout(db, dto, USER_ID);

    expect(tx.invoice.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        subtotal: 100,
        taxAmount: 15,
        total: 115,
      }),
    }));
    expect(tx.invoiceItem.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        unitPrice: 100,
        totalPrice: 100,
      }),
    }));
  });

  it('uses an advisory transaction lock for invoiceNumber generation instead of SKIP LOCKED', async () => {
    const { db, tx, attempt } = makeDb();
    const dto = baseDto();
    attempt.requestHash = (service as any).hashRequest(dto);

    await service.checkout(db, dto, USER_ID);

    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(91827364, 51020264)',
    );
    const invoiceNumberQuery = tx.$queryRawUnsafe.mock.calls
      .map((call: [string]) => call[0])
      .find((query: string) => query.includes('invoice_number'));
    expect(invoiceNumberQuery).toBeDefined();
    expect(invoiceNumberQuery).not.toContain('SKIP LOCKED');
    expect(invoiceNumberQuery).not.toContain('FOR UPDATE');
  });

  it('retries safely when invoiceNumber collides with an existing invoice', async () => {
    const { db, tx, attempt } = makeDb();
    const dto = baseDto();
    attempt.requestHash = (service as any).hashRequest(dto);
    let invoiceNumberReads = 0;
    tx.$queryRawUnsafe.mockImplementation((query: string) => {
      if (query.includes('pos_checkout_attempts')) {
        return Promise.resolve([{ id: 'attempt-1' }]);
      }
      invoiceNumberReads += 1;
      return Promise.resolve([
        { invoice_number: invoiceNumberReads === 1 ? 'INV-0001' : 'INV-0002' },
      ]);
    });
    tx.invoice.create
      .mockRejectedValueOnce({ code: 'P2002', meta: { target: ['invoice_number'] } })
      .mockResolvedValueOnce({ id: 'invoice-2', invoiceNumber: 'INV-0003' });

    const result = await service.checkout(db, dto, USER_ID);

    expect(db.$transaction).toHaveBeenCalledTimes(2);
    expect(tx.invoice.create).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: expect.objectContaining({ invoiceNumber: 'INV-0002' }),
    }));
    expect(tx.invoice.create).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: expect.objectContaining({ invoiceNumber: 'INV-0003' }),
    }));
    expect(result.invoice).toMatchObject({ id: 'invoice-2', invoiceNumber: 'INV-0003' });
  });

  it('rejects payment underpay and creates no invoice or payment', async () => {
    const { db, tx, attempt } = makeDb();
    const dto = baseDto();
    dto.payments = [{ method: PosCheckoutPaymentMethod.card, amount: 114.99 }];
    attempt.requestHash = (service as any).hashRequest(dto);

    await expect(service.checkout(db, dto, USER_ID)).rejects.toThrow(BadRequestException);
    expect(tx.invoice.create).not.toHaveBeenCalled();
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it('rejects payment overpay and creates no invoice or payment', async () => {
    const { db, tx, attempt } = makeDb();
    const dto = baseDto();
    dto.payments = [{ method: PosCheckoutPaymentMethod.card, amount: 115.01 }];
    attempt.requestHash = (service as any).hashRequest(dto);

    await expect(service.checkout(db, dto, USER_ID)).rejects.toThrow(BadRequestException);
    expect(tx.invoice.create).not.toHaveBeenCalled();
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it('rejects cash payment without cashReceived', async () => {
    const { db, tx, attempt } = makeDb();
    const dto = baseDto();
    dto.payments = [{ method: PosCheckoutPaymentMethod.cash, amount: 115 }];
    attempt.requestHash = (service as any).hashRequest(dto);

    await expect(service.checkout(db, dto, USER_ID)).rejects.toThrow(BadRequestException);
    expect(tx.invoice.create).not.toHaveBeenCalled();
  });

  it('rejects cashReceived lower than the cash leg', async () => {
    const { db, tx, attempt } = makeDb();
    const dto = baseDto();
    dto.payments = [{ method: PosCheckoutPaymentMethod.cash, amount: 115, cashReceived: 114 }];
    attempt.requestHash = (service as any).hashRequest(dto);

    await expect(service.checkout(db, dto, USER_ID)).rejects.toThrow(BadRequestException);
    expect(tx.invoice.create).not.toHaveBeenCalled();
  });

  it('creates split payments atomically when the split exactly matches the server total', async () => {
    const { db, tx, attempt } = makeDb();
    const dto = baseDto();
    dto.payments = [
      { method: PosCheckoutPaymentMethod.cash, amount: 50, cashReceived: 50 },
      { method: PosCheckoutPaymentMethod.card, amount: 65 },
    ];
    attempt.requestHash = (service as any).hashRequest(dto);

    await service.checkout(db, dto, USER_ID);

    expect(tx.payment.create).toHaveBeenCalledTimes(2);
    expect(tx.payment.create).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: expect.objectContaining({
        method: 'cash',
        amount: 50,
        cashReceived: 50,
        changeAmount: 0,
      }),
    }));
    expect(tx.payment.create).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: expect.objectContaining({
        method: 'card',
        amount: 65,
      }),
    }));
  });

  it('uses server subtotal for coupon discount, not client orderAmount', async () => {
    const { db, tx, attempt } = makeDb();
    const dto = {
      ...baseDto(),
      couponCode: 'save10',
      orderAmount: 1,
      payments: [{ method: PosCheckoutPaymentMethod.card, amount: 103.5 }],
    } as any as PosCheckoutDto;
    attempt.requestHash = (service as any).hashRequest(dto);
    tx.coupon.findUnique.mockResolvedValue({
      id: 'coupon-1',
      code: 'SAVE10',
      type: 'percentage',
      value: 10,
      minOrder: 50,
      maxDiscount: null,
      usageLimit: null,
      usedCount: 0,
      validFrom: new Date('2024-01-01'),
      validUntil: new Date('2030-01-01'),
      isActive: true,
    });

    await service.checkout(db, dto, USER_ID);

    expect(tx.discount.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        amount: 10,
        reason: 'Coupon SAVE10',
      }),
    }));
    expect(tx.invoice.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        discountAmount: 10,
        taxAmount: 13.5,
        total: 103.5,
      }),
    }));
  });

  it('allows points redemption in loyalty both mode and earns both points and visit', async () => {
    const { db, tx, attempt } = makeDb();
    const dto = {
      ...baseDto(),
      loyaltyRedemption: { type: PosCheckoutLoyaltyType.points, value: 100 },
      payments: [{ method: PosCheckoutPaymentMethod.card, amount: 103.5 }],
    };
    attempt.requestHash = (service as any).hashRequest(dto);
    tx.setting.findMany.mockResolvedValue([
      { key: 'loyalty_enabled', value: 'true' },
      { key: 'loyalty_mode', value: 'both' },
      { key: 'loyalty_points_per_sar', value: '1' },
      { key: 'loyalty_redemption_value', value: '0.1' },
      { key: 'loyalty_visits_per_reward', value: '10' },
      { key: 'loyalty_visit_reward_value', value: '50' },
    ]);
    tx.loyaltyPoints.findUnique.mockResolvedValue({ points: 200, visitCount: 20 });

    await service.checkout(db, dto, USER_ID);

    expect(tx.loyaltyPoints.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { points: { decrement: 100 } },
    }));
    expect(tx.loyaltyPoints.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ points: { increment: 103 } }),
    }));
    expect(tx.loyaltyPoints.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ visitCount: { increment: 1 } }),
    }));
    expect(tx.loyaltyTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: 'redeemed', points: -100 }),
    }));
    expect(tx.loyaltyTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: 'earned', points: 103 }),
    }));
    expect(tx.loyaltyTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: 'visit_earned', points: 1 }),
    }));
  });

  it('allows visits redemption in loyalty both mode and earns both points and visit', async () => {
    const { db, tx, attempt } = makeDb();
    const dto = {
      ...baseDto(),
      loyaltyRedemption: { type: PosCheckoutLoyaltyType.visits, value: 10 },
      payments: [{ method: PosCheckoutPaymentMethod.card, amount: 57.5 }],
    };
    attempt.requestHash = (service as any).hashRequest(dto);
    tx.setting.findMany.mockResolvedValue([
      { key: 'loyalty_enabled', value: 'true' },
      { key: 'loyalty_mode', value: 'both' },
      { key: 'loyalty_points_per_sar', value: '1' },
      { key: 'loyalty_redemption_value', value: '0.1' },
      { key: 'loyalty_visits_per_reward', value: '10' },
      { key: 'loyalty_visit_reward_value', value: '50' },
    ]);
    tx.loyaltyPoints.findUnique.mockResolvedValue({ points: 200, visitCount: 20 });

    await service.checkout(db, dto, USER_ID);

    expect(tx.loyaltyPoints.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { visitCount: { decrement: 10 } },
    }));
    expect(tx.loyaltyPoints.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ points: { increment: 57 } }),
    }));
    expect(tx.loyaltyPoints.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ visitCount: { increment: 1 } }),
    }));
    expect(tx.loyaltyTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: 'visit_redeemed', points: -10 }),
    }));
    expect(tx.loyaltyTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: 'earned', points: 57 }),
    }));
    expect(tx.loyaltyTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: 'visit_earned', points: 1 }),
    }));
  });

  it('rejects exhausted coupon race without creating invoice or payment', async () => {
    const { db, tx, attempt } = makeDb();
    const dto = {
      ...baseDto(),
      couponCode: 'race',
      payments: [{ method: PosCheckoutPaymentMethod.card, amount: 103.5 }],
    };
    attempt.requestHash = (service as any).hashRequest(dto);
    tx.coupon.findUnique.mockResolvedValue({
      id: 'coupon-1',
      code: 'RACE',
      type: 'percentage',
      value: 10,
      minOrder: null,
      maxDiscount: null,
      usageLimit: 1,
      usedCount: 0,
      validFrom: new Date('2024-01-01'),
      validUntil: new Date('2030-01-01'),
      isActive: true,
    });
    tx.coupon.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.checkout(db, dto, USER_ID)).rejects.toThrow(BadRequestException);
    expect(tx.invoice.create).not.toHaveBeenCalled();
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it('does not complete the attempt when a later transaction step fails after invoice creation', async () => {
    const { db, tx, attempt } = makeDb();
    const dto = baseDto();
    attempt.requestHash = (service as any).hashRequest(dto);
    tx.payment.create.mockRejectedValueOnce(new Error('db write failed'));

    await expect(service.checkout(db, dto, USER_ID)).rejects.toThrow('db write failed');
    expect(tx.invoice.create).toHaveBeenCalled();
    expect(tx.posCheckoutAttempt.update).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'completed' }),
    }));
    expect(tx.posCheckoutAttempt.update).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ responseJson: expect.anything() }),
    }));
    expect(tx.invoice.update).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ receiptSnapshot: expect.anything() }),
    }));
    expect(auditService.log).not.toHaveBeenCalled();
    expect(db.$transaction).toHaveBeenCalled();
  });

  it('returns a server receiptSnapshot whose total equals invoice total and payment sum', async () => {
    const { db, tx, attempt } = makeDb();
    const dto = baseDto();
    attempt.requestHash = (service as any).hashRequest(dto);

    const result = await service.checkout(db, dto, USER_ID);
    const receiptSnapshot = result.receiptSnapshot as any;
    const paymentSum = receiptSnapshot.payments.reduce(
      (sum: number, payment: { amount: number }) => sum + payment.amount,
      0,
    );

    expect(result.invoice).toMatchObject({ total: 115 });
    expect(receiptSnapshot.total).toBe(115);
    expect(paymentSum).toBe(115);
  });

  it('logs pos.checkout.completed after a successful checkout without PII fields', async () => {
    const { db, attempt } = makeDb();
    const dto = baseDto();
    attempt.requestHash = (service as any).hashRequest(dto);

    await service.checkout(db, dto, USER_ID, 'tenant-1');

    expect(auditService.log).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      userId: USER_ID,
      action: 'pos.checkout.completed',
      entityType: 'Invoice',
      entityId: 'invoice-1',
      newValues: {
        invoiceId: 'invoice-1',
        total: 115,
        paymentMethods: ['card'],
        shiftId: SHIFT_ID,
        terminalId: 'terminal-1',
        createdBy: USER_ID,
      },
    });
    const auditPayload = auditService.log.mock.calls[0][0];
    expect(JSON.stringify(auditPayload)).not.toContain('Client One');
    expect(JSON.stringify(auditPayload)).not.toContain('0500000000');
  });

  it('does not fail checkout if audit logging fails after commit', async () => {
    const { db, attempt } = makeDb();
    const dto = baseDto();
    attempt.requestHash = (service as any).hashRequest(dto);
    auditService.log.mockRejectedValueOnce(new Error('audit unavailable'));

    await expect(service.checkout(db, dto, USER_ID, 'tenant-1')).resolves.toMatchObject({
      invoice: { id: 'invoice-1', total: 115 },
    });
  });

  it('rejects a closed shift', async () => {
    const { db, tx, attempt } = makeDb();
    const dto = baseDto();
    attempt.requestHash = (service as any).hashRequest(dto);
    tx.posShift.findUnique.mockResolvedValue({ id: SHIFT_ID, status: 'closed' });

    await expect(service.checkout(db, dto, USER_ID)).rejects.toThrow(BadRequestException);
    expect(tx.invoice.create).not.toHaveBeenCalled();
  });

  it('rejects a missing shift', async () => {
    const { db, tx, attempt } = makeDb();
    const dto = baseDto();
    attempt.requestHash = (service as any).hashRequest(dto);
    tx.posShift.findUnique.mockResolvedValue(null);

    await expect(service.checkout(db, dto, USER_ID)).rejects.toThrow(NotFoundException);
    expect(tx.invoice.create).not.toHaveBeenCalled();
  });

  it('requires manual discount reason before checkout can proceed', async () => {
    const { db, tx, attempt } = makeDb();
    const dto = {
      ...baseDto(),
      manualDiscount: {
        type: PosCheckoutDiscountType.fixed,
        value: 10,
        reason: '',
      },
    };
    attempt.requestHash = (service as any).hashRequest(dto);

    await expect(service.checkout(db, dto, USER_ID)).rejects.toThrow(BadRequestException);
    expect(tx.invoice.create).not.toHaveBeenCalled();
  });
});
