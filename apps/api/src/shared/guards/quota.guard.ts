import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  QUOTA_RESOURCE_KEY,
  QuotaResourceName,
} from '../decorators/quota-resource.decorator';
import { PlatformPrismaClient } from '../database/platform.client';
import { CacheService } from '../cache/cache.service';

/** Redis key namespace for per-tenant plan limits. Exported so any future
 *  plan/subscription mutation path can invalidate the exact key. */
export const PLAN_LIMITS_CACHE_PREFIX = 'servix:quota:plan_limits:';
/** TTL mirrors the role-perms/tenant caches (5 min): bounds staleness after a
 *  plan upgrade — a tenant may wait up to 5 min for raised limits to apply. */
const PLAN_LIMITS_CACHE_TTL_SECONDS = 300;

/** -1 = unlimited (DB convention: seeded plans use -1; maxAppointmentsMonth
 *  NULL also means unlimited). */
const UNLIMITED = -1;

interface CachedPlanLimits {
  maxEmployees: number;
  maxClients: number;
  maxAppointmentsMonth: number | null;
}

/**
 * QuotaGuard — enforces plan-based resource limits (V-37 cluster).
 *
 * V-37-wire: registered as a GLOBAL APP_GUARD (app.module.ts, after
 * TenantMiddleware/TenantGuard so request.tenantDb is populated). Before this
 * the guard was registered nowhere — plan quotas were never enforced at
 * runtime (V-37-unwired finding, 2026-06-02).
 *
 * V-37c: a route is quota-checked ONLY if it declares
 * @QuotaResource('<resource>') — explicit metadata replaces the old
 * controller-name matching (which false-positived on e.g. ClientDnaController).
 *
 * Limits come from the tenant's active plan row in the platform DB
 * (maxEmployees / maxClients / maxAppointmentsMonth), cached in Redis for
 * 5 min. request.tenant does NOT carry the subscription/plan (TenantMiddleware
 * attaches only the Tenant row), so the guard resolves it itself — same
 * pattern as PermissionGuard's role-perms resolution.
 *
 * Pass-through (allow) without checking: non-POST, no @QuotaResource metadata,
 * no JWT tenant context, no resolvable plan, unlimited limit (-1 / NULL), or
 * no tenant DB on the request.
 *
 * Fail policy: platform-DB/Redis errors during plan resolution and tenant-DB
 * errors during usage counting both fail OPEN (allow + error log). Re-evaluating
 * that policy + a servix_quota_db_error_total metric is V-37d (deferred to its
 * original trigger: next quota incident or quarterly hygiene pass).
 */
@Injectable()
export class QuotaGuard implements CanActivate {
  private readonly logger = new Logger(QuotaGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly platformPrisma: PlatformPrismaClient,
    private readonly cache: CacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Only check on creation (POST)
    if (request.method !== 'POST') return true;

    // V-37c: explicit metadata only — routes without @QuotaResource are not
    // quota-managed.
    const resource = this.reflector.getAllAndOverride<QuotaResourceName>(
      QUOTA_RESOURCE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!resource) return true;

    // V-37: trust JWT only. The pre-V-37 chain
    //   request.headers?.['x-tenant-id'] || request.user?.tenantId
    // let an attacker spoof the x-tenant-id header to poison the
    // warn-log audit trail. request.tenantDb comes from TenantMiddleware
    // (JWT-derived). Header is silently ignored.
    const tenantId = request.user?.tenantId;
    if (!tenantId) return true; // No tenant context (admin routes / pre-tenant signup)

    const limits = await this.resolvePlanLimits(tenantId);
    if (!limits) return true; // No plan resolvable = unlimited (fail-open, V-37d)

    const limit = this.getLimit(limits, resource);
    if (limit === UNLIMITED) return true;

    // Query actual usage from tenant database
    const db = request.tenantDb;
    if (!db) return true; // No database connection

    const usage = await this.getActualUsage(db, resource);

    if (usage >= limit) {
      this.logger.warn(
        `Quota exceeded: tenant=${tenantId}, resource=${resource}, usage=${usage}, limit=${limit}`,
      );
      throw new ForbiddenException({
        code: 'QUOTA_EXCEEDED',
        message: `تم تجاوز الحد الأقصى لـ ${resource}. الحد: ${limit}، الاستخدام: ${usage}. قم بترقية خطتك.`,
        resource,
        currentUsage: usage,
        limit,
      });
    }

    return true;
  }

