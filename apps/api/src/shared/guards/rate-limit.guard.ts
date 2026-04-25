import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CacheService } from '../cache/cache.service';
import { PlatformSettingsService } from '../database/platform-settings.service';

const RATE_LIMIT_PREFIX = 'servix:rate:';

/**
 * Decorator to set custom rate limits per route.
 * Usage: @RateLimit(30, 60) — 30 requests per 60 seconds
 */
export const RATE_LIMIT_KEY = 'rateLimit';
export const RateLimit = (limit: number, windowSeconds: number) =>
  (target: any, key?: string, descriptor?: PropertyDescriptor) => {
    Reflect.defineMetadata(RATE_LIMIT_KEY, { limit, windowSeconds }, descriptor?.value ?? target);
    return descriptor ?? target;
  };

/**
 * Global API Rate Limiting Guard.
 *
 * Default: 100 requests per 60 seconds per IP.
 * Can be overridden per route with @RateLimit() decorator.
 *
 * Uses sliding window counter in Redis.
 * Gracefully degrades (allows all) if Redis is unavailable.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly reflector: Reflector,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Skip rate limiting for health checks
    const url = request.url as string;
    if (
      url.startsWith('/api/v1/health') ||
      url.startsWith('/health') ||
      url.startsWith('/api/webhooks/evolution')
    ) {
      return true;
    }

    // Get custom rate limit from decorator, or use defaults
    const handler = context.getHandler();
    const customLimit = this.reflector.get<{ limit: number; windowSeconds: number }>(
      RATE_LIMIT_KEY,
      handler,
    );

    const limit = customLimit?.limit ?? await this.platformSettings.getNumber('rate_limit_rpm', 100);
    const windowSeconds = customLimit?.windowSeconds ?? 60;

    // Extract IP from request
    const ip = this.extractIp(request);
    const key = `${RATE_LIMIT_PREFIX}${ip}:${windowSeconds}`;

    try {
      const result = await this.cacheService.incrementRateLimit(key, windowSeconds);

      // Set rate limit headers
      const response = context.switchToHttp().getResponse();
      response.setHeader('X-RateLimit-Limit', limit);
      response.setHeader('X-RateLimit-Remaining', Math.max(0, limit - result));
      response.setHeader('X-RateLimit-Reset', Math.ceil(Date.now() / 1000) + windowSeconds);

      if (result > limit) {
        throw new HttpException(
          {
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'تم تجاوز الحد الأقصى للطلبات. حاول مرة أخرى بعد قليل',
            },
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      return true;
    } catch (err) {
      // If it's our own rate limit error, re-throw
      if (err instanceof HttpException) throw err;
      // Redis failure — allow request (graceful degradation)
      return true;
    }
  }

  private extractIp(request: any): string {
    return (
      request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      request.headers['x-real-ip'] ||
      request.ip ||
      request.connection?.remoteAddress ||
      'unknown'
    );
  }
}
