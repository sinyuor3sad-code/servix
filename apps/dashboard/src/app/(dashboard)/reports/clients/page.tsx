'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Users, UserPlus, Repeat, Crown, Phone } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

/* ═══════════════ Backend shape ═══════════════ */
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/reports')} className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--muted)] transition">
          <ArrowRight className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-black">تقرير العملاء</h1>
          <p className="text-xs text-[var(--muted-foreground)]">تحليل بيانات العملاء والولاء</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white">
          <UserPlus className="h-5 w-5 mb-2 opacity-60" />
          <p className="text-xs opacity-70">عملاء جدد هذا الشهر</p>
          <p className="text-3xl font-black mt-1">{report.newClients}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 p-5 text-white">
          <Repeat className="h-5 w-5 mb-2 opacity-60" />
          <p className="text-xs opacity-70">عملاء عائدون</p>
          <p className="text-3xl font-black mt-1">{report.returningClients}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 p-5 text-white">
          <Users className="h-5 w-5 mb-2 opacity-60" />
          <p className="text-xs opacity-70">معدل العودة</p>
          <p className="text-3xl font-black mt-1 tabular-nums">{returningRate}%</p>
        </div>
      </div>

      {/* Top Clients */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h3 className="text-sm font-bold flex items-center gap-2"><Crown className="h-4 w-4 text-amber-500" /> أفضل العملاء</h3>
        </div>
        {report.topClients.length > 0 ? (
          <div className="divide-y divide-[var(--border)]">
            {report.topClients.map((c, i) => {
              const pct = Math.round((c.totalSpent / maxSpent) * 100);
              const medals = ['🥇', '🥈', '🥉'];
              return (
                <div key={c.id} className="px-5 py-4 hover:bg-[var(--muted)]/30 transition">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--brand-primary)]/10 to-[var(--brand-primary)]/5 flex items-center justify-center text-lg font-black flex-shrink-0">
                      {medals[i] || <span className="text-xs text-[var(--muted-foreground)]">{i + 1}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[var(--foreground)]">{c.fullName}</span>
                        <span className="text-[10px] text-[var(--muted-foreground)] px-1.5 py-0.5 rounded-md bg-[var(--muted)]">{c.totalVisits} زيارة</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3 text-[var(--muted-foreground)]" />
                        <span className="text-[11px] text-[var(--muted-foreground)] tabular-nums" dir="ltr">{c.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 h-1.5 rounded-full bg-[var(--muted)] overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-l from-[var(--brand-primary)] to-[var(--brand-primary)]/50" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
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
          <p className="text-center py-12 text-sm text-[var(--muted-foreground)]">لا توجد بيانات عملاء</p>
        )}
      </div>
    </div>
  );
}