  /**
   * Resolve the tenant's plan limits from the platform DB, cached in Redis.
   * Subscription selection mirrors TenantMiddleware.loadTenantContext (latest
   * active/trial/expired) so the guard never disagrees with the tenant context
   * about which plan applies. Negative lookups are not cached; Redis-down
   * degrades to a direct DB read (CacheService is fail-open); platform-DB
   * errors fail open to "no limits" (V-37d).
   */
  private async resolvePlanLimits(
    tenantId: string,
  ): Promise<CachedPlanLimits | null> {
    const key = `${PLAN_LIMITS_CACHE_PREFIX}${tenantId}`;

    const cached = await this.cache.getJson<CachedPlanLimits>(key);
    if (cached) {
      return cached;
    }

    try {
      const subscription = await this.platformPrisma.subscription.findFirst({
        where: {
          tenantId,
          status: { in: ['active', 'trial', 'expired'] },
        },
        orderBy: { createdAt: 'desc' },
        include: { plan: true },
      });

      if (!subscription?.plan) {
        return null;
      }

      const limits: CachedPlanLimits = {
        maxEmployees: subscription.plan.maxEmployees,
        maxClients: subscription.plan.maxClients,
        maxAppointmentsMonth: subscription.plan.maxAppointmentsMonth,
      };

      await this.cache.setJson(key, limits, PLAN_LIMITS_CACHE_TTL_SECONDS);
      return limits;
    } catch (err) {
      this.logger.error(
        `Failed to resolve plan limits for tenant=${tenantId}: ${err}`,
      );
      return null; // fail-open on platform-DB errors (V-37d)
    }
  }

  /**
   * V-37-wire: limits come from the plan ROW, not a hardcoded slug map.
   * Plan has no maxServices/maxInvoices columns — those resources are
   * unlimited by design ("بلا تحصيص"); the decorator keeps them declared so
   * adding a column later is a one-line change here.
   */
  private getLimit(
    limits: CachedPlanLimits,
    resource: QuotaResourceName,
  ): number {
    switch (resource) {
      case 'employees':
        return limits.maxEmployees ?? UNLIMITED;
      case 'clients':
        return limits.maxClients ?? UNLIMITED;
      case 'appointments':
        return limits.maxAppointmentsMonth ?? UNLIMITED;
      case 'services':
      case 'invoices':
        return UNLIMITED;
      default:
        return UNLIMITED;
    }
  }

  private async getActualUsage(
    db: any,
    resource: QuotaResourceName,
  ): Promise<number> {
    try {
      switch (resource) {
        case 'employees':
          // `await` is load-bearing: a bare `return promise` inside try{}
          // escapes the catch — rejections would 500 instead of failing open.
          return await db.employee.count({ where: { isActive: true } });
        case 'clients':
          return await db.client.count({ where: { isActive: true, deletedAt: null } });
        case 'services':
          return await db.service.count({ where: { isActive: true } });
        case 'appointments': {
          // Count this month's appointments only
          const startOfMonth = new Date();
          startOfMonth.setDate(1);
          startOfMonth.setHours(0, 0, 0, 0);
          return await db.appointment.count({ where: { createdAt: { gte: startOfMonth } } });
        }
        case 'invoices': {
          const invoiceStart = new Date();
          invoiceStart.setDate(1);
          invoiceStart.setHours(0, 0, 0, 0);
          return await db.invoice.count({ where: { createdAt: { gte: invoiceStart } } });
        }
        default:
          return 0;
      }
    } catch (err) {
      this.logger.error(`Failed to get usage for ${resource}: ${err}`);
      return 0; // fail-open on DB errors (V-37d)
    }
  }
}
