import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PlatformPrismaClient } from '../src/shared/database/platform.client';
import { TenantClientFactory } from '../src/shared/database/tenant-client.factory';
import { CacheService } from '../src/shared/cache/cache.service';
import { SettingsService } from '../src/modules/salon/settings/settings.service';
import { ResponseTransformInterceptor } from '../src/shared/interceptors/response-transform.interceptor';

const mockCacheService = {
  getTenant: jest.fn().mockResolvedValue(null),
  setTenant: jest.fn().mockResolvedValue(undefined),
  canSendBookingOtp: jest.fn().mockResolvedValue(true),
  setBookingOtp: jest.fn().mockResolvedValue(undefined),
  markBookingOtpSent: jest.fn().mockResolvedValue(undefined),
  verifyBookingOtp: jest.fn().mockResolvedValue(true),
};

const mockSettingsService = {
  getForSlug: jest.fn().mockResolvedValue({
    online_booking_enabled: 'true',
    vacation_mode: 'false',
  }),
};

const mockTenantDb = {
  salonInfo: {
    findFirst: jest.fn(),
  },
  serviceCategory: {
    findMany: jest.fn(),
  },
  service: {
    findMany: jest.fn(),
  },
  employee: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  client: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  appointment: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  attendance: {
    findMany: jest.fn(),
  },
};

const ACTIVE_TENANT = {
  id: 'tenant-uuid',
  nameAr: 'صالون الجمال',
  nameEn: 'Beauty Salon',
  slug: 'beauty-salon',
  status: 'active',
  databaseName: 'servix_tenant_abc',
  logoUrl: null,
  primaryColor: '#e91e63',
  theme: 'elegance',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  tenant: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },
  tenantUser: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  role: {
    findUnique: jest.fn(),
  },
  subscription: { count: jest.fn(), groupBy: jest.fn() },
  platformInvoice: { aggregate: jest.fn() },
  platformAuditLog: { create: jest.fn() },
  $transaction: jest.fn(),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  onModuleDestroy: jest.fn(),
};
(mockPrisma.$transaction as jest.Mock).mockImplementation(
  (fn: unknown) => typeof fn === 'function' ? (fn as (tx: unknown) => unknown)(mockPrisma) : Promise.all(fn as Promise<unknown>[]),
);

const mockTenantFactory = {
  getTenantClient: jest.fn().mockReturnValue(mockTenantDb),
};

