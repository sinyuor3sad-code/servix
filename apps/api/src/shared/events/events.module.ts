import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bullmq';
import jwtConfig from '../config/jwt.config';
import { EventsGateway } from './events.gateway';
import { EventBusService } from './event-bus.service';
import { WsAuthGuard } from './ws-auth.guard';

@Global()
@Module({
  imports: [
    ConfigModule.forFeature(jwtConfig),
    // Local JwtModule registration (V-01) — we deliberately do NOT
    // import AuthModule here to avoid a circular dependency.
    // The accessSecret is the same as the HTTP layer's, sourced from
    // the same jwt.config namespace.
    JwtModule.registerAsync({
      imports: [ConfigModule.forFeature(jwtConfig)],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.accessSecret') || '',
      }),
    }),
    BullModule.registerQueue({
      name: 'ops.intelligence',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 200,
      },
    }),
  ],
  providers: [EventsGateway, EventBusService, WsAuthGuard],
  exports: [EventsGateway, EventBusService, WsAuthGuard],
})
export class EventsModule {}
