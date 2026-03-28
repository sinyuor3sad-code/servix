'use client';

import { type ReactElement } from 'react';
import { History, CheckCircle, Clock, XCircle, ArrowRight } from 'lucide-react';
import { Glass, PageTitle, TN } from '@/components/ui/glass';

type RStatus = 'renewed' | 'pending' | 'failed';

const RENEWALS = [
  { id: '1', salon: 'صالون الأناقة الملكية', from: 'Enterprise',  to: 'Enterprise',  amount: 699,  status: 'renewed' as RStatus, date: '2026-03-15' },
  { id: '2', salon: 'عيادة لؤلؤة الجمال',   from: 'Pro',         to: 'Pro',         amount: 399,  status: 'renewed' as RStatus, date: '2026-03-20' },
  { id: '3', salon: 'صالون بلوم',           from: 'Pro',         to: 'Enterprise',  amount: 699,  status: 'pending' as RStatus,  date: '2026-03-28' },
  { id: '4', salon: 'استوديو ريماس',        from: 'Basic',       to: 'Basic',       amount: 199,  status: 'failed' as RStatus,   date: '2026-02-22' },
  { id: '5', salon: 'صالون غلام',           from: 'Enterprise',  to: 'Enterprise',  amount: 6990, status: 'renewed' as RStatus, date: '2026-01-10' },
  { id: '6', salon: 'مركز دانتيلا',         from: 'Pro',         to: 'Pro',         amount: 399,  status: 'pending' as RStatus,  date: '2026-04-10' },
];

const ST: Record<RStatus, { label: string; icon: React.ElementType; cls: string }> = {
  renewed: { label: 'تم التجديد', icon: CheckCircle, cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  pending: { label: 'قيد التجديد', icon: Clock,       cls: 'bg-amber-500/10 text-amber-400 border-amber-500/18' },
  failed:  { label: 'فشل',        icon: XCircle,     cls: 'bg-red-500/8 text-red-400 border-red-500/15' },
};

export default function RenewalsPage(): ReactElement {
  return (
    <div className="space-y-5">
      <PageTitle title="التجديدات" desc="متابعة تجديدات الاشتراكات والترقيات" />

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'تم التجديد', value: RENEWALS.filter(r => r.status === 'renewed').length, color: 'text-emerald-400' },
          { label: 'قيد التجديد', value: RENEWALS.filter(r => r.status === 'pending').length, color: 'text-amber-400' },
          { label: 'فشل التجديد', value: RENEWALS.filter(r => r.status === 'failed').length, color: 'text-red-400' },
        ].map((s) => (
          <Glass key={s.label} hover>
            <div className="px-5 py-4 text-center">
              <p className={`text-3xl font-extrabold ${s.color}`} style={TN}>{s.value}</p>
              <p className="mt-1 text-[11px] font-semibold text-white/25">{s.label}</p>
            </div>
          </Glass>
        ))}
      </div>

      <Glass className="overflow-hidden">
        <table className="w-full text-[13px]">
          <thead><tr className="border-b border-white/[0.05]">
            {['الصالون', 'من باقة', '', 'إلى باقة', 'المبلغ', 'التاريخ', 'الحالة'].map((h, i) => (
              <th key={i} className="px-5 py-4 text-start text-[11px] font-bold tracking-widest text-white/20">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {RENEWALS.map((r, i) => {
              const st = ST[r.status]; const StI = st.icon;
              const upgraded = r.from !== r.to;
              return (
                <tr key={r.id} className={`group transition-colors hover:bg-white/[0.02] ${i < RENEWALS.length - 1 ? 'border-b border-white/[0.03]' : ''}`}>
                  <td className="px-5 py-3.5 font-bold text-white/75 group-hover:text-white">{r.salon}</td>
                  <td className="px-5 py-3.5 text-white/40">{r.from}</td>
                  <td className="px-2 py-3.5"><ArrowRight size={14} className={upgraded ? 'text-amber-400' : 'text-white/15'} /></td>
                  <td className="px-5 py-3.5"><span className={upgraded ? 'font-bold text-amber-400' : 'text-white/40'}>{r.to}</span></td>
                  <td className="px-5 py-3.5 font-bold text-amber-400/65" style={TN}>{r.amount.toLocaleString()} <span className="text-[10px] text-white/15">ر.س</span></td>
                  <td className="px-5 py-3.5 text-white/30" style={TN}>{new Date(r.date).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })}</td>
                  <td className="px-5 py-3.5"><span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${st.cls}`}><StI size={12} />{st.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Glass>
    </div>
  );
}
