import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RolesGuard } from '../src/shared/guards/roles.guard';
import { AuditController } from '../src/core/audit/audit.controller';
import { SubscriptionsController } from '../src/core/subscriptions/subscriptions.controller';
import { ROLES_KEY } from '../src/shared/decorators/roles.decorator';
import { PlatformPrismaClient } from '../src/shared/database/platform.client';

/**
 * V-idor-sweep MEDIUMs — runtime proof via the real RolesGuard against the real
 * controller metadata.
 *
 *  - AuditController: platform_audit_logs spans all tenants → whole controller
 *    locked to super_admin (class scope).
 *  - SubscriptionsController: POST / is platform provisioning (takes tenantId in
 *    the body) → super_admin at the METHOD level; the self-service routes
 *    (current/cancel/renew, which derive the tenant from the JWT) must stay open
 *    to any authenticated tenant user — RolesGuard is a no-op without @Roles.
 */

const SUPER_ADMIN_ROLE_ID = 'role-superadmin-id';
const TENANT_OWNER_ROLE_ID = 'role-owner-id';

function ctx(
  target: object,
  handler: (...args: never[]) => unknown,
  user: { sub: string; roleId?: string } | undefined,
): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user, path: '/api/v1/x' }) }),
    getHandler: () => handler,
    getClass: () => target,
  } as unknown as ExecutionContext;
}

describe('V-idor-sweep MEDIUMs — audit + subscriptions authz', () => {
  let guard: RolesGuard;
  const roleFindUnique = jest.fn();
  const reflector = new Reflector();

  beforeEach(() => {
    roleFindUnique.mockReset();
    guard = new RolesGuard(reflector, {
      role: { findUnique: roleFindUnique },
    } as unknown as PlatformPrismaClient);
  });

  describe('AuditController (super_admin-only, class scope)', () => {
    it('declares @Roles("super_admin") at class scope', () => {
      expect(
        reflector.getAllAndOverride<string[]>(ROLES_KEY, [
          AuditController.prototype.findAll,
          AuditController,
        ]),
      ).toEqual(['super_admin']);
    });

    it('blocks a non-super_admin from reading audit logs (→ 403)', async () => {
      roleFindUnique.mockResolvedValue({ id: TENANT_OWNER_ROLE_ID, name: 'owner' });
      await expect(
        guard.canActivate(ctx(AuditController, AuditController.prototype.findAll, { sub: 'x', roleId: TENANT_OWNER_ROLE_ID })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows super_admin to read audit logs', async () => {
      roleFindUnique.mockResolvedValue({ id: SUPER_ADMIN_ROLE_ID, name: 'super_admin' });
      await expect(
        guard.canActivate(ctx(AuditController, AuditController.prototype.findOne, { sub: 'a', roleId: SUPER_ADMIN_ROLE_ID })),
      ).resolves.toBe(true);
    });
  });

  describe('SubscriptionsController (POST super_admin, self-service open)', () => {
    it('POST / requires super_admin (method-level @Roles)', () => {
      expect(
        reflector.getAllAndOverride<string[]>(ROLES_KEY, [
          SubscriptionsController.prototype.createSubscription,
          SubscriptionsController,
        ]),
      ).toEqual(['super_admin']);
    });

    it('blocks a non-super_admin from POST /subscriptions (→ 403)', async () => {
      roleFindUnique.mockResolvedValue({ id: TENANT_OWNER_ROLE_ID, name: 'owner' });
      await expect(
        guard.canActivate(
          ctx(SubscriptionsController, SubscriptionsController.prototype.createSubscription, {
            sub: 'x',
            roleId: TENANT_OWNER_ROLE_ID,
          }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows super_admin to POST /subscriptions', async () => {
      roleFindUnique.mockResolvedValue({ id: SUPER_ADMIN_ROLE_ID, name: 'super_admin' });
      await expect(
        guard.canActivate(
          ctx(SubscriptionsController, SubscriptionsController.prototype.createSubscription, {
            sub: 'a',
            roleId: SUPER_ADMIN_ROLE_ID,
          }),
        ),
      ).resolves.toBe(true);
    });

    it('self-service routes stay OPEN to any authed tenant user (no @Roles → RolesGuard no-op)', async () => {
      // current / cancel / renew carry no @Roles → guard returns true without a role lookup.
      for (const handler of [
        SubscriptionsController.prototype.getCurrentSubscription,
        SubscriptionsController.prototype.cancelSubscription,
        SubscriptionsController.prototype.renewSubscription,
        SubscriptionsController.prototype.getPlans,
      ]) {
        await expect(
          guard.canActivate(ctx(SubscriptionsController, handler, { sub: 'tenant-user', roleId: TENANT_OWNER_ROLE_ID })),
        ).resolves.toBe(true);
      }
      expect(roleFindUnique).not.toHaveBeenCalled();
    });
  });
});
