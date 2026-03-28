'use client';

import { type ReactElement } from 'react';
import { BadgePercent, Plus, CheckCircle, XCircle, Copy } from 'lucide-react';
import { Glass, PageTitle, TN } from '@/components/ui/glass';

const COUPONS = [
  { id: '1', code: 'RAMADAN30',    discount: '30%',    type: 'نسبة',   usageLimit: 100, used: 47,  validUntil: '2026-04-10', active: true },
  { id: '2', code: 'WELCOME50',    discount: '50 ر.س', type: 'ثابت',   usageLimit: 200, used: 182, validUntil: '2026-12-31', active: true },
  { id: '3', code: 'ANNUAL20',     discount: '20%',    type: 'نسبة',   usageLimit: 50,  used: 12,  validUntil: '2026-06-30', active: true },
  { id: '4', code: 'LAUNCH2025',   discount: '100%',   type: 'مجاني',  usageLimit: 10,  used: 10,  validUntil: '2025-12-31', active: false },
  { id: '5', code: 'VIP100',       discount: '100 ر.س',type: 'ثابت',   usageLimit: 30,  used: 5,   validUntil: '2026-09-15', active: true },
];

export default function CouponsPage(): ReactElement {
  return (
    <div className="space-y-5">
      <PageTitle title="الكوبونات" desc="إدارة كوبونات الخصم للاشتراكات">
        <button className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-5 py-2.5 text-[13px] font-bold text-black shadow-lg shadow-amber-500/20 hover:shadow-xl active:scale-[0.97]">
          <Plus size={16} strokeWidth={2.5} /> كوبون جديد
        </button>
      </PageTitle>

      <Glass className="overflow-hidden">
        <table className="w-full text-[13px]">
          <thead><tr className="border-b border-white/[0.05]">
            {['الكود', 'الخصم', 'النوع', 'الاستخدام', 'صالح حتى', 'الحالة', ''].map((h, i) => (
              <th key={i} className="px-5 py-4 text-start text-[11px] font-bold tracking-widest text-white/20">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {COUPONS.map((c, i) => (
              <tr key={c.id} className={`group transition-colors hover:bg-white/[0.02] ${i < COUPONS.length - 1 ? 'border-b border-white/[0.03]' : ''}`}>
                <td className="px-5 py-3.5">
                  <span className="inline-flex items-center gap-2 rounded-lg border border-amber-500/15 bg-amber-500/[0.06] px-3 py-1 font-mono text-[12px] font-bold text-amber-400">
                    {c.code}
                    <button className="text-amber-400/40 hover:text-amber-400"><Copy size={12} /></button>
                  </span>
                </td>
                <td className="px-5 py-3.5 font-bold text-white/70">{c.discount}</td>
                <td className="px-5 py-3.5 text-white/40">{c.type}</td>
                <td className="px-5 py-3.5" style={TN}>
                  <span className="font-bold text-white/60">{c.used}</span>
                  <span className="text-white/20"> / {c.usageLimit}</span>
                  <div className="mt-1 h-1 w-16 overflow-hidden rounded-full bg-white/[0.04]">
                    <div className="h-full rounded-full bg-amber-400/40" style={{ width: `${(c.used / c.usageLimit) * 100}%` }} />
                  </div>
                </td>
                <td className="px-5 py-3.5 text-white/30" style={TN}>{new Date(c.validUntil).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                <td className="px-5 py-3.5">
                  {c.active
                    ? <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-400"><CheckCircle size={12} />فعّال</span>
                    : <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-[11px] font-bold text-white/30"><XCircle size={12} />منتهي</span>
                  }
                </td>
                <td className="px-3 py-3.5"><button className="flex h-8 w-8 items-center justify-center rounded-lg text-white/20 hover:bg-white/[0.05] hover:text-white/60"><BadgePercent size={15} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Glass>
    </div>
  );
}
