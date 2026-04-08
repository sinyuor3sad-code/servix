import { SetMetadata, applyDecorators } from '@nestjs/common';
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagService } from './feature-flag.service';

export const FEATURE_FLAG_KEY = 'feature_flag';

/**
 * Decorator to require a feature flag to be enabled for the endpoint
 * Usage: @RequireFeature('new-booking-flow')
 */
export const RequireFeature = (flagKey: string) =>
  SetMetadata(FEATURE_FLAG_KEY, flagKey);

/**
 * Guard that checks feature flags before allowing request
 */
@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlagService: FeatureFlagService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const flagKey = this.reflector.get<string>(
      FEATURE_FLAG_KEY,
      context.getHandler(),
    );

    if (!flagKey) return true; // No flag required

    const request = context.switchToHttp().getRequest();
    const isEnabled = this.featureFlagService.isEnabled(flagKey, {
      tenantId: request.tenant?.id || request.headers?.['x-tenant-id'],
      userId: request.user?.id,
    });

    if (!isEnabled) {
      throw new ForbiddenException({
        code: 'FEATURE_DISABLED',
        message: 'هذه الميزة غير متاحة حالياً',
        feature: flagKey,
      });
    }

    return true;
  }
}
