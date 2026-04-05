'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Scissors, TrendingUp, Clock, Hash, Star, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

interface ServicesReport {
  totalServices: number;
  totalBookings: number;
  totalRevenue: number;
  averageDuration: number;
  serviceBreakdown: {
    serviceId: string;
    serviceName: string;
    categoryName: string;
    count: number;
    revenue: number;
    avgDuration: number;
  }[];
}

type Period = 'week' | 'month' | 'year' | 'all';
type SortBy = 'revenue' | 'count' | 'duration';

const PERIODS: { key: Period; label: string }[] = [
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
    case 'week': from = new Date(now); from.setDate(now.getDate() - 7); break;
    case 'month': from = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case 'year': from = new Date(now.getFullYear(), 0, 1); break;
    case 'all': from = new Date(2020, 0, 1); break;
    default: from = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return { from: from.toISOString().split('T')[0], to };
}

const EMPTY: ServicesReport = {
  totalServices: 0, totalBookings: 0, totalRevenue: 0, averageDuration: 0,
  serviceBreakdown: [],
};

export default function ServicesReportPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [period, setPeriod] = useState<Period>('month');
  const [sortBy, setSortBy] = useState<SortBy>('revenue');

  const dateRange = useMemo(() => getDateRange(period), [period]);

  const { data, isLoading } = useQuery<ServicesReport>({
    queryKey: ['reports', 'services', dateRange.from, dateRange.to],
    queryFn: () => api.get<ServicesReport>(`/reports/services?dateFrom=${dateRange.from}&dateTo=${dateRange.to}`, accessToken!),
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000,
  });

  const report = data ?? EMPTY;
  const maxRevenue = Math.max(...(report.serviceBreakdown?.map(s => s.revenue) ?? [1]));

  const sorted = useMemo(() => {
    if (!report.serviceBreakdown) return [];
    return [...report.serviceBreakdown].sort((a, b) => {
      if (sortBy === 'revenue') return b.revenue - a.revenue;
      if (sortBy === 'count') return b.count - a.count;
      return b.avgDuration - a.avgDuration;
    });
  }, [report.serviceBreakdown, sortBy]);

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/reports')} className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--muted)] transition">
          <ArrowRight className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-black">تقرير الخدمات</h1>
          <p className="text-xs text-[var(--muted-foreground)]">الأكثر طلباً والأعلى إيراداً</p>
        </div>
      </div>

      {/* Period Tabs */}
      <div className="flex gap-1.5">
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className={cn('px-4 py-2.5 rounded-xl text-[11px] font-bold border-2 transition-all',
              period === p.key ? 'bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]' : 'border-[var(--border)] hover:border-[var(--foreground)]/30')}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 p-4 text-white">
          <Scissors className="h-4 w-4 mb-1.5 opacity-60" />
          <p className="text-[10px] opacity-70">إجمالي الخدمات</p>
          <p className="text-2xl font-black mt-0.5">{report.totalServices}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-4 text-white">
          <TrendingUp className="h-4 w-4 mb-1.5 opacity-60" />
          <p className="text-[10px] opacity-70">الإيرادات</p>
          <p className="text-2xl font-black mt-0.5 tabular-nums" dir="ltr">{report.totalRevenue.toLocaleString('en')}</p>
          <p className="text-[9px] opacity-50">SAR</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 p-4 text-white">
          <Hash className="h-4 w-4 mb-1.5 opacity-60" />
          <p className="text-[10px] opacity-70">عدد الحجوزات</p>
          <p className="text-2xl font-black mt-0.5">{report.totalBookings}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-4 text-white">
          <Clock className="h-4 w-4 mb-1.5 opacity-60" />
          <p className="text-[10px] opacity-70">متوسط المدة</p>
          <p className="text-2xl font-black mt-0.5">{report.averageDuration}</p>
          <p className="text-[9px] opacity-50">دقيقة</p>
        </div>
      </div>

      {/* Sort Tabs */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--muted-foreground)]">ترتيب حسب:</span>
        {[
          { key: 'revenue' as SortBy, label: 'الإيراد' },
          { key: 'count' as SortBy, label: 'الطلب' },
          { key: 'duration' as SortBy, label: 'المدة' },
        ].map(s => (
          <button key={s.key} onClick={() => setSortBy(s.key)}
            className={cn('px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all',
              sortBy === s.key ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]')}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Services List */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--border)] bg-[var(--muted)]/30">
          <h3 className="text-xs font-bold text-[var(--muted-foreground)] flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5" /> تفصيل الخدمات ({sorted.length})
          </h3>
        </div>
        {sorted.length === 0 ? (
          <p className="text-center py-12 text-sm text-[var(--muted-foreground)]">لا توجد بيانات في هذه الفترة</p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {sorted.map((svc, i) => {
              const pct = maxRevenue > 0 ? (svc.revenue / maxRevenue) * 100 : 0;
              const medals = ['🥇', '🥈', '🥉'];
              return (
                <div key={svc.serviceId} className="px-5 py-3.5 hover:bg-[var(--muted)]/30 transition">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm w-6 text-center">{medals[i] || `${i + 1}`}</span>
                      <div>
                        <p className="text-sm font-bold text-[var(--foreground)]">{svc.serviceName}</p>
                        <p className="text-[10px] text-[var(--muted-foreground)]">{svc.categoryName} · {svc.avgDuration} دقيقة</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-black tabular-nums text-[var(--foreground)]" dir="ltr">
                        {svc.revenue.toLocaleString('en')} <span className="text-[10px] font-normal text-[var(--muted-foreground)]">SAR</span>
                      </p>
                      <p className="text-[10px] text-[var(--muted-foreground)]">{svc.count} مرة</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-[var(--muted)] overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-l from-[var(--brand-primary)] to-[var(--brand-primary)]/50 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[9px] font-bold text-[var(--muted-foreground)] tabular-nums w-8 text-left">{Math.round(pct)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
