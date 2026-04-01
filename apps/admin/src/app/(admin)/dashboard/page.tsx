'use client';

import { useState, useEffect, type ReactElement } from 'react';
import Link from 'next/link';
import {
  Calendar, DollarSign, Users, UserCheck, TrendingUp,
  AlertTriangle, Bell, BarChart3, Plus, Building2,
  CreditCard, Activity, FileText, Settings, Shield,
} from 'lucide-react';
import { Glass, PageTitle, TN } from '@/components/ui/glass';
import { adminService, type AdminStats, type Tenant } from '@/services/admin.service';

/* ═══════════════════════════════════════════════════════════════
   STAT CARD
   ═══════════════════════════════════════════════════════════════ */

function StatCard({ label, value, suffix, icon: Icon, color, glow }: {
  label: string; value: string; suffix?: string; icon: React.ElementType;
  color: string; glow: string;
}) {
  return (
    <Glass hover className="group transition-all duration-400 hover:border-amber-500/15">
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
      </div>
    </Glass>
  );
}

/* ═══════════════════════════════════════════════════════════════
   QUICK NAV
   ═══════════════════════════════════════════════════════════════ */

const QUICK_NAV = [
  { label: 'الصالونات',   icon: Building2,    href: '/tenants',       color: 'text-violet-400',  bg: 'group-hover:bg-violet-500/[0.08]' },
  { label: 'الاشتراكات',  icon: CreditCard,   href: '/subscriptions', color: 'text-amber-400',   bg: 'group-hover:bg-amber-500/[0.08]' },
  { label: 'الفواتير',    icon: FileText,      href: '/invoices',      color: 'text-emerald-400', bg: 'group-hover:bg-emerald-500/[0.08]' },
  { label: 'التحليلات',   icon: BarChart3,     href: '/analytics',     color: 'text-sky-400',     bg: 'group-hover:bg-sky-500/[0.08]' },
  { label: 'الباقات',     icon: DollarSign,    href: '/plans',         color: 'text-pink-400',    bg: 'group-hover:bg-pink-500/[0.08]' },
  { label: 'الميزات',     icon: Shield,        href: '/features',      color: 'text-orange-400',  bg: 'group-hover:bg-orange-500/[0.08]' },
  { label: 'النظام',      icon: Activity,      href: '/system',        color: 'text-rose-400',    bg: 'group-hover:bg-rose-500/[0.08]' },
  { label: 'الإعدادات',   icon: Settings,      href: '/settings',      color: 'text-indigo-400',  bg: 'group-hover:bg-indigo-500/[0.08]' },
];

/* ═══════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════ */

