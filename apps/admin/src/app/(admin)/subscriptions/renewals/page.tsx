'use client';

import { useState, useEffect, type ReactElement } from 'react';
import { History, CheckCircle, Clock, XCircle, Loader2 } from 'lucide-react';
import { Glass, PageTitle, TN } from '@/components/ui/glass';
import { adminService, type RenewalRecord } from '@/services/admin.service';

type RStatus = 'renewed' | 'pending' | 'failed';

const ST: Record<RStatus, { label: string; icon: React.ElementType; cls: string }> = {
  renewed:   { label: 'تم التجديد', icon: CheckCircle, cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  pending:   { label: 'قيد الانتظار', icon: Clock,     cls: 'bg-amber-500/10 text-amber-400 border-amber-500/18' },
  failed:    { label: 'فشل',        icon: XCircle,     cls: 'bg-red-500/8 text-red-400 border-red-500/15' },
};

export default function RenewalsPage(): ReactElement {
  const [renewals, setRenewals] = useState<RenewalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setLoading(true);
    adminService.getRenewals(`page=${page}&perPage=20`)
      .then(res => {
        setRenewals(res.data ?? []);
        setTotalPages(res.meta?.totalPages ?? 1);
      })
      .catch(() => setRenewals([]))
      .finally(() => setLoading(false));
  }, [page]);

  const renewedCount = renewals.filter(r => r.status === 'renewed').length;
  const failedCount = renewals.filter(r => r.status === 'failed').length;
  const pendingCount = renewals.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-5">
      <PageTitle title="التجديدات" desc="متابعة تجديدات الاشتراكات والترقيات" />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'تم التجديد', value: renewedCount, color: 'text-emerald-400' },
          { label: 'فشل التجديد', value: failedCount, color: 'text-red-400' },
          { label: 'قيد الانتظار', value: pendingCount, color: 'text-amber-400' },
        ].map((s) => (
          <Glass key={s.label} hover>
            <div className="px-5 py-4 text-center">
              <p className={`text-3xl font-extrabold ${s.color}`} style={TN}>{loading ? '—' : s.value}</p>
              <p className="mt-1 text-[11px] font-semibold text-white/25">{s.label}</p>
            </div>
          </Glass>
        ))}
      </div>

      <Glass className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-amber-400/60" />
          </div>
        ) : renewals.length === 0 ? (
          <div className="py-16 text-center">
            <History size={32} className="mx-auto mb-3 text-white/10" />
            <p className="text-[14px] font-bold text-white/30">لا توجد تجديدات</p>
            <p className="mt-1 text-[12px] text-white/15">ستظهر هنا عند تجديد أول اشتراك</p>
          </div>
        ) : (
          <>
            <table className="w-full text-[13px]">
              <thead><tr className="border-b border-white/[0.05]">
                {['الصالون', 'الباقة', 'دورة الفوترة', 'المبلغ', 'تاريخ الانتهاء', 'الحالة'].map((h, i) => (
                  <th key={i} className="px-5 py-4 text-start text-[11px] font-bold tracking-widest text-white/20">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {renewals.map((r, i) => {
                  const status = (r.status || 'pending') as RStatus;
                  const st = ST[status] || ST.pending;
                  const StI = st.icon;
                  return (
                    <tr key={r.id} className={`group transition-colors hover:bg-white/[0.02] ${i < renewals.length - 1 ? 'border-b border-white/[0.03]' : ''}`}>
                      <td className="px-5 py-3.5 font-bold text-white/75 group-hover:text-white">{r.salon || '—'}</td>
                      <td className="px-5 py-3.5 text-white/40">{r.planName || '—'}</td>
                      <td className="px-5 py-3.5 text-white/40">{r.billingCycle === 'yearly' ? 'سنوي' : 'شهري'}</td>
                      <td className="px-5 py-3.5 font-bold text-amber-400/65" style={TN}>{(r.amount ?? 0).toLocaleString()} <span className="text-[10px] text-white/15">ر.س</span></td>
                      <td className="px-5 py-3.5 text-white/30" style={TN}>
                        {r.date ? new Date(r.date).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' }) : '—'}
                      </td>
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
