'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Wallet, Home, Zap, ShoppingBag, Users, Wrench, MoreHorizontal, TrendingDown, CreditCard, UserCheck, ChevronLeft, ChevronRight, Check, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Spinner, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { dashboardService } from '@/services/dashboard.service';
import type { PaginatedResponse } from '@/types';

interface Expense {
  id: string; description: string; category: string; amount: number; date: string; notes: string | null; createdAt: string;
}
interface DebtItem {
  id: string; amount: number; description: string; type?: string; isPaid: boolean; paidAt: string | null; date: string;
  employee?: { id: string; fullName: string; phone: string | null };
  client?: { id: string; fullName: string; phone: string | null };
  invoice?: { id: string; total: number; status: string } | null;
}
interface DebtSummary {
  employeeTotalDebt: number; employeeDebtCount: number; clientTotalDebt: number; clientDebtCount: number;
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
const DEBT_TYPES: Record<string, string> = { advance: 'سلفة', loan: 'قرض', other: 'أخرى' };

export default function ExpensesPage() {
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('expenses');
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');
  const defaults = useMemo(() => {
    const now = new Date();
    return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0], to: now.toISOString().split('T')[0] };
  }, []);
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);

  // ─── New Debt Modal ───
  const [newDebtOpen, setNewDebtOpen] = useState<'employee' | 'client' | null>(null);
  const [debtForm, setDebtForm] = useState({ targetId: '', amount: '', description: '', type: 'advance', date: new Date().toISOString().split('T')[0] });

  const qp = new URLSearchParams({ page: String(page), limit: '10', ...(category && { category }), ...(dateFrom && { dateFrom }), ...(dateTo && { dateTo }) }).toString();

  // ─── Queries ───
  const { data, isLoading } = useQuery({
    queryKey: ['expenses', page, category, dateFrom, dateTo],
    queryFn: () => api.get<PaginatedResponse<Expense>>(`/expenses?${qp}`, accessToken!),
    enabled: !!accessToken,
  });

  const { data: debtSummary } = useQuery<DebtSummary>({
    queryKey: ['debts', 'summary'],
    queryFn: () => api.get<DebtSummary>('/debts/summary', accessToken!),
    enabled: !!accessToken,
  });

  const { data: empDebts, isLoading: empDebtsLoading } = useQuery<DebtItem[]>({
    queryKey: ['debts', 'employees'],
    queryFn: () => api.get<DebtItem[]>('/debts/employees', accessToken!),
    enabled: !!accessToken && tab === 'emp_debts',
  });

  const { data: clientDebts, isLoading: clientDebtsLoading } = useQuery<DebtItem[]>({
    queryKey: ['debts', 'clients'],
    queryFn: () => api.get<DebtItem[]>('/debts/clients', accessToken!),
    enabled: !!accessToken && tab === 'client_debts',
  });

  const { data: emps } = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => dashboardService.getEmployees({ page: 1, limit: 50 }, accessToken!),
    enabled: !!accessToken,
  });

  const { data: clientsData } = useQuery({
    queryKey: ['clients-list'],
    queryFn: () => api.get<PaginatedResponse<{ id: string; fullName: string }>>('/clients?limit=100', accessToken!),
    enabled: !!accessToken && tab === 'client_debts',
  });

  // ─── Mutations ───
  const invalidateDebts = () => {
    qc.invalidateQueries({ queryKey: ['debts'] });
  };

  const createEmpDebt = useMutation({
    mutationFn: (d: any) => api.post('/debts/employees', d, accessToken!),
    onSuccess: () => { toast.success('✅ تم إضافة الدين'); invalidateDebts(); setNewDebtOpen(null); },
    onError: () => toast.error('فشل الإضافة'),
  });

  const createClientDebt = useMutation({
    mutationFn: (d: any) => api.post('/debts/clients', d, accessToken!),
    onSuccess: () => { toast.success('✅ تم إضافة الدين'); invalidateDebts(); setNewDebtOpen(null); },
    onError: () => toast.error('فشل الإضافة'),
  });

  const payDebt = useMutation({
    mutationFn: ({ type, id }: { type: 'employees' | 'clients'; id: string }) => api.patch(`/debts/${type}/${id}/pay`, {}, accessToken!),
    onSuccess: () => { toast.success('✅ تم التسديد'); invalidateDebts(); },
    onError: () => toast.error('فشل التسديد'),
  });

  const deleteDebt = useMutation({
    mutationFn: ({ type, id }: { type: 'employees' | 'clients'; id: string }) => api.delete(`/debts/${type}/${id}`, accessToken!),
    onSuccess: () => { toast.success('تم الحذف'); invalidateDebts(); },
    onError: () => toast.error('فشل الحذف'),
  });

  const expenses = data?.items ?? [];
  const totalExp = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const salaryTotal = expenses.filter(e => e.category === 'salary').reduce((s, e) => s + Number(e.amount), 0);
  const employees = emps?.items ?? [];
  const clients = clientsData?.items ?? [];

  const empDebtsPending = (empDebts ?? []).filter(d => !d.isPaid);
  const empDebtsPaid = (empDebts ?? []).filter(d => d.isPaid);
  const clientDebtsPending = (clientDebts ?? []).filter(d => !d.isPaid);
  const clientDebtsPaid = (clientDebts ?? []).filter(d => d.isPaid);

  const handleSubmitDebt = () => {
    if (!debtForm.targetId) return toast.error('اختاري الشخص');
    if (!debtForm.amount || Number(debtForm.amount) <= 0) return toast.error('أدخلي المبلغ');
    if (!debtForm.description.trim()) return toast.error('أدخلي الوصف');

    if (newDebtOpen === 'employee') {
      createEmpDebt.mutate({ employeeId: debtForm.targetId, amount: Number(debtForm.amount), description: debtForm.description, type: debtForm.type, date: debtForm.date });
    } else {
      createClientDebt.mutate({ clientId: debtForm.targetId, amount: Number(debtForm.amount), description: debtForm.description, date: debtForm.date });
    }
  };

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Hero Header */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-bl from-slate-900 via-slate-800 to-slate-900 p-8">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-red-500/15 to-transparent rounded-full blur-3xl" />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
                <Wallet className="h-6 w-6 text-white/80" />
              </div>
              <div>
                <h1 className="text-xl font-black text-white tracking-tight">المصروفات والديون</h1>
                <p className="text-xs text-white/40 mt-0.5">إدارة المصروفات ورواتب الموظفات والديون</p>
              </div>
            </div>
            <div className="flex gap-2">
              {tab === 'emp_debts' && (
                <Button size="sm" variant="outline" className="gap-1.5 border-white/20 text-white hover:bg-white/10" onClick={() => { setDebtForm({ targetId: '', amount: '', description: '', type: 'advance', date: new Date().toISOString().split('T')[0] }); setNewDebtOpen('employee'); }}>
                  <Plus className="h-3.5 w-3.5" /> سلفة جديدة
                </Button>
              )}
              {tab === 'client_debts' && (
                <Button size="sm" variant="outline" className="gap-1.5 border-white/20 text-white hover:bg-white/10" onClick={() => { setDebtForm({ targetId: '', amount: '', description: '', type: 'advance', date: new Date().toISOString().split('T')[0] }); setNewDebtOpen('client'); }}>
                  <Plus className="h-3.5 w-3.5" /> دين جديد
                </Button>
              )}
              <Link href="/expenses/new">
                <Button size="sm" className="gap-1.5 bg-white/10 border border-white/20 text-white hover:bg-white/20"><Plus className="h-3.5 w-3.5" /> إضافة مصروف</Button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
            <div className="bg-white/[0.06] backdrop-blur-md rounded-2xl p-4 border border-white/[0.08]">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center"><TrendingDown className="h-3 w-3 text-white/50" /></div>
                <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/30">إجمالي المصروفات</span>
              </div>
              <p className="text-2xl font-black text-white tabular-nums" dir="ltr">{totalExp.toLocaleString('en')}</p>
              <p className="text-[10px] text-white/20">SAR</p>
            </div>
            <div className="bg-white/[0.06] backdrop-blur-md rounded-2xl p-4 border border-white/[0.08]">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center"><Users className="h-3 w-3 text-white/50" /></div>
                <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/30">رواتب الموظفات</span>
              </div>
              <p className="text-2xl font-black text-white tabular-nums" dir="ltr">{salaryTotal.toLocaleString('en')}</p>
              <p className="text-[10px] text-white/20">SAR</p>
            </div>
            <button onClick={() => setTab('emp_debts')} className="bg-white/[0.06] backdrop-blur-md rounded-2xl p-4 border border-white/[0.08] text-right hover:bg-white/[0.09] transition-all">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center"><UserCheck className="h-3 w-3 text-white/50" /></div>
                <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/30">ديون الموظفات</span>
              </div>
              <p className="text-2xl font-black text-white tabular-nums" dir="ltr">{(debtSummary?.employeeTotalDebt ?? 0).toLocaleString('en')}</p>
              <p className="text-[10px] text-white/20">SAR</p>
            </button>
            <button onClick={() => setTab('client_debts')} className="bg-white/[0.06] backdrop-blur-md rounded-2xl p-4 border border-white/[0.08] text-right hover:bg-white/[0.09] transition-all">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center"><CreditCard className="h-3 w-3 text-white/50" /></div>
                <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/30">ديون العملاء</span>
              </div>
              <p className="text-2xl font-black text-white tabular-nums" dir="ltr">{(debtSummary?.clientTotalDebt ?? 0).toLocaleString('en')}</p>
              <p className="text-[10px] text-white/20">SAR</p>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-2xl bg-[var(--muted)]/40 w-full sm:w-fit border border-[var(--border)] overflow-x-auto no-scrollbar">
        {([
          { key: 'expenses' as Tab, label: '💰 المصروفات', count: expenses.length },
          { key: 'emp_debts' as Tab, label: '👩‍💼 ديون الموظفات', count: debtSummary?.employeeDebtCount ?? 0 },
          { key: 'client_debts' as Tab, label: '👤 ديون العملاء', count: debtSummary?.clientDebtCount ?? 0 },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('px-4 py-2.5 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0',
              tab === t.key ? 'bg-[var(--card)] shadow-md text-[var(--foreground)]' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]')}>
            {t.label}
            {t.count > 0 && <span className={cn('min-w-[18px] h-[18px] rounded-full text-[9px] font-black flex items-center justify-center',
              tab === t.key ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--muted)] text-[var(--muted-foreground)]')}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* ─── Expenses Tab ─── */}
      {tab === 'expenses' && (
        <>
          <div className="flex flex-col gap-3">
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {[{ k: '', l: 'الكل' }, ...Object.entries(CAT).map(([k, v]) => ({ k, l: v.label }))].map(f => (
                <button key={f.k} onClick={() => { setCategory(f.k); setPage(1); }}
                  className={cn('px-3 py-2 rounded-xl text-[10px] font-bold border-2 transition-all whitespace-nowrap shrink-0',
                    category === f.k ? 'bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]' : 'border-[var(--border)] hover:border-[var(--foreground)]/30')}>
                  {f.l}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} dir="ltr"
                className="flex-1 min-w-0 px-2.5 py-2 rounded-xl border border-[var(--border)] text-[11px] bg-[var(--card)] outline-none focus:border-[var(--brand-primary)]" />
              <span className="text-[var(--muted-foreground)] shrink-0">→</span>
              <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} dir="ltr"
                className="flex-1 min-w-0 px-2.5 py-2 rounded-xl border border-[var(--border)] text-[11px] bg-[var(--card)] outline-none focus:border-[var(--brand-primary)]" />
            </div>
          </div>

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

      {/* ─── Employee Debts Tab ─── */}
      {tab === 'emp_debts' && (
        <div className="space-y-4">
          {empDebtsLoading ? (
            <div className="flex justify-center py-12"><Spinner size="lg" /></div>
          ) : (
            <>
              {/* Pending */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
                <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
                  <span className="text-xs font-bold">⏳ ديون معلقة ({empDebtsPending.length})</span>
                  <span className="text-sm font-black tabular-nums" dir="ltr">{empDebtsPending.reduce((s, d) => s + d.amount, 0).toLocaleString('en')} SAR</span>
                </div>
                {empDebtsPending.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-sm font-bold text-emerald-600">🎉 لا توجد ديون معلقة</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--border)]">
                    {empDebtsPending.map(d => (
                      <div key={d.id} className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--muted)]/20 transition">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                          <UserCheck className="h-4 w-4 text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold">{d.employee?.fullName}</p>
                          <p className="text-[10px] text-[var(--muted-foreground)]">{d.description} · {DEBT_TYPES[d.type ?? 'advance']} · {new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</p>
                        </div>
                        <div className="text-left flex-shrink-0">
                          <p className="text-sm font-black tabular-nums text-amber-600" dir="ltr">{d.amount.toLocaleString('en')} <span className="text-[9px] text-[var(--muted-foreground)]">SAR</span></p>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => payDebt.mutate({ type: 'employees', id: d.id })} title="تسديد"
                            className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-100 transition">
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => deleteDebt.mutate({ type: 'employees', id: d.id })} title="حذف"
                            className="p-2 rounded-xl bg-red-50 border border-red-200 text-red-500 hover:bg-red-100 transition">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Paid */}
              {empDebtsPaid.length > 0 && (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
                  <div className="px-5 py-3 border-b border-[var(--border)]">
                    <span className="text-xs font-bold">✅ مسددة ({empDebtsPaid.length})</span>
                  </div>
                  <div className="divide-y divide-[var(--border)]">
                    {empDebtsPaid.slice(0, 5).map(d => (
                      <div key={d.id} className="flex items-center gap-4 px-5 py-3 opacity-60">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold line-through">{d.employee?.fullName} - {d.description}</p>
                        </div>
                        <p className="text-xs font-bold tabular-nums text-emerald-600 line-through" dir="ltr">{d.amount.toLocaleString('en')} SAR</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── Client Debts Tab ─── */}
      {tab === 'client_debts' && (
        <div className="space-y-4">
          {clientDebtsLoading ? (
            <div className="flex justify-center py-12"><Spinner size="lg" /></div>
          ) : (
            <>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
                <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
                  <span className="text-xs font-bold">⏳ ديون معلقة ({clientDebtsPending.length})</span>
                  <span className="text-sm font-black tabular-nums" dir="ltr">{clientDebtsPending.reduce((s, d) => s + d.amount, 0).toLocaleString('en')} SAR</span>
                </div>
                {clientDebtsPending.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-sm font-bold text-emerald-600">🎉 لا توجد ديون معلقة</p>
                    <p className="text-[10px] text-[var(--muted-foreground)] mt-1">عملاؤك في وضع ممتاز</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--border)]">
                    {clientDebtsPending.map(d => (
                      <div key={d.id} className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--muted)]/20 transition">
                        <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center">
                          <CreditCard className="h-4 w-4 text-sky-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold">{d.client?.fullName}</p>
                          <p className="text-[10px] text-[var(--muted-foreground)]">{d.description} · {new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</p>
                          {d.client?.phone && <p className="text-[10px] text-[var(--muted-foreground)]" dir="ltr">📱 {d.client.phone}</p>}
                        </div>
                        <div className="text-left flex-shrink-0">
                          <p className="text-sm font-black tabular-nums text-sky-600" dir="ltr">{d.amount.toLocaleString('en')} <span className="text-[9px] text-[var(--muted-foreground)]">SAR</span></p>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => payDebt.mutate({ type: 'clients', id: d.id })} title="تسديد"
                            className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-100 transition">
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => deleteDebt.mutate({ type: 'clients', id: d.id })} title="حذف"
                            className="p-2 rounded-xl bg-red-50 border border-red-200 text-red-500 hover:bg-red-100 transition">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {clientDebtsPaid.length > 0 && (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
                  <div className="px-5 py-3 border-b border-[var(--border)]">
                    <span className="text-xs font-bold">✅ مسددة ({clientDebtsPaid.length})</span>
                  </div>
                  <div className="divide-y divide-[var(--border)]">
                    {clientDebtsPaid.slice(0, 5).map(d => (
                      <div key={d.id} className="flex items-center gap-4 px-5 py-3 opacity-60">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold line-through">{d.client?.fullName} - {d.description}</p>
                        </div>
                        <p className="text-xs font-bold tabular-nums text-emerald-600 line-through" dir="ltr">{d.amount.toLocaleString('en')} SAR</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── New Debt Dialog ─── */}
      <Dialog open={!!newDebtOpen} onOpenChange={() => setNewDebtOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{newDebtOpen === 'employee' ? '👩‍💼 إضافة سلفة / دين موظفة' : '👤 إضافة دين عميل'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5 block">
                {newDebtOpen === 'employee' ? 'الموظفة' : 'العميل/ة'}
              </label>
              <select value={debtForm.targetId} onChange={e => setDebtForm(p => ({ ...p, targetId: e.target.value }))}
                className="w-full px-4 py-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] text-sm outline-none focus:border-[var(--brand-primary)]">
                <option value="">-- اختاري --</option>
                {newDebtOpen === 'employee'
                  ? employees.map((e: any) => <option key={e.id} value={e.id}>{e.fullName}</option>)
                  : clients.map(c => <option key={c.id} value={c.id}>{c.fullName}</option>)
                }
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5 block">المبلغ (SAR)</label>
                <input type="number" dir="ltr" lang="en" inputMode="decimal" value={debtForm.amount}
                  onChange={e => setDebtForm(p => ({ ...p, amount: e.target.value }))}
                  className="w-full px-4 py-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] text-sm text-center font-bold outline-none focus:border-[var(--brand-primary)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5 block">التاريخ</label>
                <input type="date" dir="ltr" value={debtForm.date}
                  onChange={e => setDebtForm(p => ({ ...p, date: e.target.value }))}
                  className="w-full px-4 py-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] text-sm outline-none focus:border-[var(--brand-primary)]" />
              </div>
            </div>
            {newDebtOpen === 'employee' && (
              <div>
                <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5 block">النوع</label>
                <div className="flex gap-2">
                  {Object.entries(DEBT_TYPES).map(([k, v]) => (
                    <button key={k} onClick={() => setDebtForm(p => ({ ...p, type: k }))}
                      className={cn('px-4 py-2.5 rounded-xl text-[11px] font-bold border-2 transition-all',
                        debtForm.type === k ? 'bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]' : 'border-[var(--border)]')}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5 block">الوصف</label>
              <input value={debtForm.description} onChange={e => setDebtForm(p => ({ ...p, description: e.target.value }))}
                placeholder={newDebtOpen === 'employee' ? 'مثال: سلفة شهر أبريل' : 'مثال: خدمة صبغة بالدين'}
                className="w-full px-4 py-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] text-sm outline-none focus:border-[var(--brand-primary)]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDebtOpen(null)}>إلغاء</Button>
            <Button onClick={handleSubmitDebt} disabled={createEmpDebt.isPending || createClientDebt.isPending}>
              {(createEmpDebt.isPending || createClientDebt.isPending) ? 'جارٍ...' : '✅ إضافة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
