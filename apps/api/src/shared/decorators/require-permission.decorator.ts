import { SetMetadata } from '@nestjs/common';

/**
 * V-123 — granular RBAC. Marks a route as requiring a single fine-grained
 * permission code (e.g. 'employees.delete'). Enforced by the global
 * PermissionGuard (APP_GUARD). Routes without this decorator are not governed
 * by PermissionGuard — they keep whatever protection they already declare
 * (@Public, @Roles, TenantGuard).
 *
 * Permission codes are the `code` column of the seeded `permissions` table
 * (see prisma/seed.ts). super_admin bypasses; owner/manager/... pass via their
 * seeded role_permissions.
 */
export const PERMISSION_KEY = 'requiredPermission';

export const RequirePermission = (
  code: string,
): ReturnType<typeof SetMetadata> => SetMetadata(PERMISSION_KEY, code);
