import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from '../src/core/auth/strategies/jwt.strategy';
import { CacheService } from '../src/shared/cache/cache.service';

/**
 * V-14c — role-change session invalidation.
 *
 * Two surfaces under test:
 *   1. admin.service.changeUserRole now cascades:
 *      DB tx → setPasswordChangedAt(userId) → disconnectUserClients(userId).
 *      Tested via spies, same pattern as V-14a/V-14b.
 *   2. The JwtStrategy revocation gate (already shipped in V-14a) closes
 *      the privilege-downgrade window: a stale JWT carrying the old
 *      roleId fails iat < pwChangedAt and is rejected before the
 *      RolesGuard ever reads payload.roleId.
 *
 * No new HTTP transport assertion — V-01/V-14a already cover the
 * JwtStrategy.validate path with the same primitive.
 */

const JWT_SECRET = 'v14c-test-jwt-secret-that-is-at-least-32-chars';
const USER_ID = 'aaaaaaaa-1111-1111-1111-111111111111';
const TENANT_A = 'bbbbbbbb-2222-2222-2222-222222222222';
const TENANT_B = 'cccccccc-3333-3333-3333-333333333333';
const ADMIN_ID = 'dddddddd-4444-4444-4444-444444444444';
const OLD_ROLE_ID = 'eeeeeeee-5555-5555-5555-555555555555';
const NEW_ROLE_ID = 'ffffffff-6666-6666-6666-666666666666';

