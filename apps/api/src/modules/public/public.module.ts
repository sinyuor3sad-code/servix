import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '../../shared/database';
import { EventsModule } from '../../shared/events';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';
import { OrderExpiryService } from './order-expiry.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DatabaseModule,
    EventsModule,
  ],
  controllers: [PublicController],
  providers: [PublicService, OrderExpiryService],
  exports: [PublicService],
})
export class PublicModule {}