export default function DashboardPage(): ReactElement {
  const [ready, setReady] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setReady(true);
    adminService.getStats()
      .then(setStats)
      .catch(() => { /* API not available yet */ })
      .finally(() => setLoading(false));
  }, []);

  const fade = (d: number): React.CSSProperties => ({
    opacity: ready ? 1 : 0,
    transform: ready ? 'translateY(0)' : 'translateY(14px)',
    transition: `all 0.7s cubic-bezier(0.23,1,0.32,1) ${d}ms`,
  });

  const now = new Date();
  const timeStr = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const totalTenants = stats?.totalTenants ?? 0;
  const activeTenants = stats?.activeTenants ?? 0;
  const pendingTenants = stats?.pendingTenants ?? 0;
  const monthlyRevenue = stats?.monthlyRevenue ?? 0;
  const newThisMonth = stats?.newTenantsThisMonth ?? 0;
  const recentTenants = stats?.recentTenants ?? [];
  const planDist = stats?.planDistribution ?? [];

  return (
    <div className="space-y-5">

      {/* ── HEADER ── */}
      <header style={fade(0)}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[13px] text-white/25">{dateStr} · {timeStr}</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white" style={{ textShadow: '0 0 20px rgba(251,191,36,0.2)' }}>
              لوحة تحكم المنصة
            </h1>
            <p className="mt-1 text-[14px] text-white/35">
              {loading ? 'جاري تحميل البيانات...' : `${totalTenants} صالون مسجل في المنصة`}
            </p>
          </div>
        </div>
      </header>

      {/* ── KEY METRICS ── */}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" style={fade(80)}>
        <StatCard label="إجمالي الصالونات" value={totalTenants.toLocaleString('ar-SA')} icon={Building2}   color="text-violet-400"  glow="group-hover:shadow-violet-500/10" />
        <StatCard label="الصالونات النشطة" value={activeTenants.toLocaleString('ar-SA')} icon={UserCheck}   color="text-emerald-400" glow="group-hover:shadow-emerald-500/10" />
        <StatCard label="إيرادات الشهر"    value={monthlyRevenue.toLocaleString('ar-SA')} suffix="ر.س" icon={DollarSign} color="text-amber-400"   glow="group-hover:shadow-amber-500/10" />
        <StatCard label="جديد هذا الشهر"   value={newThisMonth.toLocaleString('ar-SA')}  icon={TrendingUp}  color="text-rose-400"    glow="group-hover:shadow-rose-500/10" />
      </section>

      {/* ── QUICK NAV ── */}
      <section style={fade(200)}>
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

      {/* ── RECENT TENANTS + PLAN DISTRIBUTION ── */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12" style={fade(400)}>

        {/* Recent Tenants */}
        <Glass className="lg:col-span-7">
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-white/70">أحدث الصالونات المسجلة</h2>
              <Link href="/tenants" className="text-[11px] font-semibold text-amber-400/60 hover:text-amber-400">عرض الكل</Link>
            </div>
            {recentTenants.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Building2 size={40} className="text-white/10 mb-3" />
                <p className="text-[13px] text-white/30">لا توجد صالونات مسجلة بعد</p>
                <p className="text-[11px] text-white/15 mt-1">ستظهر هنا عند تسجيل أول صالون</p>
              </div>
            ) : (
              <div className="space-y-1">
                {recentTenants.slice(0, 5).map((t) => (
                  <Link key={t.id} href={`/tenants/${t.id}`} className="group flex items-center gap-4 rounded-xl px-3 py-3 transition-colors hover:bg-white/[0.02]">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/10 text-[14px] font-bold text-violet-300">
                      {t.nameAr?.charAt(0) || t.nameEn?.charAt(0) || '؟'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-white/75 group-hover:text-white">{t.nameAr || t.nameEn}</p>
                      <p className="text-[11px] text-white/25">{t.city || 'غير محدد'} · {t.phone}</p>
                    </div>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                      t.status === 'active' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' :
                      t.status === 'pending' ? 'border-amber-500/18 bg-amber-500/10 text-amber-400' :
                      'border-red-500/15 bg-red-500/10 text-red-400'
                    }`}>
                      {t.status === 'active' ? 'نشط' : t.status === 'pending' ? 'بانتظار' : 'معلق'}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </Glass>

        {/* Plan Distribution */}
        <Glass className="lg:col-span-5">
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-white/70">توزيع الباقات</h2>
            </div>
            {planDist.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CreditCard size={40} className="text-white/10 mb-3" />
                <p className="text-[13px] text-white/30">لا توجد اشتراكات بعد</p>
              </div>
            ) : (
              <div className="space-y-3">
                {planDist.map((p) => {
                  const total = planDist.reduce((s, x) => s + x.count, 0);
                  const pct = total > 0 ? Math.round((p.count / total) * 100) : 0;
                  return (
                    <div key={p.plan}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-[12px] font-semibold text-white/50">{p.plan}</span>
                        <span className="text-[12px] font-bold text-white/30" style={TN}>{p.count}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.03]">
                        <div className="h-full rounded-full bg-gradient-to-l from-violet-400/50 to-violet-500/15" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Glass>
      </section>

      {/* ── EMPTY STATE NOTICE ── */}
      {!loading && totalTenants === 0 && (
        <section style={fade(550)}>
          <Glass>
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10">
                <AlertTriangle size={28} className="text-amber-400" />
              </div>
              <h3 className="text-lg font-bold text-white/70 mb-2">المنصة جاهزة للإطلاق</h3>
              <p className="text-[13px] text-white/35 max-w-md">
                لم يتم تسجيل أي صالون بعد. شارك رابط التسجيل مع عملائك للبدء.
              </p>
              <div className="mt-6 flex gap-3">
                <a href="https://servi-x.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 px-5 py-2.5 text-[13px] font-bold text-black shadow-lg shadow-amber-500/20 hover:shadow-xl active:scale-[0.97]">
                  صفحة الهبوط
                </a>
                <Link href="/tenants" className="inline-flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-[13px] font-semibold text-white/50 transition-all hover:border-amber-500/20 hover:text-amber-400">
                  إدارة الصالونات
                </Link>
              </div>
            </div>
          </Glass>
        </section>
      )}
    </div>
  );
}
