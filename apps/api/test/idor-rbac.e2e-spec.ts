import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RolesGuard } from '../src/shared/guards/roles.guard';
import { RolesController } from '../src/core/roles/roles.controller';
import { FeaturesController } from '../src/core/features/features.controller';
import { ROLES_KEY } from '../src/shared/decorators/roles.decorator';
import { PlatformPrismaClient } from '../src/shared/database/platform.client';

/**
 * V-idor-rbac (HIGH / privilege escalation) — RolesController and
 * FeaturesController manage platform RBAC + the feature catalog. Pre-fix each
 * carried per-route @Roles('admin') but only @UseGuards(JwtAuthGuard) at class
 * level; RolesGuard is NOT a global APP_GUARD, so the @Roles metadata was inert
 * and ANY authenticated user could PUT /roles/:id/permissions (grant arbitrary
 * permissions = privilege escalation). On top of that 'admin' is not a seeded
 * role (platform = 'super_admin'; tenant = owner/manager/...).
 *
 * The fix locks both controllers to super_admin via class-level
 * @UseGuards(JwtAuthGuard, RolesGuard) + @Roles('super_admin'). These tests run
 * the REAL RolesGuard against the REAL @Roles metadata on the actual controller
 * classes — a regression that drops the decorator or the guard makes them fail.
 */

const SUPER_ADMIN_ROLE_ID = 'role-superadmin-id';
const TENANT_OWNER_ROLE_ID = 'role-owner-id';

function ctx(target: object, handler: (...args: never[]) => unknown, user: { sub: string; roleId?: string } | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user, path: '/api/v1/rbac' }) }),
    getHandler: () => handler,
    getClass: () => target,
  } as unknown as ExecutionContext;
}

describe('V-idor-rbac — RBAC/features controllers are super_admin-only', () => {
  let guard: RolesGuard;
  const roleFindUnique = jest.fn();
  const reflector = new Reflector();

  beforeEach(() => {
    roleFindUnique.mockReset();
    guard = new RolesGuard(reflector, {
      role: { findUnique: roleFindUnique },
    } as unknown as PlatformPrismaClient);
  });

  it('RolesController declares @Roles("super_admin") at class scope', () => {
    expect(
      reflector.getAllAndOverride<string[]>(ROLES_KEY, [
        RolesController.prototype.setRolePermissions,
        RolesController,
      ]),
    ).toEqual(['super_admin']);
  });

  it('FeaturesController declares @Roles("super_admin") at class scope', () => {
    expect(
      reflector.getAllAndOverride<string[]>(ROLES_KEY, [
        FeaturesController.prototype.create,
        FeaturesController,
      ]),
    ).toEqual(['super_admin']);
  });

  it('blocks a non-super_admin from PUT /roles/:id/permissions (privilege escalation → 403)', async () => {
    roleFindUnique.mockResolvedValue({ id: TENANT_OWNER_ROLE_ID, name: 'owner' });
    await expect(
      guard.canActivate(
        ctx(RolesController, RolesController.prototype.setRolePermissions, {
          sub: 'attacker',
          roleId: TENANT_OWNER_ROLE_ID,
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks a non-super_admin from creating a feature (→ 403)', async () => {
    roleFindUnique.mockResolvedValue({ id: TENANT_OWNER_ROLE_ID, name: 'manager' });
    await expect(
      guard.canActivate(
        ctx(FeaturesController, FeaturesController.prototype.create, {
          sub: 'attacker',
          roleId: TENANT_OWNER_ROLE_ID,
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks the legacy non-existent "admin" role too (fail-closed — only super_admin passes)', async () => {
    roleFindUnique.mockResolvedValue({ id: 'whatever', name: 'admin' });
    await expect(
      guard.canActivate(
        ctx(RolesController, RolesController.prototype.create, { sub: 'x', roleId: 'whatever' }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows a super_admin through to manage roles and features', async () => {
    roleFindUnique.mockResolvedValue({ id: SUPER_ADMIN_ROLE_ID, name: 'super_admin' });
    await expect(
      guard.canActivate(
        ctx(RolesController, RolesController.prototype.setRolePermissions, {
          sub: 'admin',
          roleId: SUPER_ADMIN_ROLE_ID,
        }),
      ),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(
        ctx(FeaturesController, FeaturesController.prototype.create, {
          sub: 'admin',
          roleId: SUPER_ADMIN_ROLE_ID,
        }),
      ),
    ).resolves.toBe(true);
  });
});
