'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, Calendar, Users, UserCog, TrendingUp, ChevronLeft, BarChart3, Scissors, Wallet, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { dashboardService } from '@/services/dashboard.service';
import type { DashboardStats } from '@/types';

const REPORT_CARDS = [
  {
    title: 'الإيرادات',
    desc: 'تحليل مالي شامل — يومي · شهري · سنوي',
    href: '/reports/revenue',
    icon: DollarSign,
    statKey: 'monthlyRevenue' as keyof DashboardStats,
    format: (v: number) => `${v.toLocaleString('en')} SAR`,
  },
  {
    title: 'المواعيد',
    desc: 'الحجوزات والجدولة والحالات',
    href: '/reports/appointments',
    icon: Calendar,
    statKey: 'monthlyAppointments' as keyof DashboardStats,
    format: (v: number) => `${v} موعد`,
  },
  {
    title: 'العملاء',
    desc: 'الزيارات والولاء وأفضل العملاء',
    href: '/reports/clients',
    icon: Users,
    statKey: 'totalClients' as keyof DashboardStats,
    format: (v: number) => `${v} عميل`,
  },
  {
    title: 'الموظفات',
    desc: 'الأداء والإنتاجية والتقييم',
    href: '/reports/employees',
    icon: UserCog,
    statKey: 'totalEmployees' as keyof DashboardStats,
    format: (v: number) => `${v} موظفة`,
  },
  {
    title: 'الخدمات',
    desc: 'الأكثر طلباً والأعلى إيراداً',
    href: '/reports/services',
    icon: Scissors,
    statKey: 'totalClients' as keyof DashboardStats,
    format: () => 'عرض التفاصيل',
  },
  {
    title: 'المصروفات والأرباح',
    desc: 'تحليل مالي — إيرادات مقابل مصروفات',
    href: '/reports/expenses',
    icon: Wallet,
    statKey: 'monthlyRevenue' as keyof DashboardStats,
    format: () => 'عرض التفاصيل',
  },
];

export default function ReportsPage() {
  const { accessToken } = useAuth();

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => dashboardService.getStats(accessToken!),
    enabled: !!accessToken,
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-[var(--foreground)] flex items-center justify-center">
          <BarChart3 className="h-6 w-6 text-[var(--background)]" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[var(--foreground)]">التقارير</h1>
          <p className="text-sm text-[var(--muted-foreground)]">تحليلات شاملة لأداء الصالون</p>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[var(--border)] rounded-2xl overflow-hidden">
        {[
          { label: 'إيرادات اليوم', value: stats?.todayRevenue ?? 0, suffix: 'SAR', mono: true },
          { label: 'مواعيد اليوم', value: stats?.todayAppointments ?? 0, suffix: '', mono: false },
          { label: 'إيرادات الشهر', value: stats?.monthlyRevenue ?? 0, suffix: 'SAR', mono: true },
          { label: 'إجمالي العملاء', value: stats?.totalClients ?? 0, suffix: '', mono: false },
        ].map((kpi, i) => (
          <div key={i} className="bg-[var(--card)] p-5 flex flex-col justify-between min-h-[100px]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-2">{kpi.label}</p>
            <div className="flex items-baseline gap-1.5">
              <span className={cn('text-2xl font-black text-[var(--foreground)]', kpi.mono && 'tabular-nums')} dir="ltr">
                {kpi.value.toLocaleString('en')}
              </span>
              {kpi.suffix && <span className="text-[10px] font-medium text-[var(--muted-foreground)]">{kpi.suffix}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORT_CARDS.map(card => {
          const Icon = card.icon;
          const val = Number(stats?.[card.statKey] ?? 0);

          return (
            <Link key={card.href} href={card.href}>
              <div className="group relative rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--card)] p-6 transition-all duration-300 hover:border-[var(--foreground)]/20 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:-translate-y-0.5 cursor-pointer h-full">
                {/* Subtle top accent line */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-l from-transparent via-[var(--foreground)]/10 to-transparent group-hover:via-[var(--foreground)]/30 transition-all duration-500" />

                <div className="flex items-start justify-between mb-5">
                  <div className="w-11 h-11 rounded-xl bg-[var(--muted)] flex items-center justify-center group-hover:bg-[var(--foreground)] transition-colors duration-300">
                    <Icon className="h-5 w-5 text-[var(--muted-foreground)] group-hover:text-[var(--background)] transition-colors duration-300" />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-[var(--muted-foreground)] opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                </div>

                <h3 className="text-base font-bold text-[var(--foreground)] mb-1">{card.title}</h3>
                <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed mb-4">{card.desc}</p>

                <div className="pt-4 border-t border-[var(--border)]">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                    <span className="text-sm font-bold tabular-nums text-[var(--foreground)]">{card.format(val)}</span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Revenue Chart Preview */}
      {stats?.revenueChart && stats.revenueChart.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--muted)] flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-[var(--muted-foreground)]" />
              </div>
              <h3 className="text-sm font-bold text-[var(--foreground)]">إيرادات آخر 7 أيام</h3>
            </div>
            <Link href="/reports/revenue" className="text-[11px] font-bold text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors flex items-center gap-1">
              عرض الكل <ChevronLeft className="h-3 w-3" />
            </Link>
          </div>
          <div className="p-6">
            <div className="flex items-end gap-2 h-32">
              {stats.revenueChart.slice(-7).map((dp, i) => {
                const max = Math.max(...stats.revenueChart.slice(-7).map(d => d.revenue));
                const pct = max > 0 ? (dp.revenue / max) * 100 : 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
                    <span className="text-[9px] font-bold text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100 transition-opacity tabular-nums" dir="ltr">
                      {dp.revenue > 0 ? dp.revenue.toLocaleString('en') : ''}
                    </span>
                    <div
                      className="w-full rounded-md bg-[var(--foreground)]/8 group-hover:bg-[var(--foreground)]/15 transition-all duration-300 cursor-pointer"
                      style={{ height: `${Math.max(pct, 4)}%` }}
                    />
                    <span className="text-[9px] text-[var(--muted-foreground)]">
                      {new Date(dp.date).toLocaleDateString('en', { weekday: 'short' })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
