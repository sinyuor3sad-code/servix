import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaClient } from '../../shared/types';
import { GetNotificationsDto, UpdateNotificationSettingsDto } from './notifications.dto';

interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

const SETTINGS_KEY_MAP: Record<string, string> = {
  emailEnabled: 'notification_email_enabled',
  smsEnabled: 'notification_sms_enabled',
  whatsappEnabled: 'notification_whatsapp_enabled',
  bookingNotifications: 'notification_booking_enabled',
  paymentNotifications: 'notification_payment_enabled',
  reminderNotifications: 'notification_reminder_enabled',
};

@Injectable()
export class NotificationsService {
  async findAll(
    db: TenantPrismaClient,
    userId: string,
    dto: GetNotificationsDto,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const page = dto.page ?? 1;
    const perPage = dto.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const where: Record<string, unknown> = {
      recipientId: userId,
    };

    if (dto.type) {
      where.type = dto.type;
    }

    if (dto.isRead !== undefined) {
      where.isRead = dto.isRead;
    }

    const [data, total] = await Promise.all([
      db.notification.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
      }),
      db.notification.count({ where }),
    ]);

    return {
      data: data as unknown as Record<string, unknown>[],
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  async markAsRead(
    db: TenantPrismaClient,
    id: string,
    userId: string,
  ): Promise<Record<string, unknown>> {
    const notification = await db.notification.findFirst({
      where: { id, recipientId: userId },
    });

    if (!notification) {
      throw new NotFoundException('الإشعار غير موجود');
    }

    const updated = await db.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return updated as unknown as Record<string, unknown>;
  }

  async markAllAsRead(
    db: TenantPrismaClient,
    userId: string,
  ): Promise<{ count: number }> {
    const result = await db.notification.updateMany({
      where: { recipientId: userId, isRead: false },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { count: result.count };
  }

  async getSettings(
    db: TenantPrismaClient,
  ): Promise<Record<string, boolean>> {
    const keys = Object.values(SETTINGS_KEY_MAP);
    const settings = await db.setting.findMany({
      where: { key: { in: keys } },
    });

    const settingsMap = new Map(settings.map((s) => [s.key, s.value]));
    const result: Record<string, boolean> = {};

    for (const [dtoKey, dbKey] of Object.entries(SETTINGS_KEY_MAP)) {
      result[dtoKey] = settingsMap.get(dbKey) === 'true';
    }

    return result;
  }

  async updateSettings(
    db: TenantPrismaClient,
    dto: UpdateNotificationSettingsDto,
  ): Promise<Record<string, boolean>> {
    const operations = Object.entries(dto)
      .filter(([key, value]) => value !== undefined && key in SETTINGS_KEY_MAP)
      .map(([key, value]) => {
        const dbKey = SETTINGS_KEY_MAP[key];
        return db.setting.upsert({
          where: { key: dbKey },
          update: { value: String(value) },
          create: { key: dbKey, value: String(value) },
        });
      });

    if (operations.length > 0) {
      await db.$transaction(operations);
    }

    return this.getSettings(db);
  }
}
