import { ForbiddenException } from '@nestjs/common';
import { PlatformPrismaClient } from '../database/platform.client';
import type { TenantUser } from '../database';

/**
 * Verifies that `userId` has an active TenantUser link for `tenantId`.
 * Throws ForbiddenException with a localized message on any failure.
 *
 * Used by HTTP TenantGuard and WS WsAuthGuard to keep the single source
 * of truth for "is this user allowed to act inside this tenant" in one
 * place. Behaviour mirrors the original TenantGuard inline check.
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
  });

  if (!tenantUser || tenantUser.status !== 'active') {
    throw new ForbiddenException(
      'ليس لديك صلاحية للوصول إلى هذا الحساب',
    );
  }

  return tenantUser;
}
