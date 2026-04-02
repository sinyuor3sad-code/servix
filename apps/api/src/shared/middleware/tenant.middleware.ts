import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PlatformPrismaClient } from '../database/platform.client';
import { TenantClientFactory } from '../database/tenant-client.factory';
import { CacheService } from '../cache/cache.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { computeSubscriptionStatus } from '../../core/subscriptions/subscription-status.service';
import type { Tenant } from '../database';
import type { TenantPrismaClient } from '../types/tenant-db.type';
import type { AuthenticatedRequest } from '../types/request.interface';

const TENANT_REQUIRED_PREFIXES = [
  '/api/v1/salon',
  '/api/v1/services',
  '/api/v1/employees',
  '/api/v1/clients',
  '/api/v1/appointments',
  '/api/v1/invoices',
  '/api/v1/coupons',
  '/api/v1/loyalty',
  '/api/v1/expenses',
  '/api/v1/attendance',
  '/api/v1/settings',
  '/api/v1/reports',
  '/api/v1/notifications',
  '/api/v1/account',
];

const PUBLIC_TENANT_PATHS = [
  '/api/v1/auth',
  '/api/v1/booking',
  '/api/v1/health',
  '/api/v1/admin',
];

/** When LOCKED, only these paths are allowed */
const RENEWAL_ALLOWED_PATHS = [
  '/api/v1/subscriptions/current',
  '/api/v1/subscriptions/renew',
  '/api/v1/subscriptions/plans',
  '/api/v1/auth/me',
];

const ACTIVE_SUBSCRIPTION_STATUSES = ['active', 'trial'] as const;

function isPublicPath(path: string): boolean {
  return PUBLIC_TENANT_PATHS.some((p) => path.startsWith(p));
}

function isTenantRequiredPath(path: string): boolean {
  return TENANT_REQUIRED_PREFIXES.some((p) => path.startsWith(p));
}

