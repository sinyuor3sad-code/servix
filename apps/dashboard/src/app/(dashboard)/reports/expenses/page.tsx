'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Wallet, TrendingDown, PieChart, DollarSign, Building, Zap, ShoppingBag, Megaphone, HelpCircle, ArrowUpRight, ArrowDownRight, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

interface ExpenseItem { category: string; total: number; count: number; }
interface ExpensesResult { items: ExpenseItem[]; grandTotal: number; }
interface RevenueResult { items: unknown[]; totalRevenue: number; totalCount: number; }

type Period = 'month' | 'quarter' | 'year' | 'all';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'month', label: 'الشهر' },
  { key: 'quarter', label: '3 أشهر' },
  { key: 'year', label: 'السنة' },
  { key: 'all', label: 'الكل' },
];

const CATEGORY_META: Record<string, { icon: typeof Wallet; label: string }> = {
  rent: { icon: Building, label: 'إيجار' },
  salary: { icon: DollarSign, label: 'رواتب' },
  supplies: { icon: ShoppingBag, label: 'مستلزمات' },
  utilities: { icon: Zap, label: 'فواتير خدمات' },
  marketing: { icon: Megaphone, label: 'تسويق' },
  other: { icon: HelpCircle, label: 'أخرى' },
};

function getDateRange(period: Period): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().split('T')[0];
  let from: Date;
  switch (period) {
    case 'month': from = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case 'quarter': from = new Date(now); from.setMonth(now.getMonth() - 3); break;
    case 'year': from = new Date(now.getFullYear(), 0, 1); break;
    case 'all': from = new Date(2020, 0, 1); break;
    default: from = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return { from: from.toISOString().split('T')[0], to };
}

const EMPTY_EXP: ExpensesResult = { items: [], grandTotal: 0 };

