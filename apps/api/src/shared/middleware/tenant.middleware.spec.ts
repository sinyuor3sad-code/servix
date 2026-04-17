import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantMiddleware } from './tenant.middleware';
import { PlatformPrismaClient } from '../database/platform.client';
import { TenantClientFactory } from '../database/tenant-client.factory';
import { CacheService } from '../cache/cache.service';
import { PlatformSettingsService } from '../database/platform-settings.service';

const mockPlatformPrisma = {
  tenant: { findUnique: jest.fn() },
  subscription: { findFirst: jest.fn() },
  planFeature: { findMany: jest.fn() },
  tenantFeature: { findMany: jest.fn() },
};

const mockTenantFactory = {
  getTenantClient: jest.fn().mockReturnValue({}),
};

const mockCacheService = {
  getTenant: jest.fn().mockResolvedValue(null),
  setTenant: jest.fn().mockResolvedValue(undefined),
  invalidateTenant: jest.fn().mockResolvedValue(undefined),
};

const mockPlatformSettingsService = {
  getNumber: jest.fn().mockResolvedValue(7),
  getString: jest.fn().mockReturnValue(''),
  getBoolean: jest.fn().mockResolvedValue(false),
  get: jest.fn().mockResolvedValue(''),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
};

const createMockContext = (path: string, user?: { tenantId?: string; sub?: string }) => {
  const request: Record<string, unknown> = { path, user: user || {} };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
};

const baseTenant = {
  id: 'tenant-1',
  nameAr: 'صالون',
  nameEn: 'Salon',
  slug: 'salon',
  databaseName: 'servix_tenant_1',
  status: 'active',
  primaryColor: '#8B5CF6',
  theme: 'velvet',
  logoUrl: null,
};

const baseSubscription = {
  id: 'sub-1',
  status: 'active',
  currentPeriodEnd: new Date(Date.now() + 86400000),
  planId: 'plan-1',
};

