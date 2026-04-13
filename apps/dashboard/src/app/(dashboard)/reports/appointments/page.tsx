'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Calendar, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

/* ═══════════════ Backend shape ═══════════════ */
interface ApptReport {
  total: number;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
}

const EMPTY: ApptReport = { total: 0, byStatus: {}, bySource: {} };

const STATUS_COLORS: Record<string, string> = {
  completed: '#10b981',
  confirmed: '#3b82f6',
  pending: '#f59e0b',
  cancelled: '#ef4444',
  no_show: '#f97316',
  in_progress: '#6366f1',
};

const STATUS_LABELS: Record<string, string> = {
  completed: 'مكتملة',
  confirmed: 'مؤكدة',
  pending: 'قيد الانتظار',
  cancelled: 'ملغية',
  no_show: 'لم يحضر',
  in_progress: 'جارية',
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
  const completed = r.byStatus?.completed ?? 0;
  const cancelled = r.byStatus?.cancelled ?? 0;
  const noShow = r.byStatus?.no_show ?? 0;
  const completedRate = r.total > 0 ? Math.round((completed / r.total) * 100) : 0;
  const cancelledRate = r.total > 0 ? Math.round((cancelled / r.total) * 100) : 0;
  const noShowRate = r.total > 0 ? Math.round((noShow / r.total) * 100) : 0;

  // Build status distribution entries from byStatus map
  const statusEntries = Object.entries(r.byStatus || {}).map(([name, value]) => ({
    name: STATUS_LABELS[name] || name,
    value,
    color: STATUS_COLORS[name] || '#94a3b8',
  })).sort((a, b) => b.value - a.value);

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
          <p className="text-2xl font-black tabular-nums">{completedRate}%</p>
          <p className="text-[10px] opacity-50">{completed} موعد</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 p-4 text-white">
          <XCircle className="h-4 w-4 mb-1.5 opacity-60" />
          <p className="text-[10px] opacity-70">ملغية</p>
          <p className="text-2xl font-black tabular-nums">{cancelledRate}%</p>
          <p className="text-[10px] opacity-50">{cancelled} موعد</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-4 text-white">
          <AlertTriangle className="h-4 w-4 mb-1.5 opacity-60" />
          <p className="text-[10px] opacity-70">لم يحضر</p>
          <p className="text-2xl font-black tabular-nums">{noShowRate}%</p>
          <p className="text-[10px] opacity-50">{noShow} موعد</p>
        </div>
      </div>

      {/* Status Distribution */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h3 className="text-sm font-bold">📊 توزيع الحالات</h3>
        </div>
        <div className="p-5">
          {statusEntries.length > 0 ? (
            <>
              {/* Horizontal stacked bar */}
              <div className="h-8 rounded-xl overflow-hidden flex mb-4">
                {statusEntries.map((s, i) => {
                  const pct = r.total > 0 ? (s.value / r.total) * 100 : 0;
                  return <div key={i} className="transition-all" style={{ width: `${pct}%`, backgroundColor: s.color }} />;
                })}
              </div>
              {/* Legend */}
              <div className="flex items-center justify-center gap-6 flex-wrap">
                {statusEntries.map(s => (
                  <div key={s.name} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-xs font-bold text-[var(--foreground)]">{s.name}</span>
                    <span className="text-[10px] text-[var(--muted-foreground)]">({s.value})</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-center py-8 text-sm text-[var(--muted-foreground)]">لا توجد مواعيد في هذه الفترة</p>
          )}
        </div>
      </div>

      {/* Source Distribution */}
      {Object.keys(r.bySource || {}).length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <h3 className="text-sm font-bold">📱 مصدر الحجز</h3>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {Object.entries(r.bySource).sort((a, b) => b[1] - a[1]).map(([source, count]) => {
              const pct = r.total > 0 ? Math.round((count / r.total) * 100) : 0;
              const labels: Record<string, string> = { walk_in: 'حضور مباشر', online: 'حجز إلكتروني', phone: 'هاتف', app: 'تطبيق' };
              return (
                <div key={source} className="px-5 py-3.5 hover:bg-[var(--muted)]/30 transition">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-[var(--foreground)]">{labels[source] || source}</span>
                    <span className="text-sm font-black tabular-nums">{count} <span className="text-[10px] font-normal text-[var(--muted-foreground)]">({pct}%)</span></span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--muted)] overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-l from-violet-500 to-violet-400" style={{ width: `${pct}%` }} />
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
