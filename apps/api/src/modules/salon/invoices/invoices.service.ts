import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { TenantPrismaClient } from '../../../shared/types';
import { PdfService } from '../../../shared/pdf/pdf.service';
import { MailService } from '../../../shared/mail/mail.service';
import { WhatsAppService } from '../../../shared/whatsapp/whatsapp.service';
import { WhatsAppEvolutionService } from '../whatsapp-evolution/whatsapp-evolution.service';
import { PlatformPrismaClient } from '../../../shared/database/platform.client';
import { SmsService } from '../../../shared/sms/sms.service';
import { SettingsService } from '../settings/settings.service';
import { AuditService } from '../../../core/audit/audit.service';
import { EventsGateway } from '../../../shared/events/events.gateway';
import { SalonZatcaService } from '../zatca/zatca.service';
import { SETTINGS_KEYS } from '../settings/settings.constants';
import { ReviewRequestsService } from '../whatsapp-evolution/review-requests.service';
import { CreateInvoiceDto, InvoiceItemDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { AddDiscountDto } from './dto/add-discount.dto';
import { ApplyCouponDto } from './dto/apply-coupon.dto';
import { QueryInvoicesDto } from './dto/query-invoices.dto';
import { InvoiceSendChannel } from './dto/send-invoice.dto';
import { paginate, effectiveLimit } from '../../../shared/helpers/paginate.helper';

type NormalizedInvoiceItem = {
  serviceId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  employeeId: string;
};

type InvoiceNumberClient = Pick<TenantPrismaClient, '$executeRawUnsafe' | '$queryRawUnsafe'>;


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
    private readonly reviewRequests: ReviewRequestsService,
    private readonly salonZatcaService: SalonZatcaService,
    private readonly evolutionService: WhatsAppEvolutionService,
    private readonly platformPrisma: PlatformPrismaClient,
  ) {}

  private async normalizeInvoiceItems(
    db: TenantPrismaClient,
    items: InvoiceItemDto[],
  ): Promise<NormalizedInvoiceItem[]> {
    const serviceIds = Array.from(
      new Set(
        items
          .map((item) => item.serviceId)
          .filter((serviceId): serviceId is string => Boolean(serviceId)),
      ),
    );

    const services = serviceIds.length
      ? await db.service.findMany({
          where: { id: { in: serviceIds }, isActive: true },
          select: { id: true, nameAr: true, nameEn: true, price: true },
        })
      : [];

    if (services.length !== serviceIds.length) {
      throw new BadRequestException('Invalid invoice service');
    }

    const serviceById = new Map(services.map((service) => [service.id, service]));

    return items.map((item) => {
      if (!item.serviceId) {
        const unitPrice = Number(item.unitPrice);
        return {
          serviceId: undefined,
          description: item.description,
          quantity: item.quantity,
          unitPrice,
          totalPrice: item.quantity * unitPrice,
          employeeId: item.employeeId,
        };
      }

      const service = serviceById.get(item.serviceId);
      if (!service) {
        throw new BadRequestException('Invalid invoice service');
      }

      const unitPrice = Number(service.price);
      return {
        serviceId: service.id,
        description: service.nameAr || service.nameEn || item.description,
        quantity: item.quantity,
        unitPrice,
        totalPrice: item.quantity * unitPrice,
        employeeId: item.employeeId,
      };
    });
  }

  async findAll(
    db: TenantPrismaClient,
    query: QueryInvoicesDto,
  ) {
    const { page, sort, order, status, clientId, dateFrom, dateTo, terminalId } = query;
    const limit = effectiveLimit(query);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (clientId) {
      where.clientId = clientId;
    }

    if (terminalId) {
      where.terminalId = terminalId;
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

    const salonInfo = await db.salonInfo.findFirst();
    const taxPercentage = salonInfo ? Number(salonInfo.taxPercentage) : 15;
    const items = await this.normalizeInvoiceItems(db, dto.items);

    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const taxAmount = (subtotal * taxPercentage) / 100;
    const total = subtotal + taxAmount;

    let invoice: Awaited<ReturnType<TenantPrismaClient['invoice']['create']>> | null = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        invoice = await db.$transaction(async (tx) => {
          const invoiceNumber = await this.generateInvoiceNumber(tx);
          return tx.invoice.create({
            data: {
              clientId: dto.clientId,
              appointmentId: dto.appointmentId,
              selfOrderId: dto.selfOrderId,
              terminalId: dto.terminalId || null,
              invoiceNumber,
              subtotal,
              taxAmount,
              total,
              notes: dto.notes,
              createdBy,
              invoiceItems: {
                create: items.map((item) => ({
                  serviceId: item.serviceId,
                  description: item.description,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  totalPrice: item.totalPrice,
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
        }, {
          isolationLevel: 'Serializable',
        });
        break;
      } catch (error) {
        if (this.isInvoiceNumberConflict(error) && attempt < 2) {
          continue;
        }
        throw error;
      }
    }

    if (!invoice) {
      throw new ConflictException('Unable to allocate a unique invoice number');
    }

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
    const normalizedItems = dto.items
      ? await this.normalizeInvoiceItems(db, dto.items)
      : null;

    const invoice = await db.$transaction(async (tx) => {
      if (normalizedItems) {
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });

        await tx.invoiceItem.createMany({
          data: normalizedItems.map((item) => ({
            invoiceId: id,
            serviceId: item.serviceId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            employeeId: item.employeeId,
          })),
        });

        const subtotal = normalizedItems.reduce((sum, item) => sum + item.totalPrice, 0);
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

    if (dto.method === 'cash') {
      const isModernPosInvoice = Boolean(invoice.terminalId);
      // Legacy non-terminal invoice payments predate cashReceived. Modern POS invoices
      // carry terminalId and must send cashReceived explicitly until atomic checkout owns this fully.
      if (isModernPosInvoice && dto.cashReceived === undefined) {
        throw new BadRequestException('Cash received is required for POS cash payments');
      }
      if (dto.cashReceived !== undefined && dto.cashReceived < dto.amount) {
        throw new BadRequestException('Cash received is less than the cash payment amount');
      }
    }

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

    if (res.invoice.status === 'paid') {
      this.reviewRequests.scheduleForPaidInvoice(db, id).catch((err: unknown) => {
        this.logger.error(`Failed to schedule review request for invoice ${id}: ${(err as Error).message}`);
      });

      // ZATCA auto-submit: fire-and-forget (don't block POS)
      this.salonZatcaService.submitInvoice(db, id).then(() => {
        this.logger.log(`ZATCA invoice submitted for ${id}`);
      }).catch((err: unknown) => {
        // Non-fatal: invoice is still valid, ZATCA submission can be retried
        this.logger.warn(`ZATCA auto-submit skipped for ${id}: ${(err as Error).message}`);
      });
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

  /**
   * Refund a paid invoice.
   * - Only 'paid' invoices can be refunded
   * - Creates a negative refund payment record
   * - Reverses client stats (totalSpent, totalVisits)
   * - Revokes the public token
   * - Sets invoice status to 'refunded'
   */
  async refundInvoice(
    db: TenantPrismaClient,
    id: string,
    reason?: string,
    itemIds?: string[],
  ): Promise<Record<string, unknown>> {
    const invoice = await db.invoice.findUnique({
      where: { id },
      include: { payments: true, invoiceItems: true },
    });

    if (!invoice) {
      throw new NotFoundException('الفاتورة غير موجودة');
    }
    if (invoice.status === 'refunded') {
      throw new BadRequestException('الفاتورة مستردة بالفعل');
    }
    if (invoice.status === 'void') {
      throw new BadRequestException('لا يمكن استرداد فاتورة ملغاة');
    }
    if (invoice.status !== 'paid') {
      throw new BadRequestException('يمكن استرداد الفواتير المدفوعة بالكامل فقط');
    }

    const isPartial = itemIds && itemIds.length > 0 && itemIds.length < invoice.invoiceItems.length;
    let refundAmount: number;

    if (isPartial) {
      const selectedItems = invoice.invoiceItems.filter(item => itemIds.includes(item.id));
      if (selectedItems.length === 0) {
        throw new BadRequestException('العناصر المحددة غير موجودة في الفاتورة');
      }
      refundAmount = selectedItems.reduce((sum, item) => sum + Number(item.totalPrice), 0);
    } else {
      refundAmount = Number(invoice.total);
    }

    const updated = await db.$transaction(async (tx) => {
      // 1. Create refund payment record (negative amount)
      await tx.payment.create({
        data: {
          invoiceId: id,
          amount: -refundAmount,
          method: 'cash',
          reference: reason || 'refund',
          status: 'refunded',
        },
      });

      if (isPartial) {
        // Partial refund — keep invoice status as paid
        const updatedInvoice = await tx.invoice.update({
          where: { id },
          data: {
            refundReason: `[جزئي] ${reason || 'إرجاع جزئي'} — ${itemIds!.length} عنصر — ${refundAmount} ر.س`,
          },
          include: { invoiceItems: true, payments: true },
        });
        if (invoice.clientId) {
          await tx.client.update({
            where: { id: invoice.clientId },
            data: { totalSpent: { decrement: refundAmount } },
          }).catch(() => {});
        }
        return updatedInvoice;
      } else {
        // Full refund — original logic
        await tx.payment.updateMany({
          where: { invoiceId: id, status: 'completed' },
          data: { status: 'refunded' },
        });
        const updatedInvoice = await tx.invoice.update({
          where: { id },
          data: {
            status: 'refunded',
            refundedAt: new Date(),
            refundReason: reason || null,
            ...(invoice.publicToken && { publicTokenStatus: 'revoked' }),
          },
          include: { invoiceItems: true, payments: true },
        });
        if (invoice.clientId) {
          await tx.client.update({
            where: { id: invoice.clientId },
            data: {
              totalSpent: { decrement: refundAmount },
              totalVisits: { decrement: 1 },
            },
          }).catch(() => {});
        }
        return updatedInvoice;
      }
    });

    // Audit log (fire-and-forget)
    this.auditService.log({
      userId: id,
      action: isPartial ? 'invoice.partial_refund' : 'invoice.refund',
      entityType: 'Invoice',
      entityId: id,
      oldValues: { status: 'paid' },
      newValues: { status: isPartial ? 'paid' : 'refunded', reason, refundAmount, itemIds },
    }).catch(() => {});

    this.logger.log(`Invoice ${invoice.invoiceNumber} ${isPartial ? 'partially ' : ''}refunded (${refundAmount} SAR). Reason: ${reason || 'N/A'}`);

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
    overridePhone?: string,
  ): Promise<{ message: string }> {
    const invoice = await db.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        client: { select: { fullName: true, phone: true, email: true } },
        invoiceItems: {
          select: {
            description: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('الفاتورة غير موجودة');
    }

    if (!invoice.invoiceItems.length) {
      throw new BadRequestException('لا يمكن إرسال فاتورة بدون أصناف');
    }

    const pdfBuffer = await this.pdfService.generateInvoicePdf(
      db,
      invoiceId,
      tenantBranding,
    );
    const filename = `فاتورة-${invoice.invoiceNumber}.pdf`;

    // ── Resolve target phone: explicit override > client phone ──
    const rawPhone = (overridePhone ?? invoice.client.phone ?? '').replace(/\D/g, '');
    if (!rawPhone || rawPhone.length < 8) {
      throw new BadRequestException(
        'رقم جوال العميل غير متوفر. أدخل رقماً صحيحاً قبل الإرسال',
      );
    }
    const whatsappPhone = this.normalizeGulfPhone(rawPhone);

    switch (channel) {
      case InvoiceSendChannel.whatsapp: {
        // ── Unified: send via Evolution API (Baileys) ──
        if (!tenantId) {
          throw new BadRequestException('لا يمكن تحديد الصالون لإرسال واتساب');
        }

        // Check settings
        const settings = await this.settingsService.getAll(db, tenantId);
        if (settings[SETTINGS_KEYS.whatsapp_enabled] !== 'true') {
          throw new BadRequestException('إرسال واتساب غير مفعّل في إعدادات الصالون');
        }
        if (settings[SETTINGS_KEYS.whatsapp_invoice_send] !== 'true') {
          throw new BadRequestException('إرسال الفواتير عبر واتساب غير مفعّل');
        }

        // Look up the Evolution instance for this tenant
        const waInstance = await this.platformPrisma.whatsAppInstance.findUnique({
          where: { tenantId },
        });
        if (!waInstance || waInstance.status !== 'connected') {
          throw new BadRequestException(
            'واتساب غير متصل. افتح إعدادات واتساب وأعد المسح بالـ QR',
          );
        }

        const salonInfo = await db.salonInfo.findFirst({
          select: { taxNumber: true },
        });
        const caption = this.buildInvoiceWhatsAppCaption(
          invoice,
          tenantBranding.nameAr,
          salonInfo?.taxNumber ?? null,
        );

        // Convert PDF buffer → base64 (no data: prefix; Evolution v2 expects raw base64)
        const base64Pdf = pdfBuffer.toString('base64');

        try {
          await this.evolutionService.sendMedia({
            instanceName: waInstance.instanceName,
            instanceToken: waInstance.instanceToken,
            to: whatsappPhone,
            message: caption,
            mediaUrl: base64Pdf,
            mediaType: 'document',
            mimetype: 'application/pdf',
            filename,
            caption,
          });
        } catch (err) {
          const reason = (err as Error)?.message ?? 'unknown';
          this.logger.error(
            `Invoice ${invoice.invoiceNumber} WA send failed → ${whatsappPhone} (instance=${waInstance.instanceName}): ${reason}`,
          );
          throw new BadRequestException(
            `تعذّر إرسال الفاتورة عبر واتساب: ${reason}`,
          );
        }

        this.logger.log(
          `Invoice ${invoice.invoiceNumber} sent via Evolution WhatsApp to ${whatsappPhone} (instance=${waInstance.instanceName})`,
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

  // ── Gulf country-code-aware phone normalization (E.164 without +). ──
  // Accepts: bare local digits, leading 0, or already-prefixed international.
  // Default fallback for plain local numbers is +966 (KSA).
  private normalizeGulfPhone(rawDigits: string): string {
    const GULF_CODES = ['966', '971', '965', '973', '974', '968'];
    const digits = rawDigits.replace(/^00/, '');
    if (GULF_CODES.some((c) => digits.startsWith(c))) return digits;
    return `966${digits.replace(/^0/, '')}`;
  }

  private buildInvoiceWhatsAppCaption(
    invoice: {
      invoiceNumber: string;
      createdAt: Date;
      subtotal: unknown;
      discountAmount: unknown;
      taxAmount: unknown;
      total: unknown;
      client: { fullName: string };
      invoiceItems: { description: string; quantity: number; unitPrice: unknown; totalPrice: unknown }[];
    },
    salonName: string,
    taxNumber: string | null,
  ): string {
    const fmt = (v: unknown) => Number(v ?? 0).toFixed(2);
    const dateStr = new Intl.DateTimeFormat('ar-SA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(invoice.createdAt);

    const lines: string[] = [];
    // ZATCA-required header for B2C simplified invoices.
    lines.push('فاتورة ضريبية مبسطة');
    lines.push(`*${salonName}*`);
    if (taxNumber) lines.push(`الرقم الضريبي: ${taxNumber}`);
    lines.push('──────────────');
    lines.push(`فاتورة رقم: ${invoice.invoiceNumber}`);
    if (invoice.client.fullName) lines.push(`العميل: ${invoice.client.fullName}`);
    lines.push(`التاريخ: ${dateStr}`);
    lines.push('');
    lines.push('*الأصناف:*');
    for (const it of invoice.invoiceItems) {
      lines.push(`• ${it.description} × ${it.quantity} = ${fmt(it.totalPrice)} ر.س`);
    }
    lines.push('');
    lines.push(`المجموع الفرعي: ${fmt(invoice.subtotal)} ر.س`);
    if (Number(invoice.discountAmount ?? 0) > 0) {
      lines.push(`الخصم: ${fmt(invoice.discountAmount)} ر.س`);
    }
    if (Number(invoice.taxAmount ?? 0) > 0) {
      lines.push(`الضريبة: ${fmt(invoice.taxAmount)} ر.س`);
    }
    lines.push(`*الإجمالي: ${fmt(invoice.total)} ر.س*`);
    lines.push('');
    lines.push('شكراً لزيارتكم 🌸');
    return lines.join('\n');
  }

  private async generateInvoiceNumber(db: InvoiceNumberClient): Promise<string> {
    await db.$executeRawUnsafe('SELECT pg_advisory_xact_lock(91827364, 51020264)');

    const lastInvoices = await db.$queryRawUnsafe<{ invoice_number: string }[]>(
      `SELECT invoice_number
       FROM invoices
       WHERE invoice_number ~ '^INV-[0-9]+$'
       ORDER BY CAST(SPLIT_PART(invoice_number, '-', 2) AS INTEGER) DESC
       LIMIT 1`,
    );

    let nextNumber = 1;
    if (lastInvoices.length > 0) {
      const parts = lastInvoices[0].invoice_number.split('-');
      const lastNum = parseInt(parts[1], 10);
      if (!Number.isNaN(lastNum)) {
        nextNumber = lastNum + 1;
      }
    }

    return `INV-${nextNumber.toString().padStart(4, '0')}`;
  }

  private isInvoiceNumberConflict(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const candidate = error as { code?: string; meta?: { target?: unknown } };
    if (candidate.code !== 'P2002') return false;
    return JSON.stringify(candidate.meta?.target ?? '').includes('invoice_number');
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

  /**
   * Update the client name on a POS invoice's client record.
   * Allowed only when the linked client is anonymous or walk-in
   * (registered clients are managed via the clients module).
   * Also patches receipt_snapshot.client.fullName for consistency.
   */
  async updateClientName(
    db: TenantPrismaClient,
    invoiceId: string,
    fullName: string,
    userId: string,
  ): Promise<Record<string, unknown>> {
    const trimmed = fullName.trim();
    if (!trimmed) throw new BadRequestException('الاسم مطلوب');

    const invoice = await db.invoice.findUnique({
      where: { id: invoiceId },
      include: { client: { select: { id: true, fullName: true, phone: true, source: true } } },
    });
    if (!invoice) throw new NotFoundException('الفاتورة غير موجودة');
    if (!invoice.client) throw new BadRequestException('لا يوجد عميل مرتبط بالفاتورة');

    const isAnonymous =
      invoice.client.fullName === 'Anonymous Customer' && invoice.client.phone === '0000000000';
    const isWalkIn = invoice.client.source === 'walk_in';

    if (!isAnonymous && !isWalkIn) {
      throw new BadRequestException('لا يمكن تعديل اسم عميل مسجّل من شاشة الكاشير');
    }

    await db.client.update({
      where: { id: invoice.client.id },
      data: { fullName: trimmed, ...(isAnonymous ? { source: 'walk_in' as const } : {}) },
    });

    const snapshot = invoice.receiptSnapshot as Record<string, unknown> | null;
    if (snapshot && typeof snapshot === 'object') {
      const snapshotClient = (snapshot.client as Record<string, unknown> | undefined) ?? {};
      const updatedSnapshot = {
        ...snapshot,
        client: { ...snapshotClient, fullName: trimmed },
      };
      await db.invoice.update({
        where: { id: invoiceId },
        data: { receiptSnapshot: updatedSnapshot as unknown as object },
      });
    }

    this.auditService.log({
      userId,
      action: 'invoice.client_name.updated',
      entityType: 'Invoice',
      entityId: invoiceId,
      newValues: { clientId: invoice.client.id, fullName: trimmed },
    }).catch(() => {});

    return { id: invoice.client.id, fullName: trimmed };
  }
}