describe('Booking (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PlatformPrismaClient)
      .useValue(mockPrisma)
      .overrideProvider(TenantClientFactory)
      .useValue(mockTenantFactory)
      .overrideProvider(CacheService)
      .useValue(mockCacheService)
      .overrideProvider(SettingsService)
      .useValue(mockSettingsService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalInterceptors(new ResponseTransformInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheService.canSendBookingOtp.mockResolvedValue(true);
    mockCacheService.verifyBookingOtp.mockResolvedValue(true);
    mockSettingsService.getForSlug.mockResolvedValue({
      online_booking_enabled: 'true',
      vacation_mode: 'false',
    });
  });

  describe('GET /api/v1/booking/:slug', () => {
    it('should return salon info for a valid slug', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(ACTIVE_TENANT);
      mockTenantDb.salonInfo.findFirst.mockResolvedValue({
        id: 'info-uuid',
        nameAr: 'صالون الجمال',
        phone: '0512345678',
        address: 'الرياض',
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/booking/beauty-salon')
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('slug', 'beauty-salon');
    });

    it('should return 404 for non-existent salon slug', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/api/v1/booking/non-existent-salon')
        .expect(404);
    });

    it('should not require authentication', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(ACTIVE_TENANT);
      mockTenantDb.salonInfo.findFirst.mockResolvedValue({
        id: 'info-uuid',
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/booking/beauty-salon');

      expect(res.status).not.toBe(401);
    });
  });

  describe('GET /api/v1/booking/:slug/services', () => {
    it('should return salon services', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(ACTIVE_TENANT);
      mockTenantDb.serviceCategory.findMany.mockResolvedValue([
        {
          id: 'cat-uuid',
          nameAr: 'شعر',
          nameEn: 'Hair',
          isActive: true,
          sortOrder: 1,
          services: [
            {
              id: 'svc-uuid',
              nameAr: 'قص شعر',
              nameEn: 'Haircut',
              price: { toNumber: () => 50 },
              duration: 30,
              isActive: true,
              sortOrder: 1,
            },
          ],
        },
      ]);

      const res = await request(app.getHttpServer())
        .get('/api/v1/booking/beauty-salon/services')
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return 404 for non-existent salon', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/api/v1/booking/non-existent-salon/services')
        .expect(404);
    });
  });

  describe('GET /api/v1/booking/:slug/employees', () => {
    it('should return salon employees', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(ACTIVE_TENANT);
      mockTenantDb.employee.findMany.mockResolvedValue([
        {
          id: 'emp-uuid',
          fullName: 'فاطمة',
          role: 'stylist',
          avatarUrl: null,
          isActive: true,
          employeeServices: [
            {
              service: {
                id: 'svc-uuid',
                nameAr: 'قص شعر',
                nameEn: 'Haircut',
              },
            },
          ],
        },
      ]);

      const res = await request(app.getHttpServer())
        .get('/api/v1/booking/beauty-salon/employees')
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toHaveProperty('fullName', 'فاطمة');
      expect(res.body.data[0]).toHaveProperty('role', 'stylist');
      expect(res.body.data[0].services).toHaveLength(1);
      expect(res.body.data[0].services[0]).toHaveProperty('nameAr', 'قص شعر');
    });

    it('should return 404 for non-existent salon', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/api/v1/booking/non-existent-salon/employees')
        .expect(404);
    });
  });

  describe('GET /api/v1/booking/:slug/slots', () => {
    it('should return available slots for valid query', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(ACTIVE_TENANT);
      mockTenantDb.salonInfo.findFirst.mockResolvedValue({
        id: 'info-uuid',
        slotDuration: 30,
        bufferTime: 10,
      });
      mockTenantDb.service.findMany.mockResolvedValue([
        {
          id: 'svc-uuid',
          nameAr: 'قص شعر',
          duration: 30,
          isActive: true,
        },
      ]);
      mockTenantDb.employee.findMany.mockResolvedValue([
        {
          id: 'emp-uuid',
          employeeSchedules: [
            {
              dayOfWeek: 1,
              startTime: '09:00',
              endTime: '18:00',
              isDayOff: false,
            },
          ],
          employeeBreaks: [],
        },
      ]);
      mockTenantDb.appointment.findMany.mockResolvedValue([]);
      mockTenantDb.attendance.findMany.mockResolvedValue([
        { employeeId: 'emp-uuid', checkIn: '09:00', checkOut: null, isOnBreak: false },
      ]);

      const res = await request(app.getHttpServer())
        .get('/api/v1/booking/beauty-salon/slots')
        .query({ date: '2026-04-20', serviceIds: ['11111111-1111-4111-8111-111111111111'] })
        .expect(200);

      const slots = res.body?.data ?? res.body;
      expect(Array.isArray(slots)).toBe(true);
    });

    it('should return 404 for non-existent salon', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/api/v1/booking/non-existent-salon/slots')
        .query({ date: '2026-04-20', serviceIds: ['11111111-1111-4111-8111-111111111111'] })
        .expect(404);
    });
  });

  describe('POST /api/v1/booking/:slug/send-otp', () => {
    it('should send OTP for valid phone', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(ACTIVE_TENANT);
      mockCacheService.canSendBookingOtp.mockResolvedValue(true);

      const res = await request(app.getHttpServer())
        .post('/api/v1/booking/beauty-salon/send-otp')
        .send({ phone: '0512345678' })
        .expect(201);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('message');
    });

    it('should reject too-frequent OTP requests', async () => {
      mockCacheService.canSendBookingOtp.mockResolvedValue(false);

      const res = await request(app.getHttpServer())
        .post('/api/v1/booking/beauty-salon/send-otp')
        .send({ phone: '0512345678' })
        .expect(400);

      expect(res.body).toHaveProperty('message');
    });
  });

  describe('POST /api/v1/booking/:slug/verify-otp', () => {
    it('should verify correct OTP code', async () => {
      mockCacheService.verifyBookingOtp.mockResolvedValue(true);

      const res = await request(app.getHttpServer())
        .post('/api/v1/booking/beauty-salon/verify-otp')
        .send({ phone: '0512345678', code: '1234' })
        .expect(201);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data?.data?.verified ?? res.body.data?.verified).toBe(true);
    });

    it('should reject incorrect OTP code', async () => {
      mockCacheService.verifyBookingOtp.mockResolvedValue(false);

      const res = await request(app.getHttpServer())
        .post('/api/v1/booking/beauty-salon/verify-otp')
        .send({ phone: '0512345678', code: '9999' })
        .expect(201);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data?.data?.verified ?? res.body.data?.verified).toBe(false);
    });
  });

  describe('POST /api/v1/booking/:slug/book', () => {
    const SVC_UUID = '11111111-1111-4111-8111-111111111111';
    const validBooking = {
      clientName: 'سارة محمد',
      clientPhone: '+966512345678',
      serviceIds: [SVC_UUID],
      date: '2026-04-15',
      startTime: '14:30',
    };

    it('should create a booking successfully', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(ACTIVE_TENANT);

      mockTenantDb.service.findMany.mockResolvedValue([
        {
          id: SVC_UUID,
          nameAr: 'قص شعر',
          nameEn: 'Haircut',
          price: 50,
          duration: 30,
          isActive: true,
        },
      ]);

      mockTenantDb.client.findFirst.mockResolvedValue(null);
      mockTenantDb.client.create.mockResolvedValue({
        id: 'client-uuid',
        fullName: 'سارة محمد',
        phone: '+966512345678',
        source: 'online',
      });

      mockTenantDb.employee.findFirst.mockResolvedValue({
        id: 'emp-uuid',
        fullName: 'فاطمة',
      });

      mockTenantDb.appointment.create.mockResolvedValue({
        id: 'appointment-uuid',
        clientId: 'client-uuid',
        employeeId: 'emp-uuid',
        date: new Date('2026-04-15'),
        startTime: '14:30',
        endTime: '15:00',
        status: 'pending',
        source: 'online',
        totalPrice: 50,
        totalDuration: 30,
        client: { id: 'client-uuid', fullName: 'سارة محمد', phone: '+966512345678' },
        employee: { id: 'emp-uuid', fullName: 'فاطمة' },
        appointmentServices: [],
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/booking/beauty-salon/book')
        .send(validBooking)
        .expect(201);

      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('status', 'pending');
    });

    it('should reject booking with missing required fields', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/booking/beauty-salon/book')
        .send({})
        .expect(400);
    });

    it('should reject booking with invalid phone format', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/booking/beauty-salon/book')
        .send({ ...validBooking, clientPhone: 'not-a-phone' })
        .expect(400);
    });

    it('should reject booking with invalid time format', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/booking/beauty-salon/book')
        .send({ ...validBooking, startTime: '25:99' })
        .expect(400);
    });

    it('should return 404 for non-existent salon', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/api/v1/booking/non-existent/book')
        .send(validBooking)
        .expect(404);
    });
  });

  describe('Full booking flow (integration-style)', () => {
    it('should complete full booking flow: get salon → get services → get employees → get slots → book', async () => {
      const slug = 'beauty-salon';
      const svcId = '11111111-1111-4111-8111-111111111111';
      const empId = '22222222-2222-4222-8222-222222222222';

      mockPrisma.tenant.findUnique.mockResolvedValue(ACTIVE_TENANT);
      mockTenantDb.salonInfo.findFirst.mockResolvedValue({
        id: 'info-uuid',
        nameAr: 'صالون الجمال',
        phone: '0512345678',
        address: 'الرياض',
        slotDuration: 30,
        bufferTime: 10,
      });
      mockTenantDb.serviceCategory.findMany.mockResolvedValue([
        {
          id: 'cat-uuid',
          nameAr: 'شعر',
          nameEn: 'Hair',
          isActive: true,
          sortOrder: 1,
          services: [
            {
              id: svcId,
              nameAr: 'قص شعر',
              nameEn: 'Haircut',
              price: { toNumber: () => 50 },
              duration: 30,
              isActive: true,
              sortOrder: 1,
            },
          ],
        },
      ]);
      mockTenantDb.service.findMany.mockResolvedValue([
        {
          id: svcId,
          nameAr: 'قص شعر',
          nameEn: 'Haircut',
          price: 50,
          duration: 30,
          isActive: true,
        },
      ]);
      mockTenantDb.employee.findMany
        .mockResolvedValueOnce([
          {
            id: empId,
            fullName: 'فاطمة',
            role: 'stylist',
            avatarUrl: null,
            isActive: true,
            employeeServices: [
              { service: { id: svcId, nameAr: 'قص شعر', nameEn: 'Haircut' } },
            ],
          },
        ])
        .mockResolvedValueOnce([
          {
            id: empId,
            employeeSchedules: [
              {
                dayOfWeek: 1,
                startTime: '09:00',
                endTime: '18:00',
                isDayOff: false,
              },
            ],
            employeeBreaks: [],
          },
        ]);
      mockTenantDb.appointment.findMany.mockResolvedValue([]);
      mockTenantDb.attendance.findMany.mockResolvedValue([
        { employeeId: empId, checkIn: '09:00', checkOut: null, isOnBreak: false },
      ]);
      mockTenantDb.client.findFirst.mockResolvedValue(null);
      mockTenantDb.client.create.mockResolvedValue({
        id: 'client-uuid',
        fullName: 'سارة محمد',
        phone: '+966512345678',
        source: 'online',
      });
      mockTenantDb.employee.findFirst.mockResolvedValue({
        id: empId,
        fullName: 'فاطمة',
      });
      mockTenantDb.appointment.create.mockResolvedValue({
        id: 'appointment-uuid',
        clientId: 'client-uuid',
        employeeId: empId,
        date: new Date('2026-04-20'),
        startTime: '10:00',
        endTime: '10:30',
        status: 'pending',
        source: 'online',
        totalPrice: 50,
        totalDuration: 30,
        client: { id: 'client-uuid', fullName: 'سارة محمد', phone: '+966512345678' },
        employee: { id: empId, fullName: 'فاطمة' },
        appointmentServices: [],
      });

      const server = app.getHttpServer();

      const salonRes = await request(server)
        .get(`/api/v1/booking/${slug}`)
        .expect(200);
      expect(salonRes.body.data).toHaveProperty('slug', slug);

      const servicesRes = await request(server)
        .get(`/api/v1/booking/${slug}/services`)
        .expect(200);
      expect(Array.isArray(servicesRes.body.data)).toBe(true);
      expect(servicesRes.body.data.length).toBeGreaterThan(0);

      const employeesRes = await request(server)
        .get(`/api/v1/booking/${slug}/employees`)
        .expect(200);
      expect(Array.isArray(employeesRes.body.data)).toBe(true);
      expect(employeesRes.body.data.length).toBeGreaterThan(0);

      const slotsRes = await request(server)
        .get(`/api/v1/booking/${slug}/slots`)
        .query({ date: '2026-04-20', serviceIds: [svcId] })
        .expect(200);
      const slots = Array.isArray(slotsRes.body) ? slotsRes.body : slotsRes.body?.data ?? [];
      expect(Array.isArray(slots)).toBe(true);

      const bookRes = await request(server)
        .post(`/api/v1/booking/${slug}/book`)
        .send({
          clientName: 'سارة محمد',
          clientPhone: '+966512345678',
          serviceIds: [svcId],
          date: '2026-04-20',
          startTime: slots.length > 0 ? slots[0] : '10:00',
        })
        .expect(201);
      expect(bookRes.body.data).toHaveProperty('status', 'pending');
      expect(bookRes.body.data).toHaveProperty('id');
    });
  });
});
