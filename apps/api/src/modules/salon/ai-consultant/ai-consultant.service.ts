import { Injectable, Logger } from '@nestjs/common';
import { TenantClientFactory } from '../../../shared/database/tenant-client.factory';
import { GeminiService } from '../../../shared/ai/gemini.service';
import { CacheService } from '../../../shared/cache/cache.service';

const SALON_DATA_CACHE_PREFIX = 'servix:ai_data:';
const SALON_DATA_CACHE_TTL = 900; // 15 minutes

/**
 * AI Consultant Service — Gathers comprehensive salon data
 * and routes questions to Gemini AI for intelligent business advice.
 *
 * Privacy (PDPL): All client names/phones are stripped.
 * Only aggregated statistics and employee data are sent to AI.
 */
@Injectable()
export class AiConsultantService {
  private readonly logger = new Logger(AiConsultantService.name);

  constructor(
    private readonly tenantFactory: TenantClientFactory,
    private readonly gemini: GeminiService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Answer a question using salon data context.
   */
  async ask(
    tenantId: string,
    databaseName: string,
    question: string,
  ): Promise<string> {
    // 1. Gather salon data (cached for 15 minutes)
    const salonData = await this.gatherSalonData(tenantId, databaseName);

    // 2. Send to Gemini consultant
    const answer = await this.gemini.consultantChat(
      tenantId,
      question,
      salonData,
    );

    return answer;
  }

  /**
   * Gather comprehensive salon data for AI context.
   * Cached in Redis for 15 minutes to avoid repeated DB queries.
   */
  async gatherSalonData(
    tenantId: string,
    databaseName: string,
  ): Promise<Record<string, unknown>> {
    const cacheKey = `${SALON_DATA_CACHE_PREFIX}${tenantId}`;

    // Try cache first
    try {
      const cached = await this.cache.getSettings(cacheKey);
      if (cached?.data) {
        this.logger.debug(`Cache hit for salon data: ${tenantId}`);
        return JSON.parse(cached.data);
      }
    } catch {
      // Cache miss — continue
    }

    this.logger.log(`Gathering salon data for tenant: ${tenantId}`);

    try {
      const db = this.tenantFactory.getTenantClient(databaseName);
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Run all queries in parallel
      const [
        salonInfo,
        // Revenue
        thisMonthRevenue,
        lastMonthRevenue,
        todayRevenue,
        // Clients
        totalClients,
        newClientsThisMonth,
        inactiveClients,
        // Services (top 10)
        topServices,
        // Employees
        employees,
        // Appointment stats
        appointmentStats,
        // Expenses
        thisMonthExpenses,
        // Peak hours
        peakHours,
      ] = await Promise.all([
        // Salon info
        db.salonInfo.findFirst(),

        // Revenue this month
        db.invoice.aggregate({
          _sum: { total: true },
          _count: true,
          where: {
            status: 'paid',
            createdAt: { gte: firstOfMonth },
          },
        }),

        // Revenue last month
        db.invoice.aggregate({
          _sum: { total: true },
          _count: true,
          where: {
            status: 'paid',
            createdAt: { gte: firstOfLastMonth, lt: firstOfMonth },
          },
        }),

        // Revenue today
        db.invoice.aggregate({
          _sum: { total: true },
          _count: true,
          where: {
            status: 'paid',
            createdAt: { gte: today },
          },
        }),

        // Total active clients
        db.client.count({ where: { isActive: true } }),

        // New clients this month
        db.client.count({
          where: { createdAt: { gte: firstOfMonth } },
        }),

        // Inactive clients (30+ days without visit)
        db.client.count({
          where: {
            isActive: true,
            lastVisitAt: { lt: thirtyDaysAgo },
          },
        }),

        // Top 10 services by appointment count this month
        db.appointmentService.groupBy({
          by: ['serviceId'],
          _count: true,
          orderBy: { _count: { serviceId: 'desc' } },
          take: 10,
          where: {
            appointment: {
              date: { gte: firstOfMonth },
              status: { notIn: ['cancelled', 'no_show'] },
            },
          },
        }),

        // All active employees with appointment count this month
        db.employee.findMany({
          where: { isActive: true },
          select: {
            id: true,
            fullName: true,
            role: true,
            appointments: {
              where: {
                date: { gte: firstOfMonth },
                status: { notIn: ['cancelled', 'no_show'] },
              },
              select: { totalPrice: true },
            },
          },
        }),

        // Appointment status distribution this month
        db.appointment.groupBy({
          by: ['status'],
          _count: true,
          where: { date: { gte: firstOfMonth } },
        }),

        // Total expenses this month
        db.expense.aggregate({
          _sum: { amount: true },
          _count: true,
          where: { date: { gte: firstOfMonth } },
        }),

        // Appointments grouped by hour (peak hours analysis)
        db.appointment.findMany({
          where: {
            date: { gte: firstOfMonth },
            status: { notIn: ['cancelled', 'no_show'] },
          },
          select: { startTime: true },
        }),
      ]);

      // ─── Process results ───

      // Get service names for top services
      const serviceIds = topServices.map((s) => s.serviceId);
      const services = serviceIds.length > 0
        ? await db.service.findMany({
            where: { id: { in: serviceIds } },
            select: { id: true, nameAr: true, price: true },
          })
        : [];

      const serviceMap = new Map(services.map((s) => [s.id, s]));

      // Peak hours distribution
      const hourDistribution: Record<string, number> = {};
      for (const appt of peakHours) {
        const hour = appt.startTime.split(':')[0];
        hourDistribution[hour] = (hourDistribution[hour] || 0) + 1;
      }

      // Employee performance (no client PII, just stats)
      const employeePerformance = employees.map((emp) => ({
        name: emp.fullName,
        role: emp.role,
        appointmentsThisMonth: emp.appointments.length,
        revenueThisMonth: emp.appointments.reduce(
          (sum, a) => sum + Number(a.totalPrice),
          0,
        ),
      }));

      // Appointment status breakdown
      const statusBreakdown: Record<string, number> = {};
      for (const stat of appointmentStats) {
        statusBreakdown[stat.status] = stat._count;
      }

      const totalAppointments = Object.values(statusBreakdown).reduce((a, b) => a + b, 0);
      const cancelledCount = (statusBreakdown['cancelled'] || 0) + (statusBreakdown['no_show'] || 0);
      const completedCount = statusBreakdown['completed'] || 0;

      const salonData: Record<string, unknown> = {
        salonName: salonInfo?.nameAr || salonInfo?.nameEn || 'الصالون',
        workingHours: salonInfo
          ? `${salonInfo.openingTime} - ${salonInfo.closingTime}`
          : 'غير محدد',

        revenue: {
          today: Number(todayRevenue._sum.total || 0),
          todayInvoiceCount: todayRevenue._count,
          thisMonth: Number(thisMonthRevenue._sum.total || 0),
          thisMonthInvoiceCount: thisMonthRevenue._count,
          lastMonth: Number(lastMonthRevenue._sum.total || 0),
          lastMonthInvoiceCount: lastMonthRevenue._count,
          growthPercent: lastMonthRevenue._sum.total
            ? Math.round(
                ((Number(thisMonthRevenue._sum.total || 0) -
                  Number(lastMonthRevenue._sum.total || 0)) /
                  Number(lastMonthRevenue._sum.total)) *
                  100,
              )
            : null,
        },

        clients: {
          total: totalClients,
          newThisMonth: newClientsThisMonth,
          inactivePlus30Days: inactiveClients,
        },

        topServices: topServices.map((s) => ({
          name: serviceMap.get(s.serviceId)?.nameAr || 'خدمة',
          price: Number(serviceMap.get(s.serviceId)?.price || 0),
          appointmentCount: s._count,
        })),

        employees: employeePerformance,

        appointments: {
          totalThisMonth: totalAppointments,
          completed: completedCount,
          cancelled: cancelledCount,
          completionRate: totalAppointments
            ? Math.round((completedCount / totalAppointments) * 100)
            : 0,
          cancellationRate: totalAppointments
            ? Math.round((cancelledCount / totalAppointments) * 100)
            : 0,
          statusBreakdown,
        },

        expenses: {
          totalThisMonth: Number(thisMonthExpenses._sum.amount || 0),
          count: thisMonthExpenses._count,
        },

        peakHours: hourDistribution,

        netProfit: {
          thisMonth:
            Number(thisMonthRevenue._sum.total || 0) -
            Number(thisMonthExpenses._sum.amount || 0),
        },
      };

      // Cache the result
      try {
        await this.cache.setSettings(cacheKey, {
          data: JSON.stringify(salonData),
        });
      } catch {
        // Cache write failed — non-fatal
      }

      return salonData;
    } catch (err) {
      this.logger.error(
        `Failed to gather salon data for ${tenantId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      return { error: 'فشل في جمع بيانات الصالون' };
    }
  }
}
