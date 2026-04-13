'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Calendar, CheckCircle2, XCircle, AlertTriangle, Smartphone, Footprints, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

interface ApptReport { total: number; byStatus: Record<string, number>; bySource: Record<string, number>; }
const EMPTY: ApptReport = { total: 0, byStatus: {}, bySource: {} };

const STATUS_COLORS: Record<string, string> = {
  completed: 'var(--foreground)', confirmed: '#6366f1', pending: '#a3a3a3',
  cancelled: '#dc2626', no_show: '#f97316', in_progress: '#2563eb',
};
const STATUS_LABELS: Record<string, string> = {
  completed: 'مكتملة', confirmed: 'مؤكدة', pending: 'قيد الانتظار',
  cancelled: 'ملغية', no_show: 'لم يحضر', in_progress: 'جارية',
};
const SOURCE_LABELS: Record<string, string> = { walk_in: 'حضور مباشر', online: 'حجز إلكتروني', phone: 'هاتف', app: 'تطبيق' };

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

  const statusEntries = Object.entries(r.byStatus || {}).map(([name, value]) => ({
    name: STATUS_LABELS[name] || name, value, color: STATUS_COLORS[name] || '#94a3b8', key: name,
  })).sort((a, b) => b.value - a.value);

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
            <h1 className="text-xl font-black tracking-tight">تقرير المواعيد</h1>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">تحليل المواعيد والحجوزات</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} dir="ltr"
            className="px-3 py-2 rounded-lg border border-[var(--border)] text-xs bg-[var(--card)] outline-none focus:border-[var(--foreground)]/30 transition-colors" />
          <span className="text-xs text-[var(--muted-foreground)]">—</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} dir="ltr"
            className="px-3 py-2 rounded-lg border border-[var(--border)] text-xs bg-[var(--card)] outline-none focus:border-[var(--foreground)]/30 transition-colors" />
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[var(--border)] rounded-2xl overflow-hidden">
        {[
          { label: 'إجمالي', value: r.total, icon: Calendar },
          { label: 'مكتملة', value: `${completedRate}%`, sub: `${completed} موعد`, icon: CheckCircle2 },
          { label: 'ملغية', value: `${cancelledRate}%`, sub: `${cancelled} موعد`, icon: XCircle },
          { label: 'لم يحضر', value: `${noShowRate}%`, sub: `${noShow} موعد`, icon: AlertTriangle },
        ].map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <div key={i} className="bg-[var(--card)] p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-[var(--muted)] flex items-center justify-center">
                  <Icon className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">{kpi.label}</span>
              </div>
              <p className="text-2xl font-black tabular-nums text-[var(--foreground)]">{kpi.value}</p>
              {kpi.sub && <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">{kpi.sub}</p>}
            </div>
          );
        })}
      </div>

      {/* Status Distribution */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--muted)] flex items-center justify-center">
            <Calendar className="h-4 w-4 text-[var(--muted-foreground)]" />
          </div>
          <h3 className="text-sm font-bold">توزيع الحالات</h3>
        </div>
        <div className="p-6">
          {statusEntries.length > 0 ? (
            <>
              <div className="h-3 rounded-full overflow-hidden flex mb-6 bg-[var(--muted)]">
                {statusEntries.map((s, i) => {
                  const pct = r.total > 0 ? (s.value / r.total) * 100 : 0;
                  return <div key={i} className="transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: s.color, opacity: 0.7 }} />;
                })}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {statusEntries.map(s => (
                  <div key={s.key} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--muted)]/30">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color, opacity: 0.7 }} />
                    <div>
                      <span className="text-xs font-bold text-[var(--foreground)]">{s.name}</span>
                      <p className="text-[10px] text-[var(--muted-foreground)] tabular-nums">{s.value} موعد</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-center py-12 text-sm text-[var(--muted-foreground)]">لا توجد مواعيد في هذه الفترة</p>
          )}
        </div>
      </div>

      {/* Source Distribution */}
      {Object.keys(r.bySource || {}).length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border)] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--muted)] flex items-center justify-center">
              <Smartphone className="h-4 w-4 text-[var(--muted-foreground)]" />
            </div>
            <h3 className="text-sm font-bold">مصدر الحجز</h3>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {Object.entries(r.bySource).sort((a, b) => b[1] - a[1]).map(([source, count]) => {
              const pct = r.total > 0 ? Math.round((count / r.total) * 100) : 0;
              return (
                <div key={source} className="px-6 py-4 hover:bg-[var(--muted)]/20 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-[var(--foreground)]">{SOURCE_LABELS[source] || source}</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm font-black tabular-nums">{count}</span>
                      <span className="text-[10px] text-[var(--muted-foreground)]">({pct}%)</span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--muted)] overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--foreground)]/15 transition-all duration-500" style={{ width: `${pct}%` }} />
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