// ─────────────────────────────────────────────────────────────────────
// Section A — service level (admin.changeUserRole cascade)
// ─────────────────────────────────────────────────────────────────────
describe('V-14c — admin.changeUserRole cascade', () => {
  let service: any;
  let prismaMock: any;
  let cacheMock: any;
  let gatewayMock: any;

  const makeService = () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AdminService } = require('../src/core/admin/admin.service');
    return new AdminService(
      prismaMock,
      {} /* jwt */,
      {} /* config */,
      {} /* platformSettings */,
      cacheMock,
      gatewayMock,
    );
  };

  beforeEach(() => {
    prismaMock = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: USER_ID,
          tenantUsers: [
            {
              id: 'tu-a',
              tenantId: TENANT_A,
              roleId: OLD_ROLE_ID,
              role: { name: 'manager' },
            },
            {
              id: 'tu-b',
              tenantId: TENANT_B,
              roleId: OLD_ROLE_ID,
              role: { name: 'manager' },
            },
          ],
        }),
      },
      role: {
        findUnique: jest.fn().mockResolvedValue({
          id: NEW_ROLE_ID,
          name: 'staff',
          nameAr: 'موظف',
        }),
      },
      tenantUser: { update: jest.fn().mockResolvedValue({}) },
      platformAuditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn().mockImplementation(async (ops: any[]) => {
        return Promise.all(ops);
      }),
    };

    cacheMock = {
      setPasswordChangedAt: jest.fn().mockResolvedValue(undefined),
    };
    gatewayMock = {
      disconnectUserClients: jest.fn(),
    };

    service = makeService();
  });

  it('cascades setPasswordChangedAt + disconnectUserClients on role change', async () => {
    await service.changeUserRole(USER_ID, NEW_ROLE_ID, TENANT_A, ADMIN_ID);

    expect(cacheMock.setPasswordChangedAt).toHaveBeenCalledTimes(1);
    expect(cacheMock.setPasswordChangedAt).toHaveBeenCalledWith(USER_ID);

    expect(gatewayMock.disconnectUserClients).toHaveBeenCalledTimes(1);
    expect(gatewayMock.disconnectUserClients).toHaveBeenCalledWith(USER_ID);
  });

  it('enriches the audit row with oldRoleId and sessionsRevoked=true', async () => {
    await service.changeUserRole(USER_ID, NEW_ROLE_ID, TENANT_A, ADMIN_ID);

    expect(prismaMock.platformAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'admin_change_role',
          entityType: 'user',
          entityId: USER_ID,
          oldValues: expect.objectContaining({
            role: 'manager',
            roleId: OLD_ROLE_ID,
            tenantId: TENANT_A,
          }),
          newValues: expect.objectContaining({
            role: 'staff',
            roleId: NEW_ROLE_ID,
            sessionsRevoked: true,
          }),
        }),
      }),
    );
  });

  it('multi-tenant: changing role on tenant B still revokes the user-level session', async () => {
    // User is JWT-pinned to tenant A (irrelevant at the cache layer —
    // pwChangedAt is per-user, not per-tenant). Changing role on
    // tenant B should still invalidate every JWT for this user.
    await service.changeUserRole(USER_ID, NEW_ROLE_ID, TENANT_B, ADMIN_ID);

    expect(cacheMock.setPasswordChangedAt).toHaveBeenCalledWith(USER_ID);
    expect(gatewayMock.disconnectUserClients).toHaveBeenCalledWith(USER_ID);
    // Audit row references the targeted TU's tenant, not whatever the
    // user's current JWT pins them to.
    expect(prismaMock.platformAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          oldValues: expect.objectContaining({ tenantId: TENANT_B }),
        }),
      }),
    );
  });

  it('no-op edge: changing to the same roleId still cascades (defensive)', async () => {
    // Pre-V-14c the existing service had no early-out, so this same
    // call already executed the tx. V-14c keeps the cascade firing in
    // the no-op case — fresh JWT issuance is desirable even when the
    // role itself didn't change.
    prismaMock.role.findUnique.mockResolvedValueOnce({
      id: OLD_ROLE_ID,
      name: 'manager',
      nameAr: 'مدير',
    });

    await service.changeUserRole(USER_ID, OLD_ROLE_ID, TENANT_A, ADMIN_ID);

    expect(cacheMock.setPasswordChangedAt).toHaveBeenCalledWith(USER_ID);
    expect(gatewayMock.disconnectUserClients).toHaveBeenCalledWith(USER_ID);
  });

  it('falls back to user.tenantUsers[0] when tenantId is omitted', async () => {
    await service.changeUserRole(USER_ID, NEW_ROLE_ID, undefined, ADMIN_ID);

    // Default TU is tu-a (tenant A).
    expect(prismaMock.tenantUser.update).toHaveBeenCalledWith({
      where: { id: 'tu-a' },
      data: { roleId: NEW_ROLE_ID },
    });
    expect(cacheMock.setPasswordChangedAt).toHaveBeenCalledWith(USER_ID);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Section B — privilege downgrade is enforced via JwtStrategy
//
// The JwtStrategy.validate revocation gate (V-14a) is what actually
// closes the V-14c window: even though the JWT still says roleId =
// <super_admin>, the gate rejects the token because iat < pwChangedAt.
// RolesGuard never sees the stale roleId.
// ─────────────────────────────────────────────────────────────────────
describe('V-14c — privilege downgrade enforcement via JwtStrategy', () => {
  const mockCacheService = {
    getPasswordChangedAt: jest.fn().mockResolvedValue(null),
    setPasswordChangedAt: jest.fn().mockResolvedValue(undefined),
  };

  async function buildStrategy(): Promise<JwtStrategy> {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          load: [() => ({ jwt: { accessSecret: JWT_SECRET } })],
        }),
        PassportModule,
      ],
      providers: [
        JwtStrategy,
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();
    return module.get(JwtStrategy);
  }

  let strategy: JwtStrategy;
  let jwt: JwtService;

  beforeEach(async () => {
    mockCacheService.getPasswordChangedAt.mockReset().mockResolvedValue(null);
    strategy = await buildStrategy();
    const m: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: JWT_SECRET })],
    }).compile();
    jwt = m.get(JwtService);
  });

  it('rejects a stale super_admin JWT after the user was demoted to staff', async () => {
    // Token issued at T0 with roleId = SUPER_ADMIN (snapshot of state then).
    const token = jwt.sign(
      {
        sub: USER_ID,
        email: 'demoted@example.com',
        tenantId: TENANT_A,
        roleId: 'super-admin-role-id',
      },
      { secret: JWT_SECRET, expiresIn: '15m' },
    );
    const decoded = jwt.decode(token) as { iat: number };

    // Admin demotes the user at T0+5min — V-14c writes pwChangedAt.
    mockCacheService.getPasswordChangedAt.mockResolvedValueOnce(
      (decoded.iat + 5 * 60) * 1000,
    );

    // Same stale JWT, replayed against any HTTP endpoint:
    await expect(
      strategy.validate({
        sub: USER_ID,
        email: 'demoted@example.com',
        tenantId: TENANT_A,
        roleId: 'super-admin-role-id',
        iat: decoded.iat,
      } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    // The user must re-log in. Their new JWT will carry the new roleId
    // (staff) sourced fresh from firstTenantUser at login time —
    // RolesGuard then correctly blocks admin actions.
  });
});
