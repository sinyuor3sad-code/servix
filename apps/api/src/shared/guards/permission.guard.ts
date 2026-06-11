import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { PlatformPrismaClient } from '../database/platform.client';
import { CacheService } from '../cache/cache.service';

interface JwtPayload {
  sub?: string;
  roleId?: string;
}

interface CachedRolePerms {
  name: string;
  codes: string[];
}

/** Redis key namespace for the per-role permission set. Exported so cache
 *  invalidation (RolesService.setRolePermissions/remove, V-123b) reuses the
 *  exact key — a mismatch would silently serve stale permissions. */
export const ROLE_PERMS_CACHE_PREFIX = 'servix:rbac:role_perms:';
/** TTL mirrors tenant/settings caches (5 min). Bounds staleness of system roles
 *  whose permissions only change on re-seed at deploy time. Custom roles are
 *  invalidated explicitly when their permissions change (V-123b). */
const ROLE_PERMS_CACHE_TTL_SECONDS = 300;
const SUPER_ADMIN_ROLE = 'super_admin';

/**
 * V-123 — granular RBAC enforcement.
 *
 * Registered as a GLOBAL APP_GUARD (app.module.ts) so @RequirePermission is
 * enforced on every request WITHOUT relying on per-controller
 * @UseGuards(PermissionGuard). That per-controller reliance is exactly the
 * "inert guard" trap that left @Roles dead on RolesController (V-idor-rbac) —
 * a missed decorator silently disabled the gate. As a global guard it always
 * runs; routes that don't declare @RequirePermission short-circuit to allow
 * (pass-through), so unprotected/public/@Roles routes are unaffected.
 *
 * Decision matrix once a route declares @RequirePermission(code):
 *   - no roleId on the JWT            → 403
 *   - role not found                   → 403
 *   - role.name === 'super_admin'      → allow (platform owner bypass)
 *   - role's seeded codes include code → allow
 *   - otherwise                        → 403
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly platformPrisma: PlatformPrismaClient,
    private readonly cache: CacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Pass-through: routes without @RequirePermission are not governed here.
    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as JwtPayload | undefined;

    if (!user?.roleId) {
      this.logger.warn(
        `[PermissionGuard] BLOCKED: no roleId, required=${required}, path=${request.path}`,
      );
      throw new ForbiddenException('ليس لديك صلاحية للقيام بهذا الإجراء');
    }

    const rolePerms = await this.resolveRolePerms(user.roleId);

    if (!rolePerms) {
      this.logger.warn(
        `[PermissionGuard] BLOCKED: role ${user.roleId} not found, required=${required}, path=${request.path}`,
      );
      throw new ForbiddenException('ليس لديك صلاحية للقيام بهذا الإجراء');
    }

    // super_admin (platform owner) bypasses. owner/manager pass via seeded codes.
    if (rolePerms.name === SUPER_ADMIN_ROLE) {
      return true;
    }

    if (rolePerms.codes.includes(required)) {
      return true;
    }

    this.logger.warn(
      `[PermissionGuard] BLOCKED: role=${rolePerms.name} lacks ${required}, path=${request.path}`,
    );
    throw new ForbiddenException('ليس لديك صلاحية للقيام بهذا الإجراء');
  }

  /**
   * Resolve a role's name + permission codes, cached in Redis to avoid a
   * role+permissions join on every request. Cache misses fall back to a single
   * platform-DB query and repopulate. Negative lookups (role not found) are NOT
   * cached. Redis-down degrades to a direct DB read (CacheService is fail-open).
   */
  private async resolveRolePerms(
    roleId: string,
  ): Promise<CachedRolePerms | null> {
    const key = `${ROLE_PERMS_CACHE_PREFIX}${roleId}`;

    const cached = await this.cache.getJson<CachedRolePerms>(key);
    if (cached) {
      return cached;
    }

    const role = await this.platformPrisma.role.findUnique({
      where: { id: roleId },
      include: {
        rolePermissions: {
          include: { permission: { select: { code: true } } },
        },
      },
    });

    if (!role) {
      return null;
    }

    const rolePerms: CachedRolePerms = {
      name: role.name,
      codes: role.rolePermissions.map((rp) => rp.permission.code),
    };

    await this.cache.setJson(key, rolePerms, ROLE_PERMS_CACHE_TTL_SECONDS);
    return rolePerms;
  }
}