@Injectable()
export class TenantMiddleware implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly platformPrisma: PlatformPrismaClient,
    private readonly tenantClientFactory: TenantClientFactory,
    private readonly cacheService: CacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const path = request.path;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic || isPublicPath(path)) {
      return true;
    }

    const user = request.user;
    const tenantId = user?.tenantId;

    if (isTenantRequiredPath(path)) {
      if (!tenantId) {
        console.warn(`[TenantMiddleware] BLOCKED: No tenantId in JWT for tenant-required path=${path}, userId=${user?.sub}`);
        throw new ForbiddenException(
          'يجب أن تكون مرتبطاً بحساب صالون للوصول إلى هذا المورد',
        );
      }

      console.log(`[TenantMiddleware] Loading tenant context for tenantId=${tenantId}, path=${path}`);
      const ctx = await this.loadTenantContext(tenantId, path);
      request.tenant = ctx.tenant;
      request.tenantDb = ctx.tenantDb;
      request.features = ctx.features;
      request.subscriptionStatus = ctx.subscriptionStatus;
    } else if (tenantId) {
      const ctx = await this.loadTenantContext(tenantId, path);
      request.tenant = ctx.tenant;
      request.tenantDb = ctx.tenantDb;
      request.features = ctx.features;
      request.subscriptionStatus = ctx.subscriptionStatus;
    }

    return true;
  }

  private async loadTenantContext(
    tenantId: string,
    path: string,
  ): Promise<{
    tenant: Tenant;
    tenantDb: TenantPrismaClient;
    features: string[];
    subscriptionStatus?: import('../../core/subscriptions/subscription-status.service').SubscriptionStatus;
  }> {
    const cached = await this.cacheService.getTenant(tenantId);

    if (cached?.subscription) {
      const subStatus = computeSubscriptionStatus(
        new Date(cached.subscription.currentPeriodEnd),
        cached.subscription.status ?? 'active',
      );
      if (subStatus.phase === 'deleted') {
        await this.cacheService.invalidateTenant(tenantId);
      } else if (subStatus.phase === 'expired_locked') {
        const isRenewalPath = RENEWAL_ALLOWED_PATHS.some((p) => path.startsWith(p));
        if (!isRenewalPath) {
          throw new ForbiddenException(
            'انتهت فترة الاشتراك. يرجى التجديد للوصول — اشتراكك مقفل. جدّدي الآن للاستمرار',
          );
        }
      } else if (subStatus.phase !== 'expired_grace' && subStatus.phase !== 'active' && subStatus.phase !== 'trial') {
        await this.cacheService.invalidateTenant(tenantId);
      } else {
        const tenantDb = this.tenantClientFactory.getTenantClient(
          cached.tenant.databaseName,
        );
        const tenant = cached.tenant as Tenant;
        return {
          tenant,
          tenantDb,
          features: cached.featureCodes,
          subscriptionStatus: subStatus,
        };
      }
    }

    const tenant = await this.platformPrisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('الحساب غير موجود');
    }

    if (tenant.status === 'suspended') {
      throw new ForbiddenException('حساب الصالون معلّق');
    }

    const subscription = await this.platformPrisma.subscription.findFirst({
      where: {
        tenantId,
        status: { in: ['active', 'trial', 'expired'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      console.error(`[TenantMiddleware] BLOCKED: No subscription found for tenantId=${tenantId}, path=${path}`);
      throw new ForbiddenException(
        'لا يوجد اشتراك. يرجى الاشتراك للوصول',
      );
    }
    console.log(`[TenantMiddleware] Subscription found: id=${subscription.id}, status=${subscription.status}, endsAt=${subscription.currentPeriodEnd.toISOString()}`);

    const subStatus = computeSubscriptionStatus(
      subscription.currentPeriodEnd,
      subscription.status,
    );

    if (subStatus.phase === 'deleted') {
      throw new ForbiddenException(
        'تم حذف الحساب. تواصل مع الدعم الفني',
      );
    }

    if (subStatus.phase === 'expired_locked' && !subStatus.canAccessDashboard) {
      const isRenewalPath = RENEWAL_ALLOWED_PATHS.some((p) => path.startsWith(p));
      if (!isRenewalPath) {
        throw new ForbiddenException(
          'انتهت فترة الاشتراك. يرجى التجديد للوصول — اشتراكك مقفل. جدّدي الآن للاستمرار',
        );
      }
    }

    const featureCodes = await this.loadFeatureFlags(tenantId, subscription.planId);

    const isActive = subStatus.phase === 'active' || subStatus.phase === 'trial' || subStatus.phase === 'expired_grace';
    if (isActive) {
      await this.cacheService.setTenant(tenantId, {
        tenant: {
          id: tenant.id,
          nameAr: tenant.nameAr,
          nameEn: tenant.nameEn,
          slug: tenant.slug,
          databaseName: tenant.databaseName,
          status: tenant.status,
          primaryColor: tenant.primaryColor,
          theme: tenant.theme,
          logoUrl: tenant.logoUrl,
        },
        subscription: {
          id: subscription.id,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
        },
        featureCodes,
      });
    }

    const tenantDb = this.tenantClientFactory.getTenantClient(
      tenant.databaseName,
    );

    return {
      tenant,
      tenantDb,
      features: featureCodes,
      subscriptionStatus: subStatus,
    };
  }

  private validateSubscriptionFromCache(
    cached: { subscription: { currentPeriodEnd: string } | null },
  ): boolean {
    if (!cached.subscription) return false;
    return new Date(cached.subscription.currentPeriodEnd) > new Date();
  }

  private async loadFeatureFlags(
    tenantId: string,
    planId: string,
  ): Promise<string[]> {
    const [planFeatures, tenantOverrides] = await Promise.all([
      this.platformPrisma.planFeature.findMany({
        where: { planId },
        include: { feature: true },
      }),
      this.platformPrisma.tenantFeature.findMany({
        where: { tenantId },
        include: { feature: true },
      }),
    ]);

    const overrideMap = new Map(
      tenantOverrides.map((tf) => [tf.feature.code, tf.isEnabled]),
    );

    const featureCodes: string[] = [];

    for (const pf of planFeatures) {
      const override = overrideMap.get(pf.feature.code);
      if (override === undefined) {
        featureCodes.push(pf.feature.code);
      } else if (override) {
        featureCodes.push(pf.feature.code);
      }
    }

    return featureCodes;
  }
}
