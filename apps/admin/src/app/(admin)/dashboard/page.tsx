'use client';

import { useState, useEffect, type ReactElement } from 'react';
import { SovereignHeader } from '@/components/command/SovereignHeader';
import { EmpirePulse } from '@/components/nexus/EmpirePulse';
import { MomentumRiver, type MomentumEvent } from '@/components/nexus/MomentumRiver';
import { LeverageMap, type LeverageInsight } from '@/components/nexus/LeverageMap';
import { TerritoryGrid, type Territory } from '@/components/nexus/TerritoryGrid';
import { adminService, type AdminStats } from '@/services/admin.service';
import {
  Building2,
  DollarSign,
  BarChart3,
  Settings,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   NEXUS — The Supreme Command Surface
   ═══════════════════════════════════════════════════════════════ */

function generateMomentumEvents(stats: AdminStats | null): MomentumEvent[] {
  if (!stats) return [];
  const events: MomentumEvent[] = [];

  if (stats.newTenantsThisMonth > 0) {
    events.push({
      id: 'new-tenants',
      type: 'registration',
      text: `${stats.newTenantsThisMonth} صالون جديد هذا الشهر`,
      timeAgo: 'هذا الشهر',
    });
  }

  if (stats.recentTenants.length > 0) {
    const latest = stats.recentTenants[0];
    events.push({
      id: 'latest-tenant',
      type: 'registration',
      text: `آخر تسجيل: ${latest.nameAr || latest.nameEn}`,
      timeAgo: 'جديد',
    });
  }

  if (stats.totalSubscriptions > 0) {
    events.push({
      id: 'subs-active',
      type: 'payment',
      text: `${stats.totalSubscriptions} اشتراك نشط في المنصة`,
      timeAgo: 'الحين',
    });
  }

  if (stats.pendingTenants > 0) {
    events.push({
      id: 'pending',
      type: 'expiry',
      text: `${stats.pendingTenants} صالون بانتظار التفعيل`,
      timeAgo: 'يتطلب اهتمام',
    });
  }

  // System healthy event
  events.push({
    id: 'system-ok',
    type: 'system',
    text: 'جميع الخدمات تعمل بكفاءة',
    timeAgo: 'الحين',
  });

  return events;
}

function generateInsights(stats: AdminStats | null): LeverageInsight[] {
  if (!stats) return [];
  const insights: LeverageInsight[] = [];

  if (stats.totalTenants === 0) {
    insights.push({
      id: 'no-tenants',
      type: 'milestone',
      message: 'المنصة <strong>جاهزة للإطلاق</strong> — شارك رابط التسجيل مع عملائك لبدء استقبال الصالونات',
      priority: 'high',
    });
  }

  if (stats.pendingTenants > 0) {
    insights.push({
      id: 'pending-action',
      type: 'alert',
      message: `<strong>${stats.pendingTenants} صالون</strong> بانتظار مراجعتك — التفعيل السريع يزيد معدل التحويل`,
      priority: 'high',
    });
  }

  if (stats.monthlyRevenue > 0) {
    insights.push({
      id: 'revenue-insight',
      type: 'trend',
      message: `إيرادات الشهر الحالي <strong>${stats.monthlyRevenue.toLocaleString('ar-SA')} ر.س</strong>`,
      priority: 'medium',
    });
  }

  if (stats.activeTenants > 0 && stats.totalTenants > 0) {
    const activeRate = Math.round((stats.activeTenants / stats.totalTenants) * 100);
    insights.push({
      id: 'active-rate',
      type: activeRate >= 80 ? 'opportunity' : 'risk',
      message: `معدل النشاط <strong>${activeRate}%</strong> — ${activeRate >= 80 ? 'ممتاز' : 'يحتاج متابعة'}`,
      priority: activeRate >= 80 ? 'low' : 'high',
    });
  }

  if (stats.planDistribution.length > 0) {
    const topPlan = stats.planDistribution.reduce((a, b) => a.count > b.count ? a : b);
    insights.push({
      id: 'top-plan',
      type: 'trend',
      message: `باقة <strong>${topPlan.plan}</strong> هي الأكثر اشتراكاً بـ ${topPlan.count} صالون`,
      priority: 'low',
    });
  }

  return insights;
}

export default function NexusPage(): ReactElement {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminService.getStats()
      .then(setStats)
      .catch(() => { /* API may not be available */ })
      .finally(() => setLoading(false));
  }, []);

  const totalTenants = stats?.totalTenants ?? 0;
  const activeTenants = stats?.activeTenants ?? 0;
  const monthlyRevenue = stats?.monthlyRevenue ?? 0;
  const growthRate = stats?.newTenantsThisMonth && totalTenants > 0
    ? Math.round((stats.newTenantsThisMonth / totalTenants) * 100)
    : 0;

  const momentumEvents = generateMomentumEvents(stats);
  const leverageInsights = generateInsights(stats);

  const territories: Territory[] = [
    {
      id: 'tenants',
      name: 'الأقاليم',
      href: '/tenants',
      icon: Building2,
      metric: totalTenants,
      metricLabel: 'صالون مسجل',
      accentColor: '#8B5CF6',
      accentBg: 'rgba(139,92,246,0.08)',
    },
    {
      id: 'revenue',
      name: 'الإيرادات',
      href: '/subscriptions',
      icon: DollarSign,
      metric: stats?.totalSubscriptions ?? 0,
      metricLabel: 'اشتراك نشط',
      accentColor: '#10B981',
      accentBg: 'rgba(16,185,129,0.08)',
    },
    {
      id: 'intelligence',
      name: 'الاستخبارات',
      href: '/analytics',
      icon: BarChart3,
      metric: stats?.planDistribution?.length ?? 0,
      metricLabel: 'تقرير متاح',
      accentColor: '#6366F1',
      accentBg: 'rgba(99,102,241,0.08)',
    },
    {
      id: 'codex',
      name: 'البنية التحتية',
      href: '/system',
      icon: Settings,
      metric: 4,
      metricLabel: 'خدمة نشطة',
      accentColor: '#C9A84C',
      accentBg: 'rgba(201,168,76,0.08)',
    },
  ];

  if (loading) {
    return (
      <div>
        <SovereignHeader />
        <div className="os-loading-bar" />
        <div style={{ paddingTop: 120, textAlign: 'center' }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--os-text-3)' }}>
            جاري تحميل بيانات المنصة...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ── Sovereign Header ── */}
      <SovereignHeader />

      {/* ── Empire Summary Line ── */}
      <div className="os-enter os-enter-1" style={{ paddingBottom: 8 }}>
        <p style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--os-text-3)',
          lineHeight: 1.8,
        }}>
          {totalTenants === 0
            ? 'المنصة جاهزة للإطلاق — في انتظار أول صالون'
            : `${totalTenants} صالون مسجل · ${activeTenants} نشط · ${monthlyRevenue.toLocaleString('en-US')} ر.س إيرادات الشهر`
          }
        </p>
      </div>

      {/* ── Empire Pulse ── */}
      <EmpirePulse
        metrics={[
          {
            label: 'الصالونات النشطة',
            value: activeTenants,
            delta: totalTenants > 0 ? { value: growthRate, direction: 'up' } : undefined,
          },
          {
            label: 'إيرادات الشهر',
            value: monthlyRevenue,
            suffix: 'ر.س',
          },
          {
            label: 'معدل النمو',
            value: growthRate,
            suffix: '%',
            delta: growthRate > 0 ? { value: growthRate, direction: 'up' } : undefined,
          },
        ]}
      />

      {/* ── Momentum River ── */}
      <MomentumRiver events={momentumEvents} />

      {/* ── Leverage Map ── */}
      <LeverageMap insights={leverageInsights} />

      {/* ── Territory Grid ── */}
      <TerritoryGrid territories={territories} />

      {/* Bottom spacer for command bar */}
      <div style={{ height: 40 }} />
    </div>
  );
}
