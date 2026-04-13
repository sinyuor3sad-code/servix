import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { TenantPrismaClient } from '../../../shared/types';
import { PdfService } from '../../../shared/pdf/pdf.service';
import { MailService } from '../../../shared/mail/mail.service';
import { WhatsAppService } from '../../../shared/whatsapp/whatsapp.service';
import { SmsService } from '../../../shared/sms/sms.service';
import { SettingsService } from '../settings/settings.service';
import { AuditService } from '../../../core/audit/audit.service';
import { EventsGateway } from '../../../shared/events/events.gateway';
import { SETTINGS_KEYS } from '../settings/settings.constants';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { AddDiscountDto } from './dto/add-discount.dto';
import { ApplyCouponDto } from './dto/apply-coupon.dto';
import { QueryInvoicesDto } from './dto/query-invoices.dto';
import { InvoiceSendChannel } from './dto/send-invoice.dto';
import { paginate, effectiveLimit } from '../../../shared/helpers/paginate.helper';


@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly pdfService: PdfService,
    private readonly mailService: MailService,
    private readonly whatsAppService: WhatsAppService,
    private readonly smsService: SmsService,
    private readonly settingsService: SettingsService,
    private readonly auditService: AuditService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async findAll(
    db: TenantPrismaClient,
    query: QueryInvoicesDto,
  ) {
    const { page, sort, order, status, clientId, dateFrom, dateTo } = query;
    const limit = effectiveLimit(query);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (clientId) {
      where.clientId = clientId;
    }

    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {};
      if (dateFrom) createdAt.gte = new Date(dateFrom);
      if (dateTo) createdAt.lte = new Date(dateTo);
      where.createdAt = createdAt;
    }

    const [data, total] = await Promise.all([
      db.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort || 'createdAt']: order || 'desc' },
        include: {
          invoiceItems: true,
          payments: true,
          client: {
            select: { id: true, fullName: true, phone: true },
          },
        },
      }),
      db.invoice.count({ where }),
    ]);

    return paginate(data as unknown as Record<string, unknown>[], total, page, limit);
  }

  async create(
    db: TenantPrismaClient,
    dto: CreateInvoiceDto,
    createdBy: string,
  ): Promise<Record<string, unknown>> {
    const client = await db.client.findFirst({
      where: { id: dto.clientId, deletedAt: null },
    });
    if (!client) {
      throw new NotFoundException('العميل غير موجود');
    }

    if (dto.appointmentId) {
      const appointment = await db.appointment.findUnique({
        where: { id: dto.appointmentId },
      });
      if (!appointment) {
        throw new NotFoundException('الموعد غير موجود');
      }
    }

    const invoiceNumber = await this.generateInvoiceNumber(db);

    const salonInfo = await db.salonInfo.findFirst();
    const taxPercentage = salonInfo ? Number(salonInfo.taxPercentage) : 15;

    const subtotal = dto.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
    const taxAmount = (subtotal * taxPercentage) / 100;
    const total = subtotal + taxAmount;

    const invoice = await db.invoice.create({
      data: {
        clientId: dto.clientId,
        appointmentId: dto.appointmentId,
        selfOrderId: dto.selfOrderId,
        invoiceNumber,
        subtotal,
        taxAmount,
        total,
        notes: dto.notes,
        createdBy,
        invoiceItems: {
          create: dto.items.map((item) => ({
            serviceId: item.serviceId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
            employeeId: item.employeeId,
          })),
        },
      },
      include: {
        invoiceItems: true,
        client: {
          select: { id: true, fullName: true, phone: true },
        },
      },
    });

    // Audit log (fire-and-forget)
    this.auditService.log({
      userId: createdBy,
      action: 'invoice.create',
      entityType: 'Invoice',
      entityId: (invoice as Record<string, unknown>).id as string,
      newValues: { clientId: dto.clientId, total },
    }).catch(() => {});

    return invoice as unknown as Record<string, unknown>;
  }

  async findOne(
    db: TenantPrismaClient,
    id: string,
  ): Promise<Record<string, unknown>> {
    const invoice = await db.invoice.findUnique({
      where: { id },
      include: {
        invoiceItems: {
          include: {
            service: true,
            employee: { select: { id: true, fullName: true } },
          },
        },
        payments: true,
        discounts: true,
        client: {
          select: { id: true, fullName: true, phone: true, email: true },
        },
        appointment: {
          select: { id: true, date: true, startTime: true, status: true },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('الفاتورة غير موجودة');
    }

    return invoice as unknown as Record<string, unknown>;
  }

  async update(
    db: TenantPrismaClient,
    id: string,
    dto: UpdateInvoiceDto,
  ): Promise<Record<string, unknown>> {
    const existing = await db.invoice.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('الفاتورة غير موجودة');
    }
    if (existing.status !== 'draft') {
      throw new BadRequestException('لا يمكن تعديل فاتورة غير مسودة');
    }

    const salonInfo = await db.salonInfo.findFirst();
    const taxPercentage = salonInfo ? Number(salonInfo.taxPercentage) : 15;

    const invoice = await db.$transaction(async (tx) => {
      if (dto.items) {
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });

        await tx.invoiceItem.createMany({
          data: dto.items.map((item) => ({
            invoiceId: id,
            serviceId: item.serviceId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
            employeeId: item.employeeId,
          })),
        });

        const subtotal = dto.items.reduce(
          (sum, item) => sum + item.quantity * item.unitPrice,
          0,
        );
        const currentDiscount = Number(existing.discountAmount);
        const taxableAmount = subtotal - currentDiscount;
        const taxAmount = (taxableAmount * taxPercentage) / 100;
        const total = taxableAmount + taxAmount;

        return tx.invoice.update({
          where: { id },
          data: {
            notes: dto.notes,
            subtotal,
            taxAmount,
            total,
          },
          include: { invoiceItems: true, payments: true },
        });
      }

      return tx.invoice.update({
        where: { id },
        data: { notes: dto.notes },
        include: { invoiceItems: true, payments: true },
      });
    });

    return invoice as unknown as Record<string, unknown>;
  }

  async recordPayment(
    db: TenantPrismaClient,
    id: string,
    dto: RecordPaymentDto,
    tenantSlug?: string,
  ): Promise<Record<string, unknown>> {
    const invoice = await db.invoice.findUnique({
      where: { id },
      include: { payments: true },
    });
    if (!invoice) {
      throw new NotFoundException('الفاتورة غير موجودة');
    }
    if (invoice.status === 'void') {
      throw new BadRequestException('لا يمكن الدفع لفاتورة ملغاة');
    }
    if (invoice.status === 'paid') {
      throw new BadRequestException('الفاتورة مدفوعة بالكامل بالفعل');
    }

    const totalPaid = invoice.payments.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );
    const remaining = Number(invoice.total) - totalPaid;

    if (dto.amount > remaining) {
      throw new BadRequestException(
        `المبلغ المدفوع يتجاوز المتبقي. المبلغ المتبقي: ${remaining.toFixed(2)} ر.س`,
      );
    }

    const result = await db.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          invoiceId: id,
          amount: dto.amount,
          method: dto.method,
          reference: dto.reference,
        },
      });

      const newTotalPaid = totalPaid + dto.amount;
      const invoiceTotal = Number(invoice.total);
      const newStatus = newTotalPaid >= invoiceTotal ? 'paid' : 'partially_paid';

      // Generate publicToken for all paid invoices (QR invoice link)
      const publicToken = newStatus === 'paid'
        ? randomBytes(32).toString('hex')
        : undefined;

      const updatedInvoice = await tx.invoice.update({
        where: { id },
        data: {
          status: newStatus,
          paidAt: newStatus === 'paid' ? new Date() : undefined,
          ...(publicToken && {
            publicToken,
            publicTokenStatus: 'active',
            publicTokenCreatedAt: new Date(),
          }),
        },
        include: { payments: true, invoiceItems: true },
      });

      if (newStatus === 'paid') {
        // Update client stats
        await tx.client.update({
          where: { id: invoice.clientId },
          data: {
            totalSpent: { increment: invoiceTotal },
            totalVisits: { increment: 1 },
            lastVisitAt: new Date(),
          },
        });

        // If linked to a self-order, mark it as paid
        if (invoice.selfOrderId) {
          await tx.selfOrder.update({
            where: { id: invoice.selfOrderId },
            data: { status: 'paid' },
          });
        }
      }

      return { payment, invoice: updatedInvoice, publicToken };
    });

    // Audit log (fire-and-forget)
    this.auditService.log({
      userId: id,
      action: 'invoice.payment',
      entityType: 'Invoice',
      entityId: id,
      newValues: { amount: dto.amount, method: dto.method },
    }).catch(() => {});

    // Notify customer if self-order was paid (WebSocket)
    const res = result as { payment: unknown; invoice: Record<string, unknown>; publicToken?: string };
    if (res.publicToken && invoice.selfOrderId && tenantSlug) {
      try {
        const selfOrder = await db.selfOrder.findUnique({
          where: { id: invoice.selfOrderId },
          select: { orderCode: true },
        });
        if (selfOrder) {
          this.eventsGateway.emitToOrder(
            tenantSlug,
            selfOrder.orderCode,
            'order:paid',
            {
              orderCode: selfOrder.orderCode,
              invoiceToken: res.publicToken,
              invoiceNumber: res.invoice.invoiceNumber || '',
              total: Number(invoice.total),
            },
          );
          this.logger.log(`Emitted order:paid for ${tenantSlug}:${selfOrder.orderCode}`);
        }
      } catch (err) {
        this.logger.error(`Failed to emit order:paid: ${(err as Error).message}`);
      }
    }

    return result as unknown as Record<string, unknown>;
  }

  async voidInvoice(
    db: TenantPrismaClient,
    id: string,
  ): Promise<Record<string, unknown>> {
    const invoice = await db.invoice.findUnique({ where: { id } });
    if (!invoice) {
      throw new NotFoundException('الفاتورة غير موجودة');
    }
    if (invoice.status === 'void') {
      throw new BadRequestException('الفاتورة ملغاة بالفعل');
    }
    if (invoice.status === 'paid') {
      throw new BadRequestException('لا يمكن إلغاء فاتورة مدفوعة بالكامل');
    }

    const updated = await db.invoice.update({
      where: { id },
      data: { status: 'void' },
      include: { invoiceItems: true, payments: true },
    });

    // Audit log (fire-and-forget)
    this.auditService.log({
      userId: id,
      action: 'invoice.void',
      entityType: 'Invoice',
      entityId: id,
      oldValues: { status: invoice.status },
      newValues: { status: 'void' },
    }).catch(() => {});

    return updated as unknown as Record<string, unknown>;
  }

  async addDiscount(
    db: TenantPrismaClient,
    id: string,
    dto: AddDiscountDto,
  ): Promise<Record<string, unknown>> {
    const invoice = await db.invoice.findUnique({ where: { id } });
    if (!invoice) {
      throw new NotFoundException('الفاتورة غير موجودة');
    }
    if (invoice.status === 'void' || invoice.status === 'paid') {
      throw new BadRequestException('لا يمكن إضافة خصم لهذه الفاتورة');
    }

    const subtotal = Number(invoice.subtotal);
    const discountAmount =
      dto.type === 'percentage'
        ? (subtotal * dto.value) / 100
        : dto.value;

    if (discountAmount > subtotal) {
      throw new BadRequestException('قيمة الخصم تتجاوز المجموع الفرعي');
    }

    const salonInfo = await db.salonInfo.findFirst();
    const taxPercentage = salonInfo ? Number(salonInfo.taxPercentage) : 15;

    const result = await db.$transaction(async (tx) => {
      const discount = await tx.discount.create({
        data: {
          invoiceId: id,
          type: dto.type,
          value: dto.value,
          amount: discountAmount,
          reason: dto.reason,
        },
      });

      const allDiscounts = await tx.discount.findMany({
        where: { invoiceId: id },
      });
      const totalDiscount = allDiscounts.reduce(
        (sum, d) => sum + Number(d.amount),
        0,
      );

      const taxableAmount = subtotal - totalDiscount;
      const taxAmount = (taxableAmount * taxPercentage) / 100;
      const total = taxableAmount + taxAmount;

      const updatedInvoice = await tx.invoice.update({
        where: { id },
        data: { discountAmount: totalDiscount, taxAmount, total },
        include: { invoiceItems: true, discounts: true, payments: true },
      });

      return { discount, invoice: updatedInvoice };
    });

    return result as unknown as Record<string, unknown>;
  }

  async applyCoupon(
    db: TenantPrismaClient,
    id: string,
    dto: ApplyCouponDto,
  ): Promise<Record<string, unknown>> {
    const invoice = await db.invoice.findUnique({ where: { id } });
    if (!invoice) {
      throw new NotFoundException('الفاتورة غير موجودة');
    }
    if (invoice.status === 'void' || invoice.status === 'paid') {
      throw new BadRequestException('لا يمكن تطبيق كوبون على هذه الفاتورة');
    }

    const coupon = await db.coupon.findUnique({
      where: { code: dto.code },
    });
    if (!coupon) {
      throw new NotFoundException('الكوبون غير موجود');
    }
    if (!coupon.isActive) {
      throw new BadRequestException('الكوبون غير مفعّل');
    }

    const now = new Date();
    if (now < coupon.validFrom || (coupon.validUntil && now > coupon.validUntil)) {
      throw new BadRequestException('الكوبون منتهي الصلاحية أو لم يبدأ بعد');
    }
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException('الكوبون وصل للحد الأقصى من الاستخدام');
    }

    const subtotal = Number(invoice.subtotal);
    if (coupon.minOrder !== null && subtotal < Number(coupon.minOrder)) {
      throw new BadRequestException(
        `الحد الأدنى للطلب لاستخدام هذا الكوبون هو ${Number(coupon.minOrder).toFixed(2)} ر.س`,
      );
    }

    let discountAmount =
      coupon.type === 'percentage'
        ? (subtotal * Number(coupon.value)) / 100
        : Number(coupon.value);

    if (coupon.maxDiscount !== null && discountAmount > Number(coupon.maxDiscount)) {
      discountAmount = Number(coupon.maxDiscount);
    }

    const salonInfo = await db.salonInfo.findFirst();
    const taxPercentage = salonInfo ? Number(salonInfo.taxPercentage) : 15;

    const result = await db.$transaction(async (tx) => {
      await tx.coupon.update({
        where: { id: coupon.id },
        data: { usedCount: { increment: 1 } },
      });

      const discount = await tx.discount.create({
        data: {
          invoiceId: id,
          type: coupon.type as 'percentage' | 'fixed',
          value: Number(coupon.value),
          amount: discountAmount,
          reason: `كوبون: ${coupon.code}`,
        },
      });

      const allDiscounts = await tx.discount.findMany({
        where: { invoiceId: id },
      });
      const totalDiscount = allDiscounts.reduce(
        (sum, d) => sum + Number(d.amount),
        0,
      );

      const taxableAmount = subtotal - totalDiscount;
      const taxAmount = (taxableAmount * taxPercentage) / 100;
      const total = taxableAmount + taxAmount;

      const updatedInvoice = await tx.invoice.update({
        where: { id },
        data: { discountAmount: totalDiscount, taxAmount, total },
        include: { invoiceItems: true, discounts: true, payments: true },
      });

      return { discount, invoice: updatedInvoice };
    });

    return result as unknown as Record<string, unknown>;
  }

  async getPdf(
    db: TenantPrismaClient,
    invoiceId: string,
    tenantBranding: { nameAr: string; primaryColor: string; logoUrl: string | null },
  ): Promise<Buffer> {
    return this.pdfService.generateInvoicePdf(db, invoiceId, tenantBranding);
  }

  async sendInvoice(
    db: TenantPrismaClient,
    invoiceId: string,
    channel: InvoiceSendChannel,
    tenantBranding: { nameAr: string; primaryColor: string; logoUrl: string | null },
    tenantId?: string,
  ): Promise<{ message: string }> {
    const invoice = await db.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        client: { select: { fullName: true, phone: true, email: true } },
      },
    });

    if (!invoice) {
      throw new NotFoundException('الفاتورة غير موجودة');
    }

    const pdfBuffer = await this.pdfService.generateInvoicePdf(
      db,
      invoiceId,
      tenantBranding,
    );
    const filename = `فاتورة-${invoice.invoiceNumber}.pdf`;

    const clientPhone = invoice.client.phone.replace(/\D/g, '');
    const whatsappPhone = clientPhone.startsWith('966') ? clientPhone : `966${clientPhone.replace(/^0/, '')}`;

    switch (channel) {
      case InvoiceSendChannel.whatsapp: {
        const settings = tenantId ? await this.settingsService.getAll(db, tenantId) : {};
        if (settings[SETTINGS_KEYS.whatsapp_enabled] !== 'true') {
          throw new BadRequestException('إرسال واتساب غير مفعّل في إعدادات الصالون');
        }
        if (settings[SETTINGS_KEYS.whatsapp_invoice_send] !== 'true') {
          throw new BadRequestException('إرسال الفواتير عبر واتساب غير مفعّل');
        }
        const waCredentials = settings[SETTINGS_KEYS.whatsapp_token] && settings[SETTINGS_KEYS.whatsapp_phone_number_id]
          ? { token: settings[SETTINGS_KEYS.whatsapp_token], phoneNumberId: settings[SETTINGS_KEYS.whatsapp_phone_number_id] }
          : null;
        if (!waCredentials) {
          throw new BadRequestException('لم يتم ربط حساب واتساب للصالون. أضف التوكن ورقم الهاتف في الإعدادات');
        }
        await this.whatsAppService.sendDocument(
          {
            to: whatsappPhone,
            document: pdfBuffer,
            filename,
            caption: `فاتورة ${invoice.invoiceNumber} من ${tenantBranding.nameAr}\nالإجمالي: ${Number(invoice.total).toFixed(2)} ر.س`,
          },
          waCredentials,
        );
        return { message: 'تم إرسال الفاتورة عبر واتساب بنجاح' };
      }
      case InvoiceSendChannel.email:
        if (!invoice.client.email) {
          throw new BadRequestException('العميل لا يملك بريداً إلكترونياً مسجلاً');
        }
        await this.mailService.send({
          to: invoice.client.email,
          subject: `فاتورة ${invoice.invoiceNumber} - ${tenantBranding.nameAr}`,
          body: `مرحباً ${invoice.client.fullName}،\n\nمرفق فاتورتك رقم ${invoice.invoiceNumber}.\nالإجمالي: ${Number(invoice.total).toFixed(2)} ر.س\n\nشكراً لزيارتكم`,
          attachments: [
            { filename, content: pdfBuffer, contentType: 'application/pdf' },
          ],
        });
        return { message: 'تم إرسال الفاتورة عبر البريد الإلكتروني بنجاح' };
      case InvoiceSendChannel.sms:
        await this.smsService.send({
          to: invoice.client.phone,
          message: `${tenantBranding.nameAr}: فاتورة ${invoice.invoiceNumber} - الإجمالي ${Number(invoice.total).toFixed(2)} ر.س. شكراً لزيارتكم`,
        });
        return { message: 'تم إرسال تفاصيل الفاتورة عبر الرسائل النصية بنجاح' };
      default:
        throw new BadRequestException('قناة إرسال غير صالحة');
    }
  }

  private async generateInvoiceNumber(db: TenantPrismaClient): Promise<string> {
    const lastInvoice = await db.invoice.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { invoiceNumber: true },
    });

    let nextNumber = 1;
    if (lastInvoice?.invoiceNumber) {
      const parts = lastInvoice.invoiceNumber.split('-');
      const lastNum = parseInt(parts[1], 10);
      if (!isNaN(lastNum)) {
        nextNumber = lastNum + 1;
      }
    }

    return `INV-${nextNumber.toString().padStart(4, '0')}`;
  }

  /* ════════════════════════════════════════════════
     TOKEN MANAGEMENT
     ════════════════════════════════════════════════ */

  /** Generate a public token for a paid invoice (or return existing active one) */
  async generateToken(db: TenantPrismaClient, invoiceId: string) {
    const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('الفاتورة غير موجودة');
    if (invoice.status !== 'paid') throw new BadRequestException('يجب أن تكون الفاتورة مدفوعة');

    // If active token already exists, return it
    if (invoice.publicToken && invoice.publicTokenStatus === 'active') {
      return { publicToken: invoice.publicToken, alreadyExists: true };
    }

    // Generate new token
    const token = randomBytes(32).toString('hex');
    await db.invoice.update({
      where: { id: invoiceId },
      data: {
        publicToken: token,
        publicTokenStatus: 'active',
        publicTokenCreatedAt: new Date(),
        publicTokenRevokedAt: null,
      },
    });

    this.logger.log(`Public token generated for invoice ${invoiceId}`);
    return { publicToken: token, alreadyExists: false };
  }

  /** Revoke an active public token (doesn't delete — just changes status) */
  async revokeToken(db: TenantPrismaClient, invoiceId: string) {
    const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('الفاتورة غير موجودة');
    if (!invoice.publicToken || invoice.publicTokenStatus !== 'active') {
      throw new BadRequestException('لا يوجد رابط نشط لتعطيله');
    }

    await db.invoice.update({
      where: { id: invoiceId },
      data: {
        publicTokenStatus: 'revoked',
        publicTokenRevokedAt: new Date(),
      },
    });

    this.logger.log(`Public token revoked for invoice ${invoiceId}`);
    return { success: true };
  }

  /** Regenerate a new public token (old token becomes invalid automatically) */
  async regenerateToken(db: TenantPrismaClient, invoiceId: string) {
    const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('الفاتورة غير موجودة');
    if (invoice.status !== 'paid') throw new BadRequestException('يجب أن تكون الفاتورة مدفوعة');

    const token = randomBytes(32).toString('hex');
    await db.invoice.update({
      where: { id: invoiceId },
      data: {
        publicToken: token,
        publicTokenStatus: 'active',
        publicTokenCreatedAt: new Date(),
        publicTokenRevokedAt: null,
      },
    });

    this.logger.log(`Public token regenerated for invoice ${invoiceId}`);
    return { publicToken: token };
  }
}
