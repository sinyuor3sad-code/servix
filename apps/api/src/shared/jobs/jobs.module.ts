import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { NotificationProcessor } from './notification.processor';
import { DomainEventProcessor } from './domain-event.processor';
import { SettingsModule } from '../../modules/salon/settings/settings.module';
import { HealingModule } from '../../modules/salon/healing/healing.module';
import { InventoryModule } from '../../modules/salon/inventory/inventory.module';

@Global()
@Module({
  imports: [
    SettingsModule,
    HealingModule,
    InventoryModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD', '') || undefined,
        },
      }),
    }),
    BullModule.registerQueue(
      {
        name: 'notifications',
        defaultJobOptions: {
          attempts: 4,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: 100,
        },
      },
      { name: 'emails' },
      { name: 'sms' },
    ),
  ],
  providers: [NotificationProcessor, DomainEventProcessor],
  exports: [BullModule],
})
export class JobsModule {}
