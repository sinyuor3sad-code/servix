'use client';

import { useState, useEffect, type ReactElement } from 'react';
import { Receipt, Search, CheckCircle, Clock, XCircle, Download, Loader2 } from 'lucide-react';
import { Glass, PageTitle, TN } from '@/components/ui/glass';
import { adminService, type PaymentRecord } from '@/services/admin.service';

type PayStatus = 'completed' | 'pending' | 'failed';

const ST: Record<PayStatus, { label: string; icon: React.ElementType; cls: string }> = {
  completed: { label: 'مكتمل',  icon: CheckCircle, cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  pending:   { label: 'معلّق',  icon: Clock,       cls: 'bg-amber-500/10 text-amber-400 border-amber-500/18' },
  failed:    { label: 'فاشل',   icon: XCircle,     cls: 'bg-red-500/8 text-red-400 border-red-500/15' },
};

export default function PaymentsPage(): ReactElement {
  const [search, setSearch] = useState('');
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), perPage: '20' });
    if (search) params.set('search', search);
    adminService.getPayments(params.toString())
      .then(res => {
        setPayments(res.data ?? []);
        setTotalPages(res.meta?.totalPages ?? 1);
      })
      .catch(() => setPayments([]))
      .finally(() => setLoading(false));
  }, [page, search]);

  return (
    <div className="space-y-5">
      <PageTitle title="سجل المدفوعات" desc="جميع عمليات الدفع للاشتراكات" />

      <Glass><div className="p-4"><div className="relative max-w-sm">
        <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/15" />
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="بحث برقم الفاتورة أو الصالون..."
          className="h-10 w-full rounded-xl border border-white/[0.07] bg-white/[0.03] pr-10 pl-4 text-[13px] text-white/80 placeholder:text-white/15 outline-none focus:border-amber-500/25" />
      </div></div></Glass>

      <Glass className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-amber-400/60" />
          </div>
        ) : payments.length === 0 ? (
          <div className="py-16 text-center">
            <Receipt size={32} className="mx-auto mb-3 text-white/10" />
            <p className="text-[14px] font-bold text-white/30">لا توجد مدفوعات</p>
            <p className="mt-1 text-[12px] text-white/15">ستظهر هنا عند إصدار أول فاتورة</p>
          </div>
        ) : (
          <>
            <table className="w-full text-[13px]">
              <thead><tr className="border-b border-white/[0.05]">
                {['رقم الفاتورة', 'الصالون', 'المبلغ', 'طريقة الدفع', 'التاريخ', 'الحالة'].map((h, i) => (
                  <th key={i} className="px-5 py-4 text-start text-[11px] font-bold tracking-widest text-white/20">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {payments.map((pay, i) => {
                  const status = (pay.status || 'pending') as PayStatus;
                  const st = ST[status] || ST.pending;
                  const StI = st.icon;
                  return (
                    <tr key={pay.id} className={`group transition-colors hover:bg-white/[0.02] ${i < payments.length - 1 ? 'border-b border-white/[0.03]' : ''}`}>
                      <td className="px-5 py-3.5 font-mono text-[12px] font-bold text-violet-400/70">{pay.id}</td>
                      <td className="px-5 py-3.5 font-bold text-white/75 group-hover:text-white">{pay.salon || '—'}</td>
                      <td className="px-5 py-3.5 font-bold text-amber-400/65" style={TN}>{(pay.amount ?? 0).toLocaleString()} <span className="text-[10px] text-white/15">ر.س</span></td>
                      <td className="px-5 py-3.5 text-white/40">{pay.method || '—'}</td>
                      <td className="px-5 py-3.5 text-white/30" style={TN}>{pay.date ? new Date(pay.date).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' }) : '—'}</td>
                      <td className="px-5 py-3.5"><span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${st.cls}`}><StI size={12} />{st.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 border-t border-white/[0.05] px-5 py-3">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                  className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-[12px] font-bold text-white/40 hover:text-white/60 disabled:opacity-30">السابق</button>
                <span className="text-[12px] text-white/25" style={TN}>{page} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                  className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-[12px] font-bold text-white/40 hover:text-white/60 disabled:opacity-30">التالي</button>
              </div>
            )}
          </>
        )}
      </Glass>
    </div>
  );
}
