import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RolesGuard } from '../src/shared/guards/roles.guard';
import { TenantsController } from '../src/core/tenants/tenants.controller';
import { ROLES_KEY } from '../src/shared/decorators/roles.decorator';
import { PlatformPrismaClient } from '../src/shared/database/platform.client';

/**
 * V-tenants-authz (HIGH / cross-tenant IDOR) — every TenantsController route
 * is a platform operation (create/suspend/update any tenant by :id, read any
 * tenant's subscription, toggle features). Pre-fix the class carried only
 * JwtAuthGuard with no @Roles; the global TenantGuard only validates the
 * caller's OWN tenant (request.tenant from the JWT) and never compares the :id
 * path param — so ANY authenticated salon user could DELETE/PUT /tenants/<any-id>.
 *
 * The fix locks the controller to super_admin via class-level
 * @UseGuards(JwtAuthGuard, RolesGuard) + @Roles('super_admin'). These tests run
 * the REAL RolesGuard against the REAL @Roles metadata on the actual controller
 * class (read via Reflector), so they assert the genuine wiring — not a
 * reimplementation. A regression that drops the decorator makes them fail.
 */

const TENANT_OWNER_ROLE_ID = 'role-owner-id';
const SUPER_ADMIN_ROLE_ID = 'role-superadmin-id';
const VICTIM_TENANT_ID = 'cccccccc-3333-3333-3333-333333333333';

function ctxFor(
  handlerName: keyof TenantsController,
  user: { sub: string; roleId?: string } | undefined,
): ExecutionContext {
  const handler = TenantsController.prototype[handlerName];
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user, path: `/api/v1/tenants/${VICTIM_TENANT_ID}` }),
    }),
    getHandler: () => handler,
    getClass: () => TenantsController,
  } as unknown as ExecutionContext;
}

describe('V-tenants-authz — TenantsController is super_admin-only', () => {
  let guard: RolesGuard;
  const roleFindUnique = jest.fn();
  const reflector = new Reflector();

  beforeEach(() => {
    roleFindUnique.mockReset();
    guard = new RolesGuard(reflector, {
      role: { findUnique: roleFindUnique },
    } as unknown as PlatformPrismaClient);
  });

  it('declares @Roles("super_admin") at the class level (fail-closed for every route)', () => {
    const required = reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      TenantsController.prototype.suspend,
      TenantsController,
    ]);
    expect(required).toEqual(['super_admin']);
  });

  it.each<keyof TenantsController>([
    'suspend',
    'update',
    'toggleFeatures',
    'getSubscription',
    'findOne',
  ])('blocks a non-super_admin tenant user from %s on an arbitrary tenant (cross-tenant IDOR → 403)', async (route) => {
    // Attacker: a legitimate salon "owner" of some OTHER tenant.
    roleFindUnique.mockResolvedValue({ id: TENANT_OWNER_ROLE_ID, name: 'owner' });

    await expect(
      guard.canActivate(ctxFor(route, { sub: 'attacker', roleId: TENANT_OWNER_ROLE_ID })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks a JWT with no roleId (fail-closed)', async () => {
    await expect(
      guard.canActivate(ctxFor('suspend', { sub: 'attacker' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(roleFindUnique).not.toHaveBeenCalled();
  });

  it('allows a super_admin through to suspend', async () => {
    roleFindUnique.mockResolvedValue({ id: SUPER_ADMIN_ROLE_ID, name: 'super_admin' });

    await expect(
      guard.canActivate(ctxFor('suspend', { sub: 'admin', roleId: SUPER_ADMIN_ROLE_ID })),
    ).resolves.toBe(true);
  });
});