export default function ExpensesReportPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [period, setPeriod] = useState<Period>('month');
  const dateRange = useMemo(() => getDateRange(period), [period]);

  const { data: expData, isLoading } = useQuery<ExpensesResult>({
    queryKey: ['reports', 'expenses', dateRange.from, dateRange.to],
    queryFn: () => api.get<ExpensesResult>(`/reports/expenses?dateFrom=${dateRange.from}&dateTo=${dateRange.to}`, accessToken!),
    enabled: !!accessToken, staleTime: 5 * 60 * 1000,
  });

  const { data: revData } = useQuery<RevenueResult>({
    queryKey: ['reports', 'revenue', dateRange.from, dateRange.to],
    queryFn: () => api.get<RevenueResult>(`/reports/revenue?dateFrom=${dateRange.from}&dateTo=${dateRange.to}`, accessToken!),
    enabled: !!accessToken, staleTime: 5 * 60 * 1000,
  });

  const expenses = expData ?? EMPTY_EXP;
  const totalRevenue = revData?.totalRevenue ?? 0;
  const totalExpenses = expenses.grandTotal;
  const netProfit = totalRevenue - totalExpenses;
  const isProfitable = netProfit >= 0;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const maxCat = Math.max(...(expenses.items?.map(c => c.total) ?? [1]));

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/reports')} className="w-10 h-10 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] flex items-center justify-center transition-colors">
          <ArrowRight className="h-4 w-4 text-[var(--muted-foreground)]" />
        </button>
        <div>
          <h1 className="text-xl font-black tracking-tight">المصروفات والأرباح</h1>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">تحليل مالي — إيرادات مقابل مصروفات</p>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex bg-[var(--muted)] rounded-xl p-1 w-fit">
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className={cn('px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200',
              period === p.key ? 'bg-[var(--foreground)] text-[var(--background)] shadow-sm' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]')}>
            {p.label}
          </button>
        ))}
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[var(--border)] rounded-2xl overflow-hidden">
        {[
          { label: 'الإيرادات', value: totalRevenue.toLocaleString('en'), suffix: 'SAR', icon: ArrowUpRight },
          { label: 'المصروفات', value: totalExpenses.toLocaleString('en'), suffix: 'SAR', icon: ArrowDownRight },
          { label: 'صافي الربح', value: `${isProfitable ? '' : '-'}${Math.abs(netProfit).toLocaleString('en')}`, suffix: 'SAR', icon: Wallet },
          { label: 'هامش الربح', value: `${profitMargin.toFixed(1)}%`, icon: PieChart },
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
              <div className="flex items-baseline gap-1.5">
                <p className="text-2xl font-black tabular-nums text-[var(--foreground)]" dir="ltr">{kpi.value}</p>
                {kpi.suffix && <span className="text-[10px] text-[var(--muted-foreground)]">{kpi.suffix}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Revenue vs Expenses */}
      {totalRevenue > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border)] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--muted)] flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-[var(--muted-foreground)]" />
            </div>
            <h3 className="text-sm font-bold">الإيرادات مقابل المصروفات</h3>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-[var(--foreground)]">الإيرادات</span>
                <span className="tabular-nums font-bold text-[var(--foreground)]" dir="ltr">{totalRevenue.toLocaleString('en')} SAR</span>
              </div>
              <div className="h-2.5 rounded-full bg-[var(--muted)] overflow-hidden">
                <div className="h-full rounded-full bg-[var(--foreground)]/15 transition-all duration-500" style={{ width: '100%' }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-[var(--foreground)]">المصروفات</span>
                <span className="tabular-nums font-bold text-[var(--foreground)]" dir="ltr">{totalExpenses.toLocaleString('en')} SAR</span>
              </div>
              <div className="h-2.5 rounded-full bg-[var(--muted)] overflow-hidden">
                <div className="h-full rounded-full bg-[var(--foreground)]/8 transition-all duration-500"
                  style={{ width: `${totalRevenue > 0 ? Math.min((totalExpenses / totalRevenue) * 100, 100) : 0}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Breakdown */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--muted)] flex items-center justify-center">
            <Wallet className="h-4 w-4 text-[var(--muted-foreground)]" />
          </div>
          <h3 className="text-sm font-bold">تفصيل المصروفات حسب الفئة</h3>
        </div>
        {expenses.items && expenses.items.length > 0 ? (
          <div className="divide-y divide-[var(--border)]">
            {[...expenses.items].sort((a, b) => b.total - a.total).map((cat) => {
              const meta = CATEGORY_META[cat.category] || CATEGORY_META.other;
              const CatIcon = meta.icon;
              const pct = maxCat > 0 ? (cat.total / maxCat) * 100 : 0;
              const percentage = expenses.grandTotal > 0 ? ((cat.total / expenses.grandTotal) * 100).toFixed(1) : '0';
              return (
                <div key={cat.category} className="px-6 py-4 hover:bg-[var(--muted)]/20 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[var(--muted)] flex items-center justify-center">
                        <CatIcon className="h-4 w-4 text-[var(--muted-foreground)]" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[var(--foreground)]">{meta.label}</p>
                        <p className="text-[10px] text-[var(--muted-foreground)]">{cat.count} عملية · {percentage}%</p>
                      </div>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <p className="text-sm font-black tabular-nums text-[var(--foreground)]" dir="ltr">{cat.total.toLocaleString('en')}</p>
                      <span className="text-[10px] text-[var(--muted-foreground)]">SAR</span>
                    </div>
                  </div>
                  <div className="h-1 rounded-full bg-[var(--muted)] overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--foreground)]/12 transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[var(--muted)] flex items-center justify-center mx-auto mb-3">
              <Wallet className="h-7 w-7 text-[var(--muted-foreground)]/30" />
            </div>
            <p className="font-bold text-[var(--foreground)]">لا توجد مصروفات في هذه الفترة</p>
          </div>
        )}
      </div>
    </div>
  );
}
