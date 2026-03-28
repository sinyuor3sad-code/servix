'use client';

import { useState, useMemo, type ReactElement, type ReactNode } from 'react';
import {
  Search, Plus, ChevronLeft, ChevronRight,
  Eye, LogIn, Ban, Trash2, Building2, Users,
  CalendarCheck, DollarSign, MoreHorizontal,
  X, MapPin, Crown, Sparkles, Shield, CreditCard,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════ */

type Status = 'active' | 'suspended' | 'disabled';
type Plan   = 'basic' | 'pro' | 'enterprise';

interface Tenant {
  id: string; nameAr: string; owner: string; plan: Plan;
  employees: number; bookings: number; revenue: number;
  status: Status; joinedAt: string; city: string;
}

const DATA: Tenant[] = [
  { id: '1',  nameAr: 'صالون الأناقة الملكية', owner: 'نورة المطيري',  plan: 'enterprise', employees: 12, bookings: 1200, revenue: 45200, status: 'active',    joinedAt: '2025-03-15', city: 'الرياض' },
  { id: '2',  nameAr: 'عيادة لؤلؤة الجمال',   owner: 'سارة القحطاني', plan: 'pro',        employees: 8,  bookings: 890,  revenue: 32100, status: 'active',    joinedAt: '2025-06-20', city: 'جدة' },
  { id: '3',  nameAr: 'مركز دانتيلا',         owner: 'ريم العتيبي',   plan: 'pro',        employees: 6,  bookings: 650,  revenue: 21800, status: 'active',    joinedAt: '2025-08-10', city: 'الدمام' },
  { id: '4',  nameAr: 'صالون فيرا',           owner: 'هند الشمري',    plan: 'enterprise', employees: 15, bookings: 1450, revenue: 58900, status: 'active',    joinedAt: '2025-01-05', city: 'الرياض' },
  { id: '5',  nameAr: 'استوديو ريماس',        owner: 'لمى الحربي',    plan: 'basic',      employees: 3,  bookings: 180,  revenue: 6200,  status: 'suspended', joinedAt: '2025-11-22', city: 'مكة' },
  { id: '6',  nameAr: 'صالون بلوم',           owner: 'عبير السبيعي',  plan: 'pro',        employees: 7,  bookings: 720,  revenue: 27500, status: 'active',    joinedAt: '2025-09-14', city: 'جدة' },
  { id: '7',  nameAr: 'مركز أوبال',           owner: 'منيرة الدوسري', plan: 'basic',      employees: 2,  bookings: 95,   revenue: 3800,  status: 'disabled',  joinedAt: '2025-12-01', city: 'الخبر' },
  { id: '8',  nameAr: 'صالون غلام',           owner: 'أمل الزهراني',  plan: 'enterprise', employees: 20, bookings: 2100, revenue: 78400, status: 'active',    joinedAt: '2024-11-10', city: 'الرياض' },
  { id: '9',  nameAr: 'عيادة سيلك',          owner: 'ديما البقمي',   plan: 'pro',        employees: 5,  bookings: 410,  revenue: 18200, status: 'active',    joinedAt: '2026-01-08', city: 'المدينة' },
  { id: '10', nameAr: 'صالون روز',           owner: 'غادة الغامدي',  plan: 'basic',      employees: 3,  bookings: 0,    revenue: 0,     status: 'suspended', joinedAt: '2026-02-15', city: 'أبها' },
];

const CITIES = ['', 'الرياض', 'جدة', 'الدمام', 'مكة', 'المدينة', 'الخبر', 'أبها'];

const ST: Record<Status, { label: string; dot: string; cls: string }> = {
  active:    { label: 'نشط',  dot: 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]',  cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  suspended: { label: 'معلّق', dot: 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]',    cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  disabled:  { label: 'معطّل', dot: 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.6)]',     cls: 'bg-red-500/8 text-red-400 border-red-500/15' },
};

const PL: Record<Plan, { label: string; icon: React.ElementType; cls: string }> = {
  basic:      { label: 'Basic',      icon: Shield,   cls: 'text-white/45 bg-white/[0.03] border-white/[0.06]' },
  pro:        { label: 'Pro',        icon: Sparkles, cls: 'text-violet-400 bg-violet-500/10 border-violet-500/18' },
  enterprise: { label: 'Enterprise', icon: Crown,    cls: 'text-amber-400 bg-amber-500/10 border-amber-500/18' },
};

const TN = { fontFeatureSettings: '"tnum" 1', fontVariantNumeric: 'tabular-nums' as const };

