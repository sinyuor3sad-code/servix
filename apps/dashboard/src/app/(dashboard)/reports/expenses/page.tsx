'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
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
  { key: 'month', label: 'الشهر' }, { key: 'quarter', label: '3 أشهر' },
  { key: 'year', label: 'السنة' }, { key: 'all', label: 'الكل' },
];

const CATEGORY_META: Record<string, { icon: typeof Wallet; label: string; color: string }> = {
  rent: { icon: Building, label: 'إيجار', color: 'bg-blue-500/10 text-blue-600' },
  salary: { icon: DollarSign, label: 'رواتب', color: 'bg-emerald-500/10 text-emerald-600' },
  supplies: { icon: ShoppingBag, label: 'مستلزمات', color: 'bg-amber-500/10 text-amber-600' },
  utilities: { icon: Zap, label: 'فواتير خدمات', color: 'bg-violet-500/10 text-violet-600' },
  marketing: { icon: Megaphone, label: 'تسويق', color: 'bg-rose-500/10 text-rose-600' },
  other: { icon: HelpCircle, label: 'أخرى', color: 'bg-slate-500/10 text-slate-500' },
};

function getDateRange(period: Period) {
  const now = new Date(); const to = now.toISOString().split('T')[0]; let from: Date;
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

  const { data: expData, isLoading, isFetching } = useQuery<ExpensesResult>({
    queryKey: ['reports', 'expenses', dateRange.from, dateRange.to],
    queryFn: () => api.get<ExpensesResult>(`/reports/expenses?dateFrom=${dateRange.from}&dateTo=${dateRange.to}`, accessToken!),
    enabled: !!accessToken, staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
  const { data: revData } = useQuery<RevenueResult>({
    queryKey: ['reports', 'revenue', dateRange.from, dateRange.to],
    queryFn: () => api.get<RevenueResult>(`/reports/revenue?dateFrom=${dateRange.from}&dateTo=${dateRange.to}`, accessToken!),
    enabled: !!accessToken, staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const expenses = expData ?? EMPTY_EXP;
  const totalRevenue = revData?.totalRevenue ?? 0;
  const totalExpenses = expenses.grandTotal;
  const netProfit = totalRevenue - totalExpenses;
  const isProfitable = netProfit >= 0;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const maxCat = Math.max(...(expenses.items?.map(c => c.total) ?? [1]));

  if (isLoading && !expData) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className={cn('p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-8 transition-opacity duration-300', isFetching ? 'opacity-60' : 'opacity-100')}>
      {/* ══════ Header ══════ */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-bl from-slate-900 via-slate-800 to-slate-900 p-8">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-emerald-500/15 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-gradient-to-tr from-red-500/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/reports')} className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
              <ArrowRight className="h-4 w-4 text-white/60" />
            </button>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">المصروفات والأرباح</h1>
              <p className="text-xs text-white/40 mt-0.5">تحليل مالي — إيرادات مقابل مصروفات</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
            {[
              { label: 'الإيرادات', value: totalRevenue.toLocaleString('en'), suffix: 'SAR', icon: ArrowUpRight },
              { label: 'المصروفات', value: totalExpenses.toLocaleString('en'), suffix: 'SAR', icon: ArrowDownRight },
              { label: 'صافي الربح', value: `${isProfitable ? '' : '-'}${Math.abs(netProfit).toLocaleString('en')}`, suffix: 'SAR', icon: Wallet },
              { label: 'هامش الربح', value: `${profitMargin.toFixed(1)}%`, icon: PieChart },
            ].map((kpi, i) => {
              const Icon = kpi.icon;
              return (
                <div key={i} className="bg-white/[0.06] backdrop-blur-md rounded-2xl p-4 border border-white/[0.08]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center"><Icon className="h-3 w-3 text-white/50" /></div>
                    <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/30">{kpi.label}</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <p className="text-2xl font-black text-white tabular-nums" dir="ltr">{kpi.value}</p>
                    {kpi.suffix && <span className="text-[10px] text-white/30">{kpi.suffix}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══════ Period ══════ */}
      <div className="inline-flex bg-[var(--muted)] rounded-2xl p-1.5">
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className={cn('px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300',
              period === p.key ? 'bg-[var(--foreground)] text-[var(--background)] shadow-md' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]')}>
            {p.label}
          </button>
        ))}
      </div>

      {/* ══════ Revenue vs Expenses ══════ */}
      {totalRevenue > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <div className="px-6 py-5 border-b border-[var(--border)] flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold">الإيرادات مقابل المصروفات</h3>
              <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">مقارنة بصرية</p>
            </div>
          </div>
          <div className="p-6 space-y-5">
            <div>
              <div className="flex items-center justify-between text-xs mb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500/60" />
                  <span className="font-bold">الإيرادات</span>
                </div>
                <span className="font-black tabular-nums" dir="ltr">{totalRevenue.toLocaleString('en')} SAR</span>
              </div>
              <div className="h-3 rounded-full bg-[var(--muted)] overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-l from-emerald-500/50 to-emerald-400/20 transition-all duration-700" style={{ width: '100%' }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs mb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500/60" />
                  <span className="font-bold">المصروفات</span>
                </div>
                <span className="font-black tabular-nums" dir="ltr">{totalExpenses.toLocaleString('en')} SAR</span>
              </div>
              <div className="h-3 rounded-full bg-[var(--muted)] overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-l from-red-500/40 to-red-400/15 transition-all duration-700"
                  style={{ width: `${totalRevenue > 0 ? Math.min((totalExpenses / totalRevenue) * 100, 100) : 0}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════ Category Breakdown ══════ */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-6 py-5 border-b border-[var(--border)] flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-500/10 flex items-center justify-center">
            <Wallet className="h-4 w-4 text-slate-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold">تفصيل المصروفات حسب الفئة</h3>
            <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">توزيع المصروفات</p>
          </div>
        </div>
        {expenses.items && expenses.items.length > 0 ? (
          <div className="divide-y divide-[var(--border)]">
            {[...expenses.items].sort((a, b) => b.total - a.total).map((cat) => {
              const meta = CATEGORY_META[cat.category] || CATEGORY_META.other;
              const CatIcon = meta.icon;
              const pct = maxCat > 0 ? (cat.total / maxCat) * 100 : 0;
              const share = expenses.grandTotal > 0 ? ((cat.total / expenses.grandTotal) * 100).toFixed(1) : '0';
              return (
                <div key={cat.category} className="px-6 py-5 hover:bg-[var(--muted)]/20 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', meta.color)}>
                        <CatIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold">{meta.label}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-[var(--muted-foreground)] tabular-nums">{cat.count} عملية</span>
                          <span className="text-[10px] text-[var(--muted-foreground)] bg-[var(--muted)] px-2 py-0.5 rounded-lg tabular-nums">{share}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <p className="text-sm font-black tabular-nums" dir="ltr">{cat.total.toLocaleString('en')}</p>
                      <span className="text-[10px] text-[var(--muted-foreground)]">SAR</span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--muted)] overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-l from-slate-500/30 to-slate-400/10 transition-all duration-700" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-20 text-center">
            <div className="w-16 h-16 rounded-3xl bg-[var(--muted)] flex items-center justify-center mx-auto mb-4">
              <Wallet className="h-8 w-8 text-[var(--muted-foreground)]/20" />
            </div>
            <p className="font-bold text-lg">لا توجد مصروفات في هذه الفترة</p>
          </div>
        )}
      </div>
    </div>
  );
}
