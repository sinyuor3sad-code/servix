'use client';

import { type ReactElement } from 'react';
import { ToggleRight, Shield, Sparkles, Crown, Check, X } from 'lucide-react';
import { Glass, PageTitle } from '@/components/ui/glass';

const FEATURES = [
  { name: 'إدارة الخدمات',        basic: true,  pro: true,  enterprise: true },
  { name: 'إدارة العملاء',        basic: true,  pro: true,  enterprise: true },
  { name: 'المواعيد والحجوزات',   basic: true,  pro: true,  enterprise: true },
  { name: 'نقاط البيع (POS)',     basic: true,  pro: true,  enterprise: true },
  { name: 'صفحة الحجز الإلكتروني', basic: false, pro: true,  enterprise: true },
  { name: 'التقارير المتقدمة',    basic: false, pro: true,  enterprise: true },
  { name: 'الصلاحيات التفصيلية',  basic: false, pro: true,  enterprise: true },
  { name: 'الكوبونات',           basic: false, pro: false, enterprise: true },
  { name: 'نظام الولاء',         basic: false, pro: false, enterprise: true },
  { name: 'واتساب بزنس',         basic: false, pro: false, enterprise: true },
  { name: 'فوترة ZATCA',         basic: false, pro: true,  enterprise: true },
  { name: 'متعدد الفروع',        basic: false, pro: false, enterprise: true },
];

function Chk({ on }: { on: boolean }) {
  return on
    ? <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10"><Check size={14} className="text-emerald-400" strokeWidth={2.5} /></span>
    : <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/[0.02]"><X size={14} className="text-white/10" /></span>;
}

export default function FeaturesPage(): ReactElement {
  return (
    <div className="space-y-5">
      <PageTitle title="إدارة الميزات" desc="مصفوفة الميزات حسب كل باقة" />

      <Glass className="overflow-hidden">
        <table className="w-full text-[13px]">
          <thead><tr className="border-b border-white/[0.05]">
            <th className="px-6 py-4 text-start text-[11px] font-bold tracking-widest text-white/20 w-[40%]">الميزة</th>
            <th className="px-4 py-4 text-center text-[11px] font-bold tracking-widest text-white/20">
              <span className="inline-flex items-center gap-1"><Shield size={12} className="text-white/30" />Basic</span>
            </th>
            <th className="px-4 py-4 text-center text-[11px] font-bold tracking-widest text-white/20">
              <span className="inline-flex items-center gap-1"><Sparkles size={12} className="text-violet-400" />Pro</span>
            </th>
            <th className="px-4 py-4 text-center text-[11px] font-bold tracking-widest text-white/20">
              <span className="inline-flex items-center gap-1"><Crown size={12} className="text-amber-400" />Enterprise</span>
            </th>
          </tr></thead>
          <tbody>
            {FEATURES.map((f, i) => (
              <tr key={f.name} className={`transition-colors hover:bg-white/[0.015] ${i < FEATURES.length - 1 ? 'border-b border-white/[0.03]' : ''}`}>
                <td className="px-6 py-3.5 font-medium text-white/60">{f.name}</td>
                <td className="px-4 py-3.5 text-center"><div className="flex justify-center"><Chk on={f.basic} /></div></td>
                <td className="px-4 py-3.5 text-center"><div className="flex justify-center"><Chk on={f.pro} /></div></td>
                <td className="px-4 py-3.5 text-center"><div className="flex justify-center"><Chk on={f.enterprise} /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Glass>
    </div>
  );
}
