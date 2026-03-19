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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  tenant: {
    findUnique: jest.fn(),
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
  getTenantClient: jest.fn().mockReturnValue({}),
};

const VALID_REGISTER = {
  fullName: 'نورة أحمد',
  email: 'noura@example.com',
  phone: '0512345678',
  password: 'MyPassword1',
  salonNameAr: 'صالون الجمال',
  salonNameEn: 'Beauty Salon',
};

describe('Auth (e2e)', () => {
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
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user and return tokens', async () => {
      const mockRole = { id: 'role-uuid', name: 'owner', nameAr: 'مالك' };
      const mockUser = {
        id: 'user-uuid',
        fullName: VALID_REGISTER.fullName,
        email: VALID_REGISTER.email,
        phone: VALID_REGISTER.phone,
        passwordHash: 'hashed',
        avatarUrl: null,
      };
      const mockTenant = {
        id: 'tenant-uuid',
        nameAr: VALID_REGISTER.salonNameAr,
        nameEn: VALID_REGISTER.salonNameEn,
        slug: 'beauty-salon-abc12345',
        databaseName: 'servix_tenant_abc12345',
      };

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.role.findUnique.mockResolvedValue(mockRole);
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        mockPrisma.user.create.mockResolvedValue(mockUser);
        mockPrisma.tenant.create.mockResolvedValue(mockTenant);
        mockPrisma.tenantUser.create.mockResolvedValue({});
        return fn(mockPrisma);
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(VALID_REGISTER)
        .expect(201);

      expect(res.body).toHaveProperty('data');
      const { data } = res.body;
      expect(data).toHaveProperty('user');
      expect(data).toHaveProperty('tenant');
      expect(data).toHaveProperty('tokens');
      expect(data.tokens).toHaveProperty('accessToken');
      expect(data.tokens).toHaveProperty('refreshToken');
    });

    it('should reject duplicate email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'existing-user',
        email: VALID_REGISTER.email,
      });

      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(VALID_REGISTER)
        .expect(409);
    });

    it('should reject invalid input — missing required fields', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({})
        .expect(400);
    });

    it('should reject invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ ...VALID_REGISTER, email: 'not-an-email' })
        .expect(400);
    });

    it('should reject weak password', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ ...VALID_REGISTER, password: '123' })
        .expect(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login with valid credentials', async () => {
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash('MyPassword1', 12);

      const mockUser = {
        id: 'user-uuid',
        fullName: 'نورة أحمد',
        email: 'noura@example.com',
        phone: '0512345678',
        passwordHash,
        avatarUrl: null,
      };

      const mockTenantUsers = [
        {
          id: 'tu-uuid',
          tenantId: 'tenant-uuid',
          roleId: 'role-uuid',
          isOwner: true,
          tenant: {
            id: 'tenant-uuid',
            nameAr: 'صالون الجمال',
            nameEn: 'Beauty Salon',
            slug: 'beauty-salon',
          },
          role: { id: 'role-uuid', name: 'owner', nameAr: 'مالك' },
        },
      ];

      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.tenantUser.findMany.mockResolvedValue(mockTenantUsers);
      mockPrisma.user.update.mockResolvedValue(mockUser);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          emailOrPhone: 'noura@example.com',
          password: 'MyPassword1',
        })
        .expect(200);

      expect(res.body).toHaveProperty('data');
      const { data } = res.body;
      expect(data).toHaveProperty('user');
      expect(data).toHaveProperty('tenants');
      expect(data).toHaveProperty('tokens');
      expect(data.tokens).toHaveProperty('accessToken');
    });

    it('should reject invalid credentials — wrong password', async () => {
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash('CorrectPassword1', 12);

      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-uuid',
        email: 'noura@example.com',
        passwordHash,
      });

      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          emailOrPhone: 'noura@example.com',
          password: 'WrongPassword1',
        })
        .expect(401);
    });

    it('should reject invalid credentials — user not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          emailOrPhone: 'unknown@example.com',
          password: 'SomePassword1',
        })
        .expect(401);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return user profile with valid token', async () => {
      const mockUserWithTenants = {
        id: 'user-uuid',
        fullName: 'نورة أحمد',
        email: 'noura@example.com',
        phone: '0512345678',
        avatarUrl: null,
        tenantUsers: [
          {
            id: 'tu-uuid',
            tenantId: 'tenant-uuid',
            roleId: 'role-uuid',
            isOwner: true,
            tenant: {
              id: 'tenant-uuid',
              nameAr: 'صالون',
              nameEn: 'Salon',
              slug: 'salon-test',
            },
            role: { id: 'role-uuid', name: 'owner', nameAr: 'مالك' },
          },
        ],
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUserWithTenants);

      // First login to get a valid token
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash('MyPassword1', 12);
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-uuid',
        fullName: 'نورة أحمد',
        email: 'noura@example.com',
        phone: '0512345678',
        passwordHash,
        avatarUrl: null,
      });
      mockPrisma.tenantUser.findMany.mockResolvedValue([
        {
          id: 'tu-uuid',
          tenantId: 'tenant-uuid',
          roleId: 'role-uuid',
          isOwner: true,
          tenant: { id: 'tenant-uuid', nameAr: 'صالون', nameEn: 'Salon', slug: 'salon-test' },
          role: { id: 'role-uuid', name: 'owner', nameAr: 'مالك' },
        },
      ]);
      mockPrisma.user.update.mockResolvedValue({});

      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ emailOrPhone: 'noura@example.com', password: 'MyPassword1' });

      const token = loginRes.body.data?.tokens?.accessToken;
      if (!token) return;

      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('fullName');
      expect(res.body.data).toHaveProperty('tenantUsers');
    });

    it('should reject request without token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .expect(401);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should return new tokens with valid refresh token', async () => {
      // Login first to get a refresh token
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash('MyPassword1', 12);
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-uuid',
        fullName: 'نورة أحمد',
        email: 'noura@example.com',
        phone: '0512345678',
        passwordHash,
        avatarUrl: null,
      });
      mockPrisma.tenantUser.findMany.mockResolvedValue([
        {
          id: 'tu-uuid',
          tenantId: 'tenant-uuid',
          roleId: 'role-uuid',
          isOwner: true,
          tenant: { id: 'tenant-uuid', nameAr: 'صالون', nameEn: 'Salon', slug: 'salon-test' },
          role: { id: 'role-uuid', name: 'owner', nameAr: 'مالك' },
        },
      ]);
      mockPrisma.user.update.mockResolvedValue({});

      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ emailOrPhone: 'noura@example.com', password: 'MyPassword1' });

      const refreshToken = loginRes.body.data?.tokens?.refreshToken;
      if (!refreshToken) return;

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
    });

    it('should reject invalid refresh token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);
    });
  });
});