/* ── Glass wrapper ── */
function G({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/[0.07] shadow-[0_4px_30px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.05)] ${className}`}
      style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.015) 100%)', backdropFilter: 'blur(40px) saturate(130%)' }}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-transparent" />
      <div className="relative">{children}</div>
    </div>
  );
}

/* ── Action dropdown ── */
function Actions({ t }: { t: Tenant }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const items: ({ icon: React.ElementType; label: string; cls: string } | null)[] = [
    { icon: Eye,   label: 'عرض التفاصيل', cls: 'text-white/60 hover:text-white' },
    { icon: LogIn, label: 'دخول كـ Admin', cls: 'text-white/60 hover:text-amber-400' },
    null,
    t.status === 'active'
      ? { icon: Ban,  label: 'تعليق',  cls: 'text-amber-400/70 hover:text-amber-400' }
      : { icon: Eye,  label: 'تفعيل',  cls: 'text-emerald-400/70 hover:text-emerald-400' },
    { icon: Trash2, label: 'حذف',    cls: 'text-red-400/70 hover:text-red-400' },
  ];

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/20 transition-all hover:bg-white/[0.06] hover:text-white/60">
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div className="absolute left-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-2xl border border-white/[0.08] p-1.5 shadow-2xl" style={{ background: 'rgba(12,12,18,0.96)', backdropFilter: 'blur(40px)' }}>
            {items.map((item, i) => item === null
              ? <div key={i} className="mx-2 my-1 border-t border-white/[0.05]" />
              : <button key={item.label} onClick={close} className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors hover:bg-white/[0.04] ${item.cls}`}>
                  <item.icon size={15} /> {item.label}
                </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════ */

