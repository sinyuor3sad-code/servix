import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { CacheService } from '../../../shared/cache/cache.service';
import { AuditService } from '../../../core/audit/audit.service';
import { EventsGateway } from '../../../shared/events';
import { PlatformPrismaClient } from '../../../shared/database/platform.client';
import { TenantClientFactory } from '../../../shared/database/tenant-client.factory';
import type { TenantPrismaClient } from '../../../shared/types';

const mockDb = {
  setting: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockCacheService = {
  getSettings: jest.fn().mockResolvedValue(null),
  setSettings: jest.fn().mockResolvedValue(undefined),
  invalidateSettings: jest.fn().mockResolvedValue(undefined),
};

const mockEventsGateway = {
  emitToTenant: jest.fn(),
};

const mockPlatformDb = {
  tenant: { findUnique: jest.fn() },
};

const mockTenantFactory = {
  getTenantClient: jest.fn().mockReturnValue(mockDb),
};

const mockAuditService = {
  log: jest.fn().mockResolvedValue(undefined),
};

describe('SettingsService', () => {
  let service: SettingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: CacheService, useValue: mockCacheService },
        { provide: EventsGateway, useValue: mockEventsGateway },
        { provide: PlatformPrismaClient, useValue: mockPlatformDb },
        { provide: TenantClientFactory, useValue: mockTenantFactory },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
    jest.clearAllMocks();
    mockCacheService.getSettings.mockResolvedValue(null);
  });

  describe('getAll', () => {
    it('يجب إرجاع الإعدادات مع القيم الافتراضية', async () => {
      mockDb.setting.findMany.mockResolvedValue([
        { key: 'slotDuration', value: '45' },
      ]);

      const result = await service.getAll(
        mockDb as unknown as TenantPrismaClient,
      );

      expect(result).toHaveProperty('slotDuration', '45');
      // Should have defaults merged
      expect(Object.keys(result).length).toBeGreaterThan(1);
    });

    it('يجب استخدام الكاش عند توفره', async () => {
      mockCacheService.getSettings.mockResolvedValue({
        slotDuration: '30',
        'tax.percentage': '15',
      });

      const result = await service.getAll(
        mockDb as unknown as TenantPrismaClient,
        'tenant-1',
      );

      expect(result).toHaveProperty('slotDuration', '30');
      expect(mockDb.setting.findMany).not.toHaveBeenCalled();
    });

    it('يجب تخزين النتائج في الكاش عند عدم وجوده', async () => {
      mockDb.setting.findMany.mockResolvedValue([]);

      await service.getAll(
        mockDb as unknown as TenantPrismaClient,
        'tenant-1',
      );

      expect(mockCacheService.setSettings).toHaveBeenCalledWith(
        'tenant-1',
        expect.any(Object),
      );
    });
  });

  describe('getMultiple', () => {
    it('يجب إرجاع المفاتيح المطلوبة فقط', async () => {
      mockDb.setting.findMany.mockResolvedValue([
        { key: 'slotDuration', value: '30' },
        { key: 'currency', value: 'SAR' },
        { key: 'timezone', value: 'Asia/Riyadh' },
      ]);

      const result = await service.getMultiple(
        mockDb as unknown as TenantPrismaClient,
        ['slotDuration', 'currency'],
      );

      expect(Object.keys(result)).toEqual(['slotDuration', 'currency']);
    });
  });

  describe('getByKey', () => {
    it('يجب إرجاع إعداد محدد', async () => {
      mockDb.setting.findUnique.mockResolvedValue({
        key: 'slotDuration',
        value: '30',
      });

      const result = await service.getByKey(
        mockDb as unknown as TenantPrismaClient,
        'slotDuration',
      );

      expect(result).toHaveProperty('key', 'slotDuration');
    });

    it('يجب رمي NotFoundException لإعداد غير موجود', async () => {
      mockDb.setting.findUnique.mockResolvedValue(null);

      await expect(
        service.getByKey(
          mockDb as unknown as TenantPrismaClient,
          'nonexistent',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateBatch', () => {
    it('يجب تحديث مجموعة إعدادات صحيحة', async () => {
      mockDb.$transaction.mockResolvedValue([]);
      mockDb.setting.findMany.mockResolvedValue([]);

      await service.updateBatch(
        mockDb as unknown as TenantPrismaClient,
        {
          settings: [
            { key: 'slotDuration', value: '30' },
            { key: 'currency', value: 'SAR' },
          ],
        },
        'user-1',
        'tenant-1',
      );

      expect(mockDb.$transaction).toHaveBeenCalled();
      expect(mockCacheService.invalidateSettings).toHaveBeenCalledWith('tenant-1');
    });

    it('يجب رفض إعدادات بقيم غير صحيحة (Zod validation)', async () => {
      await expect(
        service.updateBatch(
          mockDb as unknown as TenantPrismaClient,
          {
            settings: [
              { key: 'slotDuration', value: '-5' },
            ],
          },
          'user-1',
          'tenant-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('يجب رفض نسبة ضريبة خاطئة', async () => {
      await expect(
        service.updateBatch(
          mockDb as unknown as TenantPrismaClient,
          {
            settings: [
              { key: 'taxRate', value: '150' },
            ],
          },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('يجب إرسال حدث WebSocket عند التحديث', async () => {
      mockDb.$transaction.mockResolvedValue([]);
      mockDb.setting.findMany.mockResolvedValue([]);

      await service.updateBatch(
        mockDb as unknown as TenantPrismaClient,
        { settings: [{ key: 'currency', value: 'SAR' }] },
        'user-1',
        'tenant-1',
      );

      expect(mockEventsGateway.emitToTenant).toHaveBeenCalledWith(
        'tenant-1',
        'settings:updated',
        expect.any(Object),
      );
    });
  });

  describe('getForSlug', () => {
    it('يجب إرجاع إعدادات لـ slug صالح', async () => {
      mockPlatformDb.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        slug: 'salon-test',
        status: 'active',
        databaseName: 'servix_tenant_1',
      });
      mockDb.setting.findMany.mockResolvedValue([]);

      const result = await service.getForSlug('salon-test');

      expect(result).toBeDefined();
      expect(Object.keys(result).length).toBeGreaterThan(0);
    });

    it('يجب رمي NotFoundException لـ slug غير موجود', async () => {
      mockPlatformDb.tenant.findUnique.mockResolvedValue(null);

      await expect(service.getForSlug('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('يجب رمي NotFoundException لصالون ملغي', async () => {
      mockPlatformDb.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        slug: 'cancelled-salon',
        status: 'cancelled',
      });

      await expect(service.getForSlug('cancelled-salon')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
