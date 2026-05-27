import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { TenantGuard } from '../src/shared/guards/tenant.guard';
import { PlatformPrismaClient } from '../src/shared/database/platform.client';
import { IS_PUBLIC_KEY } from '../src/shared/decorators/public.decorator';

/**
 * V-38 — TenantGuard global APP_GUARD behavior.
 *
 * Five tests cover the decision matrix the guard must implement now
 * that it runs on every request (per app.module.ts:96-109 ordering:
 * Rate → Jwt → TenantMiddleware → TenantGuard → SubscriptionWrite):
 *
 *   1. @Public() routes  → bypass (Reflector reads IS_PUBLIC_KEY).
 *   2. Admin / pre-tenant routes (request.tenant unset by middleware)
 *                          → bypass — TenantMiddleware is authoritative.
 *   3. Tenant-data route + valid JWT + active TenantUser
 *                          → allowed (assertActiveTenantUser succeeds).
 *   4. Tenant-data route + JWT without active TenantUser link
 *                          → 403 ForbiddenException (the V-38 protection).
 *   5. Suspended tenant   → 403 (V-14b parity, kept for defense-in-depth).
 *
 * The guard's assertActiveTenantUser dependency is exercised via the
 * mocked PlatformPrismaClient — the actual helper from
 * shared/auth/tenant-user.helper.ts is shared with WsAuthGuard (V-01)
 * and is covered there.
 */

const USER_ID = 'aaaaaaaa-1111-1111-1111-111111111111';
const TENANT_ID = 'bbbbbbbb-2222-2222-2222-222222222222';

function makeContext(opts: {
  isPublic?: boolean;
  tenant?: { id: string; status: string } | null;
  user?: { sub: string } | null;
}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user: opts.user === null ? undefined : opts.user ?? { sub: USER_ID },
        tenant: opts.tenant === null ? undefined : opts.tenant ?? { id: TENANT_ID, status: 'active' },
      }),
    }),
    getHandler: () => ({ __isPublic: opts.isPublic }),
    getClass: () => ({ name: 'TestController', __isPublic: opts.isPublic }),
  } as unknown as ExecutionContext;
}

describe('V-38 — TenantGuard global APP_GUARD', () => {
  let guard: TenantGuard;
  let reflector: Reflector;
  const tenantUserFindUnique = jest.fn();
  const mockPrisma = {
    tenantUser: { findUnique: tenantUserFindUnique },
  };

  beforeEach(async () => {
    tenantUserFindUnique.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantGuard,
        Reflector,
        { provide: PlatformPrismaClient, useValue: mockPrisma },
      ],
    }).compile();
    guard = module.get(TenantGuard);
    reflector = module.get(Reflector);
  });

  // Helper: stub the Reflector to return the isPublic flag we set on the
  // synthetic getHandler/getClass objects above. Real Reflector reads
  // SetMetadata(IS_PUBLIC_KEY, true); for an isolated unit we shortcut.
  function stubReflector(isPublic: boolean | undefined) {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation(
      ((key: unknown) =>
        (key === IS_PUBLIC_KEY ? isPublic : undefined)) as never,
    );
  }

  // ──────────────────────────────────────────────────────────────────

  it('1. @Public() route → bypass (Reflector reads IS_PUBLIC_KEY=true)', async () => {
    stubReflector(true);
    // Even with no user and no tenant, the public short-circuit wins.
    const ctx = makeContext({ user: null, tenant: null });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    // Crucially, no DB lookup runs.
    expect(tenantUserFindUnique).not.toHaveBeenCalled();
  });

  it('2. Admin / pre-tenant route (request.tenant undefined) → bypass', async () => {
    stubReflector(false);
    // Authenticated super_admin with NO tenant context (TenantMiddleware
    // skipped because /admin/* is in PUBLIC_TENANT_PATHS).
    const ctx = makeContext({ user: { sub: USER_ID }, tenant: null });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(tenantUserFindUnique).not.toHaveBeenCalled();
  });

  it('3. Tenant-data route + valid JWT + active TenantUser → allowed', async () => {
    stubReflector(false);
    // assertActiveTenantUser internally queries tenantUser.findFirst.
    tenantUserFindUnique.mockResolvedValueOnce({
      id: 'tu-uuid', tenantId: TENANT_ID, userId: USER_ID, status: 'active',
      tenant: { status: 'active' },                    // helper's `include` shape
    });
    const ctx = makeContext({});
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(tenantUserFindUnique).toHaveBeenCalledTimes(1);
  });

  it('4. Tenant-data route + JWT without active TenantUser → 403 (the V-38 protection)', async () => {
    stubReflector(false);
    tenantUserFindUnique.mockResolvedValueOnce(null);  // no active TU link
    const ctx = makeContext({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    expect(tenantUserFindUnique).toHaveBeenCalledTimes(1);
  });

  it('5. Suspended tenant → 403 (V-14b parity, before the membership check)', async () => {
    stubReflector(false);
    const ctx = makeContext({ tenant: { id: TENANT_ID, status: 'suspended' } });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    // Short-circuit BEFORE the DB lookup.
    expect(tenantUserFindUnique).not.toHaveBeenCalled();
  });
});
