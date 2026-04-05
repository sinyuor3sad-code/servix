'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Users, UserPlus, Repeat, Crown, Phone, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

interface ClientsReport {
  totalClients: number;
  newThisMonth: number;
  returningRate: number;
  topClients: { id: string; fullName: string; phone: string; totalVisits: number; totalSpent: number }[];
}

const PLACEHOLDER: ClientsReport = {
  totalClients: 342, newThisMonth: 28, returningRate: 65.4,
  topClients: [
    { id: '1', fullName: 'نورة الأحمد', phone: '0501234567', totalVisits: 24, totalSpent: 8400 },
    { id: '2', fullName: 'سارة المحمد', phone: '0559876543', totalVisits: 18, totalSpent: 6200 },
    { id: '3', fullName: 'ريم العتيبي', phone: '0541112233', totalVisits: 15, totalSpent: 5100 },
    { id: '4', fullName: 'هند القحطاني', phone: '0533445566', totalVisits: 12, totalSpent: 4800 },
    { id: '5', fullName: 'لمياء الدوسري', phone: '0527788990', totalVisits: 11, totalSpent: 3900 },
  ],
};

export default function ClientsReportPage() {
  const router = useRouter();
  const { accessToken } = useAuth();

  const { data, isLoading } = useQuery<ClientsReport>({
    queryKey: ['reports', 'clients'],
    queryFn: () => api.get<ClientsReport>('/reports/clients', accessToken!),
    enabled: !!accessToken, staleTime: 5 * 60 * 1000,
  });

  const report = data ?? PLACEHOLDER;
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
        <div className="rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 p-5 text-white">
          <Users className="h-5 w-5 mb-2 opacity-60" />
          <p className="text-xs opacity-70">إجمالي العملاء</p>
          <p className="text-3xl font-black mt-1">{report.totalClients.toLocaleString('en')}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white">
          <UserPlus className="h-5 w-5 mb-2 opacity-60" />
          <p className="text-xs opacity-70">عملاء جدد هذا الشهر</p>
          <p className="text-3xl font-black mt-1">{report.newThisMonth}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 p-5 text-white">
          <Repeat className="h-5 w-5 mb-2 opacity-60" />
          <p className="text-xs opacity-70">معدل العودة</p>
          <p className="text-3xl font-black mt-1 tabular-nums">{report.returningRate}%</p>
        </div>
      </div>

      {/* Top Clients */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h3 className="text-sm font-bold flex items-center gap-2"><Crown className="h-4 w-4 text-amber-500" /> أفضل العملاء</h3>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {report.topClients.map((c, i) => {
            const pct = Math.round((c.totalSpent / maxSpent) * 100);
            const medals = ['🥇', '🥈', '🥉'];
            return (
              <div key={c.id} className="px-5 py-4 hover:bg-[var(--muted)]/30 transition">
                <div className="flex items-center gap-4">
                  {/* Rank */}
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--brand-primary)]/10 to-[var(--brand-primary)]/5 flex items-center justify-center text-lg font-black flex-shrink-0">
                    {medals[i] || <span className="text-xs text-[var(--muted-foreground)]">{i + 1}</span>}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[var(--foreground)]">{c.fullName}</span>
                      <span className="text-[10px] text-[var(--muted-foreground)] px-1.5 py-0.5 rounded-md bg-[var(--muted)]">{c.totalVisits} زيارة</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Phone className="h-3 w-3 text-[var(--muted-foreground)]" />
                      <span className="text-[11px] text-[var(--muted-foreground)] tabular-nums" dir="ltr">{c.phone}</span>
                    </div>
                    {/* Progress */}
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-1.5 rounded-full bg-[var(--muted)] overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-l from-[var(--brand-primary)] to-[var(--brand-primary)]/50" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                  {/* Total Spent */}
                  <div className="text-left flex-shrink-0">
                    <span className="text-lg font-black tabular-nums text-[var(--foreground)]" dir="ltr">{c.totalSpent.toLocaleString('en')}</span>
                    <p className="text-[10px] text-[var(--muted-foreground)]">SAR</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
