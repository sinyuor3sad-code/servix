import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PermissionGuard } from './permission.guard';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { PlatformPrismaClient } from '../database/platform.client';
import { CacheService } from '../cache/cache.service';

/**
 * V-123a — PermissionGuard decision matrix (unit). The global-wiring proof
 * (that this guard actually runs as an APP_GUARD without @UseGuards) lives in
 * test/rbac-permission-guard.e2e-spec.ts. Here we exercise canActivate's
 * branches directly against the real guard with mocked deps.
 */

const ROLE_ID = 'role-uuid-1';

function makeContext(
  user: { sub?: string; roleId?: string } | undefined,
): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user, path: '/api/v1/test' }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('PermissionGuard (V-123a)', () => {
  let guard: PermissionGuard;
  let reflector: Reflector;
  const roleFindUnique = jest.fn();
  const getJson = jest.fn();
  const setJson = jest.fn();

  beforeEach(async () => {
    roleFindUnique.mockReset();
    getJson.mockReset();
    setJson.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionGuard,
        Reflector,
        {
          provide: PlatformPrismaClient,
          useValue: { role: { findUnique: roleFindUnique } },
        },
        { provide: CacheService, useValue: { getJson, setJson } },
      ],
    }).compile();

    guard = module.get(PermissionGuard);
    reflector = module.get(Reflector);
  });

  /** Stub the Reflector to return `required` for PERMISSION_KEY only. */
  function stubRequired(required: string | undefined): void {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation(
        ((key: unknown) =>
          key === PERMISSION_KEY ? required : undefined) as never,
      );
  }

  it('passes through routes without @RequirePermission (no roleId/DB/cache touched)', async () => {
    stubRequired(undefined);
    await expect(
      guard.canActivate(makeContext(undefined)),
    ).resolves.toBe(true);
    expect(getJson).not.toHaveBeenCalled();
    expect(roleFindUnique).not.toHaveBeenCalled();
  });

  it('blocks (403) when the JWT carries no roleId', async () => {
    stubRequired('employees.delete');
    await expect(
      guard.canActivate(makeContext({ sub: 'u1' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(roleFindUnique).not.toHaveBeenCalled();
  });

  it('allows on a cache HIT when the role has the code (no DB query)', async () => {
    stubRequired('employees.delete');
    getJson.mockResolvedValue({
      name: 'owner',
      codes: ['employees.delete', 'clients.view'],
    });
    await expect(
      guard.canActivate(makeContext({ sub: 'u1', roleId: ROLE_ID })),
    ).resolves.toBe(true);
    expect(roleFindUnique).not.toHaveBeenCalled();
  });

  it('on cache MISS, queries the DB once and repopulates the cache', async () => {
    stubRequired('clients.view');
    getJson.mockResolvedValue(null);
    roleFindUnique.mockResolvedValue({
      name: 'receptionist',
      rolePermissions: [
        { permission: { code: 'clients.view' } },
        { permission: { code: 'appointments.create' } },
      ],
    });
    await expect(
      guard.canActivate(makeContext({ sub: 'u1', roleId: ROLE_ID })),
    ).resolves.toBe(true);
    expect(roleFindUnique).toHaveBeenCalledTimes(1);
    expect(setJson).toHaveBeenCalledWith(
      `servix:rbac:role_perms:${ROLE_ID}`,
      { name: 'receptionist', codes: ['clients.view', 'appointments.create'] },
      300,
    );
  });

  it('blocks (403) when the role lacks the required code', async () => {
    stubRequired('employees.delete');
    getJson.mockResolvedValue({
      name: 'cashier',
      codes: ['invoices.create', 'payments.create'],
    });
    await expect(
      guard.canActivate(makeContext({ sub: 'u1', roleId: ROLE_ID })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('super_admin bypasses even with an empty code set', async () => {
    stubRequired('employees.delete');
    getJson.mockResolvedValue({ name: 'super_admin', codes: [] });
    await expect(
      guard.canActivate(makeContext({ sub: 'admin', roleId: ROLE_ID })),
    ).resolves.toBe(true);
  });

  it('blocks (403) when the role does not exist (cache miss + DB null)', async () => {
    stubRequired('clients.view');
    getJson.mockResolvedValue(null);
    roleFindUnique.mockResolvedValue(null);
    await expect(
      guard.canActivate(makeContext({ sub: 'u1', roleId: 'ghost' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(setJson).not.toHaveBeenCalled();
  });
});
