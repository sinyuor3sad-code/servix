'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, TrendingUp, DollarSign, BarChart3, Receipt, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

interface RevenueItem { period: string; revenue: number; count: number; }
interface RevenueData { items: RevenueItem[]; totalRevenue: number; totalCount: number; }

type Period = 'today' | 'week' | 'month' | 'year' | 'all';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'اليوم' },
  { key: 'week', label: 'الأسبوع' },
  { key: 'month', label: 'الشهر' },
  { key: 'year', label: 'السنة' },
  { key: 'all', label: 'الكل' },
];

function getDateRange(period: Period): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().split('T')[0];
  let from: Date;
  switch (period) {
    case 'today': from = new Date(now); from.setHours(0, 0, 0, 0); break;
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

  const { data, isLoading } = useQuery<RevenueData>({
    queryKey: ['reports', 'revenue', dateRange.from, dateRange.to],
    queryFn: () => api.get<RevenueData>(`/reports/revenue?dateFrom=${dateRange.from}&dateTo=${dateRange.to}`, accessToken!),
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000,
  });

  const report = data ?? EMPTY;
  const avgTicket = report.totalCount > 0 ? Math.round(report.totalRevenue / report.totalCount) : 0;
  const maxRev = Math.max(...(report.items?.map(d => d.revenue) ?? [0]));

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/reports')} className="w-10 h-10 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] flex items-center justify-center transition-colors">
            <ArrowRight className="h-4 w-4 text-[var(--muted-foreground)]" />
          </button>
          <div>
            <h1 className="text-xl font-black tracking-tight">تقرير الإيرادات</h1>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">تحليل مالي شامل للفترة المحددة</p>
          </div>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex bg-[var(--muted)] rounded-xl p-1">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => { setPeriod(p.key); setCustomFrom(''); setCustomTo(''); }}
              className={cn('px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200',
                period === p.key && !customFrom
                  ? 'bg-[var(--foreground)] text-[var(--background)] shadow-sm'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]')}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} dir="ltr"
            className="px-3 py-2 rounded-lg border border-[var(--border)] text-xs bg-[var(--card)] outline-none focus:border-[var(--foreground)]/30 transition-colors" />
          <span className="text-xs text-[var(--muted-foreground)]">—</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} dir="ltr"
            className="px-3 py-2 rounded-lg border border-[var(--border)] text-xs bg-[var(--card)] outline-none focus:border-[var(--foreground)]/30 transition-colors" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-[var(--border)] rounded-2xl overflow-hidden">
        <div className="bg-[var(--card)] p-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--muted)] flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-[var(--muted-foreground)]" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">إجمالي الإيرادات</span>
          </div>
          <p className="text-3xl font-black tabular-nums text-[var(--foreground)]" dir="ltr">{report.totalRevenue.toLocaleString('en')}</p>
          <p className="text-[10px] text-[var(--muted-foreground)] mt-1">SAR</p>
        </div>
        <div className="bg-[var(--card)] p-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--muted)] flex items-center justify-center">
              <Receipt className="h-4 w-4 text-[var(--muted-foreground)]" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">عدد الفواتير</span>
          </div>
          <p className="text-3xl font-black tabular-nums text-[var(--foreground)]">{report.totalCount.toLocaleString('en')}</p>
          <p className="text-[10px] text-[var(--muted-foreground)] mt-1">فاتورة</p>
        </div>
        <div className="bg-[var(--card)] p-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--muted)] flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-[var(--muted-foreground)]" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">متوسط الفاتورة</span>
          </div>
          <p className="text-3xl font-black tabular-nums text-[var(--foreground)]" dir="ltr">{avgTicket.toLocaleString('en')}</p>
          <p className="text-[10px] text-[var(--muted-foreground)] mt-1">SAR</p>
        </div>
      </div>

      {/* Revenue Chart */}
      {report.items && report.items.length > 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border)] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--muted)] flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-[var(--muted-foreground)]" />
            </div>
            <h3 className="text-sm font-bold">الإيرادات حسب الفترة</h3>
          </div>
          <div className="p-6">
            <div className="flex items-end gap-2 h-48 mb-4">
              {report.items.map((dp, i) => {
                const pct = maxRev > 0 ? (dp.revenue / maxRev) * 100 : 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
                    <span className="text-[9px] font-bold text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100 transition-opacity tabular-nums" dir="ltr">
                      {dp.revenue.toLocaleString('en')}
                    </span>
                    <div
                      className="w-full rounded-md bg-[var(--foreground)]/8 group-hover:bg-[var(--foreground)]/20 transition-all duration-300 cursor-pointer"
                      style={{ height: `${Math.max(pct, 3)}%` }}
                    />
                    <span className="text-[8px] text-[var(--muted-foreground)] tabular-nums" dir="ltr">
                      {dp.period.length > 7 ? dp.period.slice(5) : dp.period}
                    </span>
                  </div>
                );
              })}
            </div>
            {/* Summary strip */}
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-[var(--muted)]/50 text-xs">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                <span className="text-[var(--muted-foreground)]">أعلى فترة</span>
                <span className="font-bold tabular-nums text-[var(--foreground)]" dir="ltr">{maxRev.toLocaleString('en')} SAR</span>
              </div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                <span className="text-[var(--muted-foreground)]">المتوسط</span>
                <span className="font-bold tabular-nums text-[var(--foreground)]" dir="ltr">
                  {report.items.length > 0 ? Math.round(report.totalRevenue / report.items.length).toLocaleString('en') : 0} SAR
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--muted)] flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="h-8 w-8 text-[var(--muted-foreground)]/30" />
          </div>
          <p className="font-bold text-[var(--foreground)]">لا توجد إيرادات في هذه الفترة</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">جرّب تحديد فترة أخرى</p>
        </div>
      )}
    </div>
  );
}
