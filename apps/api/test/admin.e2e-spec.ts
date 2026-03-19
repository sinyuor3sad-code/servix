import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { PlatformPrismaClient } from '../src/shared/database/platform.client';
import { TenantClientFactory } from '../src/shared/database/tenant-client.factory';

const mockPrisma: Record<string, unknown> = {
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
    update: jest.fn(),
  },
  tenantUser: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  role: {
    findUnique: jest.fn(),
  },
  subscription: {
    count: jest.fn(),
    groupBy: jest.fn(),
    findMany: jest.fn(),
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
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  onModuleDestroy: jest.fn(),
};
(mockPrisma.$transaction as jest.Mock).mockImplementation(
  (fn: unknown) => typeof fn === 'function' ? (fn as (tx: unknown) => unknown)(mockPrisma) : Promise.all(fn as Promise<unknown>[]),
);

const mockTenantFactory = {
  getTenantClient: jest.fn().mockReturnValue({}),
};

function createToken(
  jwtService: JwtService,
  payload: { sub: string; email: string; tenantId: string; roleId: string },
): string {
  return jwtService.sign(payload, {
    secret: process.env.JWT_ACCESS_SECRET || 'test-access-secret',
    expiresIn: '15m',
  });
}

describe('Admin (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let adminToken: string;
  let regularToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PlatformPrismaClient)
      .useValue(mockPrisma)
      .overrideProvider(TenantClientFactory)
      .useValue(mockTenantFactory)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);

    adminToken = createToken(jwtService, {
      sub: 'admin-user-id',
      email: 'admin@servix.sa',
      tenantId: 'platform-tenant-id',
      roleId: 'super-admin-role-id',
    });

    regularToken = createToken(jwtService, {
      sub: 'regular-user-id',
      email: 'user@salon.com',
      tenantId: 'tenant-id',
      roleId: 'owner-role-id',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/admin/stats', () => {
    it('should return platform stats for super_admin', async () => {
      mockPrisma.role.findUnique.mockResolvedValue({
        id: 'super-admin-role-id',
        name: 'super_admin',
        nameAr: 'مدير المنصة',
      });

      mockPrisma.tenant.count
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(45)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(5);
      mockPrisma.user.count.mockResolvedValue(200);
      mockPrisma.subscription.count
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(42);
      mockPrisma.platformInvoice.aggregate
        .mockResolvedValueOnce({ _sum: { total: 150000 } })
        .mockResolvedValueOnce({ _sum: { total: 25000 } });
      mockPrisma.subscription.groupBy.mockResolvedValue([
        { planId: 'plan-1', _count: { id: 20 } },
        { planId: 'plan-2', _count: { id: 15 } },
      ]);
      mockPrisma.plan.findMany.mockResolvedValue([
        { id: 'plan-1', name: 'Basic', nameAr: 'أساسي' },
        { id: 'plan-2', name: 'Pro', nameAr: 'احترافي' },
      ]);

      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('totalTenants');
      expect(res.body.data).toHaveProperty('activeTenants');
      expect(res.body.data).toHaveProperty('totalUsers');
    });

    it('should reject request without token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/stats')
        .expect(401);
    });

    it('should reject non-admin user', async () => {
      mockPrisma.role.findUnique.mockResolvedValue({
        id: 'owner-role-id',
        name: 'owner',
        nameAr: 'مالك',
      });

      await request(app.getHttpServer())
        .get('/api/v1/admin/stats')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(403);
    });
  });

  describe('GET /api/v1/admin/tenants', () => {
    it('should return paginated tenants for super_admin', async () => {
      mockPrisma.role.findUnique.mockResolvedValue({
        id: 'super-admin-role-id',
        name: 'super_admin',
        nameAr: 'مدير المنصة',
      });

      mockPrisma.tenant.findMany.mockResolvedValue([
        {
          id: 'tenant-1',
          nameAr: 'صالون 1',
          nameEn: 'Salon 1',
          slug: 'salon-1',
          status: 'active',
          subscriptions: [],
        },
      ]);
      mockPrisma.tenant.count.mockResolvedValue(1);

      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/tenants')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('meta');
      expect(res.body.data.meta).toHaveProperty('total');
    });

    it('should reject unauthorized access for non-admin', async () => {
      mockPrisma.role.findUnique.mockResolvedValue({
        id: 'owner-role-id',
        name: 'owner',
        nameAr: 'مالك',
      });

      await request(app.getHttpServer())
        .get('/api/v1/admin/tenants')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(403);
    });

    it('should reject request with no token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/tenants')
        .expect(401);
    });
  });
});
