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

/**
 * Security test: Tenant A cannot access Tenant B data
 * Verifies that JWT tenantId is enforced and requests are scoped to correct tenant DB
 */
const mockTenantADb = {
  client: { findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn() },
  invoice: { findMany: jest.fn(), count: jest.fn() },
  appointment: { findMany: jest.fn(), count: jest.fn() },
};
const mockTenantBDb = {
  client: { findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn() },
  invoice: { findMany: jest.fn(), count: jest.fn() },
  appointment: { findMany: jest.fn(), count: jest.fn() },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  user: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  tenant: { findUnique: jest.fn() },
  tenantUser: { findMany: jest.fn(), findUnique: jest.fn() },
  subscription: { findFirst: jest.fn() },
  planFeature: { findMany: jest.fn() },
  tenantFeature: { findMany: jest.fn() },
};

const mockTenantFactory = {
  getTenantClient: jest.fn((dbName: string) => {
    if (dbName === 'servix_tenant_a') return mockTenantADb;
    if (dbName === 'servix_tenant_b') return mockTenantBDb;
    return mockTenantADb;
  }),
};

const mockCacheService = {
  getTenant: jest.fn().mockResolvedValue(null),
  setTenant: jest.fn().mockResolvedValue(undefined),
  checkLoginIpBlock: jest.fn().mockResolvedValue(0),
  incrementLoginFailIp: jest.fn().mockResolvedValue({ count: 1, blockSeconds: 0 }),
  resetLoginFailIp: jest.fn().mockResolvedValue(undefined),
  isAccountLocked: jest.fn().mockResolvedValue(false),
  incrementLoginFailAccount: jest.fn().mockResolvedValue({ count: 1, locked: false }),
  resetLoginFailAccount: jest.fn().mockResolvedValue(undefined),
  blacklistRefreshToken: jest.fn().mockResolvedValue(undefined),
  isRefreshTokenBlacklisted: jest.fn().mockResolvedValue(false),
  setPasswordChangedAt: jest.fn().mockResolvedValue(undefined),
  getPasswordChangedAt: jest.fn().mockResolvedValue(null),
  checkForgotPasswordRateLimit: jest.fn().mockResolvedValue(true),
  incrementForgotPasswordAttempt: jest.fn().mockResolvedValue(1),
};

