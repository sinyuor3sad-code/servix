'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, Calendar, Users, UserCog, TrendingUp, ChevronLeft, BarChart3, Scissors, Wallet, ArrowUpRight, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { dashboardService } from '@/services/dashboard.service';
import type { DashboardStats } from '@/types';

const REPORT_CARDS = [
  { title: 'الإيرادات', desc: 'يومي · شهري · سنوي', href: '/reports/revenue', icon: DollarSign, statKey: 'monthlyRevenue' as keyof DashboardStats, format: (v: number) => `${v.toLocaleString('en')} SAR`, accent: 'from-emerald-400/20 to-emerald-500/5', ring: 'ring-emerald-500/20', iconBg: 'bg-emerald-500/10 text-emerald-600' },
  { title: 'المواعيد', desc: 'الحجوزات والحالات', href: '/reports/appointments', icon: Calendar, statKey: 'monthlyAppointments' as keyof DashboardStats, format: (v: number) => `${v} موعد`, accent: 'from-blue-400/20 to-blue-500/5', ring: 'ring-blue-500/20', iconBg: 'bg-blue-500/10 text-blue-600' },
  { title: 'العملاء', desc: 'الزيارات والولاء', href: '/reports/clients', icon: Users, statKey: 'totalClients' as keyof DashboardStats, format: (v: number) => `${v} عميل`, accent: 'from-violet-400/20 to-violet-500/5', ring: 'ring-violet-500/20', iconBg: 'bg-violet-500/10 text-violet-600' },
  { title: 'الموظفات', desc: 'الأداء والإنتاجية', href: '/reports/employees', icon: UserCog, statKey: 'totalEmployees' as keyof DashboardStats, format: (v: number) => `${v} موظفة`, accent: 'from-rose-400/20 to-rose-500/5', ring: 'ring-rose-500/20', iconBg: 'bg-rose-500/10 text-rose-600' },
  { title: 'الخدمات', desc: 'الأكثر طلباً وإيراداً', href: '/reports/services', icon: Scissors, statKey: 'totalClients' as keyof DashboardStats, format: () => 'عرض التفاصيل', accent: 'from-amber-400/20 to-amber-500/5', ring: 'ring-amber-500/20', iconBg: 'bg-amber-500/10 text-amber-600' },
  { title: 'المصروفات والأرباح', desc: 'إيرادات مقابل مصروفات', href: '/reports/expenses', icon: Wallet, statKey: 'monthlyRevenue' as keyof DashboardStats, format: () => 'عرض التفاصيل', accent: 'from-slate-400/20 to-slate-500/5', ring: 'ring-slate-500/20', iconBg: 'bg-slate-500/10 text-slate-600' },
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
      {/* ══════ Hero Banner ══════ */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-bl from-slate-900 via-slate-800 to-slate-900 p-8 sm:p-10">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-[var(--brand-primary)]/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-blue-500/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
              <BarChart3 className="h-5 w-5 text-white/80" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">التقارير والتحليلات</h1>
              <p className="text-sm text-white/40 mt-0.5">نظرة شاملة على أداء الصالون</p>
            </div>
          </div>

          {/* KPI Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
            {[
              { label: 'إيرادات اليوم', value: (stats?.todayRevenue ?? 0).toLocaleString('en'), suffix: 'SAR' },
              { label: 'مواعيد اليوم', value: (stats?.todayAppointments ?? 0).toString() },
              { label: 'إيرادات الشهر', value: (stats?.monthlyRevenue ?? 0).toLocaleString('en'), suffix: 'SAR' },
              { label: 'إجمالي العملاء', value: (stats?.totalClients ?? 0).toLocaleString('en') },
            ].map((kpi, i) => (
              <div key={i} className="bg-white/[0.06] backdrop-blur-md rounded-2xl p-4 border border-white/[0.08] hover:bg-white/[0.09] transition-all duration-300">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/30 mb-2">{kpi.label}</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-white tabular-nums" dir="ltr">{kpi.value}</span>
                  {kpi.suffix && <span className="text-[10px] text-white/30">{kpi.suffix}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════ Report Cards Grid ══════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORT_CARDS.map(card => {
          const Icon = card.icon;
          const val = Number(stats?.[card.statKey] ?? 0);
          return (
            <Link key={card.href} href={card.href}>
              <div className={cn(
                'group relative rounded-2xl overflow-hidden border bg-[var(--card)] p-6 transition-all duration-500',
                'hover:shadow-lg hover:shadow-black/[0.04] hover:-translate-y-1 hover:border-[var(--foreground)]/[0.12]',
                'border-[var(--border)] cursor-pointer h-full'
              )}>
                {/* Gradient overlay on hover */}
                <div className={cn('absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500', card.accent)} />

                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-6">
                    <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300', card.iconBg)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-[var(--muted)] flex items-center justify-center opacity-0 -translate-x-3 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                      <ArrowUpRight className="h-4 w-4 text-[var(--muted-foreground)]" />
                    </div>
                  </div>

                  <h3 className="text-[15px] font-bold text-[var(--foreground)] mb-1">{card.title}</h3>
                  <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">{card.desc}</p>

                  <div className="mt-5 pt-4 border-t border-[var(--border)] group-hover:border-[var(--foreground)]/[0.08] transition-colors">
                    <div className="flex items-center gap-2">
                      <Activity className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                      <span className="text-[13px] font-bold tabular-nums text-[var(--foreground)]">{card.format(val)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* ══════ Revenue Chart Preview ══════ */}
      {stats?.revenueChart && stats.revenueChart.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--foreground)]">إيرادات آخر 7 أيام</h3>
                <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">ملخص سريع للأداء المالي</p>
              </div>
            </div>
            <Link href="/reports/revenue" className="px-4 py-2 rounded-xl text-[11px] font-bold text-[var(--muted-foreground)] hover:text-[var(--foreground)] bg-[var(--muted)] hover:bg-[var(--muted)]/80 transition-all flex items-center gap-1.5">
              عرض الكل <ChevronLeft className="h-3 w-3" />
            </Link>
          </div>
          <div className="p-6">
            <div className="flex items-end gap-3 h-36">
              {stats.revenueChart.slice(-7).map((dp, i) => {
                const max = Math.max(...stats.revenueChart.slice(-7).map(d => d.revenue));
                const pct = max > 0 ? (dp.revenue / max) * 100 : 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                    <span className="text-[9px] font-bold text-[var(--foreground)] opacity-0 group-hover:opacity-100 transition-all duration-300 tabular-nums -translate-y-1 group-hover:translate-y-0" dir="ltr">
                      {dp.revenue > 0 ? dp.revenue.toLocaleString('en') : ''}
                    </span>
                    <div className="w-full relative overflow-hidden rounded-lg" style={{ height: `${Math.max(pct, 6)}%` }}>
                      <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/30 via-emerald-400/15 to-emerald-300/5 group-hover:from-emerald-500/50 group-hover:via-emerald-400/25 group-hover:to-emerald-300/10 transition-all duration-500" />
                    </div>
                    <span className="text-[9px] font-medium text-[var(--muted-foreground)]">
                      {new Date(dp.date).toLocaleDateString('ar-SA', { weekday: 'short' })}
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
