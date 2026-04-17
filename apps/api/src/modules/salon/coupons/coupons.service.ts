import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { TenantPrismaClient } from '../../../shared/types';
import { paginate, effectiveLimit, PaginatedResponse } from '../../../shared/helpers/paginate.helper';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';

interface CouponValidationResult {
  valid: boolean;
  discountAmount: number;
  message: string;
}

@Injectable()
export class CouponsService {
  async findAll(
    db: TenantPrismaClient,
    query?: { page?: number; limit?: number; perPage?: number },
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const page = Math.max(1, query?.page ?? 1);
    const limit = effectiveLimit(query ?? {});

    const [coupons, total] = await Promise.all([
      db.coupon.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.coupon.count(),
    ]);

    return paginate(coupons as unknown as Record<string, unknown>[], total, page, limit);
  }

  async create(
    db: TenantPrismaClient,
    dto: CreateCouponDto,
  ): Promise<Record<string, unknown>> {
    const existing = await db.coupon.findUnique({
      where: { code: dto.code.toUpperCase() },
    });
    if (existing) {
      throw new ConflictException('كود الكوبون مستخدم بالفعل');
    }

    const coupon = await db.coupon.create({
      data: {
        code: dto.code.toUpperCase(),
        type: dto.type,
        value: dto.value,
        minOrder: dto.minOrder,
        maxDiscount: dto.maxDiscount,
        usageLimit: dto.usageLimit ?? null,
        validFrom: new Date(dto.validFrom),
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        autoDelete: dto.autoDelete ?? false,
      },
    });

    return coupon as unknown as Record<string, unknown>;
  }

  async findOne(
    db: TenantPrismaClient,
    id: string,
  ): Promise<Record<string, unknown>> {
    const coupon = await db.coupon.findUnique({ where: { id } });

    if (!coupon) {
      throw new NotFoundException('الكوبون غير موجود');
    }

    return coupon as unknown as Record<string, unknown>;
  }

  async update(
    db: TenantPrismaClient,
    id: string,
    dto: UpdateCouponDto,
  ): Promise<Record<string, unknown>> {
    await this.findOne(db, id);

    if (dto.code) {
      const existing = await db.coupon.findFirst({
        where: { code: dto.code.toUpperCase(), id: { not: id } },
      });
      if (existing) {
        throw new ConflictException('كود الكوبون مستخدم بالفعل');
      }
    }

    const coupon = await db.coupon.update({
      where: { id },
      data: {
        ...(dto.code && { code: dto.code.toUpperCase() }),
        ...(dto.type && { type: dto.type }),
        ...(dto.value !== undefined && { value: dto.value }),
        ...(dto.minOrder !== undefined && { minOrder: dto.minOrder }),
        ...(dto.maxDiscount !== undefined && { maxDiscount: dto.maxDiscount }),
        ...(dto.usageLimit !== undefined && { usageLimit: dto.usageLimit }),
        ...(dto.validFrom && { validFrom: new Date(dto.validFrom) }),
        ...(dto.validUntil && { validUntil: new Date(dto.validUntil) }),
      },
    });

    return coupon as unknown as Record<string, unknown>;
  }

  async remove(
    db: TenantPrismaClient,
    id: string,
  ): Promise<Record<string, unknown>> {
    await this.findOne(db, id);

    const coupon = await db.coupon.delete({ where: { id } });

    return coupon as unknown as Record<string, unknown>;
  }

  async validate(
    db: TenantPrismaClient,
    dto: ValidateCouponDto,
  ): Promise<CouponValidationResult> {
    const coupon = await db.coupon.findUnique({
      where: { code: dto.code.toUpperCase() },
    });

    if (!coupon) {
      return { valid: false, discountAmount: 0, message: 'الكوبون غير موجود' };
    }

    if (!coupon.isActive) {
      return { valid: false, discountAmount: 0, message: 'الكوبون غير مفعّل' };
    }

    const now = new Date();
    if (now < coupon.validFrom) {
      return { valid: false, discountAmount: 0, message: 'الكوبون لم يبدأ بعد' };
    }
    if (coupon.validUntil && now > coupon.validUntil) {
      return { valid: false, discountAmount: 0, message: 'الكوبون منتهي الصلاحية' };
    }

    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      return { valid: false, discountAmount: 0, message: 'الكوبون وصل للحد الأقصى من الاستخدام' };
    }

    if (coupon.minOrder !== null && dto.orderAmount < Number(coupon.minOrder)) {
      return {
        valid: false,
        discountAmount: 0,
        message: `الحد الأدنى للطلب هو ${Number(coupon.minOrder).toFixed(2)} ر.س`,
      };
    }

    let discountAmount =
      coupon.type === 'percentage'
        ? (dto.orderAmount * Number(coupon.value)) / 100
        : Number(coupon.value);

    if (coupon.maxDiscount !== null && discountAmount > Number(coupon.maxDiscount)) {
      discountAmount = Number(coupon.maxDiscount);
    }

    discountAmount = Math.round(discountAmount * 100) / 100;

    return {
      valid: true,
      discountAmount,
      message: `الكوبون صالح. قيمة الخصم: ${discountAmount.toFixed(2)} ر.س`,
    };
  }

  /**
   * Redeem a coupon: validate + increment usedCount atomically.
   * Called when an invoice is actually paid, not just previewed.
   */
  async redeem(
    db: TenantPrismaClient,
    dto: ValidateCouponDto,
  ): Promise<CouponValidationResult> {
    const result = await this.validate(db, dto);
    if (!result.valid) return result;

    // Atomically increment usedCount
    await db.coupon.update({
      where: { code: dto.code.toUpperCase() },
      data: { usedCount: { increment: 1 } },
    });

    return result;
  }

  /**
   * Auto-delete expired/exhausted coupons that have autoDelete=true
   * and have been expired or reached usage limit for over 24 hours.
   */
  async cleanupExpired(db: TenantPrismaClient): Promise<number> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Find coupons eligible for auto-deletion
    const candidates = await db.coupon.findMany({
      where: {
        autoDelete: true,
        OR: [
          // Expired by time (validUntil passed 24h ago)
          { validUntil: { lt: twentyFourHoursAgo } },
          // Exhausted by usage AND updated 24h ago
          {
            usageLimit: { not: null },
            updatedAt: { lt: twentyFourHoursAgo },
          },
        ],
      },
    });

    // Filter exhausted ones (where usedCount >= usageLimit)
    const toDelete = candidates.filter(c => {
      const isExpired = c.validUntil && c.validUntil < twentyFourHoursAgo;
      const isExhausted = c.usageLimit !== null && c.usedCount >= c.usageLimit;
      return isExpired || isExhausted;
    });

    if (toDelete.length === 0) return 0;

    await db.coupon.deleteMany({
      where: { id: { in: toDelete.map(c => c.id) } },
    });

    return toDelete.length;
  }
}
