'use client';

import { useState, type ReactElement } from 'react';
import { FileText, Search, Download, Eye, CheckCircle, Clock, XCircle, AlertTriangle, DollarSign } from 'lucide-react';
import { Glass, PageTitle, TN } from '@/components/ui/glass';

type InvStatus = 'paid' | 'pending' | 'overdue' | 'cancelled';

const INVOICES = [
  { id: 'INV-2026-0047', salon: 'صالون الأناقة الملكية', amount: 699,  status: 'paid' as InvStatus,      date: '2026-03-01', paidAt: '2026-03-02' },
  { id: 'INV-2026-0046', salon: 'عيادة لؤلؤة الجمال',   amount: 399,  status: 'paid' as InvStatus,      date: '2026-03-01', paidAt: '2026-03-01' },
  { id: 'INV-2026-0045', salon: 'صالون بلوم',           amount: 399,  status: 'overdue' as InvStatus,   date: '2026-02-14', paidAt: null },
  { id: 'INV-2026-0044', salon: 'صالون فيرا',           amount: 6990, status: 'paid' as InvStatus,      date: '2026-01-05', paidAt: '2026-01-05' },
  { id: 'INV-2026-0043', salon: 'استوديو ريماس',        amount: 199,  status: 'pending' as InvStatus,   date: '2026-03-22', paidAt: null },
  { id: 'INV-2026-0042', salon: 'مركز أوبال',           amount: 199,  status: 'cancelled' as InvStatus, date: '2026-01-01', paidAt: null },
  { id: 'INV-2026-0041', salon: 'صالون غلام',           amount: 699,  status: 'paid' as InvStatus,      date: '2026-03-10', paidAt: '2026-03-10' },
];

const ST: Record<InvStatus, { label: string; icon: React.ElementType; cls: string }> = {
  paid:      { label: 'مدفوعة',  icon: CheckCircle,   cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  pending:   { label: 'معلّقة',  icon: Clock,         cls: 'bg-amber-500/10 text-amber-400 border-amber-500/18' },
  overdue:   { label: 'متأخرة', icon: AlertTriangle, cls: 'bg-red-500/8 text-red-400 border-red-500/15' },
  cancelled: { label: 'ملغاة',   icon: XCircle,       cls: 'bg-white/[0.03] text-white/30 border-white/[0.06]' },
};

export default function InvoicesPage(): ReactElement {
  const [search, setSearch] = useState('');
  const filtered = INVOICES.filter(inv => !search || inv.salon.includes(search) || inv.id.includes(search));
  const totalPaid = INVOICES.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-5">
      <PageTitle title="الفواتير والمدفوعات" desc="تتبع فواتير الاشتراكات وحالات الدفع">
        <div className="flex items-center gap-3">
          <span className="rounded-xl border border-amber-500/15 bg-amber-500/8 px-4 py-2 text-sm font-bold text-amber-400" style={TN}>
            <DollarSign size={14} className="inline -mt-0.5 mr-1" />{totalPaid.toLocaleString()} ر.س محصّلة
          </span>
        </div>
      </PageTitle>

      <Glass><div className="p-4"><div className="relative max-w-sm">
        <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/15" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث برقم الفاتورة أو الصالون..."
          className="h-10 w-full rounded-xl border border-white/[0.07] bg-white/[0.03] pr-10 pl-4 text-[13px] text-white/80 placeholder:text-white/15 outline-none focus:border-amber-500/25" />
      </div></div></Glass>

      <Glass className="overflow-hidden">
        <table className="w-full text-[13px]">
          <thead><tr className="border-b border-white/[0.05]">
            {['رقم الفاتورة', 'الصالون', 'المبلغ', 'تاريخ الإصدار', 'تاريخ الدفع', 'الحالة', ''].map((h, i) => (
              <th key={i} className="px-5 py-4 text-start text-[11px] font-bold tracking-widest text-white/20">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.map((inv, i) => {
              const st = ST[inv.status]; const StI = st.icon;
              return (
                <tr key={inv.id} className={`group transition-colors hover:bg-white/[0.02] ${i < filtered.length - 1 ? 'border-b border-white/[0.03]' : ''}`}>
                  <td className="px-5 py-3.5 font-mono text-[12px] font-bold text-violet-400/70">{inv.id}</td>
                  <td className="px-5 py-3.5 font-bold text-white/75 group-hover:text-white">{inv.salon}</td>
                  <td className="px-5 py-3.5 font-bold text-amber-400/65" style={TN}>{inv.amount.toLocaleString()} <span className="text-[10px] text-white/15">ر.س</span></td>
                  <td className="px-5 py-3.5 text-white/30" style={TN}>{new Date(inv.date).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })}</td>
                  <td className="px-5 py-3.5 text-white/30" style={TN}>{inv.paidAt ? new Date(inv.paidAt).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' }) : '—'}</td>
                  <td className="px-5 py-3.5"><span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${st.cls}`}><StI size={12} />{st.label}</span></td>
                  <td className="px-3 py-3.5 flex gap-1">
                    <button className="flex h-8 w-8 items-center justify-center rounded-lg text-white/20 hover:bg-white/[0.05] hover:text-white/60"><Eye size={15} /></button>
                    <button className="flex h-8 w-8 items-center justify-center rounded-lg text-white/20 hover:bg-white/[0.05] hover:text-amber-400"><Download size={15} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Glass>
    </div>
  );
}
