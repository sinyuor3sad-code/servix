import { Module } from '@nestjs/common';
import { EventsModule } from '../../../shared/events';
import { SelfOrdersController } from './self-orders.controller';
import { SelfOrdersService } from './self-orders.service';

@Module({
  imports: [EventsModule],
  controllers: [SelfOrdersController],
  providers: [SelfOrdersService],
  exports: [SelfOrdersService],
})
export class SelfOrdersModule {}
