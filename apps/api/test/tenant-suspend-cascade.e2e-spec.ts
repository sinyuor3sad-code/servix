import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { assertActiveTenantUser } from '../src/shared/auth/tenant-user.helper';
import { PlatformPrismaClient } from '../src/shared/database/platform.client';

/**
 * V-14b — Tenant suspend cascade.
 *
 * Two surfaces under test:
 *   1. assertActiveTenantUser now requires BOTH tenantUser.status='active'
 *      AND tenant.status='active' (V-14b extension).
 *   2. admin.service.updateTenantStatus on suspend cascades to
 *      setPasswordChangedAt per member + disconnectTenantClients +
 *      invalidateTenant. Tested via spies, not a live socket — the
 *      live transport is covered by V-01's smoke harness.
 *
 * Unsuspend (status='active') intentionally does NOT clear
 * pwChangedAt; that's asserted as a negative test.
 */

const TENANT_ID = 'aaaaaaaa-1111-1111-1111-111111111111';
const USER_ID = 'bbbbbbbb-2222-2222-2222-222222222222';
const ADMIN_ID = 'cccccccc-3333-3333-3333-333333333333';

// ─────────────────────────────────────────────────────────────────────
// Section A — helper level (assertActiveTenantUser)
// ─────────────────────────────────────────────────────────────────────
describe('V-14b — assertActiveTenantUser tenant.status gate', () => {
  it('accepts an active TU in an active tenant', async () => {
    const prisma = {
      tenantUser: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tu',
          tenantId: TENANT_ID,
          userId: USER_ID,
          status: 'active',
          tenant: { status: 'active' },
        }),
      },
    } as unknown as PlatformPrismaClient;

    const result = await assertActiveTenantUser(prisma, TENANT_ID, USER_ID);
    expect(result.userId).toBe(USER_ID);
    // The joined tenant must NOT leak through the return type.
    expect((result as any).tenant).toBeUndefined();
  });

  it('rejects when tenant.status=suspended (the V-14b gap that was open before this card)', async () => {
    const prisma = {
      tenantUser: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tu',
          tenantId: TENANT_ID,
          userId: USER_ID,
          status: 'active',
          tenant: { status: 'suspended' },
        }),
      },
    } as unknown as PlatformPrismaClient;

    await expect(
      assertActiveTenantUser(prisma, TENANT_ID, USER_ID),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      assertActiveTenantUser(prisma, TENANT_ID, USER_ID),
    ).rejects.toThrow('حساب الصالون غير مفعّل');
  });

  it('rejects when tenant.status=cancelled', async () => {
    const prisma = {
      tenantUser: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tu',
          status: 'active',
          tenant: { status: 'cancelled' },
        }),
      },
    } as unknown as PlatformPrismaClient;

    await expect(
      assertActiveTenantUser(prisma, TENANT_ID, USER_ID),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects when tenantUser.status=inactive even if tenant is active (pre-existing behaviour preserved)', async () => {
    const prisma = {
      tenantUser: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tu',
          status: 'inactive',
          tenant: { status: 'active' },
        }),
      },
    } as unknown as PlatformPrismaClient;

    await expect(
      assertActiveTenantUser(prisma, TENANT_ID, USER_ID),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects when the TenantUser row does not exist', async () => {
    const prisma = {
      tenantUser: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PlatformPrismaClient;

    await expect(
      assertActiveTenantUser(prisma, TENANT_ID, USER_ID),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Section B — service level (admin.updateTenantStatus cascade)
//
// We construct the AdminService directly with mocked deps rather than
// booting the full Nest app (consistent with V-14a's pattern). The
// service under test is the same instance prod will run.
// ─────────────────────────────────────────────────────────────────────
describe('V-14b — admin.updateTenantStatus cascade', () => {
  let service: any;
  let prismaMock: any;
  let cacheMock: any;
  let gatewayMock: any;

  const makeService = () => {
    // We import lazily so the helper-level describe block can stay
    // independent if it ever needs to mock module-load order.
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
      tenant: {
        findUnique: jest.fn().mockResolvedValue({
          id: TENANT_ID,
          status: 'active',
        }),
      },
      tenantUser: {
        findMany: jest.fn().mockResolvedValue([
          { userId: 'u1' },
          { userId: 'u2' },
          { userId: 'u3' },
        ]),
      },
      $transaction: jest.fn().mockImplementation(async (ops: any[]) => {
        // Mimic prisma's behaviour: return the resolved values of each op.
        return Promise.all(ops);
      }),
      platformAuditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    // Wire the prisma tenant.update + audit create through $transaction
    prismaMock.tenant.update = jest
      .fn()
      .mockResolvedValue({ id: TENANT_ID, status: 'suspended' });

    cacheMock = {
      setPasswordChangedAt: jest.fn().mockResolvedValue(undefined),
      invalidateTenant: jest.fn().mockResolvedValue(undefined),
    };
    gatewayMock = {
      disconnectTenantClients: jest.fn(),
    };

    service = makeService();
  });

  it('on suspend: fans out setPasswordChangedAt per member, disconnects WS, invalidates cache', async () => {
    await service.updateTenantStatus(TENANT_ID, 'suspended', ADMIN_ID);

    expect(prismaMock.tenantUser.findMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT_ID },
      select: { userId: true },
    });

    expect(cacheMock.setPasswordChangedAt).toHaveBeenCalledTimes(3);
    expect(cacheMock.setPasswordChangedAt).toHaveBeenCalledWith('u1');
    expect(cacheMock.setPasswordChangedAt).toHaveBeenCalledWith('u2');
    expect(cacheMock.setPasswordChangedAt).toHaveBeenCalledWith('u3');

    expect(gatewayMock.disconnectTenantClients).toHaveBeenCalledWith(TENANT_ID);

    expect(cacheMock.invalidateTenant).toHaveBeenCalledWith(TENANT_ID);
  });

  it('on suspend: audit row includes affectedUserCount', async () => {
    await service.updateTenantStatus(TENANT_ID, 'suspended', ADMIN_ID);

    // $transaction was called with [tenant.update, platformAuditLog.create]
    const txOps = prismaMock.$transaction.mock.calls[0][0];
    expect(txOps).toHaveLength(2);
    // The audit row creation call is the 2nd op.
    // We inspect what was passed to platformAuditLog.create directly.
    expect(prismaMock.platformAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'update_status',
          newValues: { status: 'suspended', affectedUserCount: 3 },
        }),
      }),
    );
  });

  it('on unsuspend (active): does NOT call setPasswordChangedAt or disconnect WS', async () => {
    prismaMock.tenant.findUnique.mockResolvedValueOnce({
      id: TENANT_ID,
      status: 'suspended',
    });
    prismaMock.tenant.update.mockResolvedValueOnce({
      id: TENANT_ID,
      status: 'active',
    });

    await service.updateTenantStatus(TENANT_ID, 'active', ADMIN_ID);

    expect(cacheMock.setPasswordChangedAt).not.toHaveBeenCalled();
    expect(gatewayMock.disconnectTenantClients).not.toHaveBeenCalled();
    // Cache invalidation still runs so other api instances see the new status.
    expect(cacheMock.invalidateTenant).toHaveBeenCalledWith(TENANT_ID);
  });

  it('on unsuspend: audit row omits affectedUserCount', async () => {
    prismaMock.tenant.findUnique.mockResolvedValueOnce({
      id: TENANT_ID,
      status: 'suspended',
    });
    prismaMock.tenant.update.mockResolvedValueOnce({
      id: TENANT_ID,
      status: 'active',
    });

    await service.updateTenantStatus(TENANT_ID, 'active', ADMIN_ID);

    expect(prismaMock.platformAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          newValues: { status: 'active' },
        }),
      }),
    );
  });

  it('on suspend of empty-tenant: no setPasswordChangedAt calls but WS disconnect + invalidate still run', async () => {
    prismaMock.tenantUser.findMany.mockResolvedValueOnce([]);

    await service.updateTenantStatus(TENANT_ID, 'suspended', ADMIN_ID);

    expect(cacheMock.setPasswordChangedAt).not.toHaveBeenCalled();
    expect(gatewayMock.disconnectTenantClients).toHaveBeenCalledWith(TENANT_ID);
    expect(cacheMock.invalidateTenant).toHaveBeenCalledWith(TENANT_ID);
    expect(prismaMock.platformAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          newValues: { status: 'suspended', affectedUserCount: 0 },
        }),
      }),
    );
  });
});
