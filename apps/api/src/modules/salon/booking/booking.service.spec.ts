import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingService } from './booking.service';
import { PlatformPrismaClient } from '../../../shared/database/platform.client';
import { TenantClientFactory } from '../../../shared/database/tenant-client.factory';
import { SettingsService } from '../settings/settings.service';
import { CacheService } from '../../../shared/cache/cache.service';

const mockTenantDb = {
  salonInfo: { findFirst: jest.fn() },
  serviceCategory: { findMany: jest.fn() },
  service: { findMany: jest.fn() },
  employee: { findMany: jest.fn(), findFirst: jest.fn() },
  client: { findFirst: jest.fn(), create: jest.fn() },
  appointment: { findMany: jest.fn(), create: jest.fn() },
  attendance: { findMany: jest.fn() },
};

const mockPlatformDb = {
  tenant: { findUnique: jest.fn() },
};

const mockTenantFactory = {
  getTenantClient: jest.fn().mockReturnValue(mockTenantDb),
};

const mockSettingsService = {
  getForSlug: jest.fn().mockResolvedValue({
    online_booking_enabled: 'true',
    vacation_mode: 'false',
  }),
};

const mockCacheService = {
  canSendBookingOtp: jest.fn().mockResolvedValue(true),
  setBookingOtp: jest.fn().mockResolvedValue(undefined),
  markBookingOtpSent: jest.fn().mockResolvedValue(undefined),
  verifyBookingOtp: jest.fn().mockResolvedValue(true),
  isBookingOtpVerified: jest.fn().mockResolvedValue(true),
};

const ACTIVE_TENANT = {
  id: 'tenant-1',
  nameAr: 'صالون',
  nameEn: 'Salon',
  slug: 'salon-test',
  status: 'active',
  databaseName: 'servix_tenant_1',
  logoUrl: null,
  primaryColor: '#8B5CF6',
  theme: 'velvet',
};

