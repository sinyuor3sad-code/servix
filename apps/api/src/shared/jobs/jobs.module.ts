import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { NotificationProcessor } from './notification.processor';
import { DomainEventProcessor } from './domain-event.processor';
import { FailedJobsListener } from './failed-jobs.listener';
import { SettingsModule } from '../../modules/salon/settings/settings.module';
import { HealingModule } from '../../modules/salon/healing/healing.module';
import { InventoryModule } from '../../modules/salon/inventory/inventory.module';

const DEFAULT_JOB_OPTIONS = {
  attempts: 4,
  backoff: { type: 'exponential' as const, delay: 5000 }, // 5s, 10s, 20s, 40s
  removeOnComplete: {
    age: 86400,  // Keep completed for 24h
    count: 1000, // Or max 1000 jobs
  },
  removeOnFail: false, // Keep failed jobs for analysis
};

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
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      },
      {
        name: 'emails',
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      },
      {
        name: 'sms',
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      },
      {
        name: 'dead-letter',
        defaultJobOptions: {
          removeOnComplete: false,
          removeOnFail: false,
        },
      },
    ),
  ],
  providers: [NotificationProcessor, DomainEventProcessor, FailedJobsListener],
  exports: [BullModule],
})
export class JobsModule {}
