import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { TenantPrismaClient } from '../../../shared/types';
import { AdjustPointsDto } from './dto/adjust-points.dto';
import { AdjustVisitsDto } from './dto/adjust-visits.dto';
import { UpdateLoyaltySettingsDto, LoyaltyMode } from './dto/update-settings.dto';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { paginate, effectiveLimit } from '../../../shared/helpers/paginate.helper';

interface LoyaltySettings {
  loyaltyEnabled: boolean;
  loyaltyMode: LoyaltyMode;
  loyaltyPointsPerSar: number;
  loyaltyRedemptionValue: number;
  loyaltyVisitsPerReward: number;
  loyaltyVisitRewardValue: number;
}

const SETTING_KEYS = {
  enabled: 'loyalty_enabled',
  mode: 'loyalty_mode',
  pointsPerSar: 'loyalty_points_per_sar',
  redemptionValue: 'loyalty_redemption_value',
  visitsPerReward: 'loyalty_visits_per_reward',
  visitRewardValue: 'loyalty_visit_reward_value',
} as const;

@Injectable()
export class LoyaltyService {
  async getSettings(db: TenantPrismaClient): Promise<LoyaltySettings> {
    const settings = await db.setting.findMany({
      where: { key: { in: Object.values(SETTING_KEYS) } },
    });

    const m = new Map(settings.map((s) => [s.key, s.value]));

    return {
      loyaltyEnabled: m.get(SETTING_KEYS.enabled) === 'true',
      loyaltyMode: (m.get(SETTING_KEYS.mode) as LoyaltyMode) || 'points',
      loyaltyPointsPerSar: parseFloat(m.get(SETTING_KEYS.pointsPerSar) ?? '1'),
      loyaltyRedemptionValue: parseFloat(m.get(SETTING_KEYS.redemptionValue) ?? '0.1'),
      loyaltyVisitsPerReward: parseInt(m.get(SETTING_KEYS.visitsPerReward) ?? '10', 10),
      loyaltyVisitRewardValue: parseFloat(m.get(SETTING_KEYS.visitRewardValue) ?? '50'),
    };
  }

  async updateSettings(
    db: TenantPrismaClient,
    dto: UpdateLoyaltySettingsDto,
  ): Promise<LoyaltySettings> {
    const updates: Array<{ key: string; value: string }> = [];

    if (dto.loyaltyEnabled !== undefined) {
      updates.push({ key: SETTING_KEYS.enabled, value: String(dto.loyaltyEnabled) });
    }
    if (dto.loyaltyMode !== undefined) {
      updates.push({ key: SETTING_KEYS.mode, value: dto.loyaltyMode });
    }
    if (dto.loyaltyPointsPerSar !== undefined) {
      updates.push({ key: SETTING_KEYS.pointsPerSar, value: String(dto.loyaltyPointsPerSar) });
    }
    if (dto.loyaltyRedemptionValue !== undefined) {
      updates.push({ key: SETTING_KEYS.redemptionValue, value: String(dto.loyaltyRedemptionValue) });
    }
    if (dto.loyaltyVisitsPerReward !== undefined) {
      updates.push({ key: SETTING_KEYS.visitsPerReward, value: String(dto.loyaltyVisitsPerReward) });
    }
    if (dto.loyaltyVisitRewardValue !== undefined) {
      updates.push({ key: SETTING_KEYS.visitRewardValue, value: String(dto.loyaltyVisitRewardValue) });
    }

    await db.$transaction(
      updates.map((u) =>
        db.setting.upsert({
          where: { key: u.key },
          update: { value: u.value },
          create: { key: u.key, value: u.value },
        }),
      ),
    );

    return this.getSettings(db);
  }

