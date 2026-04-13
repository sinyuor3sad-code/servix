'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Wallet, TrendingDown, PieChart, DollarSign, Building, Zap, ShoppingBag, Megaphone, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

/* ═══════════════ Backend shape ═══════════════ */
interface ExpenseItem { category: string; total: number; count: number; }
interface ExpensesResult { items: ExpenseItem[]; grandTotal: number; }

// Also fetch revenue for profit calculation
interface RevenueResult { items: unknown[]; totalRevenue: number; totalCount: number; }

type Period = 'month' | 'quarter' | 'year' | 'all';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'month', label: 'الشهر' },
  { key: 'quarter', label: '3 أشهر' },
  { key: 'year', label: 'السنة' },
  { key: 'all', label: 'الكل' },
];

const CATEGORY_META: Record<string, { icon: typeof Wallet; label: string; color: string }> = {
  rent: { icon: Building, label: 'إيجار', color: 'from-violet-500 to-purple-600' },
  salary: { icon: DollarSign, label: 'رواتب', color: 'from-sky-500 to-blue-600' },
  supplies: { icon: ShoppingBag, label: 'مستلزمات', color: 'from-amber-500 to-orange-600' },
  utilities: { icon: Zap, label: 'فواتير خدمات', color: 'from-emerald-500 to-teal-600' },
  marketing: { icon: Megaphone, label: 'تسويق', color: 'from-rose-500 to-pink-600' },
  other: { icon: HelpCircle, label: 'أخرى', color: 'from-slate-500 to-gray-600' },
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

  const { data: expData, isLoading: expLoading } = useQuery<ExpensesResult>({
    queryKey: ['reports', 'expenses', dateRange.from, dateRange.to],
    queryFn: () => api.get<ExpensesResult>(`/reports/expenses?dateFrom=${dateRange.from}&dateTo=${dateRange.to}`, accessToken!),
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000,
  });

  const { data: revData } = useQuery<RevenueResult>({
    queryKey: ['reports', 'revenue', dateRange.from, dateRange.to],
    queryFn: () => api.get<RevenueResult>(`/reports/revenue?dateFrom=${dateRange.from}&dateTo=${dateRange.to}`, accessToken!),
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000,
  });

  const expenses = expData ?? EMPTY_EXP;
  const totalRevenue = revData?.totalRevenue ?? 0;
  const totalExpenses = expenses.grandTotal;
  const netProfit = totalRevenue - totalExpenses;
  const isProfitable = netProfit >= 0;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  const maxCat = Math.max(...(expenses.items?.map(c => c.total) ?? [1]));

  if (expLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/reports')} className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--muted)] transition">
          <ArrowRight className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-black">تقرير المصروفات والأرباح</h1>
          <p className="text-xs text-[var(--muted-foreground)]">تحليل مالي شامل — إيرادات مقابل مصروفات</p>
        </div>
      </div>

      {/* Period Tabs */}
      <div className="flex gap-1.5">
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className={cn('px-4 py-2.5 rounded-xl text-[11px] font-bold border-2 transition-all',
              period === p.key ? 'bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]' : 'border-[var(--border)] hover:border-[var(--foreground)]/30')}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-4 text-white">
          <DollarSign className="h-4 w-4 mb-1.5 opacity-60" />
          <p className="text-[10px] opacity-70">الإيرادات</p>
          <p className="text-2xl font-black mt-0.5 tabular-nums" dir="ltr">{totalRevenue.toLocaleString('en')}</p>
          <p className="text-[9px] opacity-50">SAR</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 p-4 text-white">
          <TrendingDown className="h-4 w-4 mb-1.5 opacity-60" />
          <p className="text-[10px] opacity-70">المصروفات</p>
          <p className="text-2xl font-black mt-0.5 tabular-nums" dir="ltr">{totalExpenses.toLocaleString('en')}</p>
          <p className="text-[9px] opacity-50">SAR</p>
        </div>
        <div className={cn('rounded-2xl p-4 text-white bg-gradient-to-br', isProfitable ? 'from-emerald-600 to-green-700' : 'from-red-600 to-red-800')}>
          <Wallet className="h-4 w-4 mb-1.5 opacity-60" />
          <p className="text-[10px] opacity-70">صافي الربح</p>
          <p className="text-2xl font-black mt-0.5 tabular-nums" dir="ltr">
            {isProfitable ? '' : '-'}{Math.abs(netProfit).toLocaleString('en')}
          </p>
          <p className="text-[9px] opacity-50">SAR</p>
        </div>
        <div className={cn('rounded-2xl p-4 text-white bg-gradient-to-br', isProfitable ? 'from-violet-500 to-purple-600' : 'from-amber-600 to-orange-700')}>
          <PieChart className="h-4 w-4 mb-1.5 opacity-60" />
          <p className="text-[10px] opacity-70">هامش الربح</p>
          <p className="text-2xl font-black mt-0.5 tabular-nums" dir="ltr">{profitMargin.toFixed(1)}%</p>
        </div>
      </div>

      {/* Revenue vs Expenses Bar */}
      {totalRevenue > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h3 className="text-sm font-bold mb-3">📊 الإيرادات مقابل المصروفات</h3>
          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-emerald-600 font-bold">الإيرادات</span>
                <span className="tabular-nums font-bold" dir="ltr">{totalRevenue.toLocaleString('en')} SAR</span>
              </div>
              <div className="h-3 rounded-full bg-[var(--muted)] overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-l from-emerald-500 to-emerald-400" style={{ width: '100%' }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-red-500 font-bold">المصروفات</span>
                <span className="tabular-nums font-bold" dir="ltr">{totalExpenses.toLocaleString('en')} SAR</span>
              </div>
              <div className="h-3 rounded-full bg-[var(--muted)] overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-l from-red-500 to-rose-400"
                  style={{ width: `${totalRevenue > 0 ? Math.min((totalExpenses / totalRevenue) * 100, 100) : 0}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Breakdown */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--border)] bg-[var(--muted)]/30">
          <h3 className="text-xs font-bold text-[var(--muted-foreground)]">📋 تفصيل المصروفات حسب الفئة</h3>
        </div>
        {expenses.items && expenses.items.length > 0 ? (
          <div className="divide-y divide-[var(--border)]">
            {[...expenses.items].sort((a, b) => b.total - a.total).map((cat) => {
              const meta = CATEGORY_META[cat.category] || CATEGORY_META.other;
              const CatIcon = meta.icon;
              const pct = maxCat > 0 ? (cat.total / maxCat) * 100 : 0;
              const percentage = expenses.grandTotal > 0 ? ((cat.total / expenses.grandTotal) * 100).toFixed(1) : '0';
              return (
                <div key={cat.category} className="px-5 py-3.5 hover:bg-[var(--muted)]/30 transition">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br text-white', meta.color)}>
                        <CatIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[var(--foreground)]">{meta.label}</p>
                        <p className="text-[10px] text-[var(--muted-foreground)]">{cat.count} عملية · {percentage}% من الإجمالي</p>
                      </div>
                    </div>
                    <p className="text-sm font-black tabular-nums text-[var(--foreground)]" dir="ltr">
                      {cat.total.toLocaleString('en')} <span className="text-[10px] font-normal text-[var(--muted-foreground)]">SAR</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-[var(--muted)] overflow-hidden">
                      <div className={cn('h-full rounded-full bg-gradient-to-l', meta.color)} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-center py-12 text-sm text-[var(--muted-foreground)]">لا توجد مصروفات في هذه الفترة</p>
        )}
      </div>
    </div>
  );
}
