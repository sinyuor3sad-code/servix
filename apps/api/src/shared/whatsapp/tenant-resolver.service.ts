import { Injectable, Logger } from '@nestjs/common';
import { PlatformPrismaClient } from '../database/platform.client';
import { TenantClientFactory } from '../database/tenant-client.factory';
import { CacheService } from '../cache/cache.service';
import { WhatsAppCredentials } from './whatsapp.service';

// ─────────────────── Types ───────────────────

export interface ResolvedTenant {
  id: string;
  slug: string;
  databaseName: string;
  salonName: string;
  credentials: WhatsAppCredentials;
}

export interface SalonContext {
  salonName: string;
  services: Array<{
    name: string;
    price: number;
    duration: number;
    category: string;
  }>;
  employees: Array<{ name: string; role: string }>;
  workingHours: string;
  availableSlots: Array<{ date: string; time: string; employee: string }>;
  clientInfo?: {
    name: string;
    visits: number;
    loyaltyPoints: number;
    lastVisit: string;
  };
}

// Cache TTL for WhatsApp tenant mapping (10 minutes)
const WA_TENANT_CACHE_TTL = 600;
const WA_TENANT_CACHE_PREFIX = 'servix:wa_tenant:';

/**
 * Tenant Resolver Service — Resolves which Tenant (salon) a WhatsApp message belongs to.
 *
 * Resolution strategy:
 * 1. Check Redis cache for phoneNumberId → tenantId mapping
 * 2. Scan all tenants' settings tables for matching whatsapp_phone_number_id
 * 3. Cache the result for fast subsequent lookups
 *
 * Salon context is pulled from the tenant's database for AI use (Phase 2).
 */
@Injectable()
export class TenantResolverService {
  private readonly logger = new Logger(TenantResolverService.name);

  constructor(
    private readonly platformPrisma: PlatformPrismaClient,
    private readonly tenantFactory: TenantClientFactory,
    private readonly cache: CacheService,
  ) {}

  /**
   * Resolve a Tenant by WhatsApp Phone Number ID.
   * Each salon stores their whatsapp_phone_number_id in their tenant settings table.
   */
  async resolveByPhoneNumberId(
    phoneNumberId: string,
  ): Promise<ResolvedTenant | null> {
    const cacheKey = `${WA_TENANT_CACHE_PREFIX}${phoneNumberId}`;

    // 1. Try Redis cache first
    try {
      const cached = await this.cache.getSettings(cacheKey);
      if (cached?.tenantId) {
        this.logger.debug(
          `Cache hit for phoneNumberId ${phoneNumberId} → tenant ${cached.tenantId}`,
        );
        return {
          id: cached.tenantId,
          slug: cached.slug,
          databaseName: cached.databaseName,
          salonName: cached.salonName,
          credentials: {
            token: cached.whatsappToken,
            phoneNumberId,
          },
        };
      }
    } catch {
      // Cache miss or error — continue to DB lookup
    }

    // 2. Scan platform tenants and check each tenant's settings
    try {
      const tenants = await this.platformPrisma.tenant.findMany({
        where: { status: { in: ['active', 'trial'] } },
        select: {
          id: true,
          slug: true,
          nameAr: true,
          nameEn: true,
          databaseName: true,
        },
      });

      for (const tenant of tenants) {
        try {
          const tenantClient = this.tenantFactory.getTenantClient(
            tenant.databaseName,
          );

          // Check if this tenant has matching WhatsApp Phone Number ID
          const waPhoneSetting = await tenantClient.setting.findUnique({
            where: { key: 'whatsapp_phone_number_id' },
          });

          if (waPhoneSetting?.value === phoneNumberId) {
            // Found the matching tenant — get the WhatsApp token too
            const waTokenSetting = await tenantClient.setting.findUnique({
              where: { key: 'whatsapp_access_token' },
            });

            const resolved: ResolvedTenant = {
              id: tenant.id,
              slug: tenant.slug,
              databaseName: tenant.databaseName,
              salonName: tenant.nameAr || tenant.nameEn || tenant.slug,
              credentials: {
                token: waTokenSetting?.value || '',
                phoneNumberId,
              },
            };

            // 3. Cache the mapping for fast subsequent lookups
            await this.cache.setSettings(cacheKey, {
              tenantId: resolved.id,
              slug: resolved.slug,
              databaseName: resolved.databaseName,
              salonName: resolved.salonName,
              whatsappToken: resolved.credentials.token,
            });

            this.logger.log(
              `✅ Resolved phoneNumberId ${phoneNumberId} → tenant "${resolved.salonName}" (${resolved.id})`,
            );
            return resolved;
          }
        } catch (err) {
          // Skip tenants that fail (e.g., DB not provisioned yet)
          this.logger.debug(
            `Skipping tenant ${tenant.slug} during WA resolution: ${(err as Error).message}`,
          );
        }
      }

      this.logger.warn(
        `No tenant found with whatsapp_phone_number_id=${phoneNumberId}`,
      );
      return null;
    } catch (err) {
      this.logger.error(
        `Failed to resolve tenant for phoneNumberId ${phoneNumberId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      return null;
    }
  }

  /**
   * Gather salon context data for AI prompt building (Phase 2).
   * Pulls services, employees, working hours, and availability from tenant DB.
   */
  async getSalonContext(
    tenantId: string,
    databaseName: string,
    clientPhone?: string,
  ): Promise<SalonContext> {
    try {
      const tenantClient =
        this.tenantFactory.getTenantClient(databaseName);

      // Salon info
      const salonInfo = await tenantClient.salonInfo.findFirst();

      // Active services with categories
      const services = await tenantClient.service.findMany({
        where: { isActive: true },
        include: { category: true },
        orderBy: { sortOrder: 'asc' },
      });

      // Active employees
      const employees = await tenantClient.employee.findMany({
        where: { isActive: true },
        select: { fullName: true, role: true },
      });

      // Working hours
      const workingHours = salonInfo
        ? `${salonInfo.openingTime} - ${salonInfo.closingTime}`
        : 'غير محدد';

      // Client info (if phone provided)
      let clientInfo: SalonContext['clientInfo'] | undefined;
      if (clientPhone) {
        const normalizedPhone = clientPhone.replace(/\D/g, '');
        const client = await tenantClient.client.findFirst({
          where: {
            phone: { contains: normalizedPhone.slice(-9) },
            isActive: true,
          },
          include: { loyaltyPoints: true },
        });

        if (client) {
          clientInfo = {
            name: client.fullName,
            visits: client.totalVisits,
            loyaltyPoints: client.loyaltyPoints?.points || 0,
            lastVisit: client.lastVisitAt?.toISOString() || 'لا يوجد',
          };
        }
      }

      return {
        salonName:
          salonInfo?.nameAr || salonInfo?.nameEn || 'الصالون',
        services: services.map((s) => ({
          name: s.nameAr,
          price: Number(s.price),
          duration: s.duration,
          category: s.category?.nameAr || 'عام',
        })),
        employees: employees.map((e) => ({
          name: e.fullName,
          role: e.role,
        })),
        workingHours,
        availableSlots: [], // Phase 2: Will compute available slots from appointments
        clientInfo,
      };
    } catch (err) {
      this.logger.error(
        `Failed to gather salon context for tenant ${tenantId}: ${(err as Error).message}`,
      );
      return {
        salonName: '',
        services: [],
        employees: [],
        workingHours: '',
        availableSlots: [],
      };
    }
  }
}
