import { Test, TestingModule } from '@nestjs/testing';
import { TenantsService } from './tenants.service';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { PlatformPrismaClient } from '../../shared/database/platform.client';

const mockPrisma = {
  tenant: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  tenantUser: {
    create: jest.fn(),
  },
  role: {
    findFirst: jest.fn(),
  },
  tenantFeature: {
    upsert: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('TenantsService', () => {
  let service: TenantsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        { provide: PlatformPrismaClient, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      nameAr: 'صالون الجمال',
      nameEn: 'Beauty Salon',
      slug: 'beauty-salon',
      phone: '+966501234567',
      email: 'info@beauty.com',
      city: 'الرياض',
      address: 'شارع العليا',
    };
    const ownerId = 'owner-user-id';

    it('يجب إنشاء منشأة مع اسم قاعدة بيانات فريد واشتراك تجريبي', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      const createdTenant = {
        id: 'tenant-id',
        ...createDto,
        databaseName: 'tenant_abc123',
        status: 'trial',
        trialEndsAt: expect.any(Date),
      };

      mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          tenant: { create: jest.fn().mockResolvedValue(createdTenant) },
          role: {
            findFirst: jest
              .fn()
              .mockResolvedValue({ id: 'role-id', name: 'owner' }),
          },
          tenantUser: { create: jest.fn().mockResolvedValue({}) },
        };
        return cb(tx);
      });

      const result = await service.create(createDto, ownerId);

      expect(result.status).toBe('trial');
      expect(result.databaseName).toContain('tenant_');
      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { slug: createDto.slug },
      });
    });

    it('يجب رفض الإنشاء إذا كان الـ slug مستخدماً', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'existing',
        slug: createDto.slug,
      });

      await expect(service.create(createDto, ownerId)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findOne', () => {
    it('يجب إرجاع المنشأة مع الاشتراكات والميزات', async () => {
      const tenant = {
        id: 'tenant-id',
        nameAr: 'صالون',
        subscriptions: [
          { id: 'sub-1', status: 'active', planId: 'plan-id' },
        ],
        tenantFeatures: [
          {
            id: 'tf-1',
            isEnabled: true,
            feature: { id: 'f-1', code: 'online_booking' },
          },
        ],
      };
      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);

      const result = await service.findOne('tenant-id');

      expect(result.subscriptions).toHaveLength(1);
      expect(result.tenantFeatures).toHaveLength(1);
      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: 'tenant-id' },
        include: {
          subscriptions: { orderBy: { createdAt: 'desc' } },
          tenantFeatures: { include: { feature: true } },
        },
      });
    });

    it('يجب إرجاع 404 إذا لم يتم العثور على المنشأة', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const tenantId = 'tenant-id';

    it('يجب تحديث بيانات المنشأة بنجاح', async () => {
      const existing = { id: tenantId, slug: 'old-slug', nameAr: 'قديم' };
      const updated = { ...existing, nameAr: 'جديد' };

      mockPrisma.tenant.findUnique.mockResolvedValue(existing);
      mockPrisma.tenant.update.mockResolvedValue(updated);

      const result = await service.update(tenantId, { nameAr: 'جديد' });

      expect(result.nameAr).toBe('جديد');
    });

    it('يجب رفض التحديث إذا كان الـ slug الجديد مستخدماً', async () => {
      const existing = { id: tenantId, slug: 'old-slug' };
      mockPrisma.tenant.findUnique
        .mockResolvedValueOnce(existing) // first call: find tenant
        .mockResolvedValueOnce({ id: 'other-tenant', slug: 'taken-slug' }); // second call: slug check

      await expect(
        service.update(tenantId, { slug: 'taken-slug' }),
      ).rejects.toThrow(ConflictException);
    });

    it('يجب إرجاع 404 إذا لم يتم العثور على المنشأة للتحديث', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { nameAr: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('suspend', () => {
    it('يجب تعليق المنشأة بنجاح', async () => {
      const tenant = { id: 'tenant-id', status: 'active' };
      const suspended = { ...tenant, status: 'suspended' };

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.tenant.update.mockResolvedValue(suspended);

      const result = await service.suspend('tenant-id');

      expect(result.status).toBe('suspended');
      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-id' },
        data: { status: 'suspended' },
      });
    });

    it('يجب إرجاع 404 إذا لم يتم العثور على المنشأة للتعليق', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.suspend('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
