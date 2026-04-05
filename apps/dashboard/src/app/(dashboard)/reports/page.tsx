'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, Calendar, Users, UserCog, TrendingUp, ChevronLeft, BarChart3, PieChart, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { dashboardService } from '@/services/dashboard.service';
import type { DashboardStats } from '@/types';

const REPORT_CARDS = [
  {
    title: 'الإيرادات',
    desc: 'يومية · شهرية · سنوية',
    href: '/reports/revenue',
    icon: DollarSign,
    statKey: 'monthlyRevenue' as keyof DashboardStats,
    format: (v: number) => `${v.toLocaleString('en')} SAR`,
    gradient: 'from-emerald-500 to-teal-600',
    iconBg: 'bg-emerald-400/20',
  },
  {
    title: 'المواعيد',
    desc: 'الحجوزات والجدولة',
    href: '/reports/appointments',
    icon: Calendar,
    statKey: 'monthlyAppointments' as keyof DashboardStats,
    format: (v: number) => `${v} موعد`,
    gradient: 'from-violet-500 to-purple-600',
    iconBg: 'bg-violet-400/20',
  },
  {
    title: 'العملاء',
    desc: 'الزيارات والولاء',
    href: '/reports/clients',
    icon: Users,
    statKey: 'totalClients' as keyof DashboardStats,
    format: (v: number) => `${v} عميل`,
    gradient: 'from-sky-500 to-blue-600',
    iconBg: 'bg-sky-400/20',
  },
  {
    title: 'الموظفات',
    desc: 'الأداء والإنتاجية',
    href: '/reports/employees',
    icon: UserCog,
    statKey: 'totalEmployees' as keyof DashboardStats,
    format: (v: number) => `${v} موظفة`,
    gradient: 'from-rose-500 to-pink-600',
    iconBg: 'bg-rose-400/20',
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-[var(--foreground)]">التقارير</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-0.5">تحليلات شاملة لأداء الصالون</p>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-4">
          <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider">إيرادات اليوم</p>
          <p className="text-xl font-black text-[var(--foreground)] mt-1 tabular-nums" dir="ltr">{(stats?.todayRevenue ?? 0).toLocaleString('en')} <span className="text-[10px] font-medium text-[var(--muted-foreground)]">SAR</span></p>
        </div>
        <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-4">
          <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider">إيرادات الشهر</p>
          <p className="text-xl font-black text-[var(--foreground)] mt-1 tabular-nums" dir="ltr">{(stats?.monthlyRevenue ?? 0).toLocaleString('en')} <span className="text-[10px] font-medium text-[var(--muted-foreground)]">SAR</span></p>
        </div>
        <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-4">
          <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider">مواعيد اليوم</p>
          <p className="text-xl font-black text-[var(--foreground)] mt-1">{stats?.todayAppointments ?? 0}</p>
        </div>
        <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-4">
          <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider">إجمالي العملاء</p>
          <p className="text-xl font-black text-[var(--foreground)] mt-1">{stats?.totalClients ?? 0}</p>
        </div>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {REPORT_CARDS.map(card => {
          const Icon = card.icon;
          const val = Number(stats?.[card.statKey] ?? 0);

          return (
            <Link key={card.href} href={card.href}>
              <div className={cn('group relative rounded-2xl overflow-hidden bg-gradient-to-l text-white p-6 transition-all hover:shadow-xl hover:-translate-y-1 cursor-pointer', card.gradient)}>
                <div className="absolute top-0 left-0 w-full h-full bg-black/5" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between">
                    <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center', card.iconBg)}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <ChevronLeft className="h-5 w-5 opacity-40 group-hover:opacity-100 group-hover:-translate-x-1 transition-all" />
                  </div>
                  <div className="mt-4">
                    <h3 className="text-lg font-black">{card.title}</h3>
                    <p className="text-xs opacity-70 mt-0.5">{card.desc}</p>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 opacity-60" />
                    <span className="text-xl font-black tabular-nums">{card.format(val)}</span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Revenue Chart Preview */}
      {stats?.revenueChart && stats.revenueChart.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold">📊 إيرادات هذا الأسبوع</h3>
            <Link href="/reports/revenue" className="text-[10px] font-bold text-[var(--brand-primary)] hover:underline">عرض الكل ←</Link>
          </div>
          <div className="flex items-end gap-1.5 h-28">
            {stats.revenueChart.slice(-7).map((dp, i) => {
              const max = Math.max(...stats.revenueChart.slice(-7).map(d => d.revenue));
              const pct = max > 0 ? (dp.revenue / max) * 100 : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] font-bold text-[var(--muted-foreground)] tabular-nums" dir="ltr">{dp.revenue > 0 ? dp.revenue.toLocaleString('en') : ''}</span>
                  <div className="w-full rounded-t-lg bg-gradient-to-t from-[var(--brand-primary)] to-[var(--brand-primary)]/60 transition-all" style={{ height: `${Math.max(pct, 4)}%` }} />
                  <span className="text-[8px] text-[var(--muted-foreground)]">{new Date(dp.date).toLocaleDateString('en', { weekday: 'short' })}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