  async getClientLoyalty(
    db: TenantPrismaClient,
    clientId: string,
  ): Promise<Record<string, unknown>> {
    const client = await db.client.findFirst({
      where: { id: clientId, deletedAt: null },
    });
    if (!client) {
      throw new NotFoundException('العميل غير موجود');
    }

    const [loyaltyPoints, recentTransactions, settings] = await Promise.all([
      db.loyaltyPoints.findUnique({ where: { clientId } }),
      db.loyaltyTransaction.findMany({
        where: { clientId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.getSettings(db),
    ]);

    const visitCount = loyaltyPoints?.visitCount ?? 0;
    const visitsToNextReward =
      settings.loyaltyVisitsPerReward > 0
        ? settings.loyaltyVisitsPerReward - (visitCount % settings.loyaltyVisitsPerReward)
        : 0;

    return {
      clientId,
      clientName: client.fullName,
      // Points
      points: loyaltyPoints?.points ?? 0,
      lifetimePoints: loyaltyPoints?.lifetimePoints ?? 0,
      // Visits
      visitCount,
      lifetimeVisits: loyaltyPoints?.lifetimeVisits ?? 0,
      visitsToNextReward,
      transactions: recentTransactions,
    };
  }

  async adjustPoints(
    db: TenantPrismaClient,
    clientId: string,
    dto: AdjustPointsDto,
  ): Promise<Record<string, unknown>> {
    const client = await db.client.findFirst({
      where: { id: clientId, deletedAt: null },
    });
    if (!client) {
      throw new NotFoundException('العميل غير موجود');
    }

    const result = await db.$transaction(async (tx) => {
      const currentPoints = await tx.loyaltyPoints.findUnique({
        where: { clientId },
      });

      const currentBalance = currentPoints?.points ?? 0;
      if (dto.points < 0 && currentBalance + dto.points < 0) {
        throw new BadRequestException(
          `لا يمكن خصم ${Math.abs(dto.points)} نقطة. الرصيد الحالي: ${currentBalance} نقطة`,
        );
      }

      const loyaltyPoints = await tx.loyaltyPoints.upsert({
        where: { clientId },
        update: {
          points: { increment: dto.points },
          ...(dto.points > 0 && { lifetimePoints: { increment: dto.points } }),
        },
        create: {
          clientId,
          points: Math.max(0, dto.points),
          lifetimePoints: Math.max(0, dto.points),
        },
      });

      const transaction = await tx.loyaltyTransaction.create({
        data: {
          clientId,
          type: 'adjusted',
          points: dto.points,
          description: dto.description,
        },
      });

      return { loyaltyPoints, transaction };
    });

    return result as unknown as Record<string, unknown>;
  }

  async adjustVisits(
    db: TenantPrismaClient,
    clientId: string,
    dto: AdjustVisitsDto,
  ): Promise<Record<string, unknown>> {
    const client = await db.client.findFirst({
      where: { id: clientId, deletedAt: null },
    });
    if (!client) throw new NotFoundException('العميل غير موجود');

    const result = await db.$transaction(async (tx) => {
      const current = await tx.loyaltyPoints.findUnique({ where: { clientId } });
      const currentVisits = current?.visitCount ?? 0;
      if (dto.visits < 0 && currentVisits + dto.visits < 0) {
        throw new BadRequestException(
          `لا يمكن خصم ${Math.abs(dto.visits)} زيارة. الرصيد الحالي: ${currentVisits} زيارة`,
        );
      }

      const loyaltyPoints = await tx.loyaltyPoints.upsert({
        where: { clientId },
        update: {
          visitCount: { increment: dto.visits },
          ...(dto.visits > 0 && { lifetimeVisits: { increment: dto.visits } }),
        },
        create: {
          clientId,
          visitCount: Math.max(0, dto.visits),
          lifetimeVisits: Math.max(0, dto.visits),
        },
      });

      const transaction = await tx.loyaltyTransaction.create({
        data: {
          clientId,
          type: 'visit_adjusted',
          points: dto.visits,
          description: dto.description,
        },
      });

      return { loyaltyPoints, transaction };
    });

    return result as unknown as Record<string, unknown>;
  }

  async getTransactions(
    db: TenantPrismaClient,
    query: QueryTransactionsDto,
  ): Promise<ReturnType<typeof paginate>> {
    const { page, sort, order, clientId, type } = query;
    const limit = effectiveLimit(query);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (clientId) where.clientId = clientId;
    if (type) where.type = type;

    const [data, total] = await Promise.all([
      db.loyaltyTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort || 'createdAt']: order || 'desc' },
        include: {
          client: { select: { id: true, fullName: true, phone: true } },
        },
      }),
      db.loyaltyTransaction.count({ where }),
    ]);

