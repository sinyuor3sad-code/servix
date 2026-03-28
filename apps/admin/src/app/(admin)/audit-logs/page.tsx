'use client';

import { useState, type ReactElement } from 'react';
import { ScrollText, Search, Shield, LogIn, UserPlus, Trash2, Edit, Settings, CreditCard } from 'lucide-react';
import { Glass, PageTitle, TN } from '@/components/ui/glass';

type LogType = 'auth' | 'tenant' | 'subscription' | 'settings' | 'delete';

const LOGS = [
  { id: '1', action: 'تسجيل دخول المشرف',           actor: 'سعد الغامدي', type: 'auth' as LogType,         ip: '91.108.x.x',  time: '2026-03-26T10:05:00' },
  { id: '2', action: 'تعليق صالون استوديو ريماس',    actor: 'سعد الغامدي', type: 'tenant' as LogType,       ip: '91.108.x.x',  time: '2026-03-26T09:45:00' },
  { id: '3', action: 'تجديد اشتراك صالون الأناقة',   actor: 'النظام',      type: 'subscription' as LogType, ip: 'system',       time: '2026-03-26T03:00:00' },
  { id: '4', action: 'إضافة شركة جديدة: صالون روز',  actor: 'سعد الغامدي', type: 'tenant' as LogType,       ip: '91.108.x.x',  time: '2026-03-25T14:20:00' },
  { id: '5', action: 'تعديل باقة Pro → Enterprise',   actor: 'سعد الغامدي', type: 'subscription' as LogType, ip: '91.108.x.x',  time: '2026-03-25T11:30:00' },
  { id: '6', action: 'تغيير إعدادات SMTP',            actor: 'سعد الغامدي', type: 'settings' as LogType,     ip: '91.108.x.x',  time: '2026-03-24T16:00:00' },
  { id: '7', action: 'حذف مركز أوبال نهائياً',        actor: 'سعد الغامدي', type: 'delete' as LogType,       ip: '91.108.x.x',  time: '2026-03-24T10:00:00' },
];

const TYPE_CFG: Record<LogType, { icon: React.ElementType; cls: string }> = {
  auth:         { icon: LogIn,      cls: 'bg-sky-500/10 text-sky-400 border-sky-500/15' },
  tenant:       { icon: UserPlus,   cls: 'bg-violet-500/10 text-violet-400 border-violet-500/15' },
  subscription: { icon: CreditCard, cls: 'bg-amber-500/10 text-amber-400 border-amber-500/15' },
  settings:     { icon: Settings,   cls: 'bg-white/[0.04] text-white/40 border-white/[0.06]' },
  delete:       { icon: Trash2,     cls: 'bg-red-500/8 text-red-400 border-red-500/12' },
};

export default function AuditLogsPage(): ReactElement {
  const [search, setSearch] = useState('');
  const filtered = LOGS.filter(l => !search || l.action.includes(search) || l.actor.includes(search));

  return (
    <div className="space-y-5">
      <PageTitle title="سجل العمليات" desc="جميع العمليات والأحداث في المنصة" />

      <Glass><div className="p-4"><div className="relative max-w-sm">
        <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/15" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث في السجل..."
          className="h-10 w-full rounded-xl border border-white/[0.07] bg-white/[0.03] pr-10 pl-4 text-[13px] text-white/80 placeholder:text-white/15 outline-none focus:border-amber-500/25" />
      </div></div></Glass>

      <Glass className="overflow-hidden">
        <table className="w-full text-[13px]">
          <thead><tr className="border-b border-white/[0.05]">
            {['النوع', 'العملية', 'المنفّذ', 'IP', 'الوقت'].map((h, i) => (
              <th key={i} className="px-5 py-4 text-start text-[11px] font-bold tracking-widest text-white/20">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.map((l, i) => {
              const tc = TYPE_CFG[l.type]; const TI = tc.icon;
              return (
                <tr key={l.id} className={`transition-colors hover:bg-white/[0.02] ${i < filtered.length - 1 ? 'border-b border-white/[0.03]' : ''}`}>
                  <td className="px-5 py-3.5"><span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border ${tc.cls}`}><TI size={13} /></span></td>
                  <td className="px-5 py-3.5 font-medium text-white/70">{l.action}</td>
                  <td className="px-5 py-3.5 text-white/40">{l.actor}</td>
                  <td className="px-5 py-3.5 font-mono text-[11px] text-white/20">{l.ip}</td>
                  <td className="px-5 py-3.5 text-white/25" style={TN}>{new Date(l.time).toLocaleString('ar-SA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Glass>
    </div>
  );
}