describe('TenantMiddleware', () => {
  let middleware: TenantMiddleware;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantMiddleware,
        { provide: Reflector, useValue: { getAllAndOverride: jest.fn().mockReturnValue(false) } },
        { provide: PlatformPrismaClient, useValue: mockPlatformPrisma },
        { provide: TenantClientFactory, useValue: mockTenantFactory },
        { provide: CacheService, useValue: mockCacheService },
        { provide: PlatformSettingsService, useValue: mockPlatformSettingsService },
      ],
    }).compile();

    middleware = module.get<TenantMiddleware>(TenantMiddleware);
    jest.clearAllMocks();
    mockCacheService.getTenant.mockResolvedValue(null);
  });

  const createModuleWithPublic = async () => {
    return Test.createTestingModule({
      providers: [
        TenantMiddleware,
        { provide: Reflector, useValue: { getAllAndOverride: jest.fn().mockReturnValue(true) } },
        { provide: PlatformPrismaClient, useValue: mockPlatformPrisma },
        { provide: TenantClientFactory, useValue: mockTenantFactory },
        { provide: CacheService, useValue: mockCacheService },
        { provide: PlatformSettingsService, useValue: mockPlatformSettingsService },
      ],
    }).compile();
  };

  describe('المسارات العامة (Public routes)', () => {
    it('يجب السماح بالمرور للمسارات العامة (booking)', async () => {
      const moduleWithPublic = await createModuleWithPublic();
      const mw = moduleWithPublic.get<TenantMiddleware>(TenantMiddleware);
      const ctx = createMockContext('/api/v1/booking/beauty-salon');

      const result = await mw.canActivate(ctx);
      expect(result).toBe(true);
      expect(mockPlatformPrisma.tenant.findUnique).not.toHaveBeenCalled();
    });

    it('يجب السماح بالمرور لمسارات auth بدون tenant', async () => {
      const ctx = createMockContext('/api/v1/auth/login', {});
      const result = await middleware.canActivate(ctx);
      expect(result).toBe(true);
      expect(mockPlatformPrisma.tenant.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('المسارات المحمية (Protected routes)', () => {
    it('يجب رفض الطلب بدون tenantId للمسارات المحمية', async () => {
      const ctx = createMockContext('/api/v1/salon', {});

      await expect(middleware.canActivate(ctx)).rejects.toThrow(ForbiddenException);
      await expect(middleware.canActivate(ctx)).rejects.toThrow(
        'يجب أن تكون مرتبطاً بحساب صالون للوصول إلى هذا المورد',
      );
    });

    it('يجب رفض الطلب بدون tenantId لمسار services', async () => {
      const ctx = createMockContext('/api/v1/services', {});

      await expect(middleware.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('يجب تحميل Tenant عند وجود tenantId واشتراك صالح', async () => {
      mockPlatformPrisma.tenant.findUnique.mockResolvedValue(baseTenant);
      mockPlatformPrisma.subscription.findFirst.mockResolvedValue(baseSubscription);
      mockPlatformPrisma.planFeature.findMany.mockResolvedValue([]);
      mockPlatformPrisma.tenantFeature.findMany.mockResolvedValue([]);

      const ctx = createMockContext('/api/v1/salon', { tenantId: 'tenant-1' });
      const result = await middleware.canActivate(ctx);

      expect(result).toBe(true);
      expect(mockPlatformPrisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
      });
    });

    it('يجب إرفاق tenant و tenantDb و features بالطلب', async () => {
      mockPlatformPrisma.tenant.findUnique.mockResolvedValue(baseTenant);
      mockPlatformPrisma.subscription.findFirst.mockResolvedValue(baseSubscription);
      mockPlatformPrisma.planFeature.findMany.mockResolvedValue([
        { feature: { code: 'reports' } },
      ]);
      mockPlatformPrisma.tenantFeature.findMany.mockResolvedValue([]);
      mockTenantFactory.getTenantClient.mockReturnValue({ prisma: 'client' });

      const ctx = createMockContext('/api/v1/salon', { tenantId: 'tenant-1' });
      await middleware.canActivate(ctx);

      const req = ctx.switchToHttp().getRequest();
      expect(req.tenant).toBeDefined();
      expect(req.tenant.id).toBe('tenant-1');
      expect(req.tenant.nameAr).toBe('صالون');
      expect(req.tenantDb).toBeDefined();
      expect(req.tenantDb).toEqual({ prisma: 'client' });
      expect(req.features).toContain('reports');
      expect(req.subscriptionStatus).toBeDefined();
    });
  });

  describe('التحقق من الاشتراك (Subscription validation)', () => {
    it('يجب السماح باشتراك نشط', async () => {
      mockPlatformPrisma.tenant.findUnique.mockResolvedValue(baseTenant);
      mockPlatformPrisma.subscription.findFirst.mockResolvedValue({
        ...baseSubscription,
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 86400000),
      });
      mockPlatformPrisma.planFeature.findMany.mockResolvedValue([]);
      mockPlatformPrisma.tenantFeature.findMany.mockResolvedValue([]);

      const ctx = createMockContext('/api/v1/salon', { tenantId: 'tenant-1' });
      const result = await middleware.canActivate(ctx);

      expect(result).toBe(true);
    });

    it('يجب السماح باشتراك تجريبي', async () => {
      mockPlatformPrisma.tenant.findUnique.mockResolvedValue(baseTenant);
      mockPlatformPrisma.subscription.findFirst.mockResolvedValue({
        ...baseSubscription,
        status: 'trial',
        currentPeriodEnd: new Date(Date.now() + 86400000),
      });
      mockPlatformPrisma.planFeature.findMany.mockResolvedValue([]);
      mockPlatformPrisma.tenantFeature.findMany.mockResolvedValue([]);

      const ctx = createMockContext('/api/v1/salon', { tenantId: 'tenant-1' });
      const result = await middleware.canActivate(ctx);

      expect(result).toBe(true);
    });

    it('يجب رفض الطلبات عند انتهاء الاشتراك (locked mode)', async () => {
      const expiredDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      mockPlatformPrisma.tenant.findUnique.mockResolvedValue(baseTenant);
      mockPlatformPrisma.subscription.findFirst.mockResolvedValue({
        ...baseSubscription,
        status: 'expired',
        currentPeriodEnd: expiredDate,
      });
      mockPlatformPrisma.planFeature.findMany.mockResolvedValue([]);
      mockPlatformPrisma.tenantFeature.findMany.mockResolvedValue([]);

      const ctx = createMockContext('/api/v1/salon', { tenantId: 'tenant-1' });

      await expect(middleware.canActivate(ctx)).rejects.toThrow(ForbiddenException);
      await expect(middleware.canActivate(ctx)).rejects.toThrow(
        'انتهت فترة الاشتراك. يرجى التجديد للوصول — اشتراكك مقفل. جدّدي الآن للاستمرار',
      );
    });

    it('يجب السماح بمسارات التجديد عند انتهاء الاشتراك', async () => {
      const expiredDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      mockPlatformPrisma.tenant.findUnique.mockResolvedValue(baseTenant);
      mockPlatformPrisma.subscription.findFirst.mockResolvedValue({
        ...baseSubscription,
        status: 'expired',
        currentPeriodEnd: expiredDate,
      });
      mockPlatformPrisma.planFeature.findMany.mockResolvedValue([]);
      mockPlatformPrisma.tenantFeature.findMany.mockResolvedValue([]);

      const ctx = createMockContext('/api/v1/subscriptions/renew', { tenantId: 'tenant-1' });
      const result = await middleware.canActivate(ctx);

      expect(result).toBe(true);
    });
  });

  describe('سلوك الكاش (Cache behavior)', () => {
    it('يجب استخدام الكاش عند توفره', async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      mockCacheService.getTenant.mockResolvedValue({
        tenant: baseTenant,
        subscription: {
          id: 'sub-1',
          status: 'active',
          currentPeriodEnd: futureDate,
        },
        featureCodes: ['reports'],
      });

      const ctx = createMockContext('/api/v1/salon', { tenantId: 'tenant-1' });
      await middleware.canActivate(ctx);

      expect(mockCacheService.getTenant).toHaveBeenCalledWith('tenant-1');
      expect(mockPlatformPrisma.tenant.findUnique).not.toHaveBeenCalled();
      expect(mockPlatformPrisma.subscription.findFirst).not.toHaveBeenCalled();
    });

    it('يجب تخزين البيانات في الكاش عند عدم توفرها', async () => {
      mockPlatformPrisma.tenant.findUnique.mockResolvedValue(baseTenant);
      mockPlatformPrisma.subscription.findFirst.mockResolvedValue(baseSubscription);
      mockPlatformPrisma.planFeature.findMany.mockResolvedValue([]);
      mockPlatformPrisma.tenantFeature.findMany.mockResolvedValue([]);

      const ctx = createMockContext('/api/v1/salon', { tenantId: 'tenant-1' });
      await middleware.canActivate(ctx);

      expect(mockCacheService.setTenant).toHaveBeenCalledWith('tenant-1', expect.objectContaining({
        tenant: expect.objectContaining({
          id: 'tenant-1',
          nameAr: 'صالون',
          databaseName: 'servix_tenant_1',
        }),
        subscription: expect.objectContaining({
          id: 'sub-1',
          status: 'active',
        }),
        featureCodes: expect.any(Array),
      }));
    });
  });

  describe('حالة الصالون (Tenant status)', () => {
    it('يجب رفض الطلب للصالون المعلق', async () => {
      mockCacheService.getTenant.mockResolvedValue(null);
      mockPlatformPrisma.tenant.findUnique.mockResolvedValue({
        ...baseTenant,
        status: 'suspended',
      });

      const ctx = createMockContext('/api/v1/salon', { tenantId: 'tenant-1' });

      await expect(middleware.canActivate(ctx)).rejects.toThrow(ForbiddenException);
      await expect(middleware.canActivate(ctx)).rejects.toThrow('حساب الصالون معلّق');
    });
  });

  describe('الكاش مع expired_locked', () => {
    it('يجب رفض المسارات غير التجديد عند وجود كاش expired_locked', async () => {
      const expiredDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      mockCacheService.getTenant.mockResolvedValue({
        tenant: baseTenant,
        subscription: {
          id: 'sub-1',
          status: 'expired',
          currentPeriodEnd: expiredDate,
        },
        featureCodes: [],
      });

      const ctx = createMockContext('/api/v1/salon', { tenantId: 'tenant-1' });

      await expect(middleware.canActivate(ctx)).rejects.toThrow(ForbiddenException);
      expect(mockPlatformPrisma.tenant.findUnique).not.toHaveBeenCalled();
    });

    it('يجب السماح بمسارات التجديد عند وجود كاش expired_locked', async () => {
      const expiredDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      mockCacheService.getTenant.mockResolvedValue({
        tenant: baseTenant,
        subscription: {
          id: 'sub-1',
          status: 'expired',
          currentPeriodEnd: expiredDate,
        },
        featureCodes: [],
      });
      mockPlatformPrisma.tenant.findUnique.mockResolvedValue(baseTenant);
      mockPlatformPrisma.subscription.findFirst.mockResolvedValue({
        ...baseSubscription,
        status: 'expired',
        currentPeriodEnd: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      });
      mockPlatformPrisma.planFeature.findMany.mockResolvedValue([]);
      mockPlatformPrisma.tenantFeature.findMany.mockResolvedValue([]);

      const ctx = createMockContext('/api/v1/subscriptions/current', { tenantId: 'tenant-1' });
      const result = await middleware.canActivate(ctx);

      expect(result).toBe(true);
    });
  });

  describe('مسارات غير tenant-required مع tenantId', () => {
    it('يجب تحميل السياق عند وجود tenantId لمسار غير محمي', async () => {
      mockPlatformPrisma.tenant.findUnique.mockResolvedValue(baseTenant);
      mockPlatformPrisma.subscription.findFirst.mockResolvedValue(baseSubscription);
      mockPlatformPrisma.planFeature.findMany.mockResolvedValue([]);
      mockPlatformPrisma.tenantFeature.findMany.mockResolvedValue([]);

      const ctx = createMockContext('/api/v1/subscriptions/plans', { tenantId: 'tenant-1' });
      const result = await middleware.canActivate(ctx);

      expect(result).toBe(true);
      const req = ctx.switchToHttp().getRequest();
      expect(req.tenant).toBeDefined();
      expect(req.tenantDb).toBeDefined();
    });
  });
});
