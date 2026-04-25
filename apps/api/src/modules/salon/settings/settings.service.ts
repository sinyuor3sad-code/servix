import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { TenantPrismaClient } from '../../../shared/types';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { CacheService } from '../../../shared/cache';
import { AuditService } from '../../../core/audit/audit.service';
import { EventsGateway } from '../../../shared/events';
import { SETTINGS_DEFAULTS } from './settings.constants';
import { PlatformPrismaClient } from '../../../shared/database/platform.client';
import { TenantClientFactory } from '../../../shared/database/tenant-client.factory';
import { validateSetting, validateSettingsBatch } from './settings.schema';

@Injectable()
export class SettingsService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly eventsGateway: EventsGateway,
    private readonly platformDb: PlatformPrismaClient,
    private readonly tenantFactory: TenantClientFactory,
    private readonly auditService: AuditService,
  ) {}

  async getAll(
    db: TenantPrismaClient,
    tenantId?: string,
  ): Promise<Record<string, string>> {
    if (tenantId) {
      const cached = await this.cacheService.getSettings(tenantId);
      if (cached) return { ...SETTINGS_DEFAULTS, ...cached };
    }

    const settings = await db.setting.findMany();
    const result: Record<string, string> = { ...SETTINGS_DEFAULTS };
    for (const setting of settings) {
      result[setting.key] = setting.value;
    }

    if (tenantId) {
      await this.cacheService.setSettings(tenantId, result);
    }
    return result;
  }

  /** Get multiple settings by keys (for WhatsApp etc.) */
  async getMultiple(
    db: TenantPrismaClient,
    keys: string[],
    tenantId?: string,
  ): Promise<Record<string, string>> {
    const all = await this.getAll(db, tenantId);
    const result: Record<string, string> = {};
    for (const key of keys) {
      result[key] = all[key] ?? '';
    }
    return result;
  }

  /** Get settings by salon slug (for public booking API) */
  async getForSlug(slug: string): Promise<Record<string, string>> {
    const tenant = await this.platformDb.tenant.findUnique({
      where: { slug },
    });
    if (!tenant || tenant.status === 'cancelled') {
      throw new NotFoundException('الصالون غير موجود');
    }
    const db = this.tenantFactory.getTenantClient(
      tenant.databaseName,
    ) as unknown as TenantPrismaClient;
    return this.getAll(db, tenant.id);
  }

  /** Get settings by tenant ID (for jobs/processors that only have tenantId) */
  async getForTenantId(tenantId: string): Promise<Record<string, string>> {
    const tenant = await this.platformDb.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant || tenant.status === 'cancelled') {
      return {};
    }
    const db = this.tenantFactory.getTenantClient(
      tenant.databaseName,
    ) as unknown as TenantPrismaClient;
    return this.getAll(db, tenantId);
  }

  async getByKey(
    db: TenantPrismaClient,
    key: string,
  ): Promise<Record<string, unknown>> {
    const setting = await db.setting.findUnique({ where: { key } });

    if (!setting) {
      throw new NotFoundException('الإعداد غير موجود');
    }

    return setting;
  }

  async updateBatch(
    db: TenantPrismaClient,
    dto: UpdateSettingsDto,
    userId: string,
    tenantId?: string,
  ): Promise<Record<string, string>> {
    // Validate setting values before writing
    const errors = validateSettingsBatch(dto.settings);
    if (Object.keys(errors).length > 0) {
      const errorMessages = Object.entries(errors)
        .map(([key, msg]) => `${key}: ${msg}`)
        .join(', ');
      throw new BadRequestException(`قيم إعدادات غير صحيحة — ${errorMessages}`);
    }

    const operations = dto.settings.map((item) =>
      db.setting.upsert({
        where: { key: item.key },
        update: { value: item.value, updatedBy: userId },
        create: { key: item.key, value: item.value, updatedBy: userId },
      }),
    );

    await db.$transaction(operations);

    if (tenantId) {
      await this.cacheService.invalidateSettings(tenantId);
      const updated = await this.getAll(db, tenantId);
      this.eventsGateway.emitToTenant(tenantId, 'settings:updated', updated);
      return updated;
    }
    return this.getAll(db);
  }

  // Note: audit for updateBatch handled in controller or caller with userId context

  async updateByKey(
    db: TenantPrismaClient,
    key: string,
    value: string,
    userId: string,
    tenantId?: string,
  ): Promise<Record<string, unknown>> {
    const error = validateSetting(key, value);
    if (error) {
      throw new BadRequestException(`قيمة إعداد غير صحيحة — ${key}: ${error}`);
    }

    const result = await db.setting.upsert({
      where: { key },
      update: { value, updatedBy: userId },
      create: { key, value, updatedBy: userId },
    });

    if (tenantId) {
      await this.cacheService.invalidateSettings(tenantId);
      const updated = await this.getAll(db, tenantId);
      this.eventsGateway.emitToTenant(tenantId, 'settings:updated', updated);
    }

    return result;
  }
}
