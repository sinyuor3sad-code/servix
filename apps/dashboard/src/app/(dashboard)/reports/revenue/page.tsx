'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, TrendingUp, TrendingDown, Receipt, DollarSign, BarChart3, Calendar } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area,
} from 'recharts';
import { cn } from '@/lib/utils';
import { Button, Spinner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

interface RevenueData {
  totalRevenue: number;
  totalInvoices: number;
  averageTicket: number;
  dailyRevenue: { date: string; revenue: number }[];
  serviceBreakdown: { serviceName: string; count: number; revenue: number }[];
}

type Period = 'today' | 'week' | 'month' | 'year' | 'all';

const PERIODS: { key: Period; label: string; emoji: string }[] = [
  { key: 'today', label: 'اليوم', emoji: '📅' },
  { key: 'week', label: 'الأسبوع', emoji: '📆' },
  { key: 'month', label: 'الشهر', emoji: '🗓️' },
  { key: 'year', label: 'السنة', emoji: '📊' },
  { key: 'all', label: 'الكل', emoji: '🏦' },
];

function getDateRange(period: Period): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().split('T')[0];
  let from: Date;

  switch (period) {
    case 'today':
      from = new Date(now); from.setHours(0,0,0,0); break;
    case 'week':
      from = new Date(now); from.setDate(now.getDate() - 7); break;
    case 'month':
      from = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case 'year':
      from = new Date(now.getFullYear(), 0, 1); break;
    case 'all':
      from = new Date(2020, 0, 1); break;
    default:
      from = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return { from: from.toISOString().split('T')[0], to };
}

const PLACEHOLDER: RevenueData = {
  totalRevenue: 24500,
  totalInvoices: 87,
  averageTicket: 281.6,
  dailyRevenue: [
    { date: '2026-03-01', revenue: 3200 },
    { date: '2026-03-02', revenue: 2800 },
    { date: '2026-03-03', revenue: 1500 },
    { date: '2026-03-04', revenue: 4100 },
    { date: '2026-03-05', revenue: 3600 },
    { date: '2026-03-06', revenue: 5200 },
    { date: '2026-03-07', revenue: 4100 },
  ],
  serviceBreakdown: [
    { serviceName: 'قص شعر', count: 32, revenue: 6400 },
    { serviceName: 'صبغة شعر', count: 18, revenue: 7200 },
    { serviceName: 'مانيكير', count: 25, revenue: 3750 },
    { serviceName: 'باديكير', count: 20, revenue: 4000 },
    { serviceName: 'تنظيف بشرة', count: 12, revenue: 3150 },
  ],
};

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
    queryFn: () => api.get<RevenueData>(`/reports/revenue?from=${dateRange.from}&to=${dateRange.to}`, accessToken!),
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000,
  });

  const report = data ?? PLACEHOLDER;
  const maxRev = Math.max(...(report.dailyRevenue?.map(d => d.revenue) ?? [0]));
  const totalSvcRevenue = report.serviceBreakdown?.reduce((s, r) => s + r.revenue, 0) || 1;

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/reports')} className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--muted)] transition">
            <ArrowRight className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-black">تقرير الإيرادات</h1>
            <p className="text-xs text-[var(--muted-foreground)]">تحليل مالي شامل</p>
          </div>
        </div>
      </div>

      {/* Period Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => { setPeriod(p.key); setCustomFrom(''); setCustomTo(''); }}
            className={cn('px-4 py-2.5 rounded-xl text-[11px] font-bold border-2 transition-all',
              period === p.key && !customFrom ? 'bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]' : 'border-[var(--border)] hover:border-[var(--foreground)]/30')}>
            {p.emoji} {p.label}
          </button>
        ))}
        {/* Custom Date */}
        <div className="flex items-center gap-1.5 mr-auto">
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} dir="ltr"
            className="px-3 py-2 rounded-xl border border-[var(--border)] text-[11px] bg-[var(--card)] outline-none focus:border-[var(--brand-primary)]" />
          <span className="text-[10px] text-[var(--muted-foreground)]">→</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} dir="ltr"
            className="px-3 py-2 rounded-xl border border-[var(--border)] text-[11px] bg-[var(--card)] outline-none focus:border-[var(--brand-primary)]" />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white">
          <DollarSign className="h-5 w-5 mb-2 opacity-60" />
          <p className="text-xs opacity-70">إجمالي الإيرادات</p>
          <p className="text-3xl font-black mt-1 tabular-nums" dir="ltr">{report.totalRevenue.toLocaleString('en')}</p>
          <p className="text-[10px] opacity-60 mt-0.5">SAR</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 p-5 text-white">
          <Receipt className="h-5 w-5 mb-2 opacity-60" />
          <p className="text-xs opacity-70">عدد الفواتير</p>
          <p className="text-3xl font-black mt-1">{report.totalInvoices.toLocaleString('en')}</p>
          <p className="text-[10px] opacity-60 mt-0.5">فاتورة</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 p-5 text-white">
          <TrendingUp className="h-5 w-5 mb-2 opacity-60" />
          <p className="text-xs opacity-70">متوسط الفاتورة</p>
          <p className="text-3xl font-black mt-1 tabular-nums" dir="ltr">{report.averageTicket.toLocaleString('en', { maximumFractionDigits: 0 })}</p>
          <p className="text-[10px] opacity-60 mt-0.5">SAR</p>
        </div>
      </div>

      {/* Revenue Chart */}
      {report.dailyRevenue && report.dailyRevenue.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2"><BarChart3 className="h-4 w-4 text-[var(--brand-primary)]" /> الإيرادات اليومية</h3>
          </div>
          <div className="p-5">
            {/* Mini Bar Chart */}
            <div className="flex items-end gap-1 h-40 mb-3">
              {report.dailyRevenue.map((dp, i) => {
                const pct = maxRev > 0 ? (dp.revenue / maxRev) * 100 : 0;
                const d = new Date(dp.date);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                    <span className="text-[8px] font-bold text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100 transition tabular-nums" dir="ltr">
                      {dp.revenue.toLocaleString('en')}
                    </span>
                    <div className="w-full rounded-t-lg bg-gradient-to-t from-[var(--brand-primary)] to-[var(--brand-primary)]/50 group-hover:from-[var(--brand-primary)] group-hover:to-[var(--brand-primary)]/80 transition-all cursor-pointer"
                      style={{ height: `${Math.max(pct, 3)}%` }} />
                    <span className="text-[8px] text-[var(--muted-foreground)] tabular-nums" dir="ltr">
                      {d.toLocaleDateString('en', { month: '2-digit', day: '2-digit' })}
                    </span>
                  </div>
                );
              })}
            </div>
            {/* Summary below chart */}
            <div className="flex items-center justify-between px-2 py-2 rounded-xl bg-[var(--muted)]/40 text-[11px]">
              <span className="text-[var(--muted-foreground)]">أعلى يوم: <strong className="text-[var(--foreground)]" dir="ltr">{maxRev.toLocaleString('en')} SAR</strong></span>
              <span className="text-[var(--muted-foreground)]">المتوسط: <strong className="text-[var(--foreground)]" dir="ltr">{Math.round(report.dailyRevenue.reduce((s, d) => s + d.revenue, 0) / report.dailyRevenue.length).toLocaleString('en')} SAR</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* Service Breakdown */}
      {report.serviceBreakdown && report.serviceBreakdown.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <h3 className="text-sm font-bold">🏆 الأكثر إيراداً</h3>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {[...report.serviceBreakdown].sort((a, b) => b.revenue - a.revenue).map((svc, i) => {
              const pct = Math.round((svc.revenue / totalSvcRevenue) * 100);
              const medals = ['🥇', '🥈', '🥉'];
              return (
                <div key={svc.serviceName} className="px-5 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{medals[i] || `${i + 1}.`}</span>
                      <span className="text-sm font-bold text-[var(--foreground)]">{svc.serviceName}</span>
                      <span className="text-[10px] text-[var(--muted-foreground)] px-1.5 py-0.5 rounded-md bg-[var(--muted)]">{svc.count} مرة</span>
                    </div>
                    <div className="text-left">
                      <span className="text-sm font-black tabular-nums text-[var(--foreground)]" dir="ltr">{svc.revenue.toLocaleString('en')}</span>
                      <span className="text-[10px] text-[var(--muted-foreground)] mr-1">SAR</span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-[var(--muted)] overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-l from-[var(--brand-primary)] to-[var(--brand-primary)]/60 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[9px] font-bold text-[var(--muted-foreground)] tabular-nums w-8 text-left">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
