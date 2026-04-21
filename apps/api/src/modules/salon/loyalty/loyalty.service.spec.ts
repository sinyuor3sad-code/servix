import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';
import type { TenantPrismaClient } from '../../../shared/types';

type Mock = jest.Mock;

interface LoyaltyMockDb {
  setting: { findMany: Mock; upsert: Mock };
  client: { findFirst: Mock };
  loyaltyPoints: { findUnique: Mock; upsert: Mock; update: Mock };
  loyaltyTransaction: { create: Mock; findMany: Mock; count: Mock };
  $transaction: Mock;
}

function makeDb(): LoyaltyMockDb {
  return {
    setting: { findMany: jest.fn(), upsert: jest.fn() },
    client: { findFirst: jest.fn() },
    loyaltyPoints: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    loyaltyTransaction: {
      create: jest.fn().mockResolvedValue({ id: 'tx-1' }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    $transaction: jest.fn(),
  };
}

function settingsRows(
  overrides: Partial<{
    enabled: string;
    mode: 'points' | 'visits' | 'both';
    pointsPerSar: string;
    redemptionValue: string;
    visitsPerReward: string;
    visitRewardValue: string;
  }> = {},
): Array<{ key: string; value: string }> {
  const cfg = {
    enabled: overrides.enabled ?? 'true',
    mode: overrides.mode ?? 'points',
    pointsPerSar: overrides.pointsPerSar ?? '1',
    redemptionValue: overrides.redemptionValue ?? '0.1',
    visitsPerReward: overrides.visitsPerReward ?? '10',
    visitRewardValue: overrides.visitRewardValue ?? '50',
  };
  return [
    { key: 'loyalty_enabled', value: cfg.enabled },
    { key: 'loyalty_mode', value: cfg.mode },
    { key: 'loyalty_points_per_sar', value: cfg.pointsPerSar },
    { key: 'loyalty_redemption_value', value: cfg.redemptionValue },
    { key: 'loyalty_visits_per_reward', value: cfg.visitsPerReward },
    { key: 'loyalty_visit_reward_value', value: cfg.visitRewardValue },
  ];
}

/** Wires $transaction to execute either an array of ops or a callback with the db itself. */
function wireTransaction(db: LoyaltyMockDb): void {
  db.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === 'function') {
      return (arg as (tx: LoyaltyMockDb) => unknown)(db);
    }
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    return arg;
  });
}

