'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, Wallet, Home, Zap, ShoppingBag, Users, Wrench, MoreHorizontal, TrendingDown, CreditCard, UserCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Spinner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { dashboardService } from '@/services/dashboard.service';
import type { PaginatedResponse } from '@/types';

interface Expense {
  id: string; description: string; category: string; amount: number; date: string; notes: string | null; createdAt: string;
}

const CAT: Record<string, { label: string; icon: typeof Home; color: string; bg: string }> = {
  rent: { label: 'إيجار', icon: Home, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
  utilities: { label: 'مرافق', icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  supplies: { label: 'مستلزمات', icon: ShoppingBag, color: 'text-sky-600', bg: 'bg-sky-50 border-sky-200' },
  salary: { label: 'رواتب', icon: Users, color: 'text-violet-600', bg: 'bg-violet-50 border-violet-200' },
  maintenance: { label: 'صيانة', icon: Wrench, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  other: { label: 'أخرى', icon: MoreHorizontal, color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' },
};

type Tab = 'expenses' | 'emp_debts' | 'client_debts';

export default function ExpensesPage() {
  const { accessToken } = useAuth();
  const [tab, setTab] = useState<Tab>('expenses');
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');
  const defaults = useMemo(() => {
    const now = new Date();
    return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0], to: now.toISOString().split('T')[0] };
  }, []);
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);

  const qp = new URLSearchParams({ page: String(page), limit: '10', ...(category && { category }), ...(dateFrom && { dateFrom }), ...(dateTo && { dateTo }) }).toString();

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', page, category, dateFrom, dateTo],
    queryFn: () => api.get<PaginatedResponse<Expense>>(`/expenses?${qp}`, accessToken!),
    enabled: !!accessToken,
  });

  // Employee salaries from employees list
  const { data: emps } = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => dashboardService.getEmployees({ page: 1, limit: 50 }, accessToken!),
    enabled: !!accessToken,
  });

  const expenses = data?.items ?? [];
  const totalExp = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const salaryTotal = expenses.filter(e => e.category === 'salary').reduce((s, e) => s + Number(e.amount), 0);
  const employees = emps?.items ?? [];

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-[var(--foreground)]">المصروفات والديون</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">إدارة المصروفات ورواتب الموظفات والديون</p>
        </div>
        <Link href="/expenses/new">
          <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> إضافة مصروف</Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 p-4 text-white">
          <TrendingDown className="h-5 w-5 mb-1.5 opacity-60" />
          <p className="text-[10px] opacity-70">إجمالي المصروفات</p>
          <p className="text-xl font-black tabular-nums mt-0.5" dir="ltr">{totalExp.toLocaleString('en')} <span className="text-[9px] font-medium opacity-60">SAR</span></p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 p-4 text-white">
          <Users className="h-5 w-5 mb-1.5 opacity-60" />
          <p className="text-[10px] opacity-70">رواتب الموظفات</p>
          <p className="text-xl font-black tabular-nums mt-0.5" dir="ltr">{salaryTotal.toLocaleString('en')} <span className="text-[9px] font-medium opacity-60">SAR</span></p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-4 text-white">
          <UserCheck className="h-5 w-5 mb-1.5 opacity-60" />
          <p className="text-[10px] opacity-70">ديون الموظفات</p>
          <p className="text-xl font-black mt-0.5">0 <span className="text-[9px] font-medium opacity-60">SAR</span></p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 p-4 text-white">
          <CreditCard className="h-5 w-5 mb-1.5 opacity-60" />
          <p className="text-[10px] opacity-70">ديون العملاء</p>
          <p className="text-xl font-black mt-0.5">0 <span className="text-[9px] font-medium opacity-60">SAR</span></p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-2xl bg-[var(--muted)]/40 w-fit border border-[var(--border)]">
        {([
          { key: 'expenses' as Tab, label: '💰 المصروفات', count: expenses.length },
          { key: 'emp_debts' as Tab, label: '👩‍💼 ديون الموظفات', count: 0 },
          { key: 'client_debts' as Tab, label: '👤 ديون العملاء', count: 0 },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('px-4 py-2.5 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap',
              tab === t.key ? 'bg-[var(--card)] shadow-md text-[var(--foreground)]' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]')}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'expenses' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {[{ k: '', l: 'الكل' }, ...Object.entries(CAT).map(([k, v]) => ({ k, l: v.label }))].map(f => (
                <button key={f.k} onClick={() => { setCategory(f.k); setPage(1); }}
                  className={cn('px-3 py-2 rounded-xl text-[10px] font-bold border-2 transition-all whitespace-nowrap',
                    category === f.k ? 'bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]' : 'border-[var(--border)] hover:border-[var(--foreground)]/30')}>
                  {f.l}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 mr-auto text-[11px]">
              <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} dir="ltr"
                className="px-2.5 py-2 rounded-xl border border-[var(--border)] text-[11px] bg-[var(--card)] outline-none focus:border-[var(--brand-primary)]" />
              <span className="text-[var(--muted-foreground)]">→</span>
              <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} dir="ltr"
                className="px-2.5 py-2 rounded-xl border border-[var(--border)] text-[11px] bg-[var(--card)] outline-none focus:border-[var(--brand-primary)]" />
            </div>
          </div>

          {/* Expense Cards */}
          {expenses.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-[var(--muted)] flex items-center justify-center mx-auto mb-3">
                <Wallet className="h-8 w-8 text-[var(--muted-foreground)] opacity-30" />
              </div>
              <p className="font-bold">لا توجد مصروفات</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">لم يتم تسجيل أي مصروفات في هذه الفترة</p>
            </div>
          ) : (
            <div className="space-y-2">
              {expenses.map(exp => {
                const c = CAT[exp.category] || CAT.other;
                const CIcon = c.icon;
                const d = new Date(exp.date);
                return (
                  <div key={exp.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 hover:shadow-md transition flex items-center gap-4">
                    <div className={cn('w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0', c.bg)}>
                      <CIcon className={cn('h-5 w-5', c.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[var(--foreground)] truncate">{exp.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-md border', c.bg, c.color)}>{c.label}</span>
                        <span className="text-[10px] text-[var(--muted-foreground)] tabular-nums" dir="ltr">
                          {d.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                    <div className="text-left flex-shrink-0">
                      <span className="text-lg font-black text-red-500 tabular-nums" dir="ltr">-{Number(exp.amount).toLocaleString('en')}</span>
                      <p className="text-[10px] text-[var(--muted-foreground)]">SAR</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {(data?.totalPages ?? 1) > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--muted)] disabled:opacity-30 transition">
                <ChevronRight className="h-4 w-4" />
              </button>
              <span className="text-xs font-bold tabular-nums">{page} / {data?.totalPages}</span>
              <button onClick={() => setPage(p => Math.min(data?.totalPages ?? 1, p + 1))} disabled={page >= (data?.totalPages ?? 1)}
                className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--muted)] disabled:opacity-30 transition">
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}

      {tab === 'emp_debts' && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
            <h3 className="text-sm font-bold">👩‍💼 ديون الموظفات (سُلف)</h3>
          </div>
          {employees.length === 0 ? (
            <div className="text-center py-12">
              <p className="font-bold">لا توجد موظفات</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">أضيفي موظفات أولاً</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {employees.map((emp: any) => (
                <div key={emp.id} className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--muted)]/20 transition">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center">
                    <Users className="h-4 w-4 text-violet-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold">{emp.fullName}</p>
                    <p className="text-[10px] text-[var(--muted-foreground)]">{emp.role === 'staff' ? 'موظفة' : emp.role}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-black tabular-nums text-[var(--foreground)]" dir="ltr">0 <span className="text-[10px] text-[var(--muted-foreground)]">SAR</span></p>
                    <p className="text-[10px] text-emerald-600 font-bold">لا ديون</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="px-5 py-3 bg-[var(--muted)]/20 border-t border-[var(--border)]">
            <p className="text-[10px] text-[var(--muted-foreground)]">💡 يمكنك تسجيل سلفة كمصروف من نوع "أخرى" مع ذكر اسم الموظفة في الوصف</p>
          </div>
        </div>
      )}

      {tab === 'client_debts' && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <h3 className="text-sm font-bold">👤 ديون العملاء</h3>
            <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">العملاء المقربين اللي أخذوا خدمات بالدين</p>
          </div>
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center mx-auto mb-3">
              <CreditCard className="h-8 w-8 text-sky-400" />
            </div>
            <p className="font-bold">لا توجد ديون</p>
            <p className="text-xs text-[var(--muted-foreground)] mt-1 max-w-sm mx-auto">عند تسجيل فاتورة بحالة "مسودة" أو "مدفوعة جزئياً" ستظهر كدين على العميل هنا</p>
          </div>
          <div className="px-5 py-3 bg-[var(--muted)]/20 border-t border-[var(--border)]">
            <p className="text-[10px] text-[var(--muted-foreground)]">💡 الفواتير غير المكتملة الدفع ستظهر هنا تلقائياً كديون</p>
          </div>
        </div>
      )}
    </div>
  );
}
