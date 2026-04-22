import { Injectable, Logger } from '@nestjs/common';
import { TenantClientFactory } from '../../../shared/database/tenant-client.factory';

// ─────────────────── Types ───────────────────

export interface SalonContextForAI {
  salonName: string;
  phone?: string;
  address?: string;
  city?: string;
  workingHours: string;
  workingDays: Record<string, unknown>;
  services: Array<{
    name: string;
    price: number;
    duration: number;
    category: string;
  }>;
  employees: Array<{ name: string; role: string }>;
  policies: {
    cancellationNotice: string;
    currency: string;
    taxPercentage: number;
  };
  clientInfo?: {
    name: string;
    visits: number;
    loyaltyPoints: number;
    lastVisit: string;
  };
}

/**
 * Context Builder — Gathers all salon data needed for the AI receptionist.
 *
 * This is the "knowledge base" that the AI uses to answer customer questions
 * about services, prices, availability, employees, and policies.
 */
@Injectable()
export class AIContextBuilder {
  private readonly logger = new Logger(AIContextBuilder.name);

  constructor(private readonly tenantFactory: TenantClientFactory) {}

  /**
   * Build a comprehensive salon context for AI prompt injection.
   *
   * @param databaseName - tenant database name
   * @param clientPhone  - optional: personalizes the context with client history
   */
  async buildForTenant(
    databaseName: string,
    clientPhone?: string,
  ): Promise<SalonContextForAI> {
    try {
      const db = this.tenantFactory.getTenantClient(databaseName);

      // Parallel fetch for speed
      const [salonInfo, services, employees, client] = await Promise.all([
        db.salonInfo.findFirst(),
        db.service.findMany({
          where: { isActive: true },
          include: { category: true },
          orderBy: { sortOrder: 'asc' },
        }),
        db.employee.findMany({
          where: { isActive: true },
          select: { fullName: true, role: true },
        }),
        clientPhone
          ? db.client.findFirst({
              where: {
                phone: { contains: clientPhone.replace(/\D/g, '').slice(-9) },
                isActive: true,
              },
              include: { loyaltyPoints: true },
            })
          : null,
      ]);

      const workingHours = salonInfo
        ? `${salonInfo.openingTime} - ${salonInfo.closingTime}`
        : 'غير محدد';

      let clientInfo: SalonContextForAI['clientInfo'] | undefined;
      if (client) {
        clientInfo = {
          name: client.fullName,
          visits: client.totalVisits,
          loyaltyPoints: client.loyaltyPoints?.points || 0,
          lastVisit: client.lastVisitAt?.toISOString() || 'لا يوجد',
        };
      }

      return {
        salonName: salonInfo?.nameAr || salonInfo?.nameEn || 'الصالون',
        phone: salonInfo?.phone || undefined,
        address: salonInfo?.address || undefined,
        city: salonInfo?.city || undefined,
        workingHours,
        workingDays: (salonInfo?.workingDays as Record<string, unknown>) || {},
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
        policies: {
          cancellationNotice: 'يجب الإلغاء قبل ساعتين على الأقل',
          currency: salonInfo?.currency || 'SAR',
          taxPercentage: Number(salonInfo?.taxPercentage || 15),
        },
        clientInfo,
      };
    } catch (err) {
      this.logger.error(
        `Failed to build salon context: ${(err as Error).message}`,
      );
      return {
        salonName: '',
        workingHours: '',
        workingDays: {},
        services: [],
        employees: [],
        policies: { cancellationNotice: '', currency: 'SAR', taxPercentage: 15 },
      };
    }
  }
}