describe('LoyaltyService', () => {
  let service: LoyaltyService;
  let db: LoyaltyMockDb;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LoyaltyService();
    db = makeDb();
    wireTransaction(db);
  });

  const cast = (x: LoyaltyMockDb): TenantPrismaClient =>
    x as unknown as TenantPrismaClient;

  describe('getSettings', () => {
    it('يُرجع القيم الافتراضية عندما لا توجد أي إعدادات مسجّلة', async () => {
      db.setting.findMany.mockResolvedValue([]);

      const s = await service.getSettings(cast(db));

      expect(s).toEqual({
        loyaltyEnabled: false,
        loyaltyMode: 'points',
        loyaltyPointsPerSar: 1,
        loyaltyRedemptionValue: 0.1,
        loyaltyVisitsPerReward: 10,
        loyaltyVisitRewardValue: 50,
      });
    });

    it('يحلّل القيم النصّية إلى الأنواع الصحيحة', async () => {
      db.setting.findMany.mockResolvedValue(
        settingsRows({
          enabled: 'true',
          mode: 'both',
          pointsPerSar: '2.5',
          visitsPerReward: '7',
          visitRewardValue: '100',
        }),
      );

      const s = await service.getSettings(cast(db));

      expect(s.loyaltyEnabled).toBe(true);
      expect(s.loyaltyMode).toBe('both');
      expect(s.loyaltyPointsPerSar).toBe(2.5);
      expect(s.loyaltyVisitsPerReward).toBe(7);
      expect(s.loyaltyVisitRewardValue).toBe(100);
    });
  });

  describe('updateSettings', () => {
    it('يحوّل كل الحقول المُمرّرة إلى upserts عبر transaction ثم يُعيد القيم الجديدة', async () => {
      db.setting.upsert.mockImplementation(({ where, update }) => ({
        key: where.key,
        value: update.value,
      }));
      db.setting.findMany.mockResolvedValue(
        settingsRows({ mode: 'visits', visitsPerReward: '5' }),
      );

      const result = await service.updateSettings(cast(db), {
        loyaltyMode: 'visits',
        loyaltyVisitsPerReward: 5,
      });

      expect(db.setting.upsert).toHaveBeenCalledTimes(2);
      expect(db.setting.upsert).toHaveBeenCalledWith({
        where: { key: 'loyalty_mode' },
        update: { value: 'visits' },
        create: { key: 'loyalty_mode', value: 'visits' },
      });
      expect(db.setting.upsert).toHaveBeenCalledWith({
        where: { key: 'loyalty_visits_per_reward' },
        update: { value: '5' },
        create: { key: 'loyalty_visits_per_reward', value: '5' },
      });
      expect(result.loyaltyMode).toBe('visits');
      expect(result.loyaltyVisitsPerReward).toBe(5);
    });

    it('يتجاهل الحقول التي لم تُرسَل ولا يستدعي upsert', async () => {
      db.setting.upsert.mockResolvedValue({});
      db.setting.findMany.mockResolvedValue(settingsRows());

      await service.updateSettings(cast(db), {});

      expect(db.setting.upsert).not.toHaveBeenCalled();
    });
  });

  describe('earnPoints', () => {
    it('يسجّل النقاط عند تفعيل النظام مع النمط points', async () => {
      db.setting.findMany.mockResolvedValue(
        settingsRows({ mode: 'points', pointsPerSar: '2' }),
      );
      db.loyaltyPoints.upsert.mockResolvedValue({});

      await service.earnPoints(cast(db), 'client-1', 'inv-1', 120.75);

      expect(db.loyaltyPoints.upsert).toHaveBeenCalledWith({
        where: { clientId: 'client-1' },
        update: {
          points: { increment: 241 }, // floor(120.75 * 2) = 241
          lifetimePoints: { increment: 241 },
        },
        create: { clientId: 'client-1', points: 241, lifetimePoints: 241 },
      });
      expect(db.loyaltyTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            clientId: 'client-1',
            type: 'earned',
            points: 241,
            invoiceId: 'inv-1',
          }),
        }),
      );
    });

    it('لا يسجّل شيئاً عندما النظام متوقف', async () => {
      db.setting.findMany.mockResolvedValue(settingsRows({ enabled: 'false' }));

      await service.earnPoints(cast(db), 'c1', 'i1', 200);

      expect(db.$transaction).not.toHaveBeenCalled();
      expect(db.loyaltyPoints.upsert).not.toHaveBeenCalled();
    });

    it('لا يسجّل نقاطاً عندما النمط visits فقط', async () => {
      db.setting.findMany.mockResolvedValue(settingsRows({ mode: 'visits' }));

      await service.earnPoints(cast(db), 'c1', 'i1', 200);

      expect(db.loyaltyPoints.upsert).not.toHaveBeenCalled();
    });

    it('يتجاهل الفواتير التي تُنتج صفر نقاط', async () => {
      db.setting.findMany.mockResolvedValue(
        settingsRows({ mode: 'points', pointsPerSar: '0' }),
      );

      await service.earnPoints(cast(db), 'c1', 'i1', 200);

      expect(db.loyaltyPoints.upsert).not.toHaveBeenCalled();
    });
  });

  describe('redeemPoints', () => {
    beforeEach(() => {
      db.setting.findMany.mockResolvedValue(
        settingsRows({ mode: 'points', redemptionValue: '0.1' }),
      );
    });

    it('يحسب الخصم ويسجّل المعاملة عندما يكفي الرصيد', async () => {
      db.loyaltyPoints.findUnique.mockResolvedValue({ points: 300 });
      db.loyaltyPoints.update.mockResolvedValue({});

      const discount = await service.redeemPoints(cast(db), 'c1', 200, 'inv-9');

      expect(discount).toBeCloseTo(20);
      expect(db.loyaltyPoints.update).toHaveBeenCalledWith({
        where: { clientId: 'c1' },
        data: { points: { decrement: 200 } },
      });
      expect(db.loyaltyTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'redeemed',
            points: -200,
            invoiceId: 'inv-9',
          }),
        }),
      );
    });

    it('يرفض الاستبدال عندما الرصيد غير كافٍ', async () => {
      db.loyaltyPoints.findUnique.mockResolvedValue({ points: 50 });

      await expect(
        service.redeemPoints(cast(db), 'c1', 100, 'inv'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(db.loyaltyPoints.update).not.toHaveBeenCalled();
    });

    it('يرفض الاستبدال عندما النمط visits فقط', async () => {
      db.setting.findMany.mockResolvedValue(settingsRows({ mode: 'visits' }));

      await expect(
        service.redeemPoints(cast(db), 'c1', 100, 'inv'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('يرفض الاستبدال عندما النظام معطَّل', async () => {
      db.setting.findMany.mockResolvedValue(settingsRows({ enabled: 'false' }));

      await expect(
        service.redeemPoints(cast(db), 'c1', 100, 'inv'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('earnVisit', () => {
    it('يزيد عدد الزيارات بواحد ويسجّل معاملة visit_earned للنمط visits', async () => {
      db.setting.findMany.mockResolvedValue(settingsRows({ mode: 'visits' }));
      db.loyaltyPoints.upsert.mockResolvedValue({});

      await service.earnVisit(cast(db), 'c1', 'inv-1');

      expect(db.loyaltyPoints.upsert).toHaveBeenCalledWith({
        where: { clientId: 'c1' },
        update: {
          visitCount: { increment: 1 },
          lifetimeVisits: { increment: 1 },
        },
        create: { clientId: 'c1', visitCount: 1, lifetimeVisits: 1 },
      });
      expect(db.loyaltyTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'visit_earned',
            invoiceId: 'inv-1',
            points: 1,
          }),
        }),
      );
    });

    it('يعمل أيضاً مع النمط both', async () => {
      db.setting.findMany.mockResolvedValue(settingsRows({ mode: 'both' }));
      db.loyaltyPoints.upsert.mockResolvedValue({});

      await service.earnVisit(cast(db), 'c1', 'inv-1');

      expect(db.loyaltyPoints.upsert).toHaveBeenCalled();
    });

    it('لا يسجّل زيارة عندما النمط points فقط', async () => {
      db.setting.findMany.mockResolvedValue(settingsRows({ mode: 'points' }));

      await service.earnVisit(cast(db), 'c1', 'inv-1');

      expect(db.loyaltyPoints.upsert).not.toHaveBeenCalled();
    });

    it('لا يسجّل شيئاً عندما النظام متوقف', async () => {
      db.setting.findMany.mockResolvedValue(
        settingsRows({ enabled: 'false', mode: 'visits' }),
      );

      await service.earnVisit(cast(db), 'c1', 'inv-1');

      expect(db.loyaltyPoints.upsert).not.toHaveBeenCalled();
    });
  });

  describe('redeemVisits', () => {
    it('يحسب الخصم على أساس دورات مكتملة', async () => {
      db.setting.findMany.mockResolvedValue(
        settingsRows({ mode: 'visits', visitsPerReward: '10', visitRewardValue: '50' }),
      );
      db.loyaltyPoints.findUnique.mockResolvedValue({ visitCount: 25 });
      db.loyaltyPoints.update.mockResolvedValue({});

      const discount = await service.redeemVisits(cast(db), 'c1', 20, 'inv-7');

      expect(discount).toBe(100); // دورتان × 50
      expect(db.loyaltyPoints.update).toHaveBeenCalledWith({
        where: { clientId: 'c1' },
        data: { visitCount: { decrement: 20 } },
      });
      expect(db.loyaltyTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'visit_redeemed',
            points: -20,
            invoiceId: 'inv-7',
          }),
        }),
      );
    });

    it('يرفض قيمة ليست من مضاعفات visitsPerReward', async () => {
      db.setting.findMany.mockResolvedValue(
        settingsRows({ mode: 'visits', visitsPerReward: '10' }),
      );
      db.loyaltyPoints.findUnique.mockResolvedValue({ visitCount: 25 });

      await expect(
        service.redeemVisits(cast(db), 'c1', 15, 'inv'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('يرفض عندما الرصيد غير كافٍ', async () => {
      db.setting.findMany.mockResolvedValue(
        settingsRows({ mode: 'visits', visitsPerReward: '10' }),
      );
      db.loyaltyPoints.findUnique.mockResolvedValue({ visitCount: 5 });

      await expect(
        service.redeemVisits(cast(db), 'c1', 10, 'inv'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('يرفض عندما النمط points فقط', async () => {
      db.setting.findMany.mockResolvedValue(settingsRows({ mode: 'points' }));

      await expect(
        service.redeemVisits(cast(db), 'c1', 10, 'inv'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('يرفض قيم الزيارات الصفرية أو السالبة', async () => {
      db.setting.findMany.mockResolvedValue(settingsRows({ mode: 'visits' }));

      await expect(
        service.redeemVisits(cast(db), 'c1', 0, 'inv'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('adjustPoints', () => {
    it('يرمي NotFoundException عندما العميل غير موجود', async () => {
      db.client.findFirst.mockResolvedValue(null);

      await expect(
        service.adjustPoints(cast(db), 'missing', {
          points: 10,
          description: 'يدوي',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('يرفض الخصم الذي يُنتج رصيداً سالباً', async () => {
      db.client.findFirst.mockResolvedValue({ id: 'c1' });
      db.loyaltyPoints.findUnique.mockResolvedValue({ points: 20 });

      await expect(
        service.adjustPoints(cast(db), 'c1', {
          points: -50,
          description: 'خصم',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('adjustVisits', () => {
    it('يرفض خصم زيارات أكثر من الرصيد', async () => {
      db.client.findFirst.mockResolvedValue({ id: 'c1' });
      db.loyaltyPoints.findUnique.mockResolvedValue({ visitCount: 2 });

      await expect(
        service.adjustVisits(cast(db), 'c1', {
          visits: -5,
          description: 'خصم',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('يزيد الزيارات مع تحديث lifetime للقيم الموجبة', async () => {
      db.client.findFirst.mockResolvedValue({ id: 'c1' });
      db.loyaltyPoints.findUnique.mockResolvedValue({ visitCount: 3 });
      db.loyaltyPoints.upsert.mockResolvedValue({ visitCount: 5 });

      await service.adjustVisits(cast(db), 'c1', {
        visits: 2,
        description: 'مناسبة خاصة',
      });

      expect(db.loyaltyPoints.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            visitCount: { increment: 2 },
            lifetimeVisits: { increment: 2 },
          }),
        }),
      );
      expect(db.loyaltyTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'visit_adjusted',
            points: 2,
          }),
        }),
      );
    });
  });

  describe('getClientLoyalty', () => {
    it('يحسب visitsToNextReward بشكل صحيح', async () => {
      db.client.findFirst.mockResolvedValue({ id: 'c1', fullName: 'سارة' });
      db.loyaltyPoints.findUnique.mockResolvedValue({
        points: 30,
        lifetimePoints: 50,
        visitCount: 7,
        lifetimeVisits: 7,
      });
      db.setting.findMany.mockResolvedValue(
        settingsRows({ visitsPerReward: '10' }),
      );

      const r = (await service.getClientLoyalty(cast(db), 'c1')) as {
        visitsToNextReward: number;
        visitCount: number;
      };

      expect(r.visitCount).toBe(7);
      expect(r.visitsToNextReward).toBe(3);
    });

    it('يرمي NotFoundException للعميل غير الموجود', async () => {
      db.client.findFirst.mockResolvedValue(null);

      await expect(
        service.getClientLoyalty(cast(db), 'missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
