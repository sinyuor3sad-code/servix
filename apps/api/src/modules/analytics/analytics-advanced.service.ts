import { Injectable, Logger } from '@nestjs/common';
import { PlatformPrismaClient } from '../../shared/database/platform.client';

/**
 * Advanced Analytics Service
 * Business intelligence: LTV, CAC, Churn Prediction, Cohort Analysis.
 */
@Injectable()
export class AnalyticsAdvancedService {
  private readonly logger = new Logger(AnalyticsAdvancedService.name);

  constructor(private readonly prisma: PlatformPrismaClient) {}

  /**
   * Customer Lifetime Value — Average revenue per tenant per month
   */
  async calculateLTV(): Promise<{
    averageMonthlyLTV: number;
    averageLifetimeLTV: number;
    topTenants: Array<{ tenantId: string; name: string; ltv: number }>;
  }> {
    const tenants = await (this.prisma.tenant as any).findMany({
      where: { status: { not: 'deleted' } },
      include: {
        subscriptions: {
          include: { plan: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const ltvData = tenants.map((t: any) => {
      const sub = t.subscriptions[0];
      const monthlyPrice = sub?.plan?.price ?? 0;
      const ageMonths = Math.max(
        1,
        (Date.now() - new Date(t.createdAt).getTime()) / (30 * 24 * 60 * 60 * 1000),
      );
      return {
        tenantId: t.id,
        name: t.nameAr || t.nameEn || 'غير معروف',
        monthlyLTV: monthlyPrice,
        lifetimeLTV: Math.round(monthlyPrice * ageMonths),
        ageMonths: Math.round(ageMonths),
      };
    });

    const totalMonthly = ltvData.reduce((s: number, d: any) => s + d.monthlyLTV, 0);
    const totalLifetime = ltvData.reduce((s: number, d: any) => s + d.lifetimeLTV, 0);

    return {
      averageMonthlyLTV: ltvData.length > 0 ? Math.round(totalMonthly / ltvData.length) : 0,
      averageLifetimeLTV: ltvData.length > 0 ? Math.round(totalLifetime / ltvData.length) : 0,
      topTenants: ltvData
        .sort((a: any, b: any) => b.lifetimeLTV - a.lifetimeLTV)
        .slice(0, 10)
        .map((d: any) => ({ tenantId: d.tenantId, name: d.name, ltv: d.lifetimeLTV })),
    };
  }

  /**
   * Customer Acquisition metrics
   */
  async calculateCAC(startDate: Date, endDate: Date): Promise<{
    newTenants: number;
    period: { start: string; end: string };
    avgTimeToFirstBooking: number;
  }> {
    const newTenants = await this.prisma.tenant.count({
      where: { createdAt: { gte: startDate, lte: endDate } },
    });

    return {
      newTenants,
      period: { start: startDate.toISOString(), end: endDate.toISOString() },
      avgTimeToFirstBooking: 0, // Requires tenant-level query
    };
  }

  /**
   * Churn Prediction — Risk scoring for each tenant
   */
  async predictChurn(): Promise<
    Array<{
      tenantId: string;
      name: string;
      riskScore: number;
      riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
      reasons: string[];
    }>
  > {
    const tenants = await (this.prisma.tenant as any).findMany({
      where: { status: { in: ['active', 'trial'] } },
      include: {
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    return tenants.map((t: any) => {
      let riskScore = 0;
      const reasons: string[] = [];
      const sub = t.subscriptions[0];

      // No active subscription
      if (!sub || sub.status === 'expired') {
        riskScore += 40;
        reasons.push('لا يوجد اشتراك نشط');
      }

      // Subscription expiring within 7 days
      if (sub?.currentPeriodEnd) {
        const daysToExpiry =
          (new Date(sub.currentPeriodEnd).getTime() - Date.now()) /
          (24 * 60 * 60 * 1000);
        if (daysToExpiry < 7 && daysToExpiry > 0) {
          riskScore += 30;
          reasons.push('الاشتراك ينتهي خلال 7 أيام');
        }
      }

      // Old account with trial status
      const ageMonths =
        (Date.now() - new Date(t.createdAt).getTime()) /
        (30 * 24 * 60 * 60 * 1000);
      if (ageMonths > 1 && t.status === 'trial') {
        riskScore += 20;
        reasons.push('حساب قديم لا يزال في الفترة التجريبية');
      }

      // No recent activity (simplistic check)
      if (t.updatedAt) {
        const daysSinceUpdate =
          (Date.now() - new Date(t.updatedAt).getTime()) /
          (24 * 60 * 60 * 1000);
        if (daysSinceUpdate > 14) {
          riskScore += 25;
          reasons.push('لم يُحدَّث الحساب منذ 14+ يوم');
        }
      }

      riskScore = Math.min(100, riskScore);

      return {
        tenantId: t.id,
        name: t.nameAr || t.nameEn || t.id,
        riskScore,
        riskLevel:
          riskScore >= 60 ? 'HIGH' : riskScore >= 30 ? 'MEDIUM' : 'LOW',
        reasons,
      };
    });
  }

  /**
   * Cohort Analysis — Retention by registration month
   */
  async cohortAnalysis(): Promise<
    Array<{
      cohort: string;
      totalRegistered: number;
      currentlyActive: number;
      retentionRate: number;
      churned: number;
    }>
  > {
    const tenants = await this.prisma.tenant.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const cohorts = new Map<
      string,
      { total: number; active: number; churned: number }
    >();

    for (const t of tenants) {
      const key = new Date(t.createdAt).toISOString().slice(0, 7); // YYYY-MM
      if (!cohorts.has(key)) {
        cohorts.set(key, { total: 0, active: 0, churned: 0 });
      }
      const c = cohorts.get(key)!;
      c.total++;
      if (['active', 'trial'].includes(t.status)) {
        c.active++;
      } else {
        c.churned++;
      }
    }

    return Array.from(cohorts.entries()).map(([month, data]) => ({
      cohort: month,
      totalRegistered: data.total,
      currentlyActive: data.active,
      retentionRate:
        data.total > 0 ? Math.round((data.active / data.total) * 100) : 0,
      churned: data.churned,
    }));
  }

  /**
   * Revenue growth metrics
   */
  async revenueMetrics(): Promise<{
    mrr: number;
    arr: number;
    totalTenants: number;
    activeTenants: number;
    trialTenants: number;
    conversionRate: number;
  }> {
    const [totalTenants, activeTenants, trialTenants] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { status: 'active' } }),
      this.prisma.tenant.count({ where: { status: 'trial' } }),
    ]);

    const subscriptions = await (this.prisma.subscription as any).findMany({
      where: { status: 'active' },
      include: { plan: true },
    });

    const mrr = subscriptions.reduce(
      (sum: number, s: any) => sum + (s.plan?.price ?? 0),
      0,
    );

    return {
      mrr,
      arr: mrr * 12,
      totalTenants,
      activeTenants,
      trialTenants,
      conversionRate:
        totalTenants > 0
          ? Math.round((activeTenants / totalTenants) * 100)
          : 0,
    };
  }
}
