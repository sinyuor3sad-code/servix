'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Users, UserPlus, Repeat, Crown, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

interface ClientsResult {
  newClients: number; returningClients: number;
  topClients: { id: string; fullName: string; phone: string; totalVisits: number; totalSpent: number }[];
}
const EMPTY: ClientsResult = { newClients: 0, returningClients: 0, topClients: [] };

export default function ClientsReportPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const now = new Date();
  const dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const dateTo = now.toISOString().split('T')[0];

  const { data, isLoading } = useQuery<ClientsResult>({
    queryKey: ['reports', 'clients'],
    queryFn: () => api.get<ClientsResult>(`/reports/clients?dateFrom=${dateFrom}&dateTo=${dateTo}`, accessToken!),
    enabled: !!accessToken, staleTime: 5 * 60 * 1000,
  });

  const report = data ?? EMPTY;
  const totalClients = report.newClients + report.returningClients;
  const returningRate = totalClients > 0 ? Math.round((report.returningClients / totalClients) * 100) : 0;
  const maxSpent = Math.max(...report.topClients.map(c => c.totalSpent), 1);

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
      {/* ══════ Header ══════ */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-bl from-slate-900 via-slate-800 to-slate-900 p-8">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-violet-500/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/reports')} className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
              <ArrowRight className="h-4 w-4 text-white/60" />
            </button>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">تقرير العملاء</h1>
              <p className="text-xs text-white/40 mt-0.5">تحليل بيانات العملاء والولاء</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8">
            {[
              { label: 'عملاء جدد هذا الشهر', value: report.newClients, icon: UserPlus },
              { label: 'عملاء عائدون', value: report.returningClients, icon: Repeat },
              { label: 'معدل العودة', value: `${returningRate}%`, icon: Users },
            ].map((kpi, i) => {
              const Icon = kpi.icon;
              return (
                <div key={i} className="bg-white/[0.06] backdrop-blur-md rounded-2xl p-5 border border-white/[0.08]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center"><Icon className="h-3.5 w-3.5 text-white/50" /></div>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/30">{kpi.label}</span>
                  </div>
                  <p className="text-3xl font-black text-white tabular-nums">{kpi.value}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══════ Top Clients ══════ */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-6 py-5 border-b border-[var(--border)] flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Crown className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold">أفضل العملاء</h3>
            <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">حسب إجمالي الإنفاق</p>
          </div>
        </div>
        {report.topClients.length > 0 ? (
          <div className="divide-y divide-[var(--border)]">
            {report.topClients.map((c, i) => {
              const pct = Math.round((c.totalSpent / maxSpent) * 100);
              return (
                <div key={c.id} className="px-6 py-5 hover:bg-[var(--muted)]/20 transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-black transition-all duration-300',
                      i === 0 ? 'bg-amber-500/10 text-amber-600' :
                      i === 1 ? 'bg-slate-400/10 text-slate-500' :
                      i === 2 ? 'bg-orange-500/10 text-orange-600' :
                      'bg-[var(--muted)] text-[var(--muted-foreground)]'
                    )}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-bold text-[var(--foreground)]">{c.fullName}</span>
                        <span className="text-[9px] text-[var(--muted-foreground)] px-2 py-0.5 rounded-lg bg-[var(--muted)] tabular-nums">{c.totalVisits} زيارة</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3 text-[var(--muted-foreground)]" />
                        <span className="text-[11px] text-[var(--muted-foreground)] tabular-nums" dir="ltr">{c.phone}</span>
                      </div>
                      <div className="mt-3 h-1 rounded-full bg-[var(--muted)] overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-l from-violet-500/30 to-violet-400/10 transition-all duration-700" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="text-left flex-shrink-0">
                      <span className="text-xl font-black tabular-nums text-[var(--foreground)]" dir="ltr">{c.totalSpent.toLocaleString('en')}</span>
                      <p className="text-[10px] text-[var(--muted-foreground)]">SAR</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-20 text-center">
            <div className="w-16 h-16 rounded-3xl bg-[var(--muted)] flex items-center justify-center mx-auto mb-4">
              <Users className="h-8 w-8 text-[var(--muted-foreground)]/20" />
            </div>
            <p className="font-bold text-lg">لا توجد بيانات عملاء</p>
          </div>
        )}
      </div>
    </div>
  );
}
