'use client';

import { useState, useEffect, type ReactElement, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Calendar, DollarSign, Users, UserCheck, Clock, TrendingUp, TrendingDown,
  AlertTriangle, Bell, Zap, CreditCard, Scissors, Package, Heart,
  BarChart3, ClipboardCheck, ShoppingBag, Megaphone, Star, Timer,
  ArrowUpLeft, ChevronLeft, Eye, Plus,
} from 'lucide-react';
import { Glass, PageTitle, TN } from '@/components/ui/glass';

/* ═══════════════════════════════════════════════════════════════
   GLASS HELPERS
   ═══════════════════════════════════════════════════════════════ */

function StatCard({ label, value, suffix, icon: Icon, color, change, up, glow }: {
  label: string; value: string; suffix?: string; icon: React.ElementType;
  color: string; change?: string; up?: boolean; glow: string;
}) {
  return (
    <Glass hover className={`group transition-all duration-400 hover:border-amber-500/15`}>
      <div className="flex flex-col justify-between p-5">
        <div className="mb-5 flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-wide text-white/25">{label}</span>
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.025] transition-shadow duration-300 ${glow} group-hover:shadow-lg`}>
            <Icon size={17} className={`${color} opacity-70`} strokeWidth={1.5} />
          </div>
        </div>
        <div className="mb-3">
          <span className="text-[2.25rem] font-extrabold leading-none tracking-tight text-white" style={TN}>{value}</span>
          {suffix && <span className="mr-1.5 text-xs font-semibold text-white/20">{suffix}</span>}
        </div>
        {change && (
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold ${
              up ? 'border-emerald-500/15 bg-emerald-500/10 text-emerald-400' : 'border-red-500/12 bg-red-500/10 text-red-400'
            }`}>
              {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}{change}
            </span>
            <span className="text-[10px] text-white/15">عن أمس</span>
          </div>
        )}
      </div>
    </Glass>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MOCK DATA
   ═══════════════════════════════════════════════════════════════ */

const TODAY_APPOINTMENTS = [
  { id: '1', client: 'نورة المطيري',  service: 'قص وصبغة',       employee: 'سارة',  time: '10:00', status: 'confirmed' },
  { id: '2', client: 'ريم العتيبي',   service: 'بروتين شعر',     employee: 'هند',   time: '10:30', status: 'in_progress' },
  { id: '3', client: 'لمى الحربي',    service: 'مكياج سهرة',     employee: 'أمل',   time: '11:00', status: 'confirmed' },
  { id: '4', client: 'غادة الغامدي',  service: 'تنظيف بشرة',     employee: 'ديما',  time: '11:30', status: 'pending' },
  { id: '5', client: 'عبير السبيعي',  service: 'أظافر جل',       employee: 'منيرة', time: '12:00', status: 'confirmed' },
];

