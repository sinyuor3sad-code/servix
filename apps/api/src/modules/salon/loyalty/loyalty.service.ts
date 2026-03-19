import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { TenantPrismaClient } from '../../../shared/types';
import { AdjustPointsDto } from './dto/adjust-points.dto';
import { UpdateLoyaltySettingsDto } from './dto/update-settings.dto';
import { QueryTransactionsDto } from './dto/query-transactions.dto';

interface LoyaltySettings {
  loyaltyEnabled: boolean;
  loyaltyPointsPerSar: number;
  loyaltyRedemptionValue: number;
}

interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

const SETTING_KEYS = {
  enabled: 'loyalty_enabled',
  pointsPerSar: 'loyalty_points_per_sar',
  redemptionValue: 'loyalty_redemption_value',
} as const;

@Injectable()
export class LoyaltyService {
  async getSettings(db: TenantPrismaClient): Promise<LoyaltySettings> {
    const settings = await db.setting.findMany({
      where: {
        key: {
          in: [
            SETTING_KEYS.enabled,
            SETTING_KEYS.pointsPerSar,
            SETTING_KEYS.redemptionValue,
          ],
        },
      },
    });

    const settingsMap = new Map(settings.map((s) => [s.key, s.value]));

    return {
      loyaltyEnabled: settingsMap.get(SETTING_KEYS.enabled) === 'true',
      loyaltyPointsPerSar: parseFloat(settingsMap.get(SETTING_KEYS.pointsPerSar) ?? '1'),
      loyaltyRedemptionValue: parseFloat(settingsMap.get(SETTING_KEYS.redemptionValue) ?? '0.1'),
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
    if (dto.loyaltyPointsPerSar !== undefined) {
      updates.push({ key: SETTING_KEYS.pointsPerSar, value: String(dto.loyaltyPointsPerSar) });
    }
    if (dto.loyaltyRedemptionValue !== undefined) {
      updates.push({ key: SETTING_KEYS.redemptionValue, value: String(dto.loyaltyRedemptionValue) });
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

    const loyaltyPoints = await db.loyaltyPoints.findUnique({
      where: { clientId },
    });

    const recentTransactions = await db.loyaltyTransaction.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      clientId,
      clientName: client.fullName,
      points: loyaltyPoints?.points ?? 0,
      lifetimePoints: loyaltyPoints?.lifetimePoints ?? 0,
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

  async getTransactions(
    db: TenantPrismaClient,
    query: QueryTransactionsDto,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const { page, perPage, sort, order, clientId, type } = query;
    const skip = (page - 1) * perPage;

    const where: Record<string, unknown> = {};
    if (clientId) where.clientId = clientId;
    if (type) where.type = type;

    const [data, total] = await Promise.all([
      db.loyaltyTransaction.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { [sort || 'createdAt']: order || 'desc' },
        include: {
          client: { select: { id: true, fullName: true, phone: true } },
        },
      }),
      db.loyaltyTransaction.count({ where }),
    ]);

    return {
      data: data as unknown as Record<string, unknown>[],
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  async earnPoints(
    db: TenantPrismaClient,
    clientId: string,
    invoiceId: string,
    amount: number,
  ): Promise<void> {
    const settings = await this.getSettings(db);
    if (!settings.loyaltyEnabled) return;

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
}
