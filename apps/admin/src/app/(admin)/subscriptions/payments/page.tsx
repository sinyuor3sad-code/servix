'use client';

import { useState, type ReactElement } from 'react';
import { Receipt, Search, CheckCircle, Clock, XCircle, Download } from 'lucide-react';
import { Glass, PageTitle, TN } from '@/components/ui/glass';

type PayStatus = 'completed' | 'pending' | 'failed';

const PAYMENTS = [
  { id: 'PAY-4821', salon: 'صالون الأناقة الملكية', amount: 699,  method: 'بطاقة ائتمان', status: 'completed' as PayStatus, date: '2026-03-02' },
  { id: 'PAY-4820', salon: 'عيادة لؤلؤة الجمال',   amount: 399,  method: 'تحويل بنكي',   status: 'completed' as PayStatus, date: '2026-03-01' },
  { id: 'PAY-4819', salon: 'صالون فيرا',           amount: 6990, method: 'بطاقة ائتمان', status: 'completed' as PayStatus, date: '2026-01-05' },
  { id: 'PAY-4818', salon: 'صالون بلوم',           amount: 399,  method: 'بطاقة ائتمان', status: 'pending' as PayStatus,   date: '2026-03-14' },
  { id: 'PAY-4817', salon: 'استوديو ريماس',        amount: 199,  method: 'بطاقة ائتمان', status: 'failed' as PayStatus,    date: '2026-02-22' },
  { id: 'PAY-4816', salon: 'صالون غلام',           amount: 699,  method: 'Apple Pay',    status: 'completed' as PayStatus, date: '2026-03-10' },
];

const ST: Record<PayStatus, { label: string; icon: React.ElementType; cls: string }> = {
  completed: { label: 'مكتمل',  icon: CheckCircle, cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  pending:   { label: 'معلّق',  icon: Clock,       cls: 'bg-amber-500/10 text-amber-400 border-amber-500/18' },
  failed:    { label: 'فشل',    icon: XCircle,     cls: 'bg-red-500/8 text-red-400 border-red-500/15' },
};

export default function PaymentsPage(): ReactElement {
  const [search, setSearch] = useState('');
  const filtered = PAYMENTS.filter(p => !search || p.salon.includes(search) || p.id.includes(search));

  return (
    <div className="space-y-5">
      <PageTitle title="سجل المدفوعات" desc="جميع عمليات الدفع للاشتراكات" />

      <Glass><div className="p-4"><div className="relative max-w-sm">
        <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/15" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث برقم العملية أو الصالون..."
          className="h-10 w-full rounded-xl border border-white/[0.07] bg-white/[0.03] pr-10 pl-4 text-[13px] text-white/80 placeholder:text-white/15 outline-none focus:border-amber-500/25" />
      </div></div></Glass>

      <Glass className="overflow-hidden">
        <table className="w-full text-[13px]">
          <thead><tr className="border-b border-white/[0.05]">
            {['رقم العملية', 'الصالون', 'المبلغ', 'طريقة الدفع', 'التاريخ', 'الحالة', ''].map((h, i) => (
              <th key={i} className="px-5 py-4 text-start text-[11px] font-bold tracking-widest text-white/20">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.map((p, i) => {
              const st = ST[p.status]; const StI = st.icon;
              return (
                <tr key={p.id} className={`group transition-colors hover:bg-white/[0.02] ${i < filtered.length - 1 ? 'border-b border-white/[0.03]' : ''}`}>
                  <td className="px-5 py-3.5 font-mono text-[12px] font-bold text-violet-400/70">{p.id}</td>
                  <td className="px-5 py-3.5 font-bold text-white/75 group-hover:text-white">{p.salon}</td>
                  <td className="px-5 py-3.5 font-bold text-amber-400/65" style={TN}>{p.amount.toLocaleString()} <span className="text-[10px] text-white/15">ر.س</span></td>
                  <td className="px-5 py-3.5 text-white/40">{p.method}</td>
                  <td className="px-5 py-3.5 text-white/30" style={TN}>{new Date(p.date).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })}</td>
                  <td className="px-5 py-3.5"><span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${st.cls}`}><StI size={12} />{st.label}</span></td>
                  <td className="px-3 py-3.5"><button className="flex h-8 w-8 items-center justify-center rounded-lg text-white/20 hover:bg-white/[0.05] hover:text-amber-400"><Download size={15} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Glass>
    </div>
  );
}
