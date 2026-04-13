'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, UserCog, Trophy, TrendingUp, BarChart3 } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

interface EmployeeReportItem {
  employee: { id: string; fullName: string; role: string };
  appointmentsCount: number;
  revenue: number;
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
  const totalAppts = sorted.reduce((s, e) => s + e.appointmentsCount, 0);
  const maxRev = Math.max(...sorted.map(e => e.revenue), 1);

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/reports')} className="w-10 h-10 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] flex items-center justify-center transition-colors">
          <ArrowRight className="h-4 w-4 text-[var(--muted-foreground)]" />
        </button>
        <div>
          <h1 className="text-xl font-black tracking-tight">تقرير الموظفات</h1>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">تحليل أداء وإنتاجية الفريق</p>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-[var(--border)] rounded-2xl overflow-hidden">
        {[
          { label: 'إجمالي الموظفات', value: sorted.length, icon: UserCog },
          { label: 'إجمالي الإيرادات', value: totalRevenue.toLocaleString('en'), suffix: 'SAR', icon: TrendingUp },
          { label: 'إجمالي المواعيد', value: totalAppts, icon: Trophy },
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
              <div className="flex items-baseline gap-1.5">
                <p className="text-3xl font-black tabular-nums text-[var(--foreground)]" dir="ltr">{kpi.value}</p>
                {kpi.suffix && <span className="text-[10px] text-[var(--muted-foreground)]">{kpi.suffix}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Employee Ranking */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--muted)] flex items-center justify-center">
            <BarChart3 className="h-4 w-4 text-[var(--muted-foreground)]" />
          </div>
          <h3 className="text-sm font-bold">ترتيب الموظفات حسب الإيرادات</h3>
        </div>
        {sorted.length > 0 ? (
          <div className="divide-y divide-[var(--border)]">
            {sorted.map((item, i) => {
              const revPct = Math.round((item.revenue / maxRev) * 100);
              return (
                <div key={item.employee.id} className="px-6 py-5 hover:bg-[var(--muted)]/20 transition-colors">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-[var(--muted)] flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-black text-[var(--muted-foreground)]">{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-bold text-[var(--foreground)]">{item.employee.fullName}</span>
                    </div>
                    <div className="text-left flex-shrink-0">
                      <div className="text-lg font-black tabular-nums text-[var(--foreground)]" dir="ltr">{item.revenue.toLocaleString('en')}</div>
                      <p className="text-[10px] text-[var(--muted-foreground)]">SAR · {item.appointmentsCount} موعد</p>
                    </div>
                  </div>
                  <div className="h-1 rounded-full bg-[var(--muted)] overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--foreground)]/12 transition-all duration-500" style={{ width: `${revPct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[var(--muted)] flex items-center justify-center mx-auto mb-3">
              <UserCog className="h-7 w-7 text-[var(--muted-foreground)]/30" />
            </div>
            <p className="font-bold text-[var(--foreground)]">لا توجد بيانات موظفات</p>
          </div>
        )}
      </div>
    </div>
  );
}
