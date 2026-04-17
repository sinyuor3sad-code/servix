import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionsService } from './subscriptions.service';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PlatformPrismaClient } from '../../shared/database/platform.client';

const mockPrisma = {
  plan: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  tenant: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  subscription: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: PlatformPrismaClient, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
    jest.clearAllMocks();
  });

  describe('getPlans', () => {
    it('يجب إرجاع الباقات النشطة مرتبة حسب الترتيب', async () => {
      const plans = [
        {
          id: 'plan-1',
          name: 'Basic',
          nameAr: 'أساسية',
          isActive: true,
          sortOrder: 1,
          planFeatures: [],
        },
        {
          id: 'plan-2',
          name: 'Pro',
          nameAr: 'احترافية',
          isActive: true,
          sortOrder: 2,
          planFeatures: [
            {
              feature: { id: 'f-1', code: 'online_booking' },
            },
          ],
        },
      ];
      mockPrisma.plan.findMany.mockResolvedValue(plans);

      const result = await service.getPlans();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Basic');
      expect(mockPrisma.plan.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: {
          planFeatures: { include: { feature: true } },
        },
        orderBy: { sortOrder: 'asc' },
      });
    });
  });

  describe('createSubscription', () => {
    const createDto = {
      tenantId: 'tenant-id',
      planId: 'plan-id',
      billingCycle: 'monthly' as const,
    };

    it('يجب إنشاء اشتراك وتفعيل المنشأة', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue({
        id: 'plan-id',
        name: 'Pro',
      });
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-id',
        status: 'trial',
      });

      const createdSub = {
        id: 'sub-id',
        tenantId: createDto.tenantId,
        planId: createDto.planId,
        billingCycle: 'monthly',
        status: 'active',
        currentPeriodStart: expect.any(Date),
        currentPeriodEnd: expect.any(Date),
        plan: { id: 'plan-id', name: 'Pro' },
      };

      mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          subscription: {
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            create: jest.fn().mockResolvedValue(createdSub),
          },
          tenant: {
            update: jest
              .fn()
              .mockResolvedValue({ id: 'tenant-id', status: 'active' }),
          },
        };
        return cb(tx);
      });

      const result = await service.createSubscription(createDto);

      expect(result.status).toBe('active');
      expect(result.plan.name).toBe('Pro');
    });

    it('يجب إلغاء الاشتراك النشط الحالي عند إنشاء اشتراك جديد', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue({
        id: 'plan-id',
        name: 'Premium',
      });
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-id',
        status: 'active',
      });

      const mockUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
      const newSub = {
        id: 'new-sub',
        status: 'active',
        plan: { id: 'plan-id', name: 'Premium' },
      };

      mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          subscription: {
            updateMany: mockUpdateMany,
            create: jest.fn().mockResolvedValue(newSub),
          },
          tenant: { update: jest.fn().mockResolvedValue({}) },
        };
        return cb(tx);
      });

      await service.createSubscription(createDto);

      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: {
          tenantId: createDto.tenantId,
          status: { in: ['active', 'trial'] },
        },
        data: {
          status: 'cancelled',
          cancelledAt: expect.any(Date),
        },
      });
    });

    it('يجب رفض الإنشاء إذا لم يتم العثور على الباقة', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(null);

      await expect(service.createSubscription(createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('يجب رفض الإنشاء إذا لم يتم العثور على المنشأة', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue({ id: 'plan-id' });
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.createSubscription(createDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('cancelSubscription', () => {
    it('يجب إلغاء الاشتراك النشط بنجاح', async () => {
      const activeSub = { id: 'sub-id', status: 'active', tenantId: 'tid' };
      const cancelledSub = {
        ...activeSub,
        status: 'cancelled',
        cancelledAt: new Date(),
        plan: { id: 'plan-id', name: 'Pro' },
      };

      mockPrisma.subscription.findFirst.mockResolvedValue(activeSub);
      mockPrisma.subscription.update.mockResolvedValue(cancelledSub);

      const result = await service.cancelSubscription('tid');

      expect(result.status).toBe('cancelled');
      expect(result.cancelledAt).toBeDefined();
    });

    it('يجب إرجاع خطأ إذا لم يوجد اشتراك نشط', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);

      await expect(service.cancelSubscription('tid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('renewSubscription', () => {
    it('يجب تجديد اشتراك منتهي أو ملغي وتمديد الفترة', async () => {
      const expiredSub = {
        id: 'sub-id',
        status: 'expired',
        billingCycle: 'monthly',
        plan: { id: 'plan-id', name: 'Pro' },
      };
      const renewedSub = {
        ...expiredSub,
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelledAt: null,
      };

      mockPrisma.subscription.findFirst.mockResolvedValue(expiredSub);
      mockPrisma.subscription.update.mockResolvedValue(renewedSub);

      const result = await service.renewSubscription('tid');

      expect(result.status).toBe('active');
      expect(result.cancelledAt).toBeNull();
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'active',
            cancelledAt: null,
          }),
        }),
      );
    });

    it('يجب رفض التجديد إذا كان الاشتراك نشطاً بالفعل', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-id',
        status: 'active',
        plan: { id: 'plan-id' },
      });

      await expect(service.renewSubscription('tid')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('يجب إرجاع خطأ إذا لم يوجد اشتراك للتجديد', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);

      await expect(service.renewSubscription('tid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
