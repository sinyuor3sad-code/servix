'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Calendar, CheckCircle2, XCircle, AlertTriangle, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

interface ApptReport { total: number; byStatus: Record<string, number>; bySource: Record<string, number>; }
const EMPTY: ApptReport = { total: 0, byStatus: {}, bySource: {} };

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  completed: { label: 'مكتملة', color: 'text-emerald-600', bg: 'bg-emerald-500' },
  confirmed: { label: 'مؤكدة', color: 'text-blue-600', bg: 'bg-blue-500' },
  pending: { label: 'قيد الانتظار', color: 'text-amber-600', bg: 'bg-amber-500' },
  cancelled: { label: 'ملغية', color: 'text-red-500', bg: 'bg-red-500' },
  no_show: { label: 'لم يحضر', color: 'text-orange-500', bg: 'bg-orange-500' },
  in_progress: { label: 'جارية', color: 'text-indigo-600', bg: 'bg-indigo-500' },
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

  const statusEntries = Object.entries(r.byStatus || {}).map(([key, value]) => ({
    key, value, ...(STATUS_META[key] || { label: key, color: 'text-slate-500', bg: 'bg-slate-400' }),
  })).sort((a, b) => b.value - a.value);

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
      {/* ══════ Header ══════ */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-bl from-slate-900 via-slate-800 to-slate-900 p-8">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-blue-500/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative z-10">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <button onClick={() => router.push('/reports')} className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
                <ArrowRight className="h-4 w-4 text-white/60" />
              </button>
              <div>
                <h1 className="text-xl font-black text-white tracking-tight">تقرير المواعيد</h1>
                <p className="text-xs text-white/40 mt-0.5">تحليل الحجوزات والحالات</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} dir="ltr" className="px-3 py-2.5 rounded-xl bg-white/10 border border-white/10 text-xs text-white outline-none focus:bg-white/15 transition-all" />
              <span className="text-xs text-white/30">—</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} dir="ltr" className="px-3 py-2.5 rounded-xl bg-white/10 border border-white/10 text-xs text-white outline-none focus:bg-white/15 transition-all" />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
            {[
              { label: 'إجمالي', value: r.total, icon: Calendar },
              { label: 'مكتملة', value: `${completedRate}%`, sub: `${completed}`, icon: CheckCircle2 },
              { label: 'ملغية', value: `${cancelledRate}%`, sub: `${cancelled}`, icon: XCircle },
              { label: 'لم يحضر', value: `${noShowRate}%`, sub: `${noShow}`, icon: AlertTriangle },
            ].map((kpi, i) => {
              const Icon = kpi.icon;
              return (
                <div key={i} className="bg-white/[0.06] backdrop-blur-md rounded-2xl p-4 border border-white/[0.08]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center"><Icon className="h-3 w-3 text-white/50" /></div>
                    <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/30">{kpi.label}</span>
                  </div>
                  <p className="text-2xl font-black text-white tabular-nums">{kpi.value}</p>
                  {kpi.sub && <p className="text-[10px] text-white/25 mt-0.5">{kpi.sub} موعد</p>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══════ Status Distribution ══════ */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-6 py-5 border-b border-[var(--border)] flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Calendar className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold">توزيع الحالات</h3>
            <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">تحليل حسب حالة الموعد</p>
          </div>
        </div>
        <div className="p-6">
          {statusEntries.length > 0 ? (
            <>
              {/* Stacked bar */}
              <div className="h-4 rounded-full overflow-hidden flex mb-8 bg-[var(--muted)]">
                {statusEntries.map((s, i) => {
                  const pct = r.total > 0 ? (s.value / r.total) * 100 : 0;
                  return <div key={i} className={cn('transition-all duration-700 first:rounded-r-full last:rounded-l-full', s.bg)} style={{ width: `${pct}%`, opacity: 0.6 }} />;
                })}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {statusEntries.map(s => (
                  <div key={s.key} className="flex items-center gap-3 p-4 rounded-2xl bg-[var(--muted)]/30 border border-[var(--border)] hover:border-[var(--foreground)]/10 transition-all">
                    <div className={cn('w-3 h-3 rounded-full flex-shrink-0', s.bg)} style={{ opacity: 0.6 }} />
                    <div className="flex-1">
                      <span className="text-xs font-bold text-[var(--foreground)]">{s.label}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-[var(--muted-foreground)] tabular-nums">{s.value} موعد</span>
                        <span className="text-[9px] text-[var(--muted-foreground)]">·</span>
                        <span className="text-[10px] font-bold tabular-nums text-[var(--muted-foreground)]">{r.total > 0 ? Math.round((s.value / r.total) * 100) : 0}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-3xl bg-[var(--muted)] flex items-center justify-center mx-auto mb-4">
                <Calendar className="h-8 w-8 text-[var(--muted-foreground)]/20" />
              </div>
              <p className="font-bold">لا توجد مواعيد في هذه الفترة</p>
            </div>
          )}
        </div>
      </div>

      {/* ══════ Source ══════ */}
      {Object.keys(r.bySource || {}).length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <div className="px-6 py-5 border-b border-[var(--border)] flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Smartphone className="h-4 w-4 text-violet-600" />
            </div>
            <h3 className="text-sm font-bold">مصدر الحجز</h3>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {Object.entries(r.bySource).sort((a, b) => b[1] - a[1]).map(([source, count]) => {
              const pct = r.total > 0 ? Math.round((count / r.total) * 100) : 0;
              return (
                <div key={source} className="px-6 py-5 hover:bg-[var(--muted)]/20 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold">{SOURCE_LABELS[source] || source}</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-black tabular-nums">{count}</span>
                      <span className="text-[10px] text-[var(--muted-foreground)] bg-[var(--muted)] px-2 py-0.5 rounded-md tabular-nums">{pct}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--muted)] overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-l from-violet-500/40 to-violet-400/20 transition-all duration-700" style={{ width: `${pct}%` }} />
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
