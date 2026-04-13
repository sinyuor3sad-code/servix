'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Scissors, TrendingUp, Hash, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

interface ServiceReportItem {
  service: { id: string; nameAr: string; nameEn?: string; price: number };
  bookingsCount: number;
  revenue: number;
}

type Period = 'week' | 'month' | 'year' | 'all';
type SortBy = 'revenue' | 'count';

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

export default function ServicesReportPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [period, setPeriod] = useState<Period>('month');
  const [sortBy, setSortBy] = useState<SortBy>('revenue');
  const dateRange = useMemo(() => getDateRange(period), [period]);

  const { data, isLoading } = useQuery<ServiceReportItem[]>({
    queryKey: ['reports', 'services', dateRange.from, dateRange.to],
    queryFn: () => api.get<ServiceReportItem[]>(`/reports/services?dateFrom=${dateRange.from}&dateTo=${dateRange.to}`, accessToken!),
    enabled: !!accessToken, staleTime: 5 * 60 * 1000,
  });

  const items = data ?? [];
  const totalRevenue = items.reduce((s, i) => s + i.revenue, 0);
  const totalBookings = items.reduce((s, i) => s + i.bookingsCount, 0);
  const maxRevenue = Math.max(...items.map(s => s.revenue), 1);

  const sorted = useMemo(() => [...items].sort((a, b) =>
    sortBy === 'revenue' ? b.revenue - a.revenue : b.bookingsCount - a.bookingsCount
  ), [items, sortBy]);

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/reports')} className="w-10 h-10 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] flex items-center justify-center transition-colors">
          <ArrowRight className="h-4 w-4 text-[var(--muted-foreground)]" />
        </button>
        <div>
          <h1 className="text-xl font-black tracking-tight">تقرير الخدمات</h1>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">الأكثر طلباً والأعلى إيراداً</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex bg-[var(--muted)] rounded-xl p-1">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={cn('px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200',
                period === p.key ? 'bg-[var(--foreground)] text-[var(--background)] shadow-sm' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]')}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex bg-[var(--muted)] rounded-xl p-1">
          {[{ key: 'revenue' as SortBy, label: 'الإيراد' }, { key: 'count' as SortBy, label: 'الطلب' }].map(s => (
            <button key={s.key} onClick={() => setSortBy(s.key)}
              className={cn('px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200',
                sortBy === s.key ? 'bg-[var(--foreground)] text-[var(--background)] shadow-sm' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]')}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-[var(--border)] rounded-2xl overflow-hidden">
        {[
          { label: 'إجمالي الخدمات', value: items.length, icon: Scissors },
          { label: 'الإيرادات', value: totalRevenue.toLocaleString('en'), suffix: 'SAR', icon: TrendingUp },
          { label: 'عدد الحجوزات', value: totalBookings, icon: Hash },
        ].map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <div key={i} className="bg-[var(--card)] p-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--muted)] flex items-center justify-center">
                  <Icon className="h-4 w-4 text-[var(--muted-foreground)]" />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">{kpi.label}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <p className="text-3xl font-black tabular-nums text-[var(--foreground)]" dir="ltr">{kpi.value}</p>
                {kpi.suffix && <span className="text-[10px] text-[var(--muted-foreground)]">{kpi.suffix}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Services Table */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--muted)] flex items-center justify-center">
            <BarChart3 className="h-4 w-4 text-[var(--muted-foreground)]" />
          </div>
          <h3 className="text-sm font-bold">تفصيل الخدمات ({sorted.length})</h3>
        </div>
        {sorted.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[var(--muted)] flex items-center justify-center mx-auto mb-3">
              <Scissors className="h-7 w-7 text-[var(--muted-foreground)]/30" />
            </div>
            <p className="font-bold text-[var(--foreground)]">لا توجد بيانات في هذه الفترة</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {sorted.map((item, i) => {
              const pct = maxRevenue > 0 ? (item.revenue / maxRevenue) * 100 : 0;
              return (
                <div key={item.service.id} className="px-6 py-4 hover:bg-[var(--muted)]/20 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[var(--muted)] flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-black text-[var(--muted-foreground)]">{i + 1}</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[var(--foreground)]">{item.service.nameAr}</p>
                        {item.service.nameEn && <p className="text-[10px] text-[var(--muted-foreground)]">{item.service.nameEn}</p>}
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-black tabular-nums text-[var(--foreground)]" dir="ltr">
                        {item.revenue.toLocaleString('en')} <span className="text-[10px] font-normal text-[var(--muted-foreground)]">SAR</span>
                      </p>
                      <p className="text-[10px] text-[var(--muted-foreground)]">{item.bookingsCount} مرة</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1 rounded-full bg-[var(--muted)] overflow-hidden">
                      <div className="h-full rounded-full bg-[var(--foreground)]/12 transition-all duration-500" style={{ width: `${pct}%` }} />
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
