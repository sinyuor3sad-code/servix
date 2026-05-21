import { ForbiddenException } from '@nestjs/common';
import { PlatformPrismaClient } from '../database/platform.client';
import type { TenantUser } from '../database';

/**
 * Verifies that `userId` has an active TenantUser link for `tenantId`
 * AND that the parent Tenant itself is `status='active'` (i.e. not
 * suspended, cancelled, pending deletion, or any other non-operational
 * state).
 *
 * Throws ForbiddenException on any failure with localized messages so
 * the same helper can drive both HTTP (TenantGuard) and WS (WsAuthGuard)
 * decisions — single source of truth for "is this user allowed to act
 * inside this tenant right now".
 *
 * V-14b: the tenant.status check was added so suspending a tenant
 * actually closes WS access too. Pre-V-14b the helper only checked
 * tenant_user.status, which let a suspended-tenant member open a WS
 * even though every HTTP path already rejected them via middleware.
 */
export async function assertActiveTenantUser(
  prisma: PlatformPrismaClient,
  tenantId: string,
  userId: string,
): Promise<TenantUser> {
  const tenantUser = await prisma.tenantUser.findUnique({
    where: {
      tenantId_userId: {
        tenantId,
        userId,
      },
    },
    include: {
      tenant: { select: { status: true } },
    },
  });

  if (!tenantUser || tenantUser.status !== 'active') {
    throw new ForbiddenException(
      'ليس لديك صلاحية للوصول إلى هذا الحساب',
    );
  }

  if (tenantUser.tenant.status !== 'active') {
    // Distinct message so the caller (and ops) can tell a suspended
    // tenant apart from a revoked membership.
    throw new ForbiddenException('حساب الصالون غير مفعّل');
  }

  // Strip the joined tenant before returning so the helper's return
  // type stays bit-for-bit compatible with the pre-V-14b signature.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { tenant: _tenant, ...rest } = tenantUser;
  return rest as TenantUser;
}
