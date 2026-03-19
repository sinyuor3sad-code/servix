import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { FEATURE_KEY } from '../decorators/require-feature.decorator';
import { PlatformPrismaClient } from '../database/platform.client';

interface TenantRecord {
  id: string;
  status: string;
}

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly platformPrisma: PlatformPrismaClient,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const featureCode = this.reflector.getAllAndOverride<string>(FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!featureCode) {
      return true;
    }

    const request = context.switchToHttp().getRequest<
      Request & { tenant?: TenantRecord; features?: string[] }
    >();
    const tenant = request.tenant;
    const features = request.features;

    if (!tenant) {
      throw new ForbiddenException('هذه الميزة غير متوفرة في باقتك الحالية');
    }

    if (features?.includes(featureCode)) {
      return true;
    }

    const tenantFeature = await this.platformPrisma.tenantFeature.findFirst({
      where: {
        tenantId: tenant.id,
        feature: { code: featureCode },
      },
    });

    if (tenantFeature) {
      if (tenantFeature.isEnabled) {
        return true;
      }
      throw new ForbiddenException('هذه الميزة غير متوفرة في باقتك الحالية');
    }

    const activeSubscription =
      await this.platformPrisma.subscription.findFirst({
        where: {
          tenantId: tenant.id,
          status: { in: ['active', 'trial'] },
        },
        include: {
          plan: {
            include: {
              planFeatures: {
                include: { feature: true },
              },
            },
          },
        },
      });

    if (!activeSubscription) {
      throw new ForbiddenException('هذه الميزة غير متوفرة في باقتك الحالية');
    }

    const hasFeature = activeSubscription.plan.planFeatures.some(
      (pf) => pf.feature.code === featureCode,
    );

    if (!hasFeature) {
      throw new ForbiddenException('هذه الميزة غير متوفرة في باقتك الحالية');
    }

    return true;
  }
}
