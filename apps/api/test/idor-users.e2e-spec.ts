import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RolesGuard } from '../src/shared/guards/roles.guard';
import { UsersController } from '../src/core/users/users.controller';
import { ROLES_KEY } from '../src/shared/decorators/roles.decorator';
import { PlatformPrismaClient } from '../src/shared/database/platform.client';

/**
 * V-idor-users (HIGH / cross-tenant IDOR + account takeover) — UsersController
 * administers the shared platform users table. Pre-fix it had only
 * @UseGuards(JwtAuthGuard) and no @Roles, so any authenticated user could
 * GET /users (every platform user's email/phone), GET/PUT/DELETE /users/:id on
 * any account, and PUT /users/:id could change another account's email/phone
 * (account-takeover vector). The fix locks the controller to super_admin.
 *
 * Runs the REAL RolesGuard against the REAL @Roles metadata on the actual
 * UsersController class. Self-service stays on /auth/me (not tested here).
 */

const SUPER_ADMIN_ROLE_ID = 'role-superadmin-id';
const TENANT_OWNER_ROLE_ID = 'role-owner-id';

function ctxFor(
  handlerName: keyof UsersController,
  user: { sub: string; roleId?: string } | undefined,
): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user, path: '/api/v1/users' }) }),
    getHandler: () => UsersController.prototype[handlerName],
    getClass: () => UsersController,
  } as unknown as ExecutionContext;
}

describe('V-idor-users — UsersController is super_admin-only', () => {
  let guard: RolesGuard;
  const roleFindUnique = jest.fn();
  const reflector = new Reflector();

  beforeEach(() => {
    roleFindUnique.mockReset();
    guard = new RolesGuard(reflector, {
      role: { findUnique: roleFindUnique },
    } as unknown as PlatformPrismaClient);
  });

  it('declares @Roles("super_admin") at class scope (every route gated)', () => {
    expect(
      reflector.getAllAndOverride<string[]>(ROLES_KEY, [
        UsersController.prototype.update,
        UsersController,
      ]),
    ).toEqual(['super_admin']);
  });

  it.each<keyof UsersController>(['findAll', 'findOne', 'update', 'deactivate'])(
    'blocks a non-super_admin from %s (cross-tenant user admin → 403)',
    async (route) => {
      roleFindUnique.mockResolvedValue({ id: TENANT_OWNER_ROLE_ID, name: 'owner' });
      await expect(
        guard.canActivate(ctxFor(route, { sub: 'attacker', roleId: TENANT_OWNER_ROLE_ID })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it('blocks a JWT with no roleId (fail-closed)', async () => {
    await expect(
      guard.canActivate(ctxFor('update', { sub: 'attacker' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(roleFindUnique).not.toHaveBeenCalled();
  });

  it('allows a super_admin through to administer users', async () => {
    roleFindUnique.mockResolvedValue({ id: SUPER_ADMIN_ROLE_ID, name: 'super_admin' });
    await expect(
      guard.canActivate(ctxFor('update', { sub: 'admin', roleId: SUPER_ADMIN_ROLE_ID })),
    ).resolves.toBe(true);
  });
});
