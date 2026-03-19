import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaClient } from '../../../node_modules/.prisma/tenant';
import { EventsGateway } from '../../shared/events/events.gateway';

type NotificationType =
  | 'booking_new'
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'payment'
  | 'reminder'
  | 'general';

type NotificationChannel = 'in_app' | 'email' | 'sms' | 'whatsapp';

interface DispatchNotificationOptions {
  tenantDb: PrismaClient;
  tenantId: string;
  recipientType: 'employee' | 'client';
  recipientId: string;
  recipientContact?: string;
  titleAr: string;
  bodyAr: string;
  type: NotificationType;
  channels: NotificationChannel[];
  data?: Record<string, unknown>;
}

@Injectable()
export class NotificationDispatchService {
  private readonly logger = new Logger(NotificationDispatchService.name);

  constructor(
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async dispatch(options: DispatchNotificationOptions): Promise<void> {
    const notification = await options.tenantDb.notification.create({
      data: {
        recipientType: options.recipientType,
        recipientId: options.recipientId,
        titleAr: options.titleAr,
        bodyAr: options.bodyAr,
        type: options.type,
        channel: 'in_app',
        data: (options.data as unknown as undefined) ?? undefined,
        sentAt: new Date(),
      },
    });

    this.eventsGateway.emitToUser(options.recipientId, 'notification:new', {
      id: notification.id,
      titleAr: options.titleAr,
      bodyAr: options.bodyAr,
      type: options.type,
      data: options.data,
      createdAt: notification.createdAt,
    });

    for (const channel of options.channels) {
      if (channel === 'in_app') continue;
      if (!options.recipientContact) {
        this.logger.warn(
          `تخطي قناة ${channel} — لا يوجد بيانات اتصال للمستلم ${options.recipientId}`,
        );
        continue;
      }

      await this.notificationsQueue.add(`send-${channel}`, {
        tenantId: options.tenantId,
        channel,
        recipientType: options.recipientType,
        recipientId: options.recipientId,
        recipientContact: options.recipientContact,
        titleAr: options.titleAr,
        bodyAr: options.bodyAr,
        type: options.type,
        data: options.data,
      });
    }
  }

  async getUnreadCount(
    tenantDb: PrismaClient,
    userId: string,
  ): Promise<number> {
    return tenantDb.notification.count({
      where: { recipientId: userId, isRead: false },
    });
  }
}
