'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Calendar, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

interface ApptReport {
  total: number; completed: number; cancelled: number; noShow: number;
  completedRate: number; cancelledRate: number; noShowRate: number;
  statusDistribution: { name: string; value: number; color: string }[];
  dailyTrend: { date: string; count: number }[];
}

const EMPTY: ApptReport = {
  total: 0, completed: 0, cancelled: 0, noShow: 0,
  completedRate: 0, cancelledRate: 0, noShowRate: 0,
  statusDistribution: [],
  dailyTrend: [],
};

function getDefaultDates() {
  const now = new Date();
  return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0], to: now.toISOString().split('T')[0] };
}

export default function AppointmentsReportPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const defaults = useMemo(getDefaultDates, []);
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);

  const { data, isLoading } = useQuery<ApptReport>({
    queryKey: ['reports', 'appointments', dateFrom, dateTo],
    queryFn: () => api.get<ApptReport>(`/reports/appointments?dateFrom=${dateFrom}&dateTo=${dateTo}`, accessToken!),
    enabled: !!accessToken, staleTime: 5 * 60 * 1000,
  });

  const r = data ?? EMPTY;
  const maxCount = Math.max(...(r.dailyTrend?.map(d => d.count) ?? [0]));

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
            <h1 className="text-xl font-black">تقرير المواعيد</h1>
            <p className="text-xs text-[var(--muted-foreground)]">تحليل المواعيد والحجوزات</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} dir="ltr"
            className="px-3 py-2 rounded-xl border border-[var(--border)] text-[11px] bg-[var(--card)] outline-none focus:border-[var(--brand-primary)]" />
          <span className="text-[10px] text-[var(--muted-foreground)]">→</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} dir="ltr"
            className="px-3 py-2 rounded-xl border border-[var(--border)] text-[11px] bg-[var(--card)] outline-none focus:border-[var(--brand-primary)]" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 p-4 text-white">
          <Calendar className="h-4 w-4 mb-1.5 opacity-60" />
          <p className="text-[10px] opacity-70">إجمالي</p>
          <p className="text-2xl font-black">{r.total}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-4 text-white">
          <CheckCircle2 className="h-4 w-4 mb-1.5 opacity-60" />
          <p className="text-[10px] opacity-70">مكتملة</p>
          <p className="text-2xl font-black tabular-nums">{r.completedRate}%</p>
          <p className="text-[10px] opacity-50">{r.completed} موعد</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 p-4 text-white">
          <XCircle className="h-4 w-4 mb-1.5 opacity-60" />
          <p className="text-[10px] opacity-70">ملغية</p>
          <p className="text-2xl font-black tabular-nums">{r.cancelledRate}%</p>
          <p className="text-[10px] opacity-50">{r.cancelled} موعد</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-4 text-white">
          <AlertTriangle className="h-4 w-4 mb-1.5 opacity-60" />
          <p className="text-[10px] opacity-70">لم يحضر</p>
          <p className="text-2xl font-black tabular-nums">{r.noShowRate}%</p>
          <p className="text-[10px] opacity-50">{r.noShow} موعد</p>
        </div>
      </div>

      {/* Status Distribution - Visual */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h3 className="text-sm font-bold">📊 توزيع الحالات</h3>
        </div>
        <div className="p-5">
          {/* Horizontal stacked bar */}
          <div className="h-8 rounded-xl overflow-hidden flex mb-4">
            {r.statusDistribution.map((s, i) => {
              const pct = r.total > 0 ? (s.value / r.total) * 100 : 0;
              return <div key={i} className="transition-all" style={{ width: `${pct}%`, backgroundColor: s.color }} />;
            })}
          </div>
          {/* Legend */}
          <div className="flex items-center justify-center gap-6">
            {r.statusDistribution.map(s => (
              <div key={s.name} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-xs font-bold text-[var(--foreground)]">{s.name}</span>
                <span className="text-[10px] text-[var(--muted-foreground)]">({s.value})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Daily Trend */}
      {r.dailyTrend && r.dailyTrend.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <h3 className="text-sm font-bold">📈 الاتجاه اليومي</h3>
          </div>
          <div className="p-5">
            <div className="flex items-end gap-1.5 h-36">
              {r.dailyTrend.map((dp, i) => {
                const pct = maxCount > 0 ? (dp.count / maxCount) * 100 : 0;
                const d = new Date(dp.date);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                    <span className="text-[9px] font-bold text-[var(--brand-primary)] opacity-0 group-hover:opacity-100 transition">{dp.count}</span>
                    <div className="w-full rounded-t-lg bg-gradient-to-t from-violet-500 to-violet-300 group-hover:from-violet-600 group-hover:to-violet-400 transition-all cursor-pointer"
                      style={{ height: `${Math.max(pct, 4)}%` }} />
                    <span className="text-[8px] text-[var(--muted-foreground)] tabular-nums" dir="ltr">
                      {d.toLocaleDateString('en', { month: '2-digit', day: '2-digit' })}
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
