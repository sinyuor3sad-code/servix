import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationDispatchService } from './notification-dispatch.service';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationDispatchService],
  exports: [NotificationDispatchService],
})
export class NotificationsModule {}
