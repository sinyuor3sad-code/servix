import { Injectable, Logger } from '@nestjs/common';
import { TenantClientFactory } from '../../../shared/database/tenant-client.factory';
import { GeminiService } from '../../../shared/ai/gemini.service';
import { CacheService } from '../../../shared/cache/cache.service';

const SALON_DATA_CACHE_PREFIX = 'servix:ai_data:';

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
   *
   * Queries are batched sequentially (2 at a time) to respect
   * the Prisma connection_limit=2 per tenant and avoid pool deadlocks.
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

    // Wrap everything in a 20-second timeout to prevent indefinite hanging
    const timeoutMs = 20_000;
    const dataPromise = this._gatherSalonDataInternal(tenantId, databaseName, cacheKey);
    const timeoutPromise = new Promise<Record<string, unknown>>((_, reject) =>
      setTimeout(() => reject(new Error(`Salon data gathering timed out after ${timeoutMs}ms`)), timeoutMs),
    );

    try {
      return await Promise.race([dataPromise, timeoutPromise]);
    } catch (err) {
      this.logger.error(
        `Failed to gather salon data for ${tenantId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      // Return minimal data so the AI can still respond
      return { salonName: 'الصالون', error: 'فشل في جمع بيانات الصالون — سيتم الرد بدون بيانات تفصيلية' };
    }
  }

  /**
   * Internal implementation — runs queries in small sequential batches
   * to avoid exhausting the tenant connection pool (connection_limit=2).
   */
  private async _gatherSalonDataInternal(
    tenantId: string,
    databaseName: string,
    cacheKey: string,
  ): Promise<Record<string, unknown>> {
    const db = this.tenantFactory.getTenantClient(databaseName);
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // ─── Batch 1: Salon info + Revenue this month ───
    this.logger.debug(`[AI-Data] Batch 1: salonInfo + thisMonthRevenue`);
    const [salonInfo, thisMonthRevenue] = await Promise.all([
      db.salonInfo.findFirst({
        select: {
          nameAr: true, nameEn: true, taglineAr: true, descriptionAr: true,
          city: true, address: true, workingDays: true,
          openingTime: true, closingTime: true, slotDuration: true,
          taxPercentage: true,
        },
      }),
      db.invoice.aggregate({
        _sum: { total: true },
        _count: true,
        where: { status: 'paid', createdAt: { gte: firstOfMonth } },
      }),
    ]);

    // ─── Batch 2: Revenue last month + today ───
    this.logger.debug(`[AI-Data] Batch 2: lastMonthRevenue + todayRevenue`);
    const [lastMonthRevenue, todayRevenue] = await Promise.all([
      db.invoice.aggregate({
        _sum: { total: true },
        _count: true,
        where: { status: 'paid', createdAt: { gte: firstOfLastMonth, lt: firstOfMonth } },
      }),
      db.invoice.aggregate({
        _sum: { total: true },
        _count: true,
        where: { status: 'paid', createdAt: { gte: today } },
      }),
    ]);

    // ─── Batch 3: Client counts ───
    this.logger.debug(`[AI-Data] Batch 3: client counts`);
    const [totalClients, newClientsThisMonth] = await Promise.all([
      db.client.count({ where: { isActive: true } }),
      db.client.count({ where: { createdAt: { gte: firstOfMonth } } }),
    ]);

    // ─── Batch 4: Inactive clients + top services ───
    this.logger.debug(`[AI-Data] Batch 4: inactiveClients + topServices`);
    const [inactiveClients, topServices] = await Promise.all([
      db.client.count({
        where: { isActive: true, lastVisitAt: { lt: thirtyDaysAgo } },
      }),
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
    ]);

    // ─── Batch 5: Employees + appointment stats ───
    this.logger.debug(`[AI-Data] Batch 5: employees + appointmentStats`);
    const [employees, appointmentStats] = await Promise.all([
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
      db.appointment.groupBy({
        by: ['status'],
        _count: true,
        where: { date: { gte: firstOfMonth } },
      }),
    ]);

    // ─── Batch 6: Expenses + peak hours ───
    this.logger.debug(`[AI-Data] Batch 6: expenses + peakHours`);
    const [thisMonthExpenses, peakHours] = await Promise.all([
      db.expense.aggregate({
        _sum: { amount: true },
        _count: true,
        where: { date: { gte: firstOfMonth } },
      }),
      db.appointment.findMany({
        where: {
          date: { gte: firstOfMonth },
          status: { notIn: ['cancelled', 'no_show'] },
        },
        select: { startTime: true },
      }),
    ]);

    // ─── Batch 7: Service names for top services + ALL services catalog ───
    const serviceIds = topServices.map((s) => s.serviceId);
    const [topServiceDetails, allServices, serviceCategories] = await Promise.all([
      serviceIds.length > 0
        ? db.service.findMany({
            where: { id: { in: serviceIds } },
            select: { id: true, nameAr: true, price: true },
          })
        : Promise.resolve([]),
      db.service.findMany({
        where: { isActive: true },
        select: { nameAr: true, price: true, duration: true, categoryId: true },
        orderBy: { price: 'desc' },
      }),
      db.serviceCategory.findMany({
        where: { isActive: true },
        select: { id: true, nameAr: true },
      }),
    ]);

    this.logger.debug(`[AI-Data] All batches complete for ${tenantId}`);

    // ─── Process results ───

    const serviceMap = new Map(topServiceDetails.map((s) => [s.id, s]));
    const categoryMap = new Map(serviceCategories.map((c) => [c.id, c]));

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

    // Computed metrics
    const thisMonthRevenueNum = Number(thisMonthRevenue._sum.total || 0);
    const lastMonthRevenueNum = Number(lastMonthRevenue._sum.total || 0);
    const thisMonthExpensesNum = Number(thisMonthExpenses._sum.amount || 0);
    const avgTicketThisMonth = thisMonthRevenue._count > 0
      ? Math.round(thisMonthRevenueNum / thisMonthRevenue._count)
      : 0;
    const avgTicketLastMonth = lastMonthRevenue._count > 0
      ? Math.round(lastMonthRevenueNum / lastMonthRevenue._count)
      : 0;
    const revenuePerClient = totalClients > 0
      ? Math.round(thisMonthRevenueNum / totalClients)
      : 0;
    const retentionRate = totalClients > 0
      ? Math.round(((totalClients - inactiveClients) / totalClients) * 100)
      : 0;

    // All services grouped by category
    const serviceCatalog = allServices.map((s) => ({
      name: s.nameAr,
      price: Number(s.price),
      duration: s.duration,
      category: categoryMap.get(s.categoryId)?.nameAr || 'عام',
    }));

    // Price analysis
    const prices = allServices.map((s) => Number(s.price));
    const avgPrice = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

    const salonData: Record<string, unknown> = {
      salonName: salonInfo?.nameAr || salonInfo?.nameEn || 'الصالون',
      city: salonInfo?.city || 'غير محدد',
      address: salonInfo?.address || 'غير محدد',
      tagline: salonInfo?.taglineAr || null,
      description: salonInfo?.descriptionAr || null,
      workingHours: salonInfo
        ? `${salonInfo.openingTime} - ${salonInfo.closingTime}`
        : 'غير محدد',
      workingDays: salonInfo?.workingDays || {},
      slotDuration: salonInfo?.slotDuration || 30,
      taxPercentage: salonInfo ? Number(salonInfo.taxPercentage) : 15,

      revenue: {
        today: Number(todayRevenue._sum.total || 0),
        todayInvoiceCount: todayRevenue._count,
        thisMonth: thisMonthRevenueNum,
        thisMonthInvoiceCount: thisMonthRevenue._count,
        lastMonth: lastMonthRevenueNum,
        lastMonthInvoiceCount: lastMonthRevenue._count,
        growthPercent: lastMonthRevenueNum
          ? Math.round(((thisMonthRevenueNum - lastMonthRevenueNum) / lastMonthRevenueNum) * 100)
          : null,
        avgTicketThisMonth,
        avgTicketLastMonth,
        revenuePerClient,
      },

      clients: {
        total: totalClients,
        newThisMonth: newClientsThisMonth,
        inactivePlus30Days: inactiveClients,
        retentionRate,
      },

      topServicesThisMonth: topServices.map((s) => ({
        name: serviceMap.get(s.serviceId)?.nameAr || 'خدمة',
        price: Number(serviceMap.get(s.serviceId)?.price || 0),
        appointmentCount: s._count,
      })),

      fullServiceCatalog: serviceCatalog,

      priceAnalysis: {
        avgPrice,
        minPrice,
        maxPrice,
        totalServicesCount: allServices.length,
      },

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
        totalThisMonth: thisMonthExpensesNum,
        count: thisMonthExpenses._count,
      },

      peakHours: hourDistribution,

      profitability: {
        netProfitThisMonth: thisMonthRevenueNum - thisMonthExpensesNum,
        profitMargin: thisMonthRevenueNum > 0
          ? Math.round(((thisMonthRevenueNum - thisMonthExpensesNum) / thisMonthRevenueNum) * 100)
          : 0,
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

    this.logger.log(`Salon data gathered successfully for ${tenantId}`);
    return salonData;
  }
}