    return paginate(data as unknown as Record<string, unknown>[], total, page, limit);
  }

  async earnPoints(
    db: TenantPrismaClient,
    clientId: string,
    invoiceId: string,
    amount: number,
  ): Promise<void> {
    const settings = await this.getSettings(db);
    if (!settings.loyaltyEnabled) return;
    if (settings.loyaltyMode === 'visits') return;

    const pointsToEarn = Math.floor(amount * settings.loyaltyPointsPerSar);
    if (pointsToEarn <= 0) return;

    await db.$transaction(async (tx) => {
      await tx.loyaltyPoints.upsert({
        where: { clientId },
        update: {
          points: { increment: pointsToEarn },
          lifetimePoints: { increment: pointsToEarn },
        },
        create: {
          clientId,
          points: pointsToEarn,
          lifetimePoints: pointsToEarn,
        },
      });

      await tx.loyaltyTransaction.create({
        data: {
          clientId,
          type: 'earned',
          points: pointsToEarn,
          invoiceId,
          description: `كسب نقاط من فاتورة بمبلغ ${amount.toFixed(2)} ر.س`,
        },
      });
    });
  }

  async redeemPoints(
    db: TenantPrismaClient,
    clientId: string,
    points: number,
    invoiceId: string,
  ): Promise<number> {
    const settings = await this.getSettings(db);
    if (!settings.loyaltyEnabled) {
      throw new BadRequestException('نظام الولاء غير مفعّل');
    }
    if (settings.loyaltyMode === 'visits') {
      throw new BadRequestException('نمط الولاء الحالي هو الزيارات فقط');
    }

    const currentPoints = await db.loyaltyPoints.findUnique({
      where: { clientId },
    });

    if (!currentPoints || currentPoints.points < points) {
      throw new BadRequestException(
        `رصيد النقاط غير كافٍ. الرصيد الحالي: ${currentPoints?.points ?? 0} نقطة`,
      );
    }

    const discountValue = points * settings.loyaltyRedemptionValue;

    await db.$transaction(async (tx) => {
      await tx.loyaltyPoints.update({
        where: { clientId },
        data: { points: { decrement: points } },
      });

      await tx.loyaltyTransaction.create({
        data: {
          clientId,
          type: 'redeemed',
          points: -points,
          invoiceId,
          description: `استبدال ${points} نقطة بخصم ${discountValue.toFixed(2)} ر.س`,
        },
      });
    });

    return discountValue;
  }

  /**
   * Record one paid visit for the client. Called from invoice finalization.
   * Idempotency: caller should only invoke once per invoice.
   */
  async earnVisit(
    db: TenantPrismaClient,
    clientId: string,
    invoiceId: string,
  ): Promise<void> {
    const settings = await this.getSettings(db);
    if (!settings.loyaltyEnabled) return;
    if (settings.loyaltyMode === 'points') return;

    await db.$transaction(async (tx) => {
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
          description: 'زيارة مسجّلة من فاتورة',
        },
      });
    });
  }

  /**
   * Redeem a full visit-reward cycle (settings.loyaltyVisitsPerReward) for a SAR discount.
   * Throws if the client doesn't have enough visits.
   */
  async redeemVisits(
    db: TenantPrismaClient,
    clientId: string,
    visits: number,
    invoiceId: string,
  ): Promise<number> {
    const settings = await this.getSettings(db);
    if (!settings.loyaltyEnabled) {
      throw new BadRequestException('نظام الولاء غير مفعّل');
    }
    if (settings.loyaltyMode === 'points') {
      throw new BadRequestException('نمط الولاء الحالي هو النقاط فقط');
    }
    if (visits <= 0) {
      throw new BadRequestException('عدد الزيارات يجب أن يكون أكبر من صفر');
    }
    if (settings.loyaltyVisitsPerReward <= 0) {
      throw new BadRequestException('إعدادات الزيارات غير مهيأة');
    }
    if (visits % settings.loyaltyVisitsPerReward !== 0) {
      throw new BadRequestException(
        `يجب أن يكون عدد الزيارات من مضاعفات ${settings.loyaltyVisitsPerReward}`,
      );
    }

    const current = await db.loyaltyPoints.findUnique({ where: { clientId } });
    if (!current || current.visitCount < visits) {
      throw new BadRequestException(
        `رصيد الزيارات غير كافٍ. الرصيد الحالي: ${current?.visitCount ?? 0} زيارة`,
      );
    }

    const rewardCycles = visits / settings.loyaltyVisitsPerReward;
    const discountValue = rewardCycles * settings.loyaltyVisitRewardValue;

    await db.$transaction(async (tx) => {
      await tx.loyaltyPoints.update({
        where: { clientId },
        data: { visitCount: { decrement: visits } },
      });

      await tx.loyaltyTransaction.create({
        data: {
          clientId,
          type: 'visit_redeemed',
          points: -visits,
          invoiceId,
          description: `استبدال ${visits} زيارة بخصم ${discountValue.toFixed(2)} ر.س`,
        },
      });
    });

    return discountValue;
  }
}
