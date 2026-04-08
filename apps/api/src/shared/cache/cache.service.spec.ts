/**
 * CacheService unit tests.
 *
 * The CacheService creates its own Redis instance internally.
 * We mock the ioredis module so that every `new Redis()` returns our mock,
 * then test the public API.
 */

const mockRedisInstance = {
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
  quit: jest.fn().mockResolvedValue('OK'),
  on: jest.fn(),
};

jest.mock('ioredis', () => {
  const Redis = jest.fn().mockImplementation(() => mockRedisInstance);
  return { __esModule: true, default: Redis };
});

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CacheService, CachedTenantData } from './cache.service';
import { PlatformPrismaClient } from '../database/platform.client';

const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: unknown) => {
    const config: Record<string, unknown> = {
      REDIS_HOST: 'localhost',
      REDIS_PORT: 6379,
      REDIS_PASSWORD: '',
    };
    return config[key] ?? defaultValue;
  }),
};

const mockPlatformPrisma = {
  tokenBlacklist: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
  },
};

describe('CacheService', () => {
  let service: CacheService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PlatformPrismaClient, useValue: mockPlatformPrisma },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
  });

  describe('getTenant / setTenant', () => {
    const tenantData: CachedTenantData = {
      tenant: {
        id: 'tenant-1',
        nameAr: 'صالون',
        nameEn: 'Salon',
        slug: 'salon',
        databaseName: 'servix_tenant_1',
        status: 'active',
        primaryColor: '#8B5CF6',
        theme: 'velvet',
        logoUrl: null,
      },
      subscription: {
        id: 'sub-1',
        status: 'active',
        currentPeriodEnd: new Date().toISOString(),
      },
      featureCodes: ['reports', 'online_booking'],
    };

    it('يجب إرجاع null عندما لا توجد بيانات مخزنة', async () => {
      mockRedisInstance.get.mockResolvedValue(null);
      const result = await service.getTenant('tenant-1');
      expect(result).toBeNull();
    });

    it('يجب إرجاع البيانات المخزنة عند وجودها', async () => {
      mockRedisInstance.get.mockResolvedValue(JSON.stringify(tenantData));
      const result = await service.getTenant('tenant-1');
      expect(result).toEqual(tenantData);
      expect(result!.tenant.id).toBe('tenant-1');
      expect(result!.featureCodes).toContain('reports');
    });

    it('يجب تخزين بيانات المستأجر مع TTL', async () => {
      await service.setTenant('tenant-1', tenantData);
      expect(mockRedisInstance.setex).toHaveBeenCalledWith(
        'servix:tenant:tenant-1',
        300,
        JSON.stringify(tenantData),
      );
    });

    it('يجب إرجاع null عند فشل Redis (graceful degradation)', async () => {
      mockRedisInstance.get.mockRejectedValue(new Error('ECONNREFUSED'));
      const result = await service.getTenant('tenant-1');
      expect(result).toBeNull();
    });
  });

  describe('invalidateTenant', () => {
    it('يجب حذف المستأجر من الكاش', async () => {
      await service.invalidateTenant('tenant-1');
      expect(mockRedisInstance.del).toHaveBeenCalledWith('servix:tenant:tenant-1');
    });
  });

  describe('getSettings / setSettings', () => {
    const settings = { slotDuration: '30', taxRate: '15' };

    it('يجب إرجاع null عندما لا توجد إعدادات مخزنة', async () => {
      mockRedisInstance.get.mockResolvedValue(null);
      const result = await service.getSettings('tenant-1');
      expect(result).toBeNull();
    });

    it('يجب إرجاع الإعدادات المخزنة', async () => {
      mockRedisInstance.get.mockResolvedValue(JSON.stringify(settings));
      const result = await service.getSettings('tenant-1');
      expect(result).toEqual(settings);
    });

    it('يجب تخزين الإعدادات مع TTL 5 دقائق', async () => {
      await service.setSettings('tenant-1', settings);
      expect(mockRedisInstance.setex).toHaveBeenCalledWith(
        'servix:settings:tenant-1',
        300,
        JSON.stringify(settings),
      );
    });

    it('يجب إرجاع null عند فشل Redis', async () => {
      mockRedisInstance.get.mockRejectedValue(new Error('ECONNREFUSED'));
      const result = await service.getSettings('tenant-1');
      expect(result).toBeNull();
    });
  });

  describe('invalidateSettings', () => {
    it('يجب حذف الإعدادات من الكاش', async () => {
      await service.invalidateSettings('tenant-1');
      expect(mockRedisInstance.del).toHaveBeenCalledWith('servix:settings:tenant-1');
    });
  });

  describe('checkForgotPasswordRateLimit', () => {
    it('يجب السماح إذا لم تكن هناك محاولات سابقة', async () => {
      mockRedisInstance.get.mockResolvedValue(null);
      const result = await service.checkForgotPasswordRateLimit('test@test.com');
      expect(result).toBe(true);
    });

    it('يجب السماح إذا كان عدد المحاولات أقل من 3', async () => {
      mockRedisInstance.get.mockResolvedValue('2');
      const result = await service.checkForgotPasswordRateLimit('test@test.com');
      expect(result).toBe(true);
    });

    it('يجب الرفض إذا كان عدد المحاولات 3 أو أكثر', async () => {
      mockRedisInstance.get.mockResolvedValue('3');
      const result = await service.checkForgotPasswordRateLimit('test@test.com');
      expect(result).toBe(false);
    });

    it('يجب السماح عند فشل Redis (graceful degradation)', async () => {
      mockRedisInstance.get.mockRejectedValue(new Error('ECONNREFUSED'));
      const result = await service.checkForgotPasswordRateLimit('test@test.com');
      expect(result).toBe(true);
    });
  });

  describe('incrementForgotPasswordAttempt', () => {
    it('يجب زيادة العداد وتعيين TTL عند أول محاولة', async () => {
      mockRedisInstance.incr.mockResolvedValue(1);
      const result = await service.incrementForgotPasswordAttempt('test@test.com');
      expect(result).toBe(1);
      expect(mockRedisInstance.expire).toHaveBeenCalledWith(
        'servix:forgot_pwd:test@test.com',
        3600,
      );
    });

    it('يجب زيادة العداد دون تعيين TTL عند المحاولة الثانية', async () => {
      mockRedisInstance.incr.mockResolvedValue(2);
      const result = await service.incrementForgotPasswordAttempt('test@test.com');
      expect(result).toBe(2);
      expect(mockRedisInstance.expire).not.toHaveBeenCalled();
    });
  });

  describe('checkLoginIpBlock', () => {
    it('يجب إرجاع 0 عندما لا يوجد حظر', async () => {
      mockRedisInstance.ttl.mockResolvedValue(-2);
      const result = await service.checkLoginIpBlock('192.168.1.1');
      expect(result).toBe(0);
    });

    it('يجب إرجاع TTL عندما يكون IP محظور', async () => {
      mockRedisInstance.ttl.mockResolvedValue(900);
      const result = await service.checkLoginIpBlock('192.168.1.1');
      expect(result).toBe(900);
    });

    it('يجب إرجاع 0 عند فشل Redis', async () => {
      mockRedisInstance.ttl.mockRejectedValue(new Error('ECONNREFUSED'));
      const result = await service.checkLoginIpBlock('192.168.1.1');
      expect(result).toBe(0);
    });
  });

  describe('Platform settings cache', () => {
    it('يجب جلب إعدادات المنصة المخزنة', async () => {
      const settings = { maintenance: 'false' };
      mockRedisInstance.get.mockResolvedValue(JSON.stringify(settings));

      const result = await service.getPlatformSettings();
      expect(result).toEqual(settings);
    });

    it('يجب إرجاع null عند عدم وجود بيانات', async () => {
      mockRedisInstance.get.mockResolvedValue(null);

      const result = await service.getPlatformSettings();
      expect(result).toBeNull();
    });

    it('يجب حذف إعدادات المنصة', async () => {
      await service.invalidatePlatformSettings();
      expect(mockRedisInstance.del).toHaveBeenCalledWith('servix:platform_settings');
    });
  });
});