describe('BookingService', () => {
  let service: BookingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingService,
        { provide: PlatformPrismaClient, useValue: mockPlatformDb },
        { provide: TenantClientFactory, useValue: mockTenantFactory },
        { provide: SettingsService, useValue: mockSettingsService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<BookingService>(BookingService);
    jest.clearAllMocks();

    mockPlatformDb.tenant.findUnique.mockResolvedValue(ACTIVE_TENANT);
    mockSettingsService.getForSlug.mockResolvedValue({
      online_booking_enabled: 'true',
      vacation_mode: 'false',
    });
  });

  describe('getSalonInfo', () => {
    it('يجب إرجاع معلومات الصالون لـ slug صالح', async () => {
      mockTenantDb.salonInfo.findFirst.mockResolvedValue({
        id: 'info-1',
        nameAr: 'صالون الجمال',
        phone: '0501234567',
      });

      const result = await service.getSalonInfo('salon-test');

      expect(result).toHaveProperty('slug', 'salon-test');
      expect(result).toHaveProperty('salonInfo');
      expect(result).toHaveProperty('settings');
    });

    it('يجب رمي NotFoundException لـ slug غير موجود', async () => {
      mockPlatformDb.tenant.findUnique.mockResolvedValue(null);

      await expect(service.getSalonInfo('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getServices', () => {
    it('يجب إرجاع الفئات مع خدماتها', async () => {
      mockTenantDb.serviceCategory.findMany.mockResolvedValue([
        {
          id: 'cat-1',
          nameAr: 'شعر',
          isActive: true,
          services: [
            { id: 'svc-1', nameAr: 'قص', price: 50, duration: 30, isActive: true, imageUrl: null },
          ],
        },
      ]);

      const result = await service.getServices('salon-test');

      expect(result).toHaveLength(1);
      expect(result[0].services).toHaveLength(1);
      expect((result[0].services as { price: number }[])[0].price).toBe(50);
    });

    it('يجب رمي NotFoundException لصالون غير موجود', async () => {
      mockPlatformDb.tenant.findUnique.mockResolvedValue(null);

      await expect(service.getServices('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getEmployees', () => {
    it('يجب إرجاع الموظفين النشطين مع خدماتهم', async () => {
      mockTenantDb.employee.findMany.mockResolvedValue([
        {
          id: 'emp-1',
          fullName: 'فاطمة',
          role: 'stylist',
          avatarUrl: null,
          employeeServices: [
            { service: { id: 'svc-1', nameAr: 'قص', nameEn: 'Cut' } },
          ],
        },
      ]);

      const result = await service.getEmployees('salon-test');

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('fullName', 'فاطمة');
      expect((result[0] as { services: unknown[] }).services).toHaveLength(1);
    });
  });

  describe('getAvailableSlots', () => {
    it('يجب إرجاع مصفوفة فارغة إذا كان الحجز مغلق', async () => {
      mockSettingsService.getForSlug.mockResolvedValue({
        online_booking_enabled: 'false',
        vacation_mode: 'false',
      });

      const result = await service.getAvailableSlots('salon-test', {
        date: '2026-04-20',
        serviceIds: ['svc-1'],
      } as never);

      expect(result).toEqual([]);
    });

    it('يجب إرجاع مصفوفة فارغة في وضع الإجازة', async () => {
      mockSettingsService.getForSlug.mockResolvedValue({
        online_booking_enabled: 'true',
        vacation_mode: 'true',
      });

      const result = await service.getAvailableSlots('salon-test', {
        date: '2026-04-20',
        serviceIds: ['svc-1'],
      } as never);

      expect(result).toEqual([]);
    });

    it('يجب رمي BadRequestException لخدمات غير متوفرة', async () => {
      mockTenantDb.salonInfo.findFirst.mockResolvedValue({
        slotDuration: 30,
        bufferTime: 10,
      });
      mockTenantDb.service.findMany.mockResolvedValue([]);

      await expect(
        service.getAvailableSlots('salon-test', {
          date: '2026-04-20',
          serviceIds: ['svc-nonexistent'],
        } as never),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createBooking', () => {
    it('يجب إنشاء حجز ناجح', async () => {
      mockTenantDb.service.findMany.mockResolvedValue([
        { id: 'svc-1', nameAr: 'قص', price: 50, duration: 30, isActive: true },
      ]);
      mockTenantDb.client.findFirst.mockResolvedValue(null);
      mockTenantDb.client.create.mockResolvedValue({
        id: 'client-1',
        fullName: 'سارة',
        phone: '+966501234567',
      });
      mockTenantDb.employee.findFirst.mockResolvedValue({
        id: 'emp-1',
        fullName: 'فاطمة',
      });
      mockTenantDb.appointment.create.mockResolvedValue({
        id: 'app-1',
        clientId: 'client-1',
        employeeId: 'emp-1',
        status: 'pending',
        source: 'online',
        totalPrice: 50,
        totalDuration: 30,
        client: { id: 'client-1', fullName: 'سارة', phone: '+966501234567' },
        employee: { id: 'emp-1', fullName: 'فاطمة' },
        appointmentServices: [],
      });

      const result = await service.createBooking('salon-test', {
        clientName: 'سارة',
        clientPhone: '+966501234567',
        serviceIds: ['svc-1'],
        date: '2026-04-20',
        startTime: '14:00',
      } as never);

      expect(result).toHaveProperty('status', 'pending');
      expect(result).toHaveProperty('source', 'online');
      expect(result).toHaveProperty('totalPrice', 50);
    });

    it('يجب رفض الحجز إذا كان الحجز الإلكتروني مغلق', async () => {
      mockSettingsService.getForSlug.mockResolvedValue({
        online_booking_enabled: 'false',
        vacation_mode: 'false',
      });

      await expect(
        service.createBooking('salon-test', {
          clientName: 'سارة',
          clientPhone: '+966501234567',
          serviceIds: ['svc-1'],
          date: '2026-04-20',
          startTime: '14:00',
        } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('يجب رفض الحجز في وضع الإجازة', async () => {
      mockSettingsService.getForSlug.mockResolvedValue({
        online_booking_enabled: 'true',
        vacation_mode: 'true',
      });

      await expect(
        service.createBooking('salon-test', {
          clientName: 'سارة',
          clientPhone: '+966501234567',
          serviceIds: ['svc-1'],
          date: '2026-04-20',
          startTime: '14:00',
        } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('يجب استخدام عميل موجود إذا كان رقمه مسجلاً', async () => {
      mockTenantDb.service.findMany.mockResolvedValue([
        { id: 'svc-1', price: 50, duration: 30, isActive: true },
      ]);
      mockTenantDb.client.findFirst.mockResolvedValue({
        id: 'existing-client',
        fullName: 'سارة',
        phone: '+966501234567',
      });
      mockTenantDb.employee.findFirst.mockResolvedValue({
        id: 'emp-1',
      });
      mockTenantDb.appointment.create.mockResolvedValue({
        id: 'app-1',
        clientId: 'existing-client',
        status: 'pending',
        totalPrice: 50,
        totalDuration: 30,
        client: {},
        employee: {},
        appointmentServices: [],
      });

      await service.createBooking('salon-test', {
        clientName: 'سارة',
        clientPhone: '+966501234567',
        serviceIds: ['svc-1'],
        date: '2026-04-20',
        startTime: '14:00',
      } as never);

      expect(mockTenantDb.client.create).not.toHaveBeenCalled();
    });
  });

  describe('sendOtp', () => {
    it('يجب إرسال OTP بنجاح', async () => {
      const result = await service.sendOtp('0501234567');
      expect(result).toHaveProperty('message');
      expect(mockCacheService.setBookingOtp).toHaveBeenCalled();
      expect(mockCacheService.markBookingOtpSent).toHaveBeenCalled();
    });

    it('يجب رفض الإرسال إذا كان الـ rate limit متجاوز', async () => {
      mockCacheService.canSendBookingOtp.mockResolvedValue(false);

      await expect(service.sendOtp('0501234567')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('verifyOtp', () => {
    it('يجب إرجاع verified: true لكود صحيح', async () => {
      mockCacheService.verifyBookingOtp.mockResolvedValue(true);
      const result = await service.verifyOtp('0501234567', '1234');
      expect(result).toEqual({ verified: true });
    });

    it('يجب إرجاع verified: false لكود خاطئ', async () => {
      mockCacheService.verifyBookingOtp.mockResolvedValue(false);
      const result = await service.verifyOtp('0501234567', '9999');
      expect(result).toEqual({ verified: false });
    });
  });
});