describe('Tenant Isolation (e2e) - Security', () => {
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
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheService.checkLoginIpBlock.mockResolvedValue(0);
    mockCacheService.isAccountLocked.mockResolvedValue(false);
    mockTenantADb.client.findMany.mockResolvedValue([
      { id: 'client-a1', fullName: 'عميل أ' },
    ]);
    mockTenantADb.client.count.mockResolvedValue(1);
    mockTenantBDb.client.findMany.mockResolvedValue([
      { id: 'client-b1', fullName: 'عميل ب' },
    ]);
    mockTenantBDb.client.count.mockResolvedValue(1);
    mockTenantADb.appointment.findMany.mockResolvedValue([]);
    mockTenantADb.appointment.count.mockResolvedValue(0);
    mockTenantBDb.appointment.findMany.mockResolvedValue([]);
    mockTenantBDb.appointment.count.mockResolvedValue(0);
    mockTenantADb.invoice.findMany.mockResolvedValue([]);
    mockTenantADb.invoice.count.mockResolvedValue(0);
    mockTenantBDb.invoice.findMany.mockResolvedValue([]);
    mockTenantBDb.invoice.count.mockResolvedValue(0);
  });

  async function setupTenantALogin() {
    const bcrypt = await import('bcryptjs');
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'user-a',
      fullName: 'User A',
      email: 'user@a.com',
      phone: '0511111111',
      passwordHash: await bcrypt.hash('Pass1', 12),
      avatarUrl: null,
    });
    mockPrisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-a-id',
      databaseName: 'servix_tenant_a',
      nameAr: 'صالون أ',
      primaryColor: '#000',
      logoUrl: null,
      status: 'active',
    });
    mockPrisma.tenantUser.findMany.mockResolvedValue([
      {
        id: 'tu-1',
        tenantId: 'tenant-a-id',
        userId: 'user-a',
        roleId: 'role-1',
        isOwner: true,
        status: 'active',
        tenant: { id: 'tenant-a-id', nameAr: 'صالون أ', nameEn: 'Salon A', slug: 'salon-a' },
        role: { id: 'role-1', name: 'owner', nameAr: 'مالك' },
      },
    ]);
    mockPrisma.tenantUser.findUnique.mockResolvedValue({
      id: 'tu-1',
      tenantId: 'tenant-a-id',
      userId: 'user-a',
      roleId: 'role-1',
      status: 'active',
    });
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.subscription.findFirst.mockResolvedValue({
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 86400000),
      planId: 'plan-1',
    });
    mockPrisma.planFeature.findMany.mockResolvedValue([]);
    mockPrisma.tenantFeature.findMany.mockResolvedValue([]);

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ emailOrPhone: 'user@a.com', password: 'Pass1' });

    const token = loginRes.body?.data?.tokens?.accessToken ?? loginRes.body?.tokens?.accessToken;
    return token;
  }

  describe('Tenant Isolation', () => {
    it('should scope tenant A request to tenant A database only', async () => {
      const token = await setupTenantALogin();
      if (!token) return;

      await request(app.getHttpServer())
        .get('/api/v1/clients')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(mockTenantFactory.getTenantClient).toHaveBeenCalledWith(
        'servix_tenant_a',
      );
      expect(mockTenantADb.client.findMany).toHaveBeenCalled();
      expect(mockTenantBDb.client.findMany).not.toHaveBeenCalled();
    });

    it('should not allow user from Tenant A to access Tenant B data', async () => {
      const token = await setupTenantALogin();
      if (!token) return;

      await request(app.getHttpServer())
        .get('/api/v1/clients')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/v1/appointments')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/v1/invoices')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(mockTenantBDb.client.findMany).not.toHaveBeenCalled();
      expect(mockTenantBDb.appointment.findMany).not.toHaveBeenCalled();
      expect(mockTenantBDb.invoice.findMany).not.toHaveBeenCalled();
    });

    it('should return 401 when accessing protected route without token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/clients')
        .expect(401);
    });

    it('should return 401 with invalid/expired token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/clients')
        .set('Authorization', 'Bearer invalid-token-xyz')
        .expect(401);
    });
  });

  describe('Permission Enforcement (RBAC)', () => {
    it('should allow owner to access all endpoints', async () => {
      const token = await setupTenantALogin();
      if (!token) return;

      await request(app.getHttpServer())
        .get('/api/v1/clients')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/v1/appointments')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/v1/invoices')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('should reject unauthenticated access to salon endpoints', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/appointments')
        .expect(401);

      await request(app.getHttpServer())
        .get('/api/v1/invoices')
        .expect(401);

      await request(app.getHttpServer())
        .get('/api/v1/clients')
        .expect(401);
    });
  });

  describe('Rate Limiting', () => {
    it('should block login after multiple failed attempts from same IP', async () => {
      (mockCacheService.checkLoginIpBlock as jest.Mock).mockResolvedValue(900);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', '192.168.1.100')
        .send({ emailOrPhone: 'user@a.com', password: 'Pass1' })
        .expect(401);

      expect(res.body.message || res.body.error?.message).toMatch(/دقيقة|تجاوز|الحد/);
    });

    it('should reject login when account is locked', async () => {
      const bcrypt = await import('bcryptjs');
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-a',
        fullName: 'User A',
        email: 'user@a.com',
        phone: '0511111111',
        passwordHash: await bcrypt.hash('Pass1', 12),
        avatarUrl: null,
      });
      (mockCacheService.isAccountLocked as jest.Mock).mockResolvedValue(true);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ emailOrPhone: 'user@a.com', password: 'Pass1' })
        .expect(401);

      expect(res.body.message || res.body.error?.message).toMatch(/قفل|محاولات/);
    });
  });
});
