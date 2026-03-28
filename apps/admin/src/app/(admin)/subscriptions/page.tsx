'use client';

import { useState, type ReactElement } from 'react';
import { CreditCard, Search, Eye, MoreHorizontal, Crown, Sparkles, Shield, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { Glass, PageTitle, TN } from '@/components/ui/glass';

type SubStatus = 'active' | 'expired' | 'trial' | 'past_due';
type Plan = 'basic' | 'pro' | 'enterprise';

const SUBS = [
  { id: '1', salon: 'صالون الأناقة الملكية', plan: 'enterprise' as Plan, status: 'active' as SubStatus,   startedAt: '2025-03-15', expiresAt: '2026-03-15', amount: 699, cycle: 'شهري' },
  { id: '2', salon: 'عيادة لؤلؤة الجمال',   plan: 'pro' as Plan,        status: 'active' as SubStatus,   startedAt: '2025-06-20', expiresAt: '2026-06-20', amount: 399, cycle: 'شهري' },
  { id: '3', salon: 'مركز دانتيلا',         plan: 'pro' as Plan,        status: 'trial' as SubStatus,    startedAt: '2026-03-10', expiresAt: '2026-03-24', amount: 0,   cycle: 'تجريبي' },
  { id: '4', salon: 'صالون فيرا',           plan: 'enterprise' as Plan, status: 'active' as SubStatus,   startedAt: '2025-01-05', expiresAt: '2026-01-05', amount: 6990, cycle: 'سنوي' },
  { id: '5', salon: 'استوديو ريماس',        plan: 'basic' as Plan,      status: 'expired' as SubStatus,  startedAt: '2025-11-22', expiresAt: '2026-02-22', amount: 199, cycle: 'شهري' },
  { id: '6', salon: 'صالون بلوم',           plan: 'pro' as Plan,        status: 'past_due' as SubStatus, startedAt: '2025-09-14', expiresAt: '2026-03-14', amount: 399, cycle: 'شهري' },
  { id: '7', salon: 'صالون غلام',           plan: 'enterprise' as Plan, status: 'active' as SubStatus,   startedAt: '2024-11-10', expiresAt: '2025-11-10', amount: 699, cycle: 'شهري' },
];

const ST_CFG: Record<SubStatus, { label: string; icon: React.ElementType; cls: string }> = {
  active:   { label: 'نشط',    icon: CheckCircle,    cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  expired:  { label: 'منتهي',  icon: XCircle,        cls: 'bg-red-500/8 text-red-400 border-red-500/15' },
  trial:    { label: 'تجريبي', icon: Clock,          cls: 'bg-violet-500/10 text-violet-400 border-violet-500/18' },
  past_due: { label: 'متأخر',  icon: AlertTriangle,  cls: 'bg-amber-500/10 text-amber-400 border-amber-500/18' },
};

const PL_CFG: Record<Plan, { label: string; icon: React.ElementType; cls: string }> = {
  basic:      { label: 'Basic',      icon: Shield,   cls: 'text-white/45' },
  pro:        { label: 'Pro',        icon: Sparkles, cls: 'text-violet-400' },
  enterprise: { label: 'Enterprise', icon: Crown,    cls: 'text-amber-400' },
};

export default function SubscriptionsPage(): ReactElement {
  const [search, setSearch] = useState('');
  const filtered = SUBS.filter(s => !search || s.salon.includes(search));

  return (
    <div className="space-y-5">
      <PageTitle title="الاشتراكات والخطط" desc="إدارة اشتراكات الصالونات وتتبع حالتها">
        <div className="flex items-center gap-3 text-[13px] text-white/30">
          <span className="rounded-lg border border-emerald-500/15 bg-emerald-500/8 px-3 py-1.5 font-bold text-emerald-400">{SUBS.filter(s => s.status === 'active').length} نشط</span>
          <span className="rounded-lg border border-violet-500/15 bg-violet-500/8 px-3 py-1.5 font-bold text-violet-400">{SUBS.filter(s => s.status === 'trial').length} تجريبي</span>
          <span className="rounded-lg border border-red-500/12 bg-red-500/8 px-3 py-1.5 font-bold text-red-400">{SUBS.filter(s => s.status === 'expired').length} منتهي</span>
        </div>
      </PageTitle>

      <Glass>
        <div className="p-4">
          <div className="relative max-w-sm">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/15" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم..."
              className="h-10 w-full rounded-xl border border-white/[0.07] bg-white/[0.03] pr-10 pl-4 text-[13px] text-white/80 placeholder:text-white/15 outline-none focus:border-amber-500/25" />
          </div>
        </div>
      </Glass>

      <Glass className="overflow-hidden">
        <table className="w-full text-[13px]">
          <thead><tr className="border-b border-white/[0.05]">
            {['الصالون', 'الباقة', 'الدورة', 'المبلغ', 'تاريخ البدء', 'تاريخ الانتهاء', 'الحالة', ''].map((h, i) => (
              <th key={i} className="px-5 py-4 text-start text-[11px] font-bold tracking-widest text-white/20">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.map((s, i) => {
              const st = ST_CFG[s.status]; const pl = PL_CFG[s.plan]; const StI = st.icon; const PlI = pl.icon;
              return (
                <tr key={s.id} className={`group transition-colors hover:bg-white/[0.02] ${i < filtered.length - 1 ? 'border-b border-white/[0.03]' : ''}`}>
                  <td className="px-5 py-3.5 font-bold text-white/75 group-hover:text-white">{s.salon}</td>
                  <td className="px-5 py-3.5"><span className={`inline-flex items-center gap-1.5 text-[12px] font-bold ${pl.cls}`}><PlI size={13} />{pl.label}</span></td>
                  <td className="px-5 py-3.5 text-white/40">{s.cycle}</td>
                  <td className="px-5 py-3.5 font-bold text-amber-400/65" style={TN}>{s.amount.toLocaleString()} <span className="text-[10px] text-white/15">ر.س</span></td>
                  <td className="px-5 py-3.5 text-white/30" style={TN}>{new Date(s.startedAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                  <td className="px-5 py-3.5 text-white/30" style={TN}>{new Date(s.expiresAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                  <td className="px-5 py-3.5"><span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${st.cls}`}><StI size={12} />{st.label}</span></td>
                  <td className="px-3 py-3.5"><button className="flex h-8 w-8 items-center justify-center rounded-lg text-white/20 hover:bg-white/[0.05] hover:text-white/60"><Eye size={15} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Glass>
    </div>
  );
}
