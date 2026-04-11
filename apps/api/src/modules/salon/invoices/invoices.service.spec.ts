import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { PdfService } from '../../../shared/pdf/pdf.service';
import { MailService } from '../../../shared/mail/mail.service';
import { WhatsAppService } from '../../../shared/whatsapp/whatsapp.service';
import { SmsService } from '../../../shared/sms/sms.service';
import { SettingsService } from '../settings/settings.service';
import { EventsGateway } from '../../../shared/events/events.gateway';
import type { TenantPrismaClient } from '../../../shared/types';
import { RecordPaymentDto, PaymentMethodEnum } from './dto/record-payment.dto';
import { AddDiscountDto, DiscountTypeEnum } from './dto/add-discount.dto';

const mockDb = {
  client: { findFirst: jest.fn(), update: jest.fn() },
  appointment: { findUnique: jest.fn() },
  invoice: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  salonInfo: { findFirst: jest.fn() },
  payment: { create: jest.fn() },
  discount: { create: jest.fn(), findMany: jest.fn() },
  coupon: { findUnique: jest.fn(), update: jest.fn() },
  $transaction: jest.fn(),
};

import { AuditService } from '../../../core/audit/audit.service';

const mockAuditService = {
  log: jest.fn().mockResolvedValue(undefined),
};

