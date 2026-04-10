import { Module, Global } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';

/**
 * SecurityModule provides ThrottlerModule for any @Throttle() decorator usage.
 *
 * The actual global rate limiting is handled by RateLimitGuard (APP_GUARD in
 * AppModule) which uses Redis via CacheService for distributed counting.
 * Per-route limits are set via @RateLimit() decorator on controllers.
 */
@Global()
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ([{
        ttl: config.get<number>('THROTTLE_TTL', 60) * 1000,
        limit: config.get<number>('THROTTLE_LIMIT', 100),
      }]),
    }),
  ],
})
export class SecurityModule {}
