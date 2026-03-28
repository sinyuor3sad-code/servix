'use client';

import { useState, type ReactElement } from 'react';
import {
  Bell, Send, CheckCheck, Clock, AlertTriangle, Plus, Search,
  Users, Eye, Mail, Smartphone, Filter, BarChart3, X, Megaphone,
} from 'lucide-react';
import { Glass, PageTitle, TN } from '@/components/ui/glass';

type NStatus = 'sent' | 'scheduled' | 'draft';
type NChannel = 'sms' | 'email' | 'push' | 'whatsapp';

interface Notif {
  id: string; title: string; body: string; target: string;
  channel: NChannel; status: NStatus; sentAt: string | null;
  recipients: number; opened: number; delivered: number;
}

const DATA: Notif[] = [
  { id: '1', title: 'تحديث شروط الاستخدام',     body: 'تم تحديث سياسة الخصوصية والشروط — يرجى المراجعة.',             target: 'جميع الشركات', channel: 'email',    status: 'sent',      sentAt: '2026-03-20', recipients: 47, opened: 38, delivered: 47 },
  { id: '2', title: 'عرض رمضان — خصم 30%',     body: 'استخدم كود RAMADAN30 للحصول على خصم 30% على أي باقة.',       target: 'Basic فقط',   channel: 'sms',      status: 'sent',      sentAt: '2026-03-15', recipients: 12, opened: 9,  delivered: 12 },
  { id: '3', title: 'تذكير بتجديد الاشتراك',    body: 'اشتراكك ينتهي خلال 3 أيام — جدّد الآن للاستمرار.',           target: 'منتهي قريباً', channel: 'whatsapp', status: 'scheduled', sentAt: '2026-03-28', recipients: 3,  opened: 0,  delivered: 0 },
  { id: '4', title: 'إطلاق ميزة واتساب بزنس',  body: 'الآن يمكنك ربط واتساب بزنس من الإعدادات — مجاناً لباقة Enterprise.', target: 'Enterprise', channel: 'push',     status: 'sent',      sentAt: '2026-03-10', recipients: 7,  opened: 7,  delivered: 7 },
  { id: '5', title: 'صيانة مجدولة — 2 أبريل',   body: 'ستتم صيانة الخوادم يوم 2 أبريل من 2-4 صباحاً. قد يتأثر الأداء.', target: 'جميع الشركات', channel: 'email',    status: 'draft',     sentAt: null,         recipients: 0,  opened: 0,  delivered: 0 },
  { id: '6', title: 'ميزة جديدة: التسعير الذكي', body: 'أصبح التسعير الديناميكي متاحاً لباقة Pro و Enterprise.',       target: 'Pro + Enterprise', channel: 'push', status: 'sent',      sentAt: '2026-03-05', recipients: 35, opened: 28, delivered: 34 },
];