describe('InvoicesService', () => {
  let service: InvoicesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: PdfService, useValue: {} },
        { provide: MailService, useValue: {} },
        { provide: WhatsAppService, useValue: {} },
        { provide: SmsService, useValue: {} },
        { provide: SettingsService, useValue: {} },
        { provide: AuditService, useValue: mockAuditService },
        { provide: EventsGateway, useValue: { emitToTenant: jest.fn(), emitToOrder: jest.fn() } },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
    jest.clearAllMocks();
  });

  describe('create - إنشاء الفاتورة', () => {
    it('يجب إنشاء الفاتورة بحساب ضريبة صحيح (15% افتراضي)', async () => {
      mockDb.client.findFirst.mockResolvedValue({ id: 'client-1', fullName: 'سارة' });
      mockDb.invoice.findFirst.mockResolvedValue({ invoiceNumber: 'INV-0001' });
      mockDb.salonInfo.findFirst.mockResolvedValue(null);
      mockDb.invoice.create.mockResolvedValue({
        id: 'inv-1',
        invoiceNumber: 'INV-0002',
        subtotal: 200,
        taxAmount: 30,
        total: 230,
        clientId: 'client-1',
        invoiceItems: [],
        client: { id: 'client-1', fullName: 'سارة', phone: '0501234567' },
      });

      const dto = {
        clientId: 'client-1',
        items: [
          { description: 'قص شعر', quantity: 1, unitPrice: 100, employeeId: 'emp-1' },
          { description: 'صبغ', quantity: 1, unitPrice: 100, employeeId: 'emp-1' },
        ],
      };

      const result = await service.create(
        mockDb as unknown as TenantPrismaClient,
        dto as never,
        'user-1',
      );

      expect(result).toHaveProperty('id', 'inv-1');
      expect(result).toHaveProperty('subtotal', 200);
      expect(result).toHaveProperty('taxAmount', 30);
      expect(result).toHaveProperty('total', 230);
      expect(mockDb.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: 200,
            taxAmount: 30,
            total: 230,
          }),
        }),
      );
    });

    it('يجب رمي NotFoundException عندما العميل غير موجود', async () => {
      mockDb.client.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          mockDb as unknown as TenantPrismaClient,
          {
            clientId: 'nonexistent',
            items: [{ description: 'خدمة', quantity: 1, unitPrice: 100, employeeId: 'emp-1' }],
          } as never,
          'user-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('يجب رمي NotFoundException عندما الموعد غير موجود', async () => {
      mockDb.client.findFirst.mockResolvedValue({ id: 'client-1' });
      mockDb.appointment.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          mockDb as unknown as TenantPrismaClient,
          {
            clientId: 'client-1',
            appointmentId: 'nonexistent-app',
            items: [{ description: 'خدمة', quantity: 1, unitPrice: 100, employeeId: 'emp-1' }],
          } as never,
          'user-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('يجب حساب المجموع الفرعي بشكل صحيح من عناصر متعددة', async () => {
      mockDb.client.findFirst.mockResolvedValue({ id: 'client-1' });
      mockDb.invoice.findFirst.mockResolvedValue(null);
      mockDb.salonInfo.findFirst.mockResolvedValue(null);
      mockDb.invoice.create.mockResolvedValue({
        id: 'inv-1',
        subtotal: 450,
        taxAmount: 67.5,
        total: 517.5,
        invoiceItems: [],
        client: {},
      });

      const dto = {
        clientId: 'client-1',
        items: [
          { description: 'خدمة أ', quantity: 2, unitPrice: 100, employeeId: 'emp-1' },
          { description: 'خدمة ب', quantity: 1, unitPrice: 250, employeeId: 'emp-1' },
        ],
      };

      await service.create(mockDb as unknown as TenantPrismaClient, dto as never, 'user-1');

      expect(mockDb.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: 450,
            taxAmount: 67.5,
            total: 517.5,
          }),
        }),
      );
    });
  });

  describe('recordPayment - تسجيل الدفع', () => {
    it('يجب تسجيل الدفع الكامل وتعيين الحالة إلى paid', async () => {
      const invoice = {
        id: 'inv-1',
        clientId: 'client-1',
        total: 230,
        status: 'draft',
        payments: [],
      };
      mockDb.invoice.findUnique.mockResolvedValue(invoice);
      mockDb.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
        fn(mockDb),
      );
      mockDb.payment.create.mockResolvedValue({
        id: 'pay-1',
        amount: 230,
        method: 'cash',
      });
      mockDb.invoice.update.mockResolvedValue({
        id: 'inv-1',
        status: 'paid',
        paidAt: new Date(),
        payments: [{ amount: 230 }],
        invoiceItems: [],
      });
      mockDb.client.update.mockResolvedValue({});

      const dto: RecordPaymentDto = { amount: 230, method: PaymentMethodEnum.cash };

      const result = await service.recordPayment(
        mockDb as unknown as TenantPrismaClient,
        'inv-1',
        dto,
      );

      expect(result).toHaveProperty('invoice');
      expect((result as { invoice: { status: string } }).invoice.status).toBe('paid');
      expect(mockDb.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amount: 230 }),
        }),
      );
      expect(mockDb.client.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'client-1' },
          data: expect.objectContaining({
            totalSpent: { increment: 230 },
            totalVisits: { increment: 1 },
          }),
        }),
      );
    });

    it('يجب تسجيل الدفع الجزئي وتعيين الحالة إلى partially_paid', async () => {
      const invoice = {
        id: 'inv-1',
        clientId: 'client-1',
        total: 230,
        status: 'draft',
        payments: [],
      };
      mockDb.invoice.findUnique.mockResolvedValue(invoice);
      mockDb.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
        fn(mockDb),
      );
      mockDb.payment.create.mockResolvedValue({ id: 'pay-1', amount: 100 });
      mockDb.invoice.update.mockResolvedValue({
        id: 'inv-1',
        status: 'partially_paid',
        payments: [{ amount: 100 }],
        invoiceItems: [],
      });

      const dto: RecordPaymentDto = { amount: 100, method: PaymentMethodEnum.card };

      const result = await service.recordPayment(
        mockDb as unknown as TenantPrismaClient,
        'inv-1',
        dto,
      );

      expect((result as { invoice: { status: string } }).invoice.status).toBe('partially_paid');
      expect(mockDb.client.update).not.toHaveBeenCalled();
    });

    it('يجب رفض الدفع على فاتورة ملغاة', async () => {
      mockDb.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: 'void',
        payments: [],
      });

      const dto: RecordPaymentDto = { amount: 100, method: PaymentMethodEnum.cash };

      await expect(
        service.recordPayment(mockDb as unknown as TenantPrismaClient, 'inv-1', dto),
      ).rejects.toThrow(BadRequestException);
      expect(mockDb.payment.create).not.toHaveBeenCalled();
    });

    it('يجب رفض الدفع على فاتورة مدفوعة بالفعل', async () => {
      mockDb.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: 'paid',
        total: 230,
        payments: [{ amount: 230 }],
      });

      const dto: RecordPaymentDto = { amount: 50, method: PaymentMethodEnum.cash };

      await expect(
        service.recordPayment(mockDb as unknown as TenantPrismaClient, 'inv-1', dto),
      ).rejects.toThrow(BadRequestException);
      expect(mockDb.payment.create).not.toHaveBeenCalled();
    });

    it('يجب رفض الدفع عندما يتجاوز المبلغ المتبقي', async () => {
      mockDb.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        clientId: 'client-1',
        total: 230,
        status: 'partially_paid',
        payments: [{ amount: 100 }],
      });

      const dto: RecordPaymentDto = { amount: 200, method: PaymentMethodEnum.cash };

      await expect(
        service.recordPayment(mockDb as unknown as TenantPrismaClient, 'inv-1', dto),
      ).rejects.toThrow(BadRequestException);
      expect(mockDb.payment.create).not.toHaveBeenCalled();
    });

    it('يجب تحديث إحصائيات العميل عند الدفع الكامل', async () => {
      const invoice = {
        id: 'inv-1',
        clientId: 'client-1',
        total: 500,
        status: 'draft',
        payments: [],
      };
      mockDb.invoice.findUnique.mockResolvedValue(invoice);
      mockDb.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
        fn(mockDb),
      );
      mockDb.payment.create.mockResolvedValue({ id: 'pay-1', amount: 500 });
      mockDb.invoice.update.mockResolvedValue({
        id: 'inv-1',
        status: 'paid',
        payments: [],
        invoiceItems: [],
      });
      mockDb.client.update.mockResolvedValue({});

      const dto: RecordPaymentDto = { amount: 500, method: PaymentMethodEnum.bank_transfer };

      await service.recordPayment(mockDb as unknown as TenantPrismaClient, 'inv-1', dto);

      expect(mockDb.client.update).toHaveBeenCalledWith({
        where: { id: 'client-1' },
        data: {
          totalSpent: { increment: 500 },
          totalVisits: { increment: 1 },
          lastVisitAt: expect.any(Date),
        },
      });
    });
  });

  describe('addDiscount - إضافة خصم', () => {
    it('يجب تطبيق خصم ثابت بشكل صحيح', async () => {
      const invoice = {
        id: 'inv-1',
        subtotal: 200,
        discountAmount: 0,
        taxAmount: 30,
        total: 230,
        status: 'draft',
      };
      mockDb.invoice.findUnique.mockResolvedValue(invoice);
      mockDb.salonInfo.findFirst.mockResolvedValue(null);
      mockDb.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
        fn(mockDb),
      );
      mockDb.discount.create.mockResolvedValue({
        id: 'disc-1',
        type: 'fixed',
        value: 50,
        amount: 50,
      });
      mockDb.discount.findMany.mockResolvedValue([{ amount: 50 }]);
      mockDb.invoice.update.mockResolvedValue({
        id: 'inv-1',
        discountAmount: 50,
        taxAmount: 22.5,
        total: 172.5,
        invoiceItems: [],
        discounts: [],
        payments: [],
      });

      const dto: AddDiscountDto = { type: DiscountTypeEnum.fixed, value: 50 };

      const result = await service.addDiscount(
        mockDb as unknown as TenantPrismaClient,
        'inv-1',
        dto,
      );

      expect(result).toHaveProperty('discount');
      expect(result).toHaveProperty('invoice');
      expect((result as { invoice: { discountAmount: number } }).invoice.discountAmount).toBe(50);
      expect((result as { invoice: { taxAmount: number } }).invoice.taxAmount).toBe(22.5);
      expect((result as { invoice: { total: number } }).invoice.total).toBe(172.5);
    });

    it('يجب تطبيق خصم نسبة مئوية بشكل صحيح', async () => {
      const invoice = {
        id: 'inv-1',
        subtotal: 200,
        discountAmount: 0,
        status: 'draft',
      };
      mockDb.invoice.findUnique.mockResolvedValue(invoice);
      mockDb.salonInfo.findFirst.mockResolvedValue(null);
      mockDb.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
        fn(mockDb),
      );
      mockDb.discount.create.mockResolvedValue({
        id: 'disc-1',
        type: 'percentage',
        value: 10,
        amount: 20,
      });
      mockDb.discount.findMany.mockResolvedValue([{ amount: 20 }]);
      mockDb.invoice.update.mockResolvedValue({
        id: 'inv-1',
        discountAmount: 20,
        taxAmount: 27,
        total: 207,
        invoiceItems: [],
        discounts: [],
        payments: [],
      });

      const dto: AddDiscountDto = { type: DiscountTypeEnum.percentage, value: 10 };

      const result = await service.addDiscount(
        mockDb as unknown as TenantPrismaClient,
        'inv-1',
        dto,
      );

      expect((result as { invoice: { discountAmount: number } }).invoice.discountAmount).toBe(20);
      expect(mockDb.discount.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'percentage', value: 10, amount: 20 }),
        }),
      );
    });

    it('يجب رفض الخصم على فاتورة ملغاة', async () => {
      mockDb.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        subtotal: 200,
        status: 'void',
      });

      const dto: AddDiscountDto = { type: DiscountTypeEnum.fixed, value: 50 };

      await expect(
        service.addDiscount(mockDb as unknown as TenantPrismaClient, 'inv-1', dto),
      ).rejects.toThrow(BadRequestException);
      expect(mockDb.discount.create).not.toHaveBeenCalled();
    });

    it('يجب رفض الخصم عندما تتجاوز قيمته المجموع الفرعي', async () => {
      mockDb.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        subtotal: 100,
        status: 'draft',
      });

      const dto: AddDiscountDto = { type: DiscountTypeEnum.fixed, value: 150 };

      await expect(
        service.addDiscount(mockDb as unknown as TenantPrismaClient, 'inv-1', dto),
      ).rejects.toThrow(BadRequestException);
      expect(mockDb.discount.create).not.toHaveBeenCalled();
    });

    it('يجب إعادة حساب الضريبة بعد الخصم', async () => {
      const invoice = {
        id: 'inv-1',
        subtotal: 200,
        discountAmount: 0,
        status: 'draft',
      };
      mockDb.invoice.findUnique.mockResolvedValue(invoice);
      mockDb.salonInfo.findFirst.mockResolvedValue({ taxPercentage: 15 });
      mockDb.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
        fn(mockDb),
      );
      mockDb.discount.create.mockResolvedValue({ id: 'disc-1', amount: 40 });
      mockDb.discount.findMany.mockResolvedValue([{ amount: 40 }]);
      mockDb.invoice.update.mockResolvedValue({
        id: 'inv-1',
        discountAmount: 40,
        taxAmount: 24,
        total: 184,
        invoiceItems: [],
        discounts: [],
        payments: [],
      });

      const dto: AddDiscountDto = { type: DiscountTypeEnum.percentage, value: 20 };

      const result = await service.addDiscount(
        mockDb as unknown as TenantPrismaClient,
        'inv-1',
        dto,
      );

      const inv = (result as { invoice: { taxableAmount?: number; taxAmount: number; total: number } }).invoice;
      expect(inv.taxAmount).toBe(24);
      expect(inv.total).toBe(184);
      expect(mockDb.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            discountAmount: 40,
            taxAmount: 24,
            total: 184,
          }),
        }),
      );
    });
  });

  describe('applyCoupon - تطبيق كوبون', () => {
    const validCoupon = {
      id: 'coupon-1',
      code: 'SAVE20',
      type: 'percentage',
      value: 20,
      minOrder: null,
      maxDiscount: null,
      usageLimit: 100,
      usedCount: 5,
      validFrom: new Date('2025-01-01'),
      validUntil: new Date('2026-12-31'),
      isActive: true,
    };

    it('يجب تطبيق كوبون صالح', async () => {
      const invoice = {
        id: 'inv-1',
        subtotal: 200,
        discountAmount: 0,
        status: 'draft',
      };
      mockDb.invoice.findUnique.mockResolvedValue(invoice);
      mockDb.coupon.findUnique.mockResolvedValue(validCoupon);
      mockDb.salonInfo.findFirst.mockResolvedValue(null);
      mockDb.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
        fn(mockDb));
      mockDb.coupon.update.mockResolvedValue({});
      mockDb.discount.create.mockResolvedValue({ id: 'disc-1', amount: 40 });
      mockDb.discount.findMany.mockResolvedValue([{ amount: 40 }]);
      mockDb.invoice.update.mockResolvedValue({
        id: 'inv-1',
        discountAmount: 40,
        taxAmount: 24,
        total: 184,
        invoiceItems: [],
        discounts: [],
        payments: [],
      });

      const result = await service.applyCoupon(
        mockDb as unknown as TenantPrismaClient,
        'inv-1',
        { code: 'SAVE20' },
      );

      expect(result).toHaveProperty('discount');
      expect(result).toHaveProperty('invoice');
      expect(mockDb.coupon.update).toHaveBeenCalledWith({
        where: { id: 'coupon-1' },
        data: { usedCount: { increment: 1 } },
      });
    });

    it('يجب رفض كوبون غير مفعّل', async () => {
      mockDb.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        subtotal: 200,
        status: 'draft',
      });
      mockDb.coupon.findUnique.mockResolvedValue({
        ...validCoupon,
        isActive: false,
      });

      await expect(
        service.applyCoupon(mockDb as unknown as TenantPrismaClient, 'inv-1', { code: 'SAVE20' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockDb.$transaction).not.toHaveBeenCalled();
    });

    it('يجب رفض كوبون منتهي الصلاحية', async () => {
      mockDb.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        subtotal: 200,
        status: 'draft',
      });
      mockDb.coupon.findUnique.mockResolvedValue({
        ...validCoupon,
        validFrom: new Date('2025-01-01'),
        validUntil: new Date('2025-06-01'),
      });

      await expect(
        service.applyCoupon(mockDb as unknown as TenantPrismaClient, 'inv-1', { code: 'SAVE20' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('يجب رفض كوبون وصل للحد الأقصى من الاستخدام', async () => {
      mockDb.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        subtotal: 200,
        status: 'draft',
      });
      mockDb.coupon.findUnique.mockResolvedValue({
        ...validCoupon,
        usageLimit: 10,
        usedCount: 10,
      });

      await expect(
        service.applyCoupon(mockDb as unknown as TenantPrismaClient, 'inv-1', { code: 'SAVE20' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('يجب رفض كوبون عندما يكون الطلب أقل من الحد الأدنى', async () => {
      mockDb.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        subtotal: 50,
        status: 'draft',
      });
      mockDb.coupon.findUnique.mockResolvedValue({
        ...validCoupon,
        minOrder: 100,
      });

      await expect(
        service.applyCoupon(mockDb as unknown as TenantPrismaClient, 'inv-1', { code: 'SAVE20' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('يجب تحديد الخصم عند maxDiscount', async () => {
      const invoice = {
        id: 'inv-1',
        subtotal: 1000,
        discountAmount: 0,
        status: 'draft',
      };
      mockDb.invoice.findUnique.mockResolvedValue(invoice);
      mockDb.coupon.findUnique.mockResolvedValue({
        ...validCoupon,
        type: 'percentage',
        value: 50,
        maxDiscount: 100,
      });
      mockDb.salonInfo.findFirst.mockResolvedValue(null);
      mockDb.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
        fn(mockDb),
      );
      mockDb.coupon.update.mockResolvedValue({});
      mockDb.discount.create.mockResolvedValue({ id: 'disc-1', amount: 100 });
      mockDb.discount.findMany.mockResolvedValue([{ amount: 100 }]);
      mockDb.invoice.update.mockResolvedValue({
        id: 'inv-1',
        discountAmount: 100,
        taxAmount: 135,
        total: 1035,
        invoiceItems: [],
        discounts: [],
        payments: [],
      });

      const result = await service.applyCoupon(
        mockDb as unknown as TenantPrismaClient,
        'inv-1',
        { code: 'SAVE20' },
      );

      expect((result as { invoice: { discountAmount: number } }).invoice.discountAmount).toBe(100);
      expect(mockDb.discount.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amount: 100 }),
        }),
      );
    });
  });

  describe('voidInvoice - إلغاء الفاتورة', () => {
    it('يجب إلغاء فاتورة مسودة', async () => {
      mockDb.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: 'draft',
      });
      mockDb.invoice.update.mockResolvedValue({
        id: 'inv-1',
        status: 'void',
        invoiceItems: [],
        payments: [],
      });

      const result = await service.voidInvoice(mockDb as unknown as TenantPrismaClient, 'inv-1');

      expect(result).toHaveProperty('status', 'void');
      expect(mockDb.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { status: 'void' },
        include: { invoiceItems: true, payments: true },
      });
    });

    it('يجب رفض إلغاء فاتورة ملغاة بالفعل', async () => {
      mockDb.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: 'void',
      });

      await expect(
        service.voidInvoice(mockDb as unknown as TenantPrismaClient, 'inv-1'),
      ).rejects.toThrow(BadRequestException);
      expect(mockDb.invoice.update).not.toHaveBeenCalled();
    });

    it('يجب رفض إلغاء فاتورة مدفوعة', async () => {
      mockDb.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: 'paid',
      });

      await expect(
        service.voidInvoice(mockDb as unknown as TenantPrismaClient, 'inv-1'),
      ).rejects.toThrow(BadRequestException);
      expect(mockDb.invoice.update).not.toHaveBeenCalled();
    });
  });
});