const APT_STATUS: Record<string, { label: string; cls: string }> = {
  confirmed:   { label: 'مؤكد',    cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  in_progress: { label: 'جاري',    cls: 'bg-amber-500/10 text-amber-400 border-amber-500/18' },
  pending:     { label: 'بانتظار', cls: 'bg-violet-500/10 text-violet-400 border-violet-500/18' },
  completed:   { label: 'مكتمل',   cls: 'bg-sky-500/10 text-sky-400 border-sky-500/15' },
};

const ALERTS = [
  { icon: AlertTriangle, text: 'خدمة البروتين تقترب من نفاد المخزون (3 وحدات متبقية)', type: 'warning' },
  { icon: Clock,         text: 'موعد نورة المطيري 10:00 ص — لم يتم التأكيد بعد',        type: 'info' },
  { icon: Star,          text: 'تقييم جديد ★★★★★ من ريم العتيبي',                        type: 'success' },
];

const ALERT_CLS: Record<string, string> = {
  warning: 'border-amber-500/15 bg-amber-500/[0.04] text-amber-400',
  info:    'border-sky-500/12 bg-sky-500/[0.04] text-sky-400',
  success: 'border-emerald-500/12 bg-emerald-500/[0.04] text-emerald-400',
};

const EMPLOYEES_NOW = [
  { name: 'سارة القحطاني', role: 'مصففة شعر',   status: 'present',  bookings: 4 },
  { name: 'هند الشمري',    role: 'خبيرة تجميل', status: 'present',  bookings: 3 },
  { name: 'أمل الزهراني',  role: 'مكياج',       status: 'present',  bookings: 2 },
  { name: 'ديما البقمي',   role: 'عناية بشرة',  status: 'on_break', bookings: 1 },
  { name: 'منيرة الدوسري', role: 'أظافر',       status: 'present',  bookings: 3 },
];

const EMP_ST: Record<string, { label: string; cls: string }> = {
  present:  { label: 'متواجدة', cls: 'bg-emerald-500/10 text-emerald-400' },
  on_break: { label: 'استراحة', cls: 'bg-amber-500/10 text-amber-400' },
  absent:   { label: 'غائبة',   cls: 'bg-red-500/8 text-red-400' },
};

const QUICK_NAV = [
  { label: 'المواعيد',      icon: Calendar,       href: '/tenants', color: 'text-violet-400',  bg: 'group-hover:bg-violet-500/[0.08]' },
  { label: 'الكاشير',       icon: CreditCard,     href: '/tenants', color: 'text-amber-400',   bg: 'group-hover:bg-amber-500/[0.08]' },
  { label: 'الفواتير',      icon: DollarSign,     href: '/invoices', color: 'text-emerald-400', bg: 'group-hover:bg-emerald-500/[0.08]' },
  { label: 'الموظفات',      icon: Users,          href: '/tenants', color: 'text-sky-400',     bg: 'group-hover:bg-sky-500/[0.08]' },
  { label: 'الخدمات',       icon: Scissors,       href: '/plans',   color: 'text-pink-400',    bg: 'group-hover:bg-pink-500/[0.08]' },
  { label: 'المخزون',       icon: Package,        href: '/tenants', color: 'text-orange-400',  bg: 'group-hover:bg-orange-500/[0.08]' },
  { label: 'العملاء',       icon: Heart,          href: '/tenants', color: 'text-rose-400',    bg: 'group-hover:bg-rose-500/[0.08]' },
  { label: 'التقارير',      icon: BarChart3,      href: '/analytics', color: 'text-indigo-400', bg: 'group-hover:bg-indigo-500/[0.08]' },
];

/* ═══════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════ */

export default function DashboardPage(): ReactElement {
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);

  const fade = (d: number): React.CSSProperties => ({
    opacity: ready ? 1 : 0,
    transform: ready ? 'translateY(0)' : 'translateY(14px)',
    transition: `all 0.7s cubic-bezier(0.23,1,0.32,1) ${d}ms`,
  });

  const now = new Date();
  const timeStr = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  const dateStr = 'الخميس ٢٦ مارس ٢٠٢٦';

  return (
    <div className="space-y-5">

      {/* ── HEADER ── */}
      <header style={fade(0)}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[13px] text-white/25">{dateStr} · {timeStr}</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white" style={{ textShadow: '0 0 20px rgba(251,191,36,0.2)' }}>
              صباح الخير، سعد 👋
            </h1>
            <p className="mt-1 text-[14px] text-white/35">إليك ملخص أداء صالونك اليوم</p>
          </div>
          <div className="flex gap-2">
            <button className="inline-flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-[13px] font-semibold text-white/50 transition-all hover:border-amber-500/20 hover:text-amber-400">
              <Bell size={15} /> الإشعارات
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500/15 px-1 text-[9px] font-bold text-red-400 border border-red-500/20">3</span>
            </button>
            <button className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 px-5 py-2.5 text-[13px] font-bold text-black shadow-lg shadow-amber-500/20 hover:shadow-xl active:scale-[0.97]">
              <Plus size={16} strokeWidth={2.5} /> حجز جديد
            </button>
          </div>
        </div>
      </header>

      {/* ── DECISION OS — KEY METRICS ── */}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" style={fade(80)}>
        <StatCard label="مواعيد اليوم"    value="12"      icon={Calendar}    color="text-violet-400"  change="3" up={true}  glow="group-hover:shadow-violet-500/10" />
        <StatCard label="إيرادات اليوم"   value="4,850"   suffix="ر.س" icon={DollarSign}  color="text-amber-400"   change="18%" up={true} glow="group-hover:shadow-amber-500/10" />
        <StatCard label="الموظفات اليوم"  value="5"       suffix="/ 6"  icon={UserCheck}   color="text-emerald-400" glow="group-hover:shadow-emerald-500/10" />
        <StatCard label="العملاء الجدد"   value="3"       icon={Heart}       color="text-rose-400"    change="1" up={true} glow="group-hover:shadow-rose-500/10" />
      </section>

      {/* ── ALERTS ── */}
      <section style={fade(200)}>
        <div className="space-y-2">
          {ALERTS.map((a, i) => {
            const Icon = a.icon;
            return (
              <div key={i} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${ALERT_CLS[a.type]}`}>
                <Icon size={16} className="shrink-0" />
                <span className="text-[13px] font-medium">{a.text}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── QUICK NAV ── */}
      <section style={fade(300)}>
        <h2 className="mb-3 text-[14px] font-bold text-white/50">وصول سريع</h2>
        <div className="grid grid-cols-4 gap-2 lg:grid-cols-8">
          {QUICK_NAV.map((q) => {
            const Icon = q.icon;
            return (
              <Link key={q.label} href={q.href}>
                <Glass hover className="group cursor-pointer text-center">
                  <div className="flex flex-col items-center gap-2 py-4 px-2">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.025] transition-all duration-300 ${q.bg} group-hover:shadow-lg`}>
                      <Icon size={20} className={`${q.color} opacity-70 transition-all group-hover:opacity-100`} strokeWidth={1.5} />
                    </div>
                    <span className="text-[11px] font-semibold text-white/40 group-hover:text-white/70">{q.label}</span>
                  </div>
                </Glass>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── TODAY'S APPOINTMENTS + EMPLOYEES ── */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12" style={fade(400)}>

        {/* Appointments */}
        <Glass className="lg:col-span-7">
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-white/70">مواعيد اليوم</h2>
              <span className="rounded-lg border border-amber-500/15 bg-amber-500/8 px-2.5 py-1 text-[11px] font-bold text-amber-400">{TODAY_APPOINTMENTS.length} مواعيد</span>
            </div>
            <div className="space-y-1">
              {TODAY_APPOINTMENTS.map((apt) => {
                const st = APT_STATUS[apt.status] ?? APT_STATUS.pending;
                return (
                  <div key={apt.id} className="group flex items-center gap-4 rounded-xl px-3 py-3 transition-colors hover:bg-white/[0.02]">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.03] text-[12px] font-bold text-amber-400/60" style={TN}>
                      {apt.time}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-white/75 group-hover:text-white">{apt.client}</p>
                      <p className="text-[11px] text-white/25">{apt.service} · {apt.employee}</p>
                    </div>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold ${st.cls}`}>
                      {st.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </Glass>

        {/* Employees */}
        <Glass className="lg:col-span-5">
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-white/70">الموظفات المتواجدات</h2>
              <span className="text-[12px] text-white/25">{EMPLOYEES_NOW.filter(e => e.status === 'present').length} / {EMPLOYEES_NOW.length}</span>
            </div>
            <div className="space-y-1">
              {EMPLOYEES_NOW.map((emp) => {
                const st = EMP_ST[emp.status] ?? EMP_ST.present;
                return (
                  <div key={emp.name} className="group flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-white/[0.02]">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/20 to-indigo-500/10 text-[12px] font-bold text-violet-300">
                      {emp.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-white/70">{emp.name}</p>
                      <p className="text-[11px] text-white/20">{emp.role}</p>
                    </div>
                    <div className="text-end">
                      <span className={`inline-flex rounded-lg px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>{st.label}</span>
                      <p className="mt-1 text-[11px] text-white/20" style={TN}>{emp.bookings} حجوزات</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Glass>
      </section>

      {/* ── REVENUE CHART + TOP SERVICES ── */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12" style={fade(550)}>
        <Glass className="lg:col-span-8">
          <div className="p-7">
            <h2 className="mb-5 text-[15px] font-bold text-white/70">إيرادات الأسبوع</h2>
            <div className="space-y-3">
              {[
                { day: 'السبت',   val: 3200 },
                { day: 'الأحد',   val: 4100 },
                { day: 'الإثنين', val: 2800 },
                { day: 'الثلاثاء', val: 5200 },
                { day: 'الأربعاء', val: 3900 },
                { day: 'الخميس',  val: 4850 },
                { day: 'الجمعة',  val: 1200 },
              ].map((d) => (
                <div key={d.day} className="flex items-center gap-4">
                  <span className="w-16 text-[12px] font-semibold text-white/30">{d.day}</span>
                  <div className="flex-1 h-7 rounded-lg bg-white/[0.02] overflow-hidden">
                    <div className="h-full rounded-lg bg-gradient-to-l from-amber-500/30 to-amber-500/5 transition-all duration-700"
                      style={{ width: `${(d.val / 5500) * 100}%` }} />
                  </div>
                  <span className="w-20 text-end text-[13px] font-bold text-amber-400/55" style={TN}>{d.val.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </Glass>

        <Glass className="lg:col-span-4">
          <div className="p-6">
            <h2 className="mb-5 text-[15px] font-bold text-white/70">أكثر الخدمات طلباً</h2>
            <div className="space-y-3">
              {[
                { name: 'قص شعر',       count: 145, pct: 92 },
                { name: 'صبغة شعر',     count: 98,  pct: 68 },
                { name: 'بروتين',       count: 76,  pct: 52 },
                { name: 'مكياج',        count: 64,  pct: 44 },
                { name: 'تنظيف بشرة',   count: 51,  pct: 35 },
              ].map((s, i) => (
                <div key={s.name}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-white/50">{s.name}</span>
                    <span className="text-[12px] font-bold text-white/30" style={TN}>{s.count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.03]">
                    <div className="h-full rounded-full bg-gradient-to-l from-violet-400/50 to-violet-500/15" style={{ width: `${s.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Glass>
      </section>
    </div>
  );
}
