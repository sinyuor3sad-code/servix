import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { Prisma } from '../../../../generated/tenant';
import { AuditService } from '../../../core/audit/audit.service';
import { PlatformPrismaClient } from '../../../shared/database/platform.client';
import { TenantPrismaClient } from '../../../shared/types';
import {
  PosCheckoutDiscountType,
  PosCheckoutDto,
  PosCheckoutItemDto,
  PosCheckoutLoyaltyType,
  PosCheckoutPaymentDto,
  PosCheckoutPaymentMethod,
  PosCheckoutSourceType,
} from './dto/pos-checkout.dto';
import { ManagerOverrideService, VerifiedOverride } from './manager-override.service';

/** Discount limits by role name (% of pre-discount subtotal). */
const ROLE_DISCOUNT_LIMITS: Record<string, number> = {
  owner: 100,
  manager: 50,
  receptionist: 10,
  cashier: 10,
  staff: 10,
};
const DEFAULT_ROLE_LIMIT = 10;

type CheckoutTx = Prisma.TransactionClient;
type JsonRecord = Record<string, unknown>;
type CheckoutTransactionResult = {
  response: JsonRecord;
  replayed: boolean;
};

interface ResolvedClient {
  id: string;
  fullName: string;
  phone: string;
  email?: string | null;
}

interface ResolvedItem {
  serviceId: string;
  description: string;
  employeeId: string;
  employeeName: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

interface ResolvedDiscount {
  kind: 'manual' | 'coupon' | 'loyalty';
  type: PosCheckoutDiscountType;
  value: number;
  amountCents: number;
  reason: string;
  code?: string;
}

interface ValidatedPayment {
  method: PosCheckoutPaymentMethod;
  amountCents: number;
  cashReceivedCents: number | null;
  changeAmountCents: number | null;
  reference?: string;
}

const ANONYMOUS_CLIENT = {
  fullName: 'Anonymous Customer',
  phone: '0000000000',
};

@Injectable()
export class PosCheckoutService {
  constructor(
    private readonly platformDb: PlatformPrismaClient,
    private readonly managerOverrideService: ManagerOverrideService,
    private readonly auditService?: AuditService,
  ) {}

  async checkout(
    db: TenantPrismaClient,
    dto: PosCheckoutDto,
    createdBy: string,
    tenantId?: string,
  ): Promise<JsonRecord> {
    const requestHash = this.hashRequest(dto);

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const result = await db.$transaction(
          async (tx) => this.checkoutInTransaction(tx, dto, createdBy, requestHash, tenantId),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        if (!result.replayed) {
          this.logCheckoutCompleted(result.response, dto, createdBy, tenantId).catch(() => {});
        }
        return result.response;
      } catch (error) {
        if (this.isInvoiceNumberConflict(error) && attempt < 2) {
          continue;
        }
        if (!(error instanceof ConflictException)) {
          await this.markAttemptFailed(db, dto.idempotencyKey, requestHash, createdBy).catch(() => {});
        }
        throw error;
      }
    }

    throw new ConflictException('Unable to allocate a unique invoice number for POS checkout');
  }

