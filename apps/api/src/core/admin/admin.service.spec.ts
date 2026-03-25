import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PlatformPrismaClient } from '../../shared/database/platform.client';

const mockPrisma = {
  tenant: {
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  user: {
    count: jest.fn(),
  },
  subscription: {
    count: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn(),
  },
  plan: {
    findMany: jest.fn(),
  },
  platformInvoice: {
    aggregate: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  platformAuditLog: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PlatformPrismaClient, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    jest.clearAllMocks();
  });

  describe('getStats', () => {
    it('يجب إرجاع الإحصائيات الإجمالية الصحيحة', async () => {
      mockPrisma.tenant.count
        .mockResolvedValueOnce(50) // totalTenants
        .mockResolvedValueOnce(35) // activeTenants
        .mockResolvedValueOnce(5) // suspendedTenants
        .mockResolvedValueOnce(8); // newTenantsThisMonth

      mockPrisma.user.count.mockResolvedValue(120);

      mockPrisma.subscription.count
        .mockResolvedValueOnce(60) // totalSubscriptions
        .mockResolvedValueOnce(40); // activeSubscriptions

      mockPrisma.platformInvoice.aggregate
        .mockResolvedValueOnce({ _sum: { total: 25000 } }) // totalRevenue
        .mockResolvedValueOnce({ _sum: { total: 5000 } }); // revenueThisMonth

      mockPrisma.subscription.groupBy.mockResolvedValue([
        { planId: 'plan-1', _count: { id: 20 } },
        { planId: 'plan-2', _count: { id: 15 } },
      ]);

      mockPrisma.plan.findMany.mockResolvedValue([
        { id: 'plan-1', name: 'Basic', nameAr: 'أساسية' },
        { id: 'plan-2', name: 'Pro', nameAr: 'احترافية' },
      ]);

      const result = await service.getStats();

      expect(result.totalTenants).toBe(50);
      expect(result.activeTenants).toBe(35);
      expect(result.suspendedTenants).toBe(5);
      expect(result.totalUsers).toBe(120);
      expect(result.totalSubscriptions).toBe(60);
      expect(result.activeSubscriptions).toBe(40);
      expect(result.totalRevenue).toBe(25000);
      expect(result.revenueThisMonth).toBe(5000);
      expect(result.newTenantsThisMonth).toBe(8);
      expect(result.planDistribution).toHaveLength(2);
      expect(result.planDistribution[0]).toEqual({
        planId: 'plan-1',
        planName: 'Basic',
        planNameAr: 'أساسية',
        count: 20,
      });
    });

    it('يجب إرجاع صفر للإيرادات عند عدم وجود فواتير', async () => {
      mockPrisma.tenant.count.mockResolvedValue(0);
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.subscription.count.mockResolvedValue(0);
      mockPrisma.platformInvoice.aggregate.mockResolvedValue({
        _sum: { total: null },
      });
      mockPrisma.subscription.groupBy.mockResolvedValue([]);
      mockPrisma.plan.findMany.mockResolvedValue([]);

      const result = await service.getStats();

      expect(result.totalRevenue).toBe(0);
      expect(result.revenueThisMonth).toBe(0);
      expect(result.planDistribution).toEqual([]);
    });
  });

  describe('getTenants', () => {
    it('يجب تطبيق فلتر البحث والحالة على النتائج', async () => {
      const tenants = [
        {
          id: 't-1',
          nameAr: 'صالون الجمال',
          status: 'active',
          subscriptions: [
            { plan: { id: 'p-1', name: 'Pro' } },
          ],
        },
      ];
      mockPrisma.tenant.findMany.mockResolvedValue(tenants);
      mockPrisma.tenant.count.mockResolvedValue(1);

      const result = await service.getTenants({
        page: 1,
        perPage: 20,
        search: 'الجمال',
        status: 'active',
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);

      const findManyCall = mockPrisma.tenant.findMany.mock.calls[0][0];
      expect(findManyCall.where.status).toBe('active');
      expect(findManyCall.where.OR).toBeDefined();
    });

    it('يجب إرجاع نتائج بدون فلتر عند عدم تحديد بحث أو حالة', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([]);
      mockPrisma.tenant.count.mockResolvedValue(0);

      const result = await service.getTenants({
        page: 1,
        perPage: 20,
      });

      expect(result.data).toEqual([]);
      expect(result.meta.totalPages).toBe(0);

      const findManyCall = mockPrisma.tenant.findMany.mock.calls[0][0];
      expect(findManyCall.where).toEqual({});
    });

    it('يجب حساب عدد الصفحات بشكل صحيح', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([]);
      mockPrisma.tenant.count.mockResolvedValue(45);

      const result = await service.getTenants({
        page: 1,
        perPage: 20,
      });

      expect(result.meta.totalPages).toBe(3);
    });
  });

  describe('updateTenantStatus', () => {
    it('يجب تعليق منشأة نشطة بنجاح', async () => {
      const tenant = { id: 'tid', status: 'active' };
      const updated = { ...tenant, status: 'suspended' };

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.tenant.update.mockResolvedValue(updated);
      mockPrisma.platformAuditLog.create.mockResolvedValue({ id: 'log-id' });
      mockPrisma.$transaction.mockImplementation((args: unknown[]) =>
        Promise.all(args),
      );

      const result = await service.updateTenantStatus(
        'tid',
        'suspended',
        'admin-user-id',
      );

      expect(result.status).toBe('suspended');
      expect(mockPrisma.$transaction).toHaveBeenCalledWith([
        expect.anything(), // tenant update
        expect.anything(), // audit log create
      ]);
    });

    it('يجب تفعيل منشأة معلّقة بنجاح', async () => {
      const tenant = { id: 'tid', status: 'suspended' };
      const updated = { ...tenant, status: 'active' };

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.$transaction.mockResolvedValue([updated, { id: 'log-id' }]);

      const result = await service.updateTenantStatus(
        'tid',
        'active',
        'admin-user-id',
      );

      expect(result.status).toBe('active');
    });

    it('يجب رفض التحديث إذا كانت المنشأة بنفس الحالة المطلوبة', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tid',
        status: 'suspended',
      });

      await expect(
        service.updateTenantStatus('tid', 'suspended', 'admin-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('يجب إرجاع 404 إذا لم يتم العثور على المنشأة', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.updateTenantStatus('nonexistent', 'suspended', 'admin-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
