'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Users, UserPlus, Repeat, Crown, Phone } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

interface ClientsResult {
  newClients: number;
  returningClients: number;
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
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/reports')} className="w-10 h-10 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] flex items-center justify-center transition-colors">
          <ArrowRight className="h-4 w-4 text-[var(--muted-foreground)]" />
        </button>
        <div>
          <h1 className="text-xl font-black tracking-tight">تقرير العملاء</h1>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">تحليل بيانات العملاء والولاء</p>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-[var(--border)] rounded-2xl overflow-hidden">
        {[
          { label: 'عملاء جدد هذا الشهر', value: report.newClients, icon: UserPlus },
          { label: 'عملاء عائدون', value: report.returningClients, icon: Repeat },
          { label: 'معدل العودة', value: `${returningRate}%`, icon: Users },
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
              <p className="text-3xl font-black tabular-nums text-[var(--foreground)]">{kpi.value}</p>
            </div>
          );
        })}
      </div>

      {/* Top Clients Table */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--muted)] flex items-center justify-center">
            <Crown className="h-4 w-4 text-[var(--muted-foreground)]" />
          </div>
          <h3 className="text-sm font-bold">أفضل العملاء</h3>
        </div>
        {report.topClients.length > 0 ? (
          <div className="divide-y divide-[var(--border)]">
            {report.topClients.map((c, i) => {
              const pct = Math.round((c.totalSpent / maxSpent) * 100);
              return (
                <div key={c.id} className="px-6 py-4 hover:bg-[var(--muted)]/20 transition-colors">
                  <div className="flex items-center gap-4">
                    {/* Rank */}
                    <div className="w-9 h-9 rounded-lg bg-[var(--muted)] flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-black text-[var(--muted-foreground)]">{i + 1}</span>
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-bold text-[var(--foreground)]">{c.fullName}</span>
                        <span className="text-[10px] text-[var(--muted-foreground)] px-2 py-0.5 rounded-md bg-[var(--muted)]">{c.totalVisits} زيارة</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3 text-[var(--muted-foreground)]" />
                        <span className="text-[11px] text-[var(--muted-foreground)] tabular-nums" dir="ltr">{c.phone}</span>
                      </div>
                      <div className="mt-2.5 h-1 rounded-full bg-[var(--muted)] overflow-hidden">
                        <div className="h-full rounded-full bg-[var(--foreground)]/12 transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    {/* Spent */}
                    <div className="text-left flex-shrink-0">
                      <span className="text-lg font-black tabular-nums text-[var(--foreground)]" dir="ltr">{c.totalSpent.toLocaleString('en')}</span>
                      <p className="text-[10px] text-[var(--muted-foreground)]">SAR</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[var(--muted)] flex items-center justify-center mx-auto mb-3">
              <Users className="h-7 w-7 text-[var(--muted-foreground)]/30" />
            </div>
            <p className="font-bold text-[var(--foreground)]">لا توجد بيانات عملاء</p>
          </div>
        )}
      </div>
    </div>
  );
}
