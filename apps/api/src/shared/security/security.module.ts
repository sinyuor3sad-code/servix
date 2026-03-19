import { Module, Global } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

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
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class SecurityModule {}