export default function TenantsPage(): ReactElement {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<Status | ''>('');
  const [plan, setPlan]     = useState<Plan | ''>('');
  const [city, setCity]     = useState('');
  const [page, setPage]     = useState(1);
  const PER = 7;

  const filtered = useMemo(() => DATA.filter((t) => {
    if (search && !t.nameAr.includes(search) && !t.owner.includes(search)) return false;
    if (status && t.status !== status) return false;
    if (plan && t.plan !== plan) return false;
    if (city && t.city !== city) return false;
    return true;
  }), [search, status, plan, city]);

  const pages = Math.max(1, Math.ceil(filtered.length / PER));
  const rows  = filtered.slice((page - 1) * PER, page * PER);
  const hasF  = !!(search || status || plan || city);
  const clear = () => { setSearch(''); setStatus(''); setPlan(''); setCity(''); setPage(1); };

  const stats = [
    { label: 'إجمالي الشركات',  value: DATA.length.toString(),                                      icon: Building2,     color: 'text-white/80',     glow: 'group-hover:shadow-white/5' },
    { label: 'الإيرادات',       value: DATA.reduce((s, t) => s + t.revenue, 0).toLocaleString() + ' ر.س', icon: DollarSign,    color: 'text-amber-400',    glow: 'group-hover:shadow-amber-500/10' },
    { label: 'الحجوزات',        value: DATA.reduce((s, t) => s + t.bookings, 0).toLocaleString(),     icon: CalendarCheck, color: 'text-violet-400',   glow: 'group-hover:shadow-violet-500/10' },
    { label: 'الاشتراكات النشطة', value: DATA.filter(t => t.status === 'active').length + ' / ' + DATA.length, icon: CreditCard, color: 'text-emerald-400', glow: 'group-hover:shadow-emerald-500/10' },
  ];

  const Sel = ({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: ReactNode }) => (
    <select value={value} onChange={(e) => { onChange(e.target.value); setPage(1); }}
      className="h-10 appearance-none rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 text-[13px] text-white/55 outline-none transition-all focus:border-amber-500/25 hover:border-white/[0.14] hover:bg-white/[0.05]">
      {children}
    </select>
  );

  return (
    <div className="space-y-5">

      {/* ── HEADER ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-amber-500/10 bg-gradient-to-br from-amber-500/15 to-amber-600/5">
            <Building2 size={22} className="text-amber-400" strokeWidth={1.7} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">إدارة الشركات</h1>
            <p className="text-[13px] text-white/30">مراقبة وإدارة الصالونات المشتركة في المنصة</p>
          </div>
        </div>
        <button className="group inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 px-7 py-3 text-[14px] font-bold text-black shadow-lg shadow-amber-500/20 transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/35 active:scale-[0.97]">
          <Plus size={18} strokeWidth={2.5} className="transition-transform duration-300 group-hover:rotate-90" />
          إضافة شركة جديدة
        </button>
      </div>

      {/* ── STATS ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <G key={s.label} className="group transition-all duration-400 hover:border-amber-500/15">
              <div className="flex items-center gap-4 px-5 py-[18px]">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.025] transition-shadow duration-300 ${s.glow} group-hover:shadow-lg`}>
                  <Icon size={20} className={`${s.color} opacity-75`} strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold tracking-wide text-white/25">{s.label}</p>
                  <p className={`mt-0.5 text-[17px] font-extrabold leading-tight ${s.color}`} style={TN}>{s.value}</p>
                </div>
              </div>
            </G>
          );
        })}
      </div>

      {/* ── FILTERS ── */}
      <G>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/15" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="بحث بالاسم أو المالك..."
              className="h-10 w-full rounded-xl border border-white/[0.07] bg-white/[0.03] pr-10 pl-4 text-[13px] text-white/80 placeholder:text-white/15 outline-none transition-all focus:border-amber-500/25 hover:border-white/[0.14]" />
          </div>
          <Sel value={status} onChange={(v) => setStatus(v as Status | '')}>
            <option value="">جميع الحالات</option><option value="active">نشطة</option><option value="suspended">معلّقة</option><option value="disabled">معطّلة</option>
          </Sel>
          <Sel value={plan} onChange={(v) => setPlan(v as Plan | '')}>
            <option value="">جميع الباقات</option><option value="basic">Basic</option><option value="pro">Pro</option><option value="enterprise">Enterprise</option>
          </Sel>
          <Sel value={city} onChange={setCity}>
            <option value="">جميع المدن</option>{CITIES.filter(Boolean).map(c => <option key={c} value={c}>{c}</option>)}
          </Sel>
          {hasF && (
            <button onClick={clear} className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/15 bg-amber-500/8 px-3.5 py-2.5 text-[11px] font-bold text-amber-400 hover:bg-amber-500/15">
              <X size={12} /> مسح ({[search, status, plan, city].filter(Boolean).length})
            </button>
          )}
          <span className="mr-auto text-[12px] text-white/15">{filtered.length} نتيجة</span>
        </div>
      </G>

      {/* ── TABLE ── */}
      <G className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.05]">
                {['الشركة', 'المالك', 'الباقة', 'الموظفين', 'الحجوزات', 'الإيرادات', 'الحالة', 'الانضمام', ''].map((h, i) => (
                  <th key={i} className="px-5 py-4 text-start text-[11px] font-bold tracking-widest text-white/20">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={9} className="py-24 text-center">
                  <Building2 size={32} className="mx-auto mb-3 text-white/8" />
                  <p className="text-lg font-bold text-white/30">لا توجد نتائج</p>
                  <p className="mt-1 text-sm text-white/15">جرّب تغيير معايير البحث</p>
                  {hasF && <button onClick={clear} className="mt-3 text-sm font-bold text-amber-400">مسح الفلاتر</button>}
                </td></tr>
              ) : rows.map((t, idx) => {
                const PI = PL[t.plan].icon;
                return (
                  <tr key={t.id} className={`group transition-colors hover:bg-white/[0.02] ${idx < rows.length - 1 ? 'border-b border-white/[0.03]' : ''}`}>
                    <td className="px-5 py-[14px]">
                      <div className="flex items-center gap-3.5">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/[0.06] bg-gradient-to-br from-white/[0.06] to-white/[0.02] text-[15px] font-bold text-white/30 transition-all group-hover:border-amber-500/15 group-hover:text-amber-400/50">
                          {t.nameAr.charAt(0)}
                        </div>
                        <div>
                          <p className="text-[14px] font-bold text-white/80 group-hover:text-white">{t.nameAr}</p>
                          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-white/20"><MapPin size={10} />{t.city}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-[14px] text-[13px] text-white/45">{t.owner}</td>
                    <td className="px-5 py-[14px]">
                      <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold ${PL[t.plan].cls}`}>
                        <PI size={12} />{PL[t.plan].label}
                      </span>
                    </td>
                    <td className="px-5 py-[14px] text-center text-[13px] text-white/40" style={TN}>
                      <span className="inline-flex items-center gap-1"><Users size={12} className="text-white/15" />{t.employees}</span>
                    </td>
                    <td className="px-5 py-[14px] text-center text-[14px] font-bold text-white/55" style={TN}>{t.bookings.toLocaleString()}</td>
                    <td className="px-5 py-[14px] text-[14px] font-bold text-amber-400/65" style={TN}>
                      {t.revenue.toLocaleString()} <span className="text-[10px] text-white/15">ر.س</span>
                    </td>
                    <td className="px-5 py-[14px]">
                      <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold ${ST[t.status].cls}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${ST[t.status].dot}`} />{ST[t.status].label}
                      </span>
                    </td>
                    <td className="px-5 py-[14px] text-[12px] text-white/25" style={TN}>{new Date(t.joinedAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                    <td className="px-3 py-[14px]"><Actions t={t} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-white/[0.04] px-6 py-4">
            <span className="text-[12px] text-white/15" style={TN}>صفحة {page} من {pages} · {filtered.length} شركة</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="flex h-9 w-9 items-center justify-center rounded-xl text-white/25 hover:bg-white/[0.04] disabled:opacity-20"><ChevronRight size={16} /></button>
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)} className={`flex h-9 w-9 items-center justify-center rounded-xl text-[13px] font-bold transition-all ${page === p ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20 shadow-[0_0_12px_rgba(234,179,8,0.08)]' : 'text-white/25 hover:bg-white/[0.04]'}`}>{p}</button>
              ))}
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="flex h-9 w-9 items-center justify-center rounded-xl text-white/25 hover:bg-white/[0.04] disabled:opacity-20"><ChevronLeft size={16} /></button>
            </div>
          </div>
        )}
      </G>
    </div>
  );
}
