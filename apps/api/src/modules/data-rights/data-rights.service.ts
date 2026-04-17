import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PlatformPrismaClient } from '../../shared/database/platform.client';
import { EncryptionService } from '../../shared/encryption/encryption.service';
import type { TenantPrismaClient } from '../../shared/types';

/** Setting keys used to persist deletion requests (avoids new migration) */
const DELETION_REQUESTED_AT_KEY = 'pdpl_deletion_requested_at';
const DELETION_SCHEDULED_AT_KEY = 'pdpl_deletion_scheduled_at';
const DELETION_USER_ID_KEY = 'pdpl_deletion_user_id';

/** Cooling period before actual deletion (PDPL Art. 16) */
const DELETION_COOLING_DAYS = 30;

/**
 * PDPL Data Rights Service
 * Implements Saudi Personal Data Protection Law (PDPL) requirements
 * with real database queries against platform + tenant schemas.
 */
@Injectable()
export class DataRightsService {
  private readonly logger = new Logger(DataRightsService.name);

  constructor(
    private readonly platformDb: PlatformPrismaClient,
    private readonly encryptionService: EncryptionService,
  ) {}

  /**
   * Export all user data in JSON format (PDPL Art. 14)
   * Queries real data from platform User table + tenant tables.
   */
  async exportAll(
    userId: string,
    tenantDb: TenantPrismaClient | null,
  ): Promise<{
    profile: Record<string, any>;
    appointments: any[];
    invoices: any[];
    settings: Record<string, string>;
    activityLog: any[];
    exportedAt: string;
  }> {
    this.logger.log(`Exporting data for user ${userId}`);

    // 1. Platform profile
    const user = await this.platformDb.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        avatarUrl: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        authProvider: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('المستخدم غير موجود');
    }

    // Decrypt fields if encrypted
    const profile = {
      ...user,
      email: this.encryptionService.decrypt(user.email),
      phone: this.encryptionService.decrypt(user.phone),
    };

    // 2. Tenant-level data (if tenant context is available)
    let appointments: any[] = [];
    let invoices: any[] = [];
    const settings: Record<string, string> = {};
    let activityLog: any[] = [];

