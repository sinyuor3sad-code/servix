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

const mockTenantDb = {
  invoice: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  client: { findFirst: jest.fn(), update: jest.fn() },
  invoiceItem: { deleteMany: jest.fn(), createMany: jest.fn() },
  payment: { create: jest.fn() },
  $transaction: jest.fn(),
};

const ACTIVE_TENANT = {
  id: 'tenant-uuid',
  nameAr: 'صالون الجمال',
  nameEn: 'Beauty Salon',
  slug: 'beauty-salon',
  status: 'active',
  databaseName: 'servix_tenant_abc',
  primaryColor: '#e91e63',
  logoUrl: null,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  user: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  tenant: { findUnique: jest.fn() },
  tenantUser: { findMany: jest.fn() },
  subscription: { findFirst: jest.fn() },
  planFeature: { findMany: jest.fn() },
  tenantFeature: { findMany: jest.fn() },
  passwordReset: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  $transaction: jest.fn(),
};
(mockPrisma.$transaction as jest.Mock).mockImplementation((fn: unknown) =>
  typeof fn === 'function' ? (fn as (tx: unknown) => unknown)(mockPrisma) : Promise.all(fn as Promise<unknown>[]),
);

const mockTenantFactory = {
  getTenantClient: jest.fn().mockReturnValue(mockTenantDb),
};

const mockCacheService = {
  getTenant: jest.fn().mockResolvedValue(null),
  setTenant: jest.fn().mockResolvedValue(undefined),
  checkForgotPasswordRateLimit: jest.fn().mockResolvedValue(true),
  incrementForgotPasswordAttempt: jest.fn().mockResolvedValue(1),
};

describe('Invoice + Payment (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

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
    mockPrisma.tenant.findUnique.mockResolvedValue(ACTIVE_TENANT);
    mockPrisma.tenantUser.findMany.mockResolvedValue([
      {
        id: 'tu-1',
        tenantId: ACTIVE_TENANT.id,
        userId: 'user-1',
        roleId: 'role-1',
        isOwner: true,
        status: 'active',
      },
    ]);
    mockPrisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 86400000),
      planId: 'plan-1',
    });
    mockPrisma.planFeature.findMany.mockResolvedValue([]);
    mockPrisma.tenantFeature.findMany.mockResolvedValue([]);
  });

  const login = async (): Promise<string> => {
    const bcrypt = await import('bcryptjs');
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      fullName: 'نورة',
      email: 'noura@test.com',
      phone: '0512345678',
      passwordHash: await bcrypt.hash('Password1', 12),
      avatarUrl: null,
    });
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ emailOrPhone: 'noura@test.com', password: 'Password1' });
    const token = res.body?.data?.tokens?.accessToken || res.body?.accessToken;
    return token;
  };

  describe('Invoice flow', () => {
    it('should create invoice and record payment', async () => {
      accessToken = await login();
      if (!accessToken) return;

      mockTenantDb.client.findFirst.mockResolvedValue({
        id: 'client-1',
        fullName: 'سارة',
        phone: '0511111111',
      });
      mockTenantDb.invoice.findFirst.mockResolvedValue(null);
      mockTenantDb.invoice.create.mockResolvedValue({
        id: 'inv-1',
        invoiceNumber: 'INV-0001',
        clientId: 'client-1',
        subtotal: 100,
        taxAmount: 15,
        total: 115,
        status: 'draft',
      });
      mockTenantDb.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        invoiceNumber: 'INV-0001',
        total: 115,
        status: 'draft',
        payments: [],
      });
      mockTenantDb.payment.create.mockResolvedValue({
        id: 'pay-1',
        amount: 115,
        method: 'cash',
      });
      mockTenantDb.invoice.update.mockResolvedValue({
        id: 'inv-1',
        status: 'paid',
        paidAt: new Date(),
      });
      mockTenantDb.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
        fn(mockTenantDb),
      );

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          clientId: 'client-1',
          items: [
            { serviceId: 'svc-1', description: 'قص شعر', quantity: 1, unitPrice: 100, employeeId: 'emp-1' },
          ],
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body).toHaveProperty('data');

      const payRes = await request(app.getHttpServer())
        .post('/api/v1/invoices/inv-1/pay')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ amount: 115, method: 'cash' });

      expect(payRes.status).toBe(201);
    });
  });
});
