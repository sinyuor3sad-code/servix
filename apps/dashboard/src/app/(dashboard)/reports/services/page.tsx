'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { ArrowRight, Scissors, TrendingUp, Hash, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

interface ServiceReportItem {
  service: { id: string; nameAr: string; nameEn?: string; price: number };
  bookingsCount: number; revenue: number;
}

type Period = 'week' | 'month' | 'year' | 'all';
type SortBy = 'revenue' | 'count';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'week', label: 'الأسبوع' }, { key: 'month', label: 'الشهر' },
  { key: 'year', label: 'السنة' }, { key: 'all', label: 'الكل' },
];

function getDateRange(period: Period) {
  const now = new Date(); const to = now.toISOString().split('T')[0]; let from: Date;
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

  const { data, isLoading, isFetching } = useQuery<ServiceReportItem[]>({
    queryKey: ['reports', 'services', dateRange.from, dateRange.to],
    queryFn: () => api.get<ServiceReportItem[]>(`/reports/services?dateFrom=${dateRange.from}&dateTo=${dateRange.to}`, accessToken!),
    enabled: !!accessToken, staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const items = data ?? [];
  const totalRevenue = items.reduce((s, i) => s + i.revenue, 0);
  const totalBookings = items.reduce((s, i) => s + i.bookingsCount, 0);
  const maxRevenue = Math.max(...items.map(s => s.revenue), 1);
  const sorted = useMemo(() => [...items].sort((a, b) =>
    sortBy === 'revenue' ? b.revenue - a.revenue : b.bookingsCount - a.bookingsCount
  ), [items, sortBy]);

  if (isLoading && !data) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className={cn('p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-8 transition-opacity duration-300', isFetching ? 'opacity-60' : 'opacity-100')}>
      {/* ══════ Header ══════ */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-bl from-slate-900 via-slate-800 to-slate-900 p-8">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-amber-500/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/reports')} className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
              <ArrowRight className="h-4 w-4 text-white/60" />
            </button>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">تقرير الخدمات</h1>
              <p className="text-xs text-white/40 mt-0.5">الأكثر طلباً والأعلى إيراداً</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8">
            {[
              { label: 'إجمالي الخدمات', value: items.length, icon: Scissors },
              { label: 'الإيرادات', value: totalRevenue.toLocaleString('en'), suffix: 'SAR', icon: TrendingUp },
              { label: 'عدد الحجوزات', value: totalBookings, icon: Hash },
            ].map((kpi, i) => {
              const Icon = kpi.icon;
              return (
                <div key={i} className="bg-white/[0.06] backdrop-blur-md rounded-2xl p-5 border border-white/[0.08]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center"><Icon className="h-3.5 w-3.5 text-white/50" /></div>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/30">{kpi.label}</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <p className="text-3xl font-black text-white tabular-nums" dir="ltr">{kpi.value}</p>
                    {kpi.suffix && <span className="text-[10px] text-white/30">{kpi.suffix}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══════ Controls ══════ */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="inline-flex bg-[var(--muted)] rounded-2xl p-1.5">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={cn('px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300',
                period === p.key ? 'bg-[var(--foreground)] text-[var(--background)] shadow-md' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]')}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="inline-flex bg-[var(--muted)] rounded-2xl p-1.5">
          {[{ key: 'revenue' as SortBy, label: 'حسب الإيراد' }, { key: 'count' as SortBy, label: 'حسب الطلب' }].map(s => (
            <button key={s.key} onClick={() => setSortBy(s.key)}
              className={cn('px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300',
                sortBy === s.key ? 'bg-[var(--foreground)] text-[var(--background)] shadow-md' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]')}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════ Services Table ══════ */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-6 py-5 border-b border-[var(--border)] flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <BarChart3 className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold">تفصيل الخدمات</h3>
            <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">{sorted.length} خدمة</p>
          </div>
        </div>
        {sorted.length === 0 ? (
          <div className="p-20 text-center">
            <div className="w-16 h-16 rounded-3xl bg-[var(--muted)] flex items-center justify-center mx-auto mb-4">
              <Scissors className="h-8 w-8 text-[var(--muted-foreground)]/20" />
            </div>
            <p className="font-bold text-lg">لا توجد بيانات في هذه الفترة</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {sorted.map((item, i) => {
              const pct = maxRevenue > 0 ? (item.revenue / maxRevenue) * 100 : 0;
              const share = totalRevenue > 0 ? Math.round((item.revenue / totalRevenue) * 100) : 0;
              return (
                <div key={item.service.id} className="px-6 py-5 hover:bg-[var(--muted)]/20 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-[10px] font-black',
                        i === 0 ? 'bg-amber-500/10 text-amber-600' :
                        i === 1 ? 'bg-slate-400/10 text-slate-500' :
                        i === 2 ? 'bg-orange-500/10 text-orange-600' :
                        'bg-[var(--muted)] text-[var(--muted-foreground)]'
                      )}>
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[var(--foreground)]">{item.service.nameAr}</p>
                        {item.service.nameEn && <p className="text-[10px] text-[var(--muted-foreground)]">{item.service.nameEn}</p>}
                      </div>
                    </div>
                    <div className="text-left flex items-center gap-4">
                      <span className="text-[10px] text-[var(--muted-foreground)] bg-[var(--muted)] px-2 py-0.5 rounded-lg tabular-nums">{item.bookingsCount} مرة · {share}%</span>
                      <div>
                        <p className="text-sm font-black tabular-nums text-[var(--foreground)]" dir="ltr">{item.revenue.toLocaleString('en')}</p>
                        <p className="text-[10px] text-[var(--muted-foreground)]">SAR</p>
                      </div>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--muted)] overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-l from-amber-500/30 to-amber-400/10 transition-all duration-700" style={{ width: `${pct}%` }} />
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