    if (tenantDb) {
      // Find the client record matching this user's phone
      const client = await tenantDb.client.findFirst({
        where: {
          phone: { contains: user.phone.slice(-9) },
          isActive: true,
        },
      });

      if (client) {
        // Appointments with services
        appointments = await tenantDb.appointment.findMany({
          where: { clientId: client.id },
          include: {
            appointmentServices: {
              include: { service: { select: { nameAr: true } } },
            },
            employee: { select: { fullName: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 500,
        });

        // Invoices with items
        invoices = await tenantDb.invoice.findMany({
          where: { clientId: client.id },
          include: {
            invoiceItems: { select: { description: true, quantity: true, unitPrice: true, totalPrice: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 500,
        });
      }

      // User's activity log
      activityLog = await tenantDb.activityLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });

      // Settings (non-sensitive only)
      const allSettings = await tenantDb.setting.findMany();
      const sensitiveKeys = ['whatsapp_access_token'];
      for (const s of allSettings) {
        if (!sensitiveKeys.includes(s.key)) {
          settings[s.key] = s.value;
        }
      }
    }

    return {
      profile,
      appointments,
      invoices,
      settings,
      activityLog,
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * Correct user data (PDPL Art. 15)
   * Updates allowed fields on both platform User and tenant Client tables.
   */
  async correct(
    userId: string,
    corrections: Record<string, any>,
    tenantDb: TenantPrismaClient | null,
  ): Promise<{ updated: boolean; fields: string[] }> {
    this.logger.log(
      `Correcting data for user ${userId}: ${Object.keys(corrections).join(', ')}`,
    );

    const allowedFields = ['fullName', 'phone', 'email', 'dateOfBirth'];
    const validFields = Object.keys(corrections).filter((f) =>
      allowedFields.includes(f),
    );

    if (validFields.length === 0) {
      throw new NotFoundException('لا توجد حقول صالحة للتعديل');
    }

    // Build platform update
    const platformUpdate: Record<string, any> = {};
    if (corrections.fullName) platformUpdate.fullName = corrections.fullName;
    if (corrections.phone) platformUpdate.phone = corrections.phone;
    if (corrections.email) platformUpdate.email = corrections.email;

    if (Object.keys(platformUpdate).length > 0) {
      // Encrypt sensitive fields before storage
      if (platformUpdate.phone) {
        platformUpdate.phone = this.encryptionService.encrypt(platformUpdate.phone);
      }
      if (platformUpdate.email) {
        platformUpdate.email = this.encryptionService.encrypt(platformUpdate.email);
      }

      await this.platformDb.user.update({
        where: { id: userId },
        data: platformUpdate,
      });
    }

    // Update tenant Client record if tenant context available
    if (tenantDb) {
      const user = await this.platformDb.user.findUnique({
        where: { id: userId },
        select: { phone: true },
      });

      if (user) {
        const decryptedPhone = this.encryptionService.decrypt(user.phone);
        const client = await tenantDb.client.findFirst({
          where: {
            phone: { contains: decryptedPhone.slice(-9) },
            isActive: true,
          },
        });

        if (client) {
          const clientUpdate: Record<string, any> = {};
          if (corrections.fullName) clientUpdate.fullName = corrections.fullName;
          if (corrections.phone) clientUpdate.phone = corrections.phone;
          if (corrections.email) clientUpdate.email = corrections.email;
          if (corrections.dateOfBirth) clientUpdate.dateOfBirth = new Date(corrections.dateOfBirth);

          if (Object.keys(clientUpdate).length > 0) {
            await tenantDb.client.update({
              where: { id: client.id },
              data: clientUpdate,
            });
          }
        }
      }
    }

    return { updated: true, fields: validFields };
  }

  /**
   * Request account deletion (PDPL Art. 16)
   * 30-day cooling period. Persisted via tenant Settings table.
   * Tax-related data (invoices, audit logs) retained per ZATCA regulations.
   */
  async requestDeletion(
    userId: string,
    tenantDb: TenantPrismaClient | null,
  ): Promise<{
    status: string;
    scheduledDeletionDate: string;
    retainedData: string[];
  }> {
    const now = new Date();
    const scheduledAt = new Date(
      now.getTime() + DELETION_COOLING_DAYS * 24 * 60 * 60 * 1000,
    );

    // Persist deletion request in tenant settings
    if (tenantDb) {
      const entries = [
        { key: DELETION_REQUESTED_AT_KEY, value: now.toISOString() },
        { key: DELETION_SCHEDULED_AT_KEY, value: scheduledAt.toISOString() },
        { key: DELETION_USER_ID_KEY, value: userId },
      ];

      for (const entry of entries) {
        await tenantDb.setting.upsert({
          where: { key: entry.key },
          update: { value: entry.value },
          create: { key: entry.key, value: entry.value },
        });
      }
    }

    this.logger.warn(
      `Deletion scheduled for user ${userId} at ${scheduledAt.toISOString()}`,
    );

    return {
      status: 'pending_deletion',
      scheduledDeletionDate: scheduledAt.toISOString(),
      retainedData: [
        'الفواتير (متطلب نظام الضريبة — محفوظة 7 سنوات)',
        'سجلات التدقيق (متطلب تنظيمي)',
      ],
    };
  }

  /**
   * Cancel a pending deletion request
   */
  async cancelDeletion(
    userId: string,
    tenantDb: TenantPrismaClient | null,
  ): Promise<{ cancelled: boolean }> {
    if (!tenantDb) {
      throw new NotFoundException('لا يوجد سياق مستأجر');
    }

    const pending = await tenantDb.setting.findUnique({
      where: { key: DELETION_REQUESTED_AT_KEY },
    });

    if (!pending) {
      throw new NotFoundException('لا يوجد طلب حذف معلق');
    }

    // Verify this deletion belongs to the requesting user
    const deletionUserId = await tenantDb.setting.findUnique({
      where: { key: DELETION_USER_ID_KEY },
    });

    if (deletionUserId?.value !== userId) {
      throw new NotFoundException('لا يوجد طلب حذف معلق');
    }

    // Remove deletion settings
    await tenantDb.setting.deleteMany({
      where: {
        key: {
          in: [
            DELETION_REQUESTED_AT_KEY,
            DELETION_SCHEDULED_AT_KEY,
            DELETION_USER_ID_KEY,
          ],
        },
      },
    });

    this.logger.log(`Deletion cancelled for user ${userId}`);
    return { cancelled: true };
  }

  /**
   * Process pending deletions (called by cron job).
   * Anonymizes personal data while retaining tax/audit records.
   */
  async processPendingDeletions(
    tenantDb: TenantPrismaClient,
  ): Promise<number> {
    const scheduledSetting = await tenantDb.setting.findUnique({
      where: { key: DELETION_SCHEDULED_AT_KEY },
    });

    if (!scheduledSetting) return 0;

    const scheduledAt = new Date(scheduledSetting.value);
    const now = new Date();

    if (now < scheduledAt) return 0;

    const userIdSetting = await tenantDb.setting.findUnique({
      where: { key: DELETION_USER_ID_KEY },
    });

    if (!userIdSetting) return 0;

    const userId = userIdSetting.value;
    this.logger.warn(`Executing deletion for user ${userId}`);

    // Find the user's client record
    const user = await this.platformDb.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    });

    if (user) {
      const decryptedPhone = this.encryptionService.decrypt(user.phone);
      const client = await tenantDb.client.findFirst({
        where: {
          phone: { contains: decryptedPhone.slice(-9) },
        },
      });

      if (client) {
        // Anonymize client record (keep invoices intact for tax)
        await tenantDb.client.update({
          where: { id: client.id },
          data: {
            fullName: 'مستخدم محذوف',
            phone: '0000000000',
            email: null,
            notes: null,
            dateOfBirth: null,
            isActive: false,
            deletedAt: now,
          },
        });
      }

      // Anonymize platform user
      await this.platformDb.user.update({
        where: { id: userId },
        data: {
          fullName: 'مستخدم محذوف',
          phone: `deleted_${userId.slice(0, 8)}`,
          email: `deleted_${userId.slice(0, 8)}@deleted.local`,
          avatarUrl: null,
          twoFactorEnabled: false,
          twoFactorSecret: null,
          googleId: null,
        },
      });
    }

    // Clean up deletion settings
    await tenantDb.setting.deleteMany({
      where: {
        key: {
          in: [
            DELETION_REQUESTED_AT_KEY,
            DELETION_SCHEDULED_AT_KEY,
            DELETION_USER_ID_KEY,
          ],
        },
      },
    });

    return 1;
  }
}