const ST_CFG: Record<NStatus, { label: string; icon: React.ElementType; cls: string }> = {
  sent:      { label: 'مُرسل',  icon: CheckCheck,   cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  scheduled: { label: 'مجدول',  icon: Clock,        cls: 'bg-amber-500/10 text-amber-400 border-amber-500/18' },
  draft:     { label: 'مسودة',  icon: AlertTriangle, cls: 'bg-white/[0.03] text-white/30 border-white/[0.06]' },
};

const CH_CFG: Record<NChannel, { label: string; icon: React.ElementType; cls: string }> = {
  email:    { label: 'بريد',   icon: Mail,        cls: 'text-sky-400' },
  sms:      { label: 'SMS',    icon: Smartphone,  cls: 'text-emerald-400' },
  push:     { label: 'Push',   icon: Bell,        cls: 'text-violet-400' },
  whatsapp: { label: 'واتساب', icon: Send,        cls: 'text-green-400' },
};

export default function NotificationsPage(): ReactElement {
  const [search, setSearch] = useState('');
  const [statusF, setStatusF] = useState<NStatus | ''>('');
  const [preview, setPreview] = useState<Notif | null>(null);

  const filtered = DATA.filter(n => {
    if (search && !n.title.includes(search)) return false;
    if (statusF && n.status !== statusF) return false;
    return true;
  });

  const totalSent      = DATA.filter(n => n.status === 'sent').reduce((s, n) => s + n.recipients, 0);
  const totalOpened    = DATA.filter(n => n.status === 'sent').reduce((s, n) => s + n.opened, 0);
  const totalDelivered = DATA.filter(n => n.status === 'sent').reduce((s, n) => s + n.delivered, 0);
  const openRate       = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;

  return (
    <div className="space-y-5">
      <PageTitle title="الإشعارات الجماعية" desc="إرسال إشعارات وتنبيهات لجميع الشركات أو مجموعة محددة">
        <button className="group inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 px-6 py-3 text-[14px] font-bold text-black shadow-lg shadow-amber-500/20 transition-all hover:shadow-xl active:scale-[0.97]">
          <Plus size={17} strokeWidth={2.5} className="transition-transform group-hover:rotate-90 duration-300" /> إشعار جديد
        </button>
      </PageTitle>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'إجمالي المُرسل', value: totalSent.toString(), icon: Send, color: 'text-emerald-400' },
          { label: 'تم التوصيل',     value: totalDelivered.toString(), icon: CheckCheck, color: 'text-sky-400' },
          { label: 'تم الفتح',       value: totalOpened.toString(), icon: Eye, color: 'text-violet-400' },
          { label: 'معدل الفتح',     value: `${openRate}%`, icon: BarChart3, color: 'text-amber-400' },
        ].map((k) => {
          const Icon = k.icon;
          return (
            <Glass key={k.label} hover>
              <div className="flex items-center gap-4 px-5 py-[18px]">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.025]">
                  <Icon size={18} className={`${k.color} opacity-75`} strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-white/25">{k.label}</p>
                  <p className={`text-lg font-extrabold ${k.color}`} style={TN}>{k.value}</p>
                </div>
              </div>
            </Glass>
          );
        })}
      </div>

      {/* ── Filters ── */}
      <Glass>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/15" />
            <input value={search} onChange={e => { setSearch(e.target.value); }}
              placeholder="بحث بعنوان الإشعار..."
              className="h-10 w-full rounded-xl border border-white/[0.07] bg-white/[0.03] pr-10 pl-4 text-[13px] text-white/80 placeholder:text-white/15 outline-none focus:border-amber-500/25" />
          </div>
          <select value={statusF} onChange={e => setStatusF(e.target.value as NStatus | '')}
            className="h-10 appearance-none rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 text-[13px] text-white/55 outline-none focus:border-amber-500/25 hover:border-white/[0.14]">
            <option value="">جميع الحالات</option>
            <option value="sent">مُرسل</option>
            <option value="scheduled">مجدول</option>
            <option value="draft">مسودة</option>
          </select>
          {(search || statusF) && (
            <button onClick={() => { setSearch(''); setStatusF(''); }} className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/15 bg-amber-500/8 px-3.5 py-2.5 text-[11px] font-bold text-amber-400 hover:bg-amber-500/15">
              <X size={12} /> مسح
            </button>
          )}
        </div>
      </Glass>

      {/* ── Table + Preview ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Glass className="overflow-hidden lg:col-span-8">
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-white/[0.05]">
              {['العنوان', 'القناة', 'المستهدفون', 'المستلمين', 'الفتح', 'التاريخ', 'الحالة'].map((h, i) => (
                <th key={i} className="px-4 py-3.5 text-start text-[11px] font-bold tracking-widest text-white/20">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map((n, i) => {
                const st = ST_CFG[n.status]; const StI = st.icon;
                const ch = CH_CFG[n.channel]; const ChI = ch.icon;
                const selected = preview?.id === n.id;
                return (
                  <tr key={n.id}
                    onClick={() => setPreview(n)}
                    className={`cursor-pointer transition-colors ${selected ? 'bg-amber-500/[0.04]' : 'hover:bg-white/[0.015]'} ${i < filtered.length - 1 ? 'border-b border-white/[0.03]' : ''}`}>
                    <td className="px-4 py-3 font-bold text-white/75">{n.title}</td>
                    <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 text-[11px] font-bold ${ch.cls}`}><ChI size={12} />{ch.label}</span></td>
                    <td className="px-4 py-3 text-white/35 text-[12px]">{n.target}</td>
                    <td className="px-4 py-3 font-bold text-white/50" style={TN}>{n.recipients || '—'}</td>
                    <td className="px-4 py-3" style={TN}>
                      {n.recipients > 0
                        ? <span className="text-[12px] font-bold text-violet-400/60">{Math.round((n.opened / n.recipients) * 100)}%</span>
                        : <span className="text-white/15">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-white/25" style={TN}>{n.sentAt ? new Date(n.sentAt).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' }) : '—'}</td>
                    <td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-bold ${st.cls}`}><StI size={11} />{st.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Glass>

        {/* Preview panel */}
        <Glass className="lg:col-span-4">
          <div className="p-6">
            <h3 className="mb-4 flex items-center gap-2 text-[14px] font-bold text-white/60"><Eye size={16} className="text-white/25" />معاينة الإشعار</h3>
            {preview ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="text-[15px] font-bold text-white/85">{preview.title}</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-white/45">{preview.body}</p>
                </div>
                <div className="space-y-2 text-[12px]">
                  <div className="flex justify-between"><span className="text-white/25">المستهدفون</span><span className="font-semibold text-white/55">{preview.target}</span></div>
                  <div className="flex justify-between"><span className="text-white/25">القناة</span><span className={`font-bold ${CH_CFG[preview.channel].cls}`}>{CH_CFG[preview.channel].label}</span></div>
                  <div className="flex justify-between"><span className="text-white/25">المستلمين</span><span className="font-bold text-white/55" style={TN}>{preview.recipients}</span></div>
                  <div className="flex justify-between"><span className="text-white/25">تم التوصيل</span><span className="font-bold text-sky-400/70" style={TN}>{preview.delivered}</span></div>
                  <div className="flex justify-between"><span className="text-white/25">تم الفتح</span><span className="font-bold text-violet-400/70" style={TN}>{preview.opened}</span></div>
                  {preview.recipients > 0 && (
                    <div className="mt-3">
                      <div className="mb-1 flex justify-between text-[11px]"><span className="text-white/20">معدل الفتح</span><span className="font-bold text-amber-400">{Math.round((preview.opened / preview.recipients) * 100)}%</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/[0.04]">
                        <div className="h-full rounded-full bg-gradient-to-l from-amber-400/50 to-amber-500/20" style={{ width: `${(preview.opened / preview.recipients) * 100}%` }} />
                      </div>
                    </div>
                  )}
                </div>
                {preview.status === 'draft' && (
                  <button className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 py-2.5 text-[13px] font-bold text-black">
                    <Send size={14} /> إرسال الآن
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center py-10 text-center">
                <Megaphone size={32} className="mb-3 text-white/8" />
                <p className="text-[13px] text-white/25">اختر إشعاراً لعرض تفاصيله</p>
              </div>
            )}
          </div>
        </Glass>
      </div>
    </div>
  );
}
