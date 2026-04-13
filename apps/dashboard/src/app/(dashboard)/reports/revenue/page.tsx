'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { ArrowRight, TrendingUp, DollarSign, BarChart3, Receipt, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

interface RevenueItem { period: string; revenue: number; count: number; }
interface RevenueData { items: RevenueItem[]; totalRevenue: number; totalCount: number; }
type Period = 'today' | 'week' | 'month' | 'year' | 'all';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'اليوم' }, { key: 'week', label: 'الأسبوع' },
  { key: 'month', label: 'الشهر' }, { key: 'year', label: 'السنة' }, { key: 'all', label: 'الكل' },
];

function getDateRange(period: Period) {
  const now = new Date(); const to = now.toISOString().split('T')[0]; let from: Date;
  switch (period) {
    case 'today': from = new Date(now); from.setHours(0,0,0,0); break;
    case 'week': from = new Date(now); from.setDate(now.getDate() - 7); break;
    case 'month': from = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case 'year': from = new Date(now.getFullYear(), 0, 1); break;
    case 'all': from = new Date(2020, 0, 1); break;
    default: from = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return { from: from.toISOString().split('T')[0], to };
}

const EMPTY: RevenueData = { items: [], totalRevenue: 0, totalCount: 0 };

export default function RevenueReportPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [period, setPeriod] = useState<Period>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const dateRange = useMemo(() => {
    if (customFrom && customTo) return { from: customFrom, to: customTo };
    return getDateRange(period);
  }, [period, customFrom, customTo]);

  const { data, isLoading, isFetching } = useQuery<RevenueData>({
    queryKey: ['reports', 'revenue', dateRange.from, dateRange.to],
    queryFn: () => api.get<RevenueData>(`/reports/revenue?dateFrom=${dateRange.from}&dateTo=${dateRange.to}`, accessToken!),
    enabled: !!accessToken, staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const report = data ?? EMPTY;
  const avgTicket = report.totalCount > 0 ? Math.round(report.totalRevenue / report.totalCount) : 0;
  const maxRev = Math.max(...(report.items?.map(d => d.revenue) ?? [0]));

  if (isLoading && !data) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className={cn('p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-8 transition-opacity duration-300', isFetching ? 'opacity-60' : 'opacity-100')}>
      {/* ══════ Header ══════ */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-bl from-slate-900 via-slate-800 to-slate-900 p-8">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-emerald-500/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative z-10 flex items-center gap-4">
          <button onClick={() => router.push('/reports')} className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
            <ArrowRight className="h-4 w-4 text-white/60" />
          </button>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">تقرير الإيرادات</h1>
            <p className="text-xs text-white/40 mt-0.5">تحليل مالي شامل للفترة المحددة</p>
          </div>
        </div>

        {/* KPIs */}
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8">
          {[
            { label: 'إجمالي الإيرادات', value: report.totalRevenue.toLocaleString('en'), suffix: 'SAR', icon: DollarSign },
            { label: 'عدد الفواتير', value: report.totalCount.toLocaleString('en'), suffix: 'فاتورة', icon: Receipt },
            { label: 'متوسط الفاتورة', value: avgTicket.toLocaleString('en'), suffix: 'SAR', icon: TrendingUp },
          ].map((kpi, i) => {
            const Icon = kpi.icon;
            return (
              <div key={i} className="bg-white/[0.06] backdrop-blur-md rounded-2xl p-5 border border-white/[0.08]">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                    <Icon className="h-3.5 w-3.5 text-white/50" />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/30">{kpi.label}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-white tabular-nums" dir="ltr">{kpi.value}</span>
                  <span className="text-[10px] text-white/30">{kpi.suffix}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══════ Period Selector ══════ */}
      <div className="flex flex-wrap items-center gap-6">
        <div className="inline-flex bg-[var(--muted)] rounded-2xl p-1.5">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => { setPeriod(p.key); setCustomFrom(''); setCustomTo(''); }}
              className={cn('px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300',
                period === p.key && !customFrom
                  ? 'bg-[var(--foreground)] text-[var(--background)] shadow-md'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]')}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} dir="ltr"
            className="px-3 py-2.5 rounded-xl border border-[var(--border)] text-xs bg-[var(--card)] outline-none focus:ring-2 focus:ring-[var(--foreground)]/10 transition-all" />
          <span className="text-xs text-[var(--muted-foreground)]">—</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} dir="ltr"
            className="px-3 py-2.5 rounded-xl border border-[var(--border)] text-xs bg-[var(--card)] outline-none focus:ring-2 focus:ring-[var(--foreground)]/10 transition-all" />
        </div>
      </div>

      {/* ══════ Revenue Chart ══════ */}
      {report.items && report.items.length > 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <div className="px-6 py-5 border-b border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold">الإيرادات حسب الفترة</h3>
                <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">{report.items.length} فترة</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="flex items-end gap-2 h-52 mb-4">
              {report.items.map((dp, i) => {
                const pct = maxRev > 0 ? (dp.revenue / maxRev) * 100 : 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group cursor-pointer">
                    <span className="text-[9px] font-bold text-[var(--foreground)] opacity-0 group-hover:opacity-100 transition-all duration-300 tabular-nums -translate-y-1 group-hover:translate-y-0" dir="ltr">
                      {dp.revenue.toLocaleString('en')}
                    </span>
                    <div className="w-full relative overflow-hidden rounded-lg transition-all duration-300 group-hover:scale-x-110" style={{ height: `${Math.max(pct, 4)}%` }}>
                      <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/40 via-emerald-400/20 to-emerald-300/5 group-hover:from-emerald-500/60 group-hover:via-emerald-400/30 group-hover:to-emerald-300/10 transition-all duration-500" />
                    </div>
                    <span className="text-[8px] text-[var(--muted-foreground)] tabular-nums" dir="ltr">
                      {dp.period.length > 7 ? dp.period.slice(5) : dp.period}
                    </span>
                  </div>
                );
              })}
            </div>
            {/* Summary */}
            <div className="flex items-center justify-between px-5 py-3.5 rounded-2xl bg-[var(--muted)]/50 text-xs">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-[var(--muted-foreground)]">أعلى فترة</span>
                <span className="font-bold tabular-nums" dir="ltr">{maxRev.toLocaleString('en')} SAR</span>
              </div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                <span className="text-[var(--muted-foreground)]">المتوسط</span>
                <span className="font-bold tabular-nums" dir="ltr">
                  {report.items.length > 0 ? Math.round(report.totalRevenue / report.items.length).toLocaleString('en') : 0} SAR
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-20 text-center">
          <div className="w-20 h-20 rounded-3xl bg-[var(--muted)] flex items-center justify-center mx-auto mb-5">
            <BarChart3 className="h-10 w-10 text-[var(--muted-foreground)]/20" />
          </div>
          <p className="font-bold text-lg text-[var(--foreground)]">لا توجد إيرادات في هذه الفترة</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">جرّب تحديد فترة أخرى</p>
        </div>
      )}
    </div>
  );
}