  private async checkoutInTransaction(
    tx: CheckoutTx,
    dto: PosCheckoutDto,
    createdBy: string,
    requestHash: string,
    tenantId?: string,
  ): Promise<CheckoutTransactionResult> {
    this.validateRequiredContext(dto);

    const attempt = await this.lockOrCreateAttempt(tx, dto.idempotencyKey, requestHash, createdBy);
    if (attempt.fromExisting) {
      if (attempt.requestHash !== requestHash) {
        throw new ConflictException('Idempotency key was already used with a different checkout request');
      }

      if (attempt.status === 'completed') {
        if (!attempt.responseJson) {
          throw new ConflictException('Completed checkout attempt is missing its stored response');
        }
        return { response: attempt.responseJson as JsonRecord, replayed: true };
      }

      if (attempt.status === 'in_progress') {
        throw new ConflictException('Checkout is already in progress for this idempotency key');
      }

      await tx.posCheckoutAttempt.update({
        where: { id: attempt.id },
        data: { status: 'in_progress', invoiceId: null, responseJson: Prisma.DbNull },
      });
    }

    const shift = await this.validateOpenShift(tx, dto.shiftId);
    const client = await this.resolveClient(tx, dto);
    const source = await this.validateSource(tx, dto, client.id);
    const items = await this.resolveItems(tx, dto.items);

    const subtotalCents = items.reduce((sum, item) => sum + item.totalCents, 0);
    const salonInfo = await tx.salonInfo.findFirst();
    const taxRatePercent = salonInfo ? Number(salonInfo.taxPercentage) : 15;

    const discounts: ResolvedDiscount[] = [];
    const manualDiscount = this.resolveManualDiscount(dto, subtotalCents);
    let approvedOverride: VerifiedOverride | null = null;
    if (manualDiscount) {
      approvedOverride = await this.enforceDiscountRoleLimit(
        manualDiscount,
        subtotalCents,
        createdBy,
        tenantId,
        dto.managerApprovalToken,
      );
      discounts.push(manualDiscount);
    }

    const afterManualDiscountCents = subtotalCents - (manualDiscount?.amountCents ?? 0);
    const couponDiscount = await this.resolveAndReserveCoupon(tx, dto.couponCode, afterManualDiscountCents);
    if (couponDiscount) discounts.push(couponDiscount);

    const afterCouponCents = afterManualDiscountCents - (couponDiscount?.amountCents ?? 0);
    const loyaltyDiscount = await this.resolveLoyaltyRedemption(
      tx,
      dto,
      client.id,
      afterCouponCents,
    );
    if (loyaltyDiscount) discounts.push(loyaltyDiscount);

    const discountTotalCents = discounts.reduce((sum, discount) => sum + discount.amountCents, 0);
    if (discountTotalCents > subtotalCents) {
      throw new BadRequestException('Discount total exceeds checkout subtotal');
    }

    const taxableCents = subtotalCents - discountTotalCents;
    const taxCents = this.percentCents(taxableCents, taxRatePercent);
    const totalCents = taxableCents + taxCents;
    const payments = this.validatePayments(dto.payments, totalCents);
    const now = new Date();
    const invoiceNumber = await this.generateInvoiceNumber(tx);
    const publicToken = randomBytes(32).toString('hex');

    const invoice = await tx.invoice.create({
      data: {
        clientId: client.id,
        appointmentId: source.appointmentId,
        selfOrderId: source.selfOrderId,
        posShiftId: shift.id,
        terminalId: dto.terminalId,
        invoiceNumber,
        subtotal: this.centsToAmount(subtotalCents),
        discountAmount: this.centsToAmount(discountTotalCents),
        taxAmount: this.centsToAmount(taxCents),
        total: this.centsToAmount(totalCents),
        status: 'paid',
        notes: dto.notes ?? null,
        createdBy,
        paidAt: now,
        publicToken,
        publicTokenStatus: 'active',
        publicTokenCreatedAt: now,
      },
    });

    for (const item of items) {
      await tx.invoiceItem.create({
        data: {
          invoiceId: invoice.id,
          serviceId: item.serviceId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: this.centsToAmount(item.unitPriceCents),
          totalPrice: this.centsToAmount(item.totalCents),
          employeeId: item.employeeId,
        },
      });
    }

    for (const discount of discounts) {
      await tx.discount.create({
        data: {
          invoiceId: invoice.id,
          type: discount.type,
          value: discount.value,
          amount: this.centsToAmount(discount.amountCents),
          reason: discount.reason,
        },
      });
    }

    for (const payment of payments) {
      await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: this.centsToAmount(payment.amountCents),
          method: payment.method,
          cashReceived: payment.cashReceivedCents === null
            ? null
            : this.centsToAmount(payment.cashReceivedCents),
          changeAmount: payment.changeAmountCents === null
            ? null
            : this.centsToAmount(payment.changeAmountCents),
          reference: payment.reference ?? null,
        },
      });
    }

    if (source.appointmentId) {
      await tx.appointment.update({
        where: { id: source.appointmentId },
        data: { status: 'completed' },
      });
    }

    if (source.selfOrderId) {
      await tx.selfOrder.update({
        where: { id: source.selfOrderId },
        data: { status: 'paid' },
      });
    }

    await tx.client.update({
      where: { id: client.id },
      data: {
        totalSpent: { increment: this.centsToAmount(totalCents) },
        totalVisits: { increment: 1 },
        lastVisitAt: now,
      },
    });

    await this.applyLoyaltySideEffects(tx, dto, client.id, invoice.id, totalCents);

    const receiptSnapshot = this.buildReceiptSnapshot({
      invoiceId: invoice.id,
      invoiceNumber,
      publicToken,
      issuedAt: now,
      terminalId: dto.terminalId,
      shiftId: shift.id,
      client,
      items,
      discounts,
      payments,
      subtotalCents,
      discountTotalCents,
      taxableCents,
      taxRatePercent,
      taxCents,
      totalCents,
    });

    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        receiptSnapshot: receiptSnapshot as Prisma.InputJsonValue,
        receiptSnapshotVersion: 1,
      },
    });

    const response = {
      checkoutId: attempt.id,
      idempotencyKey: dto.idempotencyKey,
      invoice: {
        id: invoice.id,
        invoiceNumber,
        status: 'paid',
        total: this.centsToAmount(totalCents),
        publicToken,
      },
      receiptSnapshot,
      // TODO(Phase 1C-C): enqueue WhatsApp/ZATCA after commit using this stored receiptSnapshot.
      nextActions: {
        canSendInvoice: true,
        canSubmitZatca: true,
      },
    };

    await tx.posCheckoutAttempt.update({
      where: { id: attempt.id },
      data: {
        status: 'completed',
        invoiceId: invoice.id,
        responseJson: response as Prisma.InputJsonValue,
      },
    });

    if (approvedOverride && this.auditService) {
      this.auditService
        .log({
          tenantId,
          userId: createdBy,
          action: 'pos.checkout.manager_override.applied',
          entityType: 'Invoice',
          entityId: invoice.id,
          newValues: {
            invoiceId: invoice.id,
            approverUserId: approvedOverride.approverUserId,
            approverName: approvedOverride.approverName,
            discountPercent: approvedOverride.discountPercent,
            reason: approvedOverride.reason,
          },
        })
        .catch(() => {});
    }

    return { response, replayed: false };
  }

  private validateRequiredContext(dto: PosCheckoutDto): void {
    if (!dto.idempotencyKey?.trim()) {
      throw new BadRequestException('idempotencyKey is required');
    }
    if (!dto.terminalId?.trim()) {
      throw new BadRequestException('terminalId is required for POS checkout');
    }
    if (!dto.shiftId?.trim()) {
      throw new BadRequestException('shiftId is required for POS checkout');
    }
  }

  private async lockOrCreateAttempt(
    tx: CheckoutTx,
    idempotencyKey: string,
    requestHash: string,
    createdBy: string,
  ): Promise<JsonRecord & { id: string; requestHash: string; status: string; fromExisting: boolean }> {
    const inserted = await tx.$executeRawUnsafe(
      `INSERT INTO "pos_checkout_attempts" ("idempotency_key", "request_hash", "status", "created_by")
       VALUES ($1, $2, 'in_progress'::"PosCheckoutAttemptStatus", $3::uuid)
       ON CONFLICT ("idempotency_key") DO NOTHING`,
      idempotencyKey,
      requestHash,
      createdBy,
    );

    await tx.$queryRawUnsafe(
      `SELECT "id" FROM "pos_checkout_attempts" WHERE "idempotency_key" = $1 FOR UPDATE`,
      idempotencyKey,
    );

    const attempt = await tx.posCheckoutAttempt.findUnique({
      where: { idempotencyKey },
    });

    if (!attempt) {
      throw new ConflictException('Unable to create checkout idempotency attempt');
    }

    return {
      ...(attempt as unknown as JsonRecord),
      id: attempt.id,
      requestHash: attempt.requestHash,
      status: attempt.status,
      fromExisting: inserted === 0,
    };
  }

  private async markAttemptFailed(
    db: TenantPrismaClient,
    idempotencyKey: string,
    requestHash: string,
    createdBy: string,
  ): Promise<void> {
    if (!idempotencyKey) return;
    const existing = await db.posCheckoutAttempt.findUnique({ where: { idempotencyKey } });
    if (!existing) {
      await db.posCheckoutAttempt.create({
        data: {
          idempotencyKey,
          requestHash,
          status: 'failed',
          createdBy,
        },
      });
      return;
    }

    if (existing.requestHash === requestHash && existing.status !== 'completed') {
      await db.posCheckoutAttempt.update({
        where: { id: existing.id },
        data: { status: 'failed' },
      });
    }
  }

  private async validateOpenShift(tx: CheckoutTx, shiftId: string): Promise<{ id: string }> {
    const shift = await tx.posShift.findUnique({
      where: { id: shiftId },
      select: { id: true, status: true },
    });
    if (!shift) {
      throw new NotFoundException('POS shift was not found');
    }
    if (shift.status !== 'open') {
      throw new BadRequestException('POS shift is not open');
    }
    return { id: shift.id };
  }

  private async resolveClient(tx: CheckoutTx, dto: PosCheckoutDto): Promise<ResolvedClient> {
    const choices = [Boolean(dto.clientId), Boolean(dto.walkIn), Boolean(dto.anonymous)].filter(Boolean);
    if (choices.length !== 1) {
      throw new BadRequestException('Provide exactly one client source: clientId, walkIn, or anonymous');
    }

    if (dto.clientId) {
      const client = await tx.client.findFirst({
        where: { id: dto.clientId, deletedAt: null, isActive: true },
        select: { id: true, fullName: true, phone: true, email: true },
      });
      if (!client) {
        throw new NotFoundException('Client was not found');
      }
      return client;
    }

    if (dto.walkIn) {
      const client = await tx.client.create({
        data: {
          fullName: dto.walkIn.fullName.trim(),
          phone: dto.walkIn.phone.trim(),
          source: 'walk_in',
        },
        select: { id: true, fullName: true, phone: true, email: true },
      });
      return client;
    }

    const existingAnonymous = await tx.client.findFirst({
      where: {
        phone: ANONYMOUS_CLIENT.phone,
        fullName: ANONYMOUS_CLIENT.fullName,
        deletedAt: null,
      },
      select: { id: true, fullName: true, phone: true, email: true },
    });
    if (existingAnonymous) return existingAnonymous;

    return tx.client.create({
      data: {
        ...ANONYMOUS_CLIENT,
        source: 'walk_in',
      },
      select: { id: true, fullName: true, phone: true, email: true },
    });
  }

  private async validateSource(
    tx: CheckoutTx,
    dto: PosCheckoutDto,
    clientId: string,
  ): Promise<{ appointmentId?: string; selfOrderId?: string }> {
    if (!dto.source) return {};

    if (dto.source.type === PosCheckoutSourceType.appointment) {
      const appointment = await tx.appointment.findUnique({
        where: { id: dto.source.id },
        select: { id: true, clientId: true, status: true },
      });
      if (!appointment) {
        throw new NotFoundException('Appointment was not found');
      }
      if (appointment.clientId !== clientId) {
        throw new BadRequestException('Appointment does not belong to the checkout client');
      }
      if (['completed', 'cancelled', 'no_show'].includes(appointment.status)) {
        throw new BadRequestException('Appointment cannot be checked out in its current status');
      }
      return { appointmentId: appointment.id };
    }

    if (dto.source.type === PosCheckoutSourceType.self_order) {
      const selfOrder = await tx.selfOrder.findUnique({
        where: { id: dto.source.id },
        select: { id: true, status: true, expiresAt: true },
      });
      if (!selfOrder) {
        throw new NotFoundException('Self-order was not found');
      }
      if (!['pending', 'claimed'].includes(selfOrder.status)) {
        throw new BadRequestException('Self-order cannot be checked out in its current status');
      }
      if (selfOrder.expiresAt < new Date()) {
        throw new BadRequestException('Self-order has expired');
      }
      return { selfOrderId: selfOrder.id };
    }

    throw new BadRequestException('Unsupported POS checkout source');
  }

  private async resolveItems(tx: CheckoutTx, items: PosCheckoutItemDto[]): Promise<ResolvedItem[]> {
    const serviceIds = Array.from(new Set(items.map((item) => item.serviceId)));
    const employeeIds = Array.from(new Set(items.map((item) => item.employeeId)));

    const [services, employees] = await Promise.all([
      tx.service.findMany({
        where: { id: { in: serviceIds }, isActive: true },
        select: { id: true, nameAr: true, nameEn: true, price: true },
      }),
      tx.employee.findMany({
        where: { id: { in: employeeIds }, isActive: true },
        select: { id: true, fullName: true },
      }),
    ]);

    if (services.length !== serviceIds.length) {
      throw new BadRequestException('One or more checkout services are invalid');
    }
    if (employees.length !== employeeIds.length) {
      throw new BadRequestException('One or more checkout employees are invalid');
    }

    const serviceById = new Map(services.map((service) => [service.id, service]));
    const employeeById = new Map(employees.map((employee) => [employee.id, employee]));

    return items.map((item) => {
      const service = serviceById.get(item.serviceId);
      const employee = employeeById.get(item.employeeId);
      if (!service || !employee) {
        throw new BadRequestException('Invalid checkout item');
      }
      const unitPriceCents = this.toCents(service.price);
      const totalCents = unitPriceCents * item.quantity;
      return {
        serviceId: service.id,
        description: service.nameAr || service.nameEn || item.serviceId,
        employeeId: employee.id,
        employeeName: employee.fullName,
        quantity: item.quantity,
        unitPriceCents,
        totalCents,
      };
    });
  }

  private resolveManualDiscount(
    dto: PosCheckoutDto,
    subtotalCents: number,
  ): ResolvedDiscount | null {
    if (!dto.manualDiscount) return null;

    const reason = dto.manualDiscount.reason?.trim();
    if (!reason) {
      throw new BadRequestException('Manual discount reason is required');
    }

    let amountCents = 0;
    if (dto.manualDiscount.type === PosCheckoutDiscountType.percentage) {
      if (dto.manualDiscount.value > 100) {
        throw new BadRequestException('Manual discount percentage cannot exceed 100');
      }
      amountCents = this.percentCents(subtotalCents, dto.manualDiscount.value);
    } else {
      amountCents = this.toCents(dto.manualDiscount.value);
    }

    if (amountCents > subtotalCents) {
      throw new BadRequestException('Manual discount exceeds checkout subtotal');
    }

    if (amountCents === 0) return null;
    return {
      kind: 'manual',
      type: dto.manualDiscount.type,
      value: dto.manualDiscount.value,
      amountCents,
      reason,
    };
  }

  private async resolveAndReserveCoupon(
    tx: CheckoutTx,
    rawCode: string | undefined,
    orderSubtotalCents: number,
  ): Promise<ResolvedDiscount | null> {
    const code = rawCode?.trim().toUpperCase();
    if (!code) return null;

    const coupon = await tx.coupon.findUnique({ where: { code } });
    if (!coupon) {
      throw new BadRequestException('Coupon is invalid');
    }
    if (!coupon.isActive) {
      throw new BadRequestException('Coupon is inactive');
    }

    const now = new Date();
    if (now < coupon.validFrom) {
      throw new BadRequestException('Coupon is not active yet');
    }
    if (coupon.validUntil && now > coupon.validUntil) {
      throw new BadRequestException('Coupon has expired');
    }
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException('Coupon usage limit has been reached');
    }
    if (coupon.minOrder !== null && orderSubtotalCents < this.toCents(coupon.minOrder)) {
      throw new BadRequestException('Coupon minimum order amount was not met');
    }

    let amountCents = coupon.type === 'percentage'
      ? this.percentCents(orderSubtotalCents, Number(coupon.value))
      : this.toCents(coupon.value);

    if (coupon.maxDiscount !== null) {
      amountCents = Math.min(amountCents, this.toCents(coupon.maxDiscount));
    }
    amountCents = Math.min(amountCents, orderSubtotalCents);

    if (amountCents <= 0) {
      throw new BadRequestException('Coupon has no discount value for this checkout');
    }

    if (coupon.usageLimit !== null) {
      const updated = await tx.coupon.updateMany({
        where: {
          id: coupon.id,
          usedCount: { lt: coupon.usageLimit },
        },
        data: { usedCount: { increment: 1 } },
      });
      if (updated.count !== 1) {
        throw new BadRequestException('Coupon usage limit has been reached');
      }
    } else {
      await tx.coupon.update({
        where: { id: coupon.id },
        data: { usedCount: { increment: 1 } },
      });
    }

    return {
      kind: 'coupon',
      type: coupon.type as PosCheckoutDiscountType,
      value: Number(coupon.value),
      amountCents,
      reason: `Coupon ${code}`,
      code,
    };
  }

  private async resolveLoyaltyRedemption(
    tx: CheckoutTx,
    dto: PosCheckoutDto,
    clientId: string,
    remainingSubtotalCents: number,
  ): Promise<ResolvedDiscount | null> {
    if (!dto.loyaltyRedemption) return null;

    const settings = await this.getLoyaltySettings(tx);
    if (!settings.enabled) {
      throw new BadRequestException('Loyalty is not enabled');
    }

    const current = await tx.loyaltyPoints.findUnique({ where: { clientId } });
    if (dto.loyaltyRedemption.type === PosCheckoutLoyaltyType.points) {
      if (!['points', 'both'].includes(settings.mode)) {
        throw new BadRequestException('Current loyalty mode is not points');
      }
      const points = dto.loyaltyRedemption.value;
      if (!current || current.points < points) {
        throw new BadRequestException('Insufficient loyalty points');
      }
      const amountCents = this.toCents(points * settings.redemptionValue);
      if (amountCents <= 0 || amountCents > remainingSubtotalCents) {
        throw new BadRequestException('Invalid loyalty points redemption amount');
      }
      return {
        kind: 'loyalty',
        type: PosCheckoutDiscountType.fixed,
        value: this.centsToAmount(amountCents),
        amountCents,
        reason: `Loyalty points redemption: ${points}`,
      };
    }

    if (!['visits', 'both'].includes(settings.mode)) {
      throw new BadRequestException('Current loyalty mode is not visits');
    }
    const visits = dto.loyaltyRedemption.value;
    if (!current || current.visitCount < visits) {
      throw new BadRequestException('Insufficient loyalty visits');
    }
    if (settings.visitsPerReward <= 0 || visits % settings.visitsPerReward !== 0) {
      throw new BadRequestException('Invalid loyalty visits redemption amount');
    }

    const cycles = visits / settings.visitsPerReward;
    const amountCents = this.toCents(cycles * settings.visitRewardValue);
    if (amountCents <= 0 || amountCents > remainingSubtotalCents) {
      throw new BadRequestException('Invalid loyalty visits redemption value');
    }

    return {
      kind: 'loyalty',
      type: PosCheckoutDiscountType.fixed,
      value: this.centsToAmount(amountCents),
      amountCents,
      reason: `Loyalty visits redemption: ${visits}`,
    };
  }

  private validatePayments(payments: PosCheckoutPaymentDto[], totalCents: number): ValidatedPayment[] {
    if (!payments.length) {
      throw new BadRequestException('Checkout payment is required');
    }

    const validated = payments.map((payment) => {
      const amountCents = this.toCents(payment.amount);
      if (amountCents <= 0) {
        throw new BadRequestException('Payment amount must be greater than zero');
      }

      if (payment.method === PosCheckoutPaymentMethod.cash) {
        if (payment.cashReceived === undefined || payment.cashReceived === null) {
          throw new BadRequestException('cashReceived is required for cash payments');
        }
        const cashReceivedCents = this.toCents(payment.cashReceived);
        if (cashReceivedCents < amountCents) {
          throw new BadRequestException('cashReceived is less than the cash payment amount');
        }
        return {
          method: payment.method,
          amountCents,
          cashReceivedCents,
          changeAmountCents: cashReceivedCents - amountCents,
          reference: payment.reference,
        };
      }

      return {
        method: payment.method,
        amountCents,
        cashReceivedCents: null,
        changeAmountCents: null,
        reference: payment.reference,
      };
    });

    const paidCents = validated.reduce((sum, payment) => sum + payment.amountCents, 0);
    if (paidCents < totalCents) {
      throw new BadRequestException('Checkout payment total is less than invoice total');
    }
    if (paidCents > totalCents) {
      throw new BadRequestException('Checkout payment total exceeds invoice total');
    }

    return validated;
  }

  private async applyLoyaltySideEffects(
    tx: CheckoutTx,
    dto: PosCheckoutDto,
    clientId: string,
    invoiceId: string,
    totalCents: number,
  ): Promise<void> {
    const settings = await this.getLoyaltySettings(tx);
    if (!settings.enabled) return;

    if (dto.loyaltyRedemption) {
      if (dto.loyaltyRedemption.type === PosCheckoutLoyaltyType.points) {
        await tx.loyaltyPoints.update({
          where: { clientId },
          data: { points: { decrement: dto.loyaltyRedemption.value } },
        });
        await tx.loyaltyTransaction.create({
          data: {
            clientId,
            type: 'redeemed',
            points: -dto.loyaltyRedemption.value,
            invoiceId,
            description: `Redeemed ${dto.loyaltyRedemption.value} points during POS checkout`,
          },
        });
      } else {
        await tx.loyaltyPoints.update({
          where: { clientId },
          data: { visitCount: { decrement: dto.loyaltyRedemption.value } },
        });
        await tx.loyaltyTransaction.create({
          data: {
            clientId,
            type: 'visit_redeemed',
            points: -dto.loyaltyRedemption.value,
            invoiceId,
            description: `Redeemed ${dto.loyaltyRedemption.value} visits during POS checkout`,
          },
        });
      }
    }

    if (['points', 'both'].includes(settings.mode)) {
      const earned = Math.floor(this.centsToAmount(totalCents) * settings.pointsPerSar);
      if (earned > 0) {
        await tx.loyaltyPoints.upsert({
          where: { clientId },
          update: {
            points: { increment: earned },
            lifetimePoints: { increment: earned },
          },
          create: {
            clientId,
            points: earned,
            lifetimePoints: earned,
          },
        });
        await tx.loyaltyTransaction.create({
          data: {
            clientId,
            type: 'earned',
            points: earned,
            invoiceId,
            description: `Earned ${earned} points from POS checkout`,
          },
        });
      }
    }

    if (['visits', 'both'].includes(settings.mode)) {
      await tx.loyaltyPoints.upsert({
        where: { clientId },
        update: {
          visitCount: { increment: 1 },
          lifetimeVisits: { increment: 1 },
        },
        create: {
          clientId,
          visitCount: 1,
          lifetimeVisits: 1,
        },
      });
      await tx.loyaltyTransaction.create({
        data: {
          clientId,
          type: 'visit_earned',
          points: 1,
          invoiceId,
          description: 'Earned one visit from POS checkout',
        },
      });
    }
  }

  private async getLoyaltySettings(tx: CheckoutTx): Promise<{
    enabled: boolean;
    mode: 'points' | 'visits' | 'both';
    pointsPerSar: number;
    redemptionValue: number;
    visitsPerReward: number;
    visitRewardValue: number;
  }> {
    const keys = [
      'loyalty_enabled',
      'loyalty_mode',
      'loyalty_points_per_sar',
      'loyalty_redemption_value',
      'loyalty_visits_per_reward',
      'loyalty_visit_reward_value',
    ];
    const settings = await tx.setting.findMany({ where: { key: { in: keys } } });
    const values = new Map(settings.map((setting) => [setting.key, setting.value]));

    return {
      enabled: values.get('loyalty_enabled') === 'true',
      mode: (values.get('loyalty_mode') as 'points' | 'visits' | 'both') || 'points',
      pointsPerSar: Number(values.get('loyalty_points_per_sar') ?? 1),
      redemptionValue: Number(values.get('loyalty_redemption_value') ?? 0.1),
      visitsPerReward: Number(values.get('loyalty_visits_per_reward') ?? 10),
      visitRewardValue: Number(values.get('loyalty_visit_reward_value') ?? 50),
    };
  }

  private buildReceiptSnapshot(input: {
    invoiceId: string;
    invoiceNumber: string;
    publicToken: string;
    issuedAt: Date;
    terminalId: string;
    shiftId: string;
    client: ResolvedClient;
    items: ResolvedItem[];
    discounts: ResolvedDiscount[];
    payments: ValidatedPayment[];
    subtotalCents: number;
    discountTotalCents: number;
    taxableCents: number;
    taxRatePercent: number;
    taxCents: number;
    totalCents: number;
  }): JsonRecord {
    return {
      version: 1,
      invoiceId: input.invoiceId,
      invoiceNumber: input.invoiceNumber,
      publicToken: input.publicToken,
      issuedAt: input.issuedAt.toISOString(),
      terminalId: input.terminalId,
      shiftId: input.shiftId,
      client: input.client,
      items: input.items.map((item) => ({
        serviceId: item.serviceId,
        description: item.description,
        employeeId: item.employeeId,
        employeeName: item.employeeName,
        quantity: item.quantity,
        unitPrice: this.centsToAmount(item.unitPriceCents),
        total: this.centsToAmount(item.totalCents),
      })),
      discounts: input.discounts.map((discount) => ({
        kind: discount.kind,
        type: discount.type,
        value: discount.value,
        amount: this.centsToAmount(discount.amountCents),
        reason: discount.reason,
        code: discount.code,
      })),
      subtotal: this.centsToAmount(input.subtotalCents),
      discountTotal: this.centsToAmount(input.discountTotalCents),
      taxableSubtotal: this.centsToAmount(input.taxableCents),
      taxRatePercent: input.taxRatePercent,
      taxAmount: this.centsToAmount(input.taxCents),
      total: this.centsToAmount(input.totalCents),
      payments: input.payments.map((payment) => ({
        method: payment.method,
        amount: this.centsToAmount(payment.amountCents),
        cashReceived: payment.cashReceivedCents === null
          ? null
          : this.centsToAmount(payment.cashReceivedCents),
        changeAmount: payment.changeAmountCents === null
          ? null
          : this.centsToAmount(payment.changeAmountCents),
        reference: payment.reference,
      })),
    };
  }

  private async generateInvoiceNumber(tx: CheckoutTx): Promise<string> {
    await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(91827364, 51020264)');

    const lastInvoices = await tx.$queryRawUnsafe<{ invoice_number: string }[]>(
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

  /**
   * Block manual discounts above the cashier's role limit unless an unexpired
   * manager-approval token covers the requested percent.
   */
  private async enforceDiscountRoleLimit(
    discount: ResolvedDiscount,
    subtotalCents: number,
    cashierUserId: string,
    tenantId: string | undefined,
    overrideToken: string | undefined,
  ): Promise<VerifiedOverride | null> {
    if (subtotalCents <= 0) return null;
    const discountPercent = (discount.amountCents / subtotalCents) * 100;
    const role = await this.lookupRoleName(cashierUserId, tenantId);
    const limit = ROLE_DISCOUNT_LIMITS[role] ?? DEFAULT_ROLE_LIMIT;
    if (discountPercent <= limit) return null;

    if (!tenantId) {
      throw new ForbiddenException('Tenant context is required to authorise this discount');
    }
    if (!overrideToken) {
      throw new ForbiddenException('هذا الخصم يحتاج اعتماد المديرة');
    }
    return this.managerOverrideService.verify(overrideToken, tenantId, discountPercent);
  }

  private async lookupRoleName(userId: string, tenantId?: string): Promise<string> {
    if (!tenantId) return 'cashier';
    const tenantUser = await this.platformDb.tenantUser.findFirst({
      where: { tenantId, userId, status: 'active' },
      include: { role: { select: { name: true } } },
    });
    return tenantUser?.role?.name ?? 'cashier';
  }

  private async logCheckoutCompleted(
    result: JsonRecord,
    dto: PosCheckoutDto,
    createdBy: string,
    tenantId?: string,
  ): Promise<void> {
    if (!this.auditService) return;

    const invoice = result.invoice as { id?: string; total?: number } | undefined;
    if (!invoice?.id) return;

    await this.auditService.log({
      tenantId,
      userId: createdBy,
      action: 'pos.checkout.completed',
      entityType: 'Invoice',
      entityId: invoice.id,
      newValues: {
        invoiceId: invoice.id,
        total: invoice.total,
        paymentMethods: dto.payments.map((payment) => payment.method),
        shiftId: dto.shiftId,
        terminalId: dto.terminalId,
        createdBy,
      },
    });
  }

  private isInvoiceNumberConflict(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const candidate = error as { code?: string; meta?: { target?: unknown } };
    if (candidate.code !== 'P2002') return false;
    return JSON.stringify(candidate.meta?.target ?? '').includes('invoice_number');
  }

  private hashRequest(dto: PosCheckoutDto): string {
    return createHash('sha256').update(this.stableStringify(dto)).digest('hex');
  }

  private stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((entry) => this.stableStringify(entry)).join(',')}]`;
    }
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      return `{${Object.keys(record)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${this.stableStringify(record[key])}`)
        .join(',')}}`;
    }
    return JSON.stringify(value);
  }

  private toCents(value: unknown): number {
    const amount = Number(value);
    if (!Number.isFinite(amount)) {
      throw new BadRequestException('Invalid monetary amount');
    }
    return Math.round(amount * 100);
  }

  private centsToAmount(cents: number): number {
    return cents / 100;
  }

  private percentCents(baseCents: number, percentage: number): number {
    return Math.round((baseCents * percentage) / 100);
  }
}
