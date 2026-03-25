import { Global, Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { EventBusService } from './event-bus.service';
import { BullModule } from '@nestjs/bullmq';

@Global()
@Module({
  imports: [
    BullModule.registerQueue({
      name: 'ops.intelligence',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 200,
      },
    }),
  ],
  providers: [EventsGateway, EventBusService],
  exports: [EventsGateway, EventBusService],
})
export class EventsModule {}
