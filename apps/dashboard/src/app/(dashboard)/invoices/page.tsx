'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, FileText, ChevronLeft, ChevronRight, Receipt, TrendingUp, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Spinner } from '@/components/ui';
import { dashboardService } from '@/services/dashboard.service';
import { useAuth } from '@/hooks/useAuth';
import type { Invoice, InvoiceStatus } from '@/types';

const STATUS: Record<InvoiceStatus, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  paid: { label: 'مدفوعة', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
  draft: { label: 'مسودة', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200', icon: Clock },
  partially_paid: { label: 'جزئية', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: AlertCircle },
  void: { label: 'ملغية', color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: XCircle },
  refunded: { label: 'مستردة', color: 'text-violet-600', bg: 'bg-violet-50 border-violet-200', icon: Receipt },
};

const STATUS_FILTERS: { key: string; label: string; emoji: string }[] = [
  { key: '', label: 'الكل', emoji: '📋' },
  { key: 'paid', label: 'مدفوعة', emoji: '✅' },
  { key: 'draft', label: 'مسودة', emoji: '📝' },
  { key: 'partially_paid', label: 'جزئية', emoji: '⏳' },
  { key: 'void', label: 'ملغية', emoji: '❌' },
];

export default function InvoicesPage() {
  const { accessToken } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', page, search],
    queryFn: () => dashboardService.getInvoices({ page, limit: 10, search }, accessToken!),
    enabled: !!accessToken,
  });

  const invoices = data?.items ?? [];
  const filtered = statusFilter ? invoices.filter(inv => inv.status === statusFilter) : invoices;

  // Stats
  const totalRevenue = invoices.reduce((s, inv) => inv.status === 'paid' ? s + inv.total : s, 0);
  const paidCount = invoices.filter(inv => inv.status === 'paid').length;

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-[var(--foreground)]">الفواتير</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">{data?.total || 0} فاتورة</p>
        </div>
        <Link href="/invoices/new">
          <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> فاتورة جديدة</Button>
        </Link>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-4 text-white">
          <TrendingUp className="h-5 w-5 mb-2 opacity-70" />
          <div className="text-2xl font-black tabular-nums" dir="ltr">{totalRevenue.toLocaleString('en')} <span className="text-xs font-medium opacity-70">SAR</span></div>
          <p className="text-[11px] opacity-80 mt-0.5">إيرادات الصفحة</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 p-4 text-white">
          <Receipt className="h-5 w-5 mb-2 opacity-70" />
          <div className="text-2xl font-black">{data?.total || 0}</div>
          <p className="text-[11px] opacity-80 mt-0.5">إجمالي الفواتير</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 p-4 text-white hidden sm:block">
          <CheckCircle2 className="h-5 w-5 mb-2 opacity-70" />
          <div className="text-2xl font-black">{paidCount}</div>
          <p className="text-[11px] opacity-80 mt-0.5">مدفوعة</p>
        </div>
      </div>

      {/* Search + Status Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)] opacity-40" />
          <input type="text" dir="rtl" placeholder="بحث برقم الفاتورة أو اسم العميل..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pr-10 pl-4 py-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] text-sm focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 outline-none transition-all shadow-sm" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {STATUS_FILTERS.map(f => (
            <button key={f.key} onClick={() => setStatusFilter(f.key)}
              className={cn('px-3 py-2.5 rounded-xl text-[11px] font-bold border-2 transition-all whitespace-nowrap',
                statusFilter === f.key ? 'bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]' : 'border-[var(--border)] hover:border-[var(--foreground)]/30')}>
              {f.emoji} {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Invoice Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 rounded-3xl bg-[var(--muted)] flex items-center justify-center mx-auto mb-4">
            <FileText className="h-10 w-10 text-[var(--muted-foreground)] opacity-30" />
          </div>
          <p className="font-bold text-lg">لا توجد فواتير</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">أنشئي فاتورة جديدة للبدء</p>
          <Link href="/invoices/new"><Button className="mt-4"><Plus className="h-4 w-4" /> فاتورة جديدة</Button></Link>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(inv => {
            const s = STATUS[inv.status] || STATUS.draft;
            const Icon = s.icon;
            const date = new Date(inv.createdAt);
            const timeStr = date.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: true });
            const dateStr = date.toLocaleDateString('en', { month: 'short', day: 'numeric' });

            return (
              <Link key={inv.id} href={`/invoices/${inv.id}`}>
                <div className="group rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5 hover:border-[var(--brand-primary)]/20 cursor-pointer">
                  <div className="flex items-center gap-4 p-4">
                    {/* Invoice Icon */}
                    <div className={cn('w-12 h-12 rounded-xl border flex items-center justify-center flex-shrink-0', s.bg)}>
                      <Icon className={cn('h-5 w-5', s.color)} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold font-mono text-[var(--foreground)]">{inv.invoiceNumber}</span>
                        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-bold', s.bg, s.color)}>
                          {s.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-[var(--muted-foreground)]">
                          {inv.client?.fullName ?? 'زائر'}
                        </span>
                        <span className="text-[10px] text-[var(--muted-foreground)] opacity-50">·</span>
                        <span className="text-[10px] text-[var(--muted-foreground)] tabular-nums" dir="ltr">{dateStr} {timeStr}</span>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="text-left flex-shrink-0">
                      <div className="text-lg font-black text-[var(--foreground)] tabular-nums" dir="ltr">
                        {Number(inv.total).toLocaleString('en')}
                      </div>
                      <div className="text-[10px] text-[var(--muted-foreground)] font-medium">SAR</div>
                    </div>

                    {/* Arrow */}
                    <ChevronLeft className="h-4 w-4 text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </div>
                </div>
              </Link>
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
          <span className="text-xs font-bold text-[var(--muted-foreground)] tabular-nums">
            {page} / {data?.totalPages}
          </span>
          <button onClick={() => setPage(p => Math.min(data?.totalPages ?? 1, p + 1))} disabled={page >= (data?.totalPages ?? 1)}
            className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--muted)] disabled:opacity-30 transition">
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
