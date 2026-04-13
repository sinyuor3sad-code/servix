'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, UserCog, Star, Trophy, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

/* ═══════════════ Backend shape ═══════════════ */
interface EmployeeReportItem {
  employee: { id: string; fullName: string; role: string };
  appointmentsCount: number;
  revenue: number;
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={cn('h-3 w-3', i <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-[var(--border)]')} />
      ))}
    </div>
  );
}

export default function EmployeesReportPage() {
  const router = useRouter();
  const { accessToken } = useAuth();

  const now = new Date();
  const dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const dateTo = now.toISOString().split('T')[0];

  const { data, isLoading } = useQuery<EmployeeReportItem[]>({
    queryKey: ['reports', 'employees'],
    queryFn: () => api.get<EmployeeReportItem[]>(`/reports/employees?dateFrom=${dateFrom}&dateTo=${dateTo}`, accessToken!),
    enabled: !!accessToken, staleTime: 5 * 60 * 1000,
  });

  const employees = data ?? [];
  const sorted = [...employees].sort((a, b) => b.revenue - a.revenue);
  const totalRevenue = sorted.reduce((s, e) => s + e.revenue, 0);
  const maxRev = Math.max(...sorted.map(e => e.revenue), 1);
  const maxAppt = Math.max(...sorted.map(e => e.appointmentsCount), 1);

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/reports')} className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--muted)] transition">
          <ArrowRight className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-black">تقرير الموظفات</h1>
          <p className="text-xs text-[var(--muted-foreground)]">تحليل أداء وإنتاجية الفريق</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 p-5 text-white">
          <UserCog className="h-5 w-5 mb-2 opacity-60" />
          <p className="text-xs opacity-70">إجمالي الموظفات</p>
          <p className="text-3xl font-black mt-1">{sorted.length}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white">
          <TrendingUp className="h-5 w-5 mb-2 opacity-60" />
          <p className="text-xs opacity-70">إجمالي الإيرادات</p>
          <p className="text-3xl font-black mt-1 tabular-nums" dir="ltr">{totalRevenue.toLocaleString('en')}</p>
          <p className="text-[10px] opacity-50">SAR</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 p-5 text-white">
          <Trophy className="h-5 w-5 mb-2 opacity-60" />
          <p className="text-xs opacity-70">إجمالي المواعيد</p>
          <p className="text-3xl font-black mt-1">{sorted.reduce((s, e) => s + e.appointmentsCount, 0)}</p>
        </div>
      </div>

      {/* Employee Cards */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h3 className="text-sm font-bold flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" /> ترتيب الموظفات حسب الإيرادات</h3>
        </div>
        {sorted.length > 0 ? (
          <div className="divide-y divide-[var(--border)]">
            {sorted.map((item, i) => {
              const revPct = Math.round((item.revenue / maxRev) * 100);
              const medals = ['🥇', '🥈', '🥉'];
              return (
                <div key={item.employee.id} className="p-5 hover:bg-[var(--muted)]/20 transition">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--brand-primary)]/10 to-[var(--brand-primary)]/5 flex items-center justify-center text-lg font-black flex-shrink-0">
                      {medals[i] || <span className="text-xs text-[var(--muted-foreground)]">{i + 1}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-bold text-[var(--foreground)]">{item.employee.fullName}</span>
                    </div>
                    <div className="text-left flex-shrink-0">
                      <div className="text-lg font-black tabular-nums text-[var(--foreground)]" dir="ltr">{item.revenue.toLocaleString('en')}</div>
                      <p className="text-[10px] text-[var(--muted-foreground)]">SAR · {item.appointmentsCount} موعد</p>
                    </div>
                  </div>
                  {/* Revenue Bar */}
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-[var(--muted-foreground)] w-14">الإيرادات</span>
                    <div className="flex-1 h-2 rounded-full bg-[var(--muted)] overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-l from-emerald-500 to-emerald-400 transition-all" style={{ width: `${revPct}%` }} />
                    </div>
                  </div>
                  {/* Appointments Bar */}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] font-bold text-[var(--muted-foreground)] w-14">المواعيد</span>
                    <div className="flex-1 h-2 rounded-full bg-[var(--muted)] overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-l from-violet-500 to-violet-400 transition-all" style={{ width: `${Math.round((item.appointmentsCount / maxAppt) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-center py-12 text-sm text-[var(--muted-foreground)]">لا توجد بيانات موظفات</p>
        )}
      </div>
    </div>
  );
}
