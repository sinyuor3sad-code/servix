'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar, DollarSign, Users, UserCheck, Clock, TrendingUp, TrendingDown,
  Bell, Heart, Plus, CreditCard, Scissors, Package,
  BarChart3, FileText, ChevronLeft, ChevronRight, Zap,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import { dashboardService } from '@/services/dashboard.service';
import type { DashboardStats } from '@/types';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'صباح الخير';
  if (h >= 12 && h < 17) return 'مساء الخير';
  if (h >= 17 && h < 21) return 'مساء النور';
  return 'أهلاً بك';
}

const TN: React.CSSProperties = { fontFeatureSettings: '"tnum" 1', fontVariantNumeric: 'tabular-nums' };

function formatCurrency(value: number): string {
  return value.toLocaleString('en');
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours, 10);
  return `${h % 12 || 12}:${minutes} ${h >= 12 ? 'م' : 'ص'}`;
}

/* ═══════════════════════════════════════════════════════════════
   GLASS CARD
   ═══════════════════════════════════════════════════════════════ */

function Glass({ children, className = '', hover = false }: { children: React.ReactNode; className?: string; hover?: boolean }) {
  return (
    <div className={`
      relative overflow-hidden rounded-2xl
      bg-[var(--card)] border border-[var(--border)]
      shadow-[var(--shadow)]
      ${hover ? 'transition-all duration-300 hover:shadow-[var(--shadow-hover)] hover:border-[var(--brand-primary)]/20' : ''}
      ${className}
    `}>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STAT CARD
   ═══════════════════════════════════════════════════════════════ */

function KpiCard({ label, value, suffix, icon: Icon, change, up, accentClass }: {
  label: string; value: string; suffix?: string; icon: React.ElementType;
  change?: string; up?: boolean; accentClass?: string;
}) {
  return (
    <Glass hover className="group">
      <div className="flex flex-col justify-between p-5">
        <div className="mb-5 flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-wide text-[var(--muted-foreground)]">{label}</span>
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors group-hover:bg-[var(--primary-100)] ${accentClass ?? 'bg-[var(--primary-50)]'}`}>
            <Icon size={17} className="text-[var(--brand-primary)] opacity-80" strokeWidth={1.5} />
          </div>
        </div>
        <div className="mb-3">
          <span className="text-2xl sm:text-[2.25rem] font-extrabold leading-none tracking-tight text-[var(--foreground)]" style={TN}>{value}</span>
          {suffix && <span className="mr-1.5 text-xs font-semibold text-[var(--muted-foreground)]">{suffix}</span>}
        </div>
        {change && (
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold ${
              up ? 'bg-[var(--success-light)] text-[var(--success)]' : 'bg-[var(--danger-light)] text-[var(--danger)]'
            }`}>
              {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}{change}
            </span>
            <span className="text-[10px] text-[var(--muted-foreground)]">عن أمس</span>
          </div>
        )}
      </div>
    </Glass>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MINI CALENDAR
   ═══════════════════════════════════════════════════════════════ */

const WEEKDAYS_AR = ['سب', 'أح', 'إث', 'ثل', 'أر', 'خم', 'جم'];

function MiniCalendar({ appointments = [] }: { appointments?: any[] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const today = new Date();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  // Adjust for Saturday-start week (Saudi standard)
  const startOffset = (firstDay + 1) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthName = currentDate.toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' });

  // Derive busy days from real appointment data
  const busyDays = useMemo(() => {
    const days = new Set<number>();
    appointments.forEach((apt) => {
      const d = new Date(apt.date);
      if (d.getMonth() === month && d.getFullYear() === year) {
        days.add(d.getDate());
      }
    });
    return days;
  }, [appointments, month, year]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < startOffset; i++) {
    cells.push(<div key={`empty-${i}`} />);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    const hasBusy = busyDays.has(d);
    cells.push(
      <button
        key={d}
        className={`relative flex h-8 w-8 items-center justify-center rounded-lg text-[12px] font-semibold transition-all
          ${isToday
            ? 'bg-[var(--brand-primary)] text-white shadow-md'
            : 'text-[var(--foreground)] hover:bg-[var(--muted)]'
          }`}
        style={TN}
      >
        {d}
        {hasBusy && !isToday && (
          <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[var(--brand-primary)] opacity-60" />
        )}
      </button>
    );
  }

  return (
    <Glass>
      <div className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-[var(--foreground)]">التقويم</h2>
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors">
              <ChevronRight size={14} />
            </button>
            <span className="min-w-[100px] text-center text-[12px] font-semibold text-[var(--muted-foreground)]">{monthName}</span>
            <button onClick={nextMonth} className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors">
              <ChevronLeft size={14} />
            </button>
          </div>
        </div>
        {/* Weekday headers */}
        <div className="mb-2 grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS_AR.map((d) => (
            <span key={d} className="text-[10px] font-semibold text-[var(--muted-foreground)]">{d}</span>
          ))}
        </div>
        {/* Day cells */}
        <div className="grid grid-cols-7 place-items-center gap-1">
          {cells}
        </div>
        {/* Legend */}
        <div className="mt-4 flex items-center gap-4 border-t border-[var(--border)] pt-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[var(--brand-primary)]" />
            <span className="text-[10px] text-[var(--muted-foreground)]">اليوم</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-[var(--brand-primary)] opacity-60" />
            <span className="text-[10px] text-[var(--muted-foreground)]">يوم مزدحم</span>
          </div>
        </div>
      </div>
    </Glass>
  );
}


/* ═══════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════ */

const APT_ST: Record<string, { label: string; variant: string }> = {
  confirmed:   { label: 'مؤكد',    variant: 'bg-[var(--success-light)] text-[var(--success)] border-[var(--success)]/15' },
  in_progress: { label: 'جاري',    variant: 'bg-[var(--warning-light)] text-[var(--warning)] border-[var(--warning)]/15' },
  pending:     { label: 'بانتظار', variant: 'bg-[var(--info-light)] text-[var(--info)] border-[var(--info)]/15' },
  completed:   { label: 'مكتمل',   variant: 'bg-[var(--success-light)] text-[var(--success)] border-[var(--success)]/15' },
  cancelled:   { label: 'ملغي',    variant: 'bg-[var(--danger-light)] text-[var(--danger)] border-[var(--danger)]/15' },
};

const QUICK_LINKS = [
  { label: 'المواعيد',  icon: Calendar,   href: '/appointments' },
  { label: 'الكاشير',   icon: CreditCard, href: '/pos' },
  { label: 'الفواتير',  icon: FileText,   href: '/invoices' },
  { label: 'الموظفات',  icon: Users,      href: '/employees' },
  { label: 'الخدمات',   icon: Scissors,   href: '/services' },
  { label: 'المخزون',   icon: Package,    href: '/inventory' },
  { label: 'العملاء',   icon: Heart,      href: '/clients' },
  { label: 'التقارير',  icon: BarChart3,  href: '/reports' },
];

/* ═══════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════ */

export default function DashboardPage(): React.ReactElement {
  const { accessToken, user } = useAuth();
  const [ready, setReady] = useState(false);
  const firstName = user?.fullName?.split(' ')[0] || '';
  useEffect(() => { setReady(true); }, []);

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => dashboardService.getStats(accessToken!),
    enabled: !!accessToken,
    staleTime: 2 * 60 * 1000,
  });

  const todayApts = stats?.todayAppointments ?? 0;
  const todayRev  = stats?.todayRevenue ?? 0;
  const monthRev  = stats?.monthlyRevenue ?? 0;
  const totalEmp  = stats?.totalEmployees ?? 0;
  const totalCli  = stats?.totalClients ?? 0;
  const recentApts = stats?.recentAppointments ?? [];
  const monthApts = stats?.monthlyAppointments ?? 0;

  const { data: employeesData } = useQuery({
    queryKey: ['employees', 'dashboard-top5'],
    queryFn: () => dashboardService.getEmployees({ limit: 5 }, accessToken!),
    enabled: !!accessToken && totalEmp > 0,
    staleTime: 5 * 60 * 1000,
  });
  const topEmployees = employeesData?.items ?? [];

  const fade = (d: number): React.CSSProperties => ({
    opacity: ready ? 1 : 0,
    transform: ready ? 'translateY(0)' : 'translateY(12px)',
    transition: `all 0.6s cubic-bezier(0.23,1,0.32,1) ${d}ms`,
  });

  return (
    <div className="space-y-5">

      {/* ── HEADER ── */}
      <header style={fade(0)}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[13px] text-[var(--muted-foreground)]">
              {new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
              {getGreeting()}{firstName ? ` ${firstName}` : ''} 👋
            </h1>
            <p className="mt-1 text-[14px] text-[var(--muted-foreground)]">إليك ملخص أداء صالونك اليوم</p>
          </div>
          <div className="flex gap-2">
            <Link href="/appointments/new">
              <button className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand-primary)] px-5 py-2.5 text-[13px] font-bold text-white shadow-md transition-all hover:opacity-90 active:scale-[0.97]">
                <Plus size={16} strokeWidth={2.5} /> حجز جديد
              </button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── KPIs ── */}
      <section className="grid grid-cols-1 gap-3 xs:grid-cols-2 xl:grid-cols-4" style={fade(80)}>
        <KpiCard label="مواعيد اليوم"   value={todayApts.toLocaleString('en')} icon={Calendar} />
        <KpiCard label="إيرادات اليوم"  value={formatCurrency(todayRev)} suffix="SAR" icon={DollarSign} />
        <KpiCard label="إيرادات الشهر"  value={formatCurrency(monthRev)} suffix="SAR" icon={TrendingUp} />
        <KpiCard label="الموظفات / العملاء" value={`${totalEmp.toLocaleString('en')} / ${totalCli.toLocaleString('en')}`} icon={Users} />
      </section>

      {/* ── ALERTS ── */}
      {/* Alerts section — only show when there's real data */}
      {recentApts.length > 0 && (
        <section className="space-y-2" style={fade(180)}>
          <div className="flex items-center gap-3 rounded-xl border px-4 py-3 bg-[var(--info-light)] text-[var(--info)] border-[var(--info)]/15">
            <Bell size={16} className="shrink-0" />
            <span className="text-[13px] font-medium">مرحباً بك في SERVIX! ابدأ بإضافة خدماتك وموظفاتك لتفعيل صالونك.</span>
          </div>
        </section>
      )}

      {/* ── QUICK NAV ── */}
      <section style={fade(280)}>
        <h2 className="mb-3 text-[14px] font-bold text-[var(--foreground)]">وصول سريع</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {QUICK_LINKS.map((q) => {
            const Icon = q.icon;
            return (
              <Link key={q.label} href={q.href}>
                <Glass hover className="group cursor-pointer text-center">
                  <div className="flex flex-col items-center gap-2 py-4 px-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary-50)] transition-colors group-hover:bg-[var(--primary-100)]">
                      <Icon size={20} className="text-[var(--brand-primary)] opacity-80" strokeWidth={1.5} />
                    </div>
                    <span className="text-[11px] font-semibold text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]">{q.label}</span>
                  </div>
                </Glass>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── APPOINTMENTS + CALENDAR ── */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12" style={fade(380)}>
        {/* Appointments list */}
        <Glass className="lg:col-span-7">
          <div className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-[var(--foreground)]">مواعيد اليوم</h2>
              <Link href="/appointments" className="text-[12px] font-semibold text-[var(--brand-primary)] hover:underline">عرض الكل</Link>
            </div>
            <div className="space-y-1">
              {recentApts.length > 0 ? recentApts.slice(0, 5).map((apt: any) => {
                const client = apt.client?.fullName ?? apt.client;
                const time = apt.startTime ?? apt.time;
                const employee = apt.employee?.fullName ?? apt.employee;
                const service = apt.appointmentServices?.[0]?.service?.nameAr ?? apt.service ?? '';
                const st = APT_ST[apt.status] ?? APT_ST.pending;
                return (
                  <div key={apt.id} className="group flex items-center gap-4 rounded-xl px-3 py-3 transition-colors hover:bg-[var(--muted)]">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-50)] text-[12px] font-bold text-[var(--brand-primary)]" style={TN}>
                      {formatTime(time)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-[var(--foreground)]">{client}</p>
                      <p className="text-[11px] text-[var(--muted-foreground)]">{service} · {employee}</p>
                    </div>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold ${st.variant}`}>
                      {st.label}
                    </span>
                  </div>
                );
              }) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Calendar size={32} className="mb-3 text-[var(--muted-foreground)] opacity-40" />
                  <p className="text-[13px] font-semibold text-[var(--muted-foreground)]">لا توجد مواعيد اليوم</p>
                  <Link href="/appointments/new" className="mt-2 text-[12px] font-medium text-[var(--brand-primary)] hover:underline">أضف أول موعد</Link>
                </div>
              )}
            </div>
          </div>
        </Glass>

        {/* Mini Calendar */}
        <div className="lg:col-span-5">
          <MiniCalendar appointments={recentApts} />
        </div>
      </section>

      {/* ── TOP EMPLOYEES + ATTENDANCE ── */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12" style={fade(460)}>
        {/* Getting Started — shows for new accounts */}
        <Glass className="lg:col-span-5">
          <div className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-[var(--foreground)]">البدء السريع</h2>
              <Zap size={16} className="text-[var(--brand-accent,var(--brand-primary))] opacity-70" />
            </div>
            <div className="space-y-3">
              {[
                { label: 'أضف موظفاتك', href: '/employees/new', icon: Users, done: totalEmp > 0 },
                { label: 'أضف خدماتك', href: '/services/new', icon: Scissors, done: false },
                { label: 'أنشئ أول موعد', href: '/appointments/new', icon: Calendar, done: todayApts > 0 },
              ].map((step) => {
                const Icon = step.icon;
                return (
                  <Link key={step.label} href={step.href}>
                    <div className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-[var(--muted)] cursor-pointer">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${step.done ? 'bg-[var(--success-light)]' : 'bg-[var(--primary-50)]'}`}>
                        <Icon size={18} className={step.done ? 'text-[var(--success)]' : 'text-[var(--brand-primary)]'} />
                      </div>
                      <p className="text-[13px] font-bold text-[var(--foreground)]">{step.label}</p>
                      {step.done && <span className="mr-auto text-[10px] font-bold text-[var(--success)]">✓</span>}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </Glass>

        {/* Employees — empty state or real data */}
        <Glass className="lg:col-span-7">
          <div className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-[var(--foreground)]">فريق العمل</h2>
              <Link href="/employees" className="text-[12px] font-semibold text-[var(--brand-primary)] hover:underline">عرض الكل</Link>
            </div>
            {totalEmp === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Users size={32} className="mb-3 text-[var(--muted-foreground)] opacity-40" />
                <p className="text-[13px] font-semibold text-[var(--muted-foreground)]">لم تضف موظفات بعد</p>
                <Link href="/employees/new" className="mt-2 text-[12px] font-medium text-[var(--brand-primary)] hover:underline">أضف أول موظفة</Link>
              </div>
            ) : (
              <div className="space-y-2">
                {topEmployees.map((emp: any) => (
                  <div key={emp.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--muted)]">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-dark)] text-[12px] font-bold text-white shadow-sm">
                      {emp.fullName?.charAt(0) || '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-[var(--foreground)] truncate">{emp.fullName}</p>
                      <p className="text-[11px] text-[var(--muted-foreground)]">{emp.role === 'stylist' ? 'مصففة' : emp.role === 'makeup' ? 'مكياج' : emp.role === 'nails' ? 'أظافر' : emp.role}</p>
                    </div>
                    <span className="inline-flex h-2 w-2 rounded-full bg-[var(--success)] shadow-[0_0_6px_var(--success)]" title="متصلة" />
                  </div>
                ))}
                {totalEmp > 5 && (
                  <Link href="/employees" className="block text-center text-[12px] font-semibold text-[var(--brand-primary)] hover:underline pt-1">
                    و {totalEmp - 5} موظفات أخرى
                  </Link>
                )}
              </div>
            )}
          </div>
        </Glass>
      </section>

      {/* ── REVENUE CHART — always show ── */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12" style={fade(560)}>
        <Glass className="lg:col-span-8">
          <div className="p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-[var(--foreground)]">إيرادات الأسبوع</h2>
              <Link href="/reports/revenue" className="text-[12px] font-semibold text-[var(--brand-primary)] hover:underline">عرض الكل</Link>
            </div>
            {stats?.revenueChart && stats.revenueChart.length > 0 ? (
              <div className="h-[220px]" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.revenueChart.slice(-7)} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--brand-primary)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="var(--brand-primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v: string) => new Date(v).toLocaleDateString('ar-SA', { weekday: 'short' })}
                      tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
                      width={45}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        fontSize: '13px',
                        boxShadow: 'var(--shadow-md)',
                      }}
                      labelFormatter={(v: string) => new Date(v).toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'short' })}
                      formatter={(value: number) => [`${value.toLocaleString('en')} SAR`, 'الإيراد']}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="var(--brand-primary)"
                      strokeWidth={2.5}
                      fill="url(#revGrad)"
                      animationDuration={1200}
                      animationEasing="ease-out"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <BarChart3 size={32} className="mb-3 text-[var(--muted-foreground)] opacity-40" />
                <p className="text-[13px] font-semibold text-[var(--muted-foreground)]">سيظهر الرسم البياني عند بدء تسجيل المعاملات</p>
              </div>
            )}
          </div>
        </Glass>

        <Glass className="lg:col-span-4">
          <div className="p-5">
            <h2 className="mb-5 text-[15px] font-bold text-[var(--foreground)]">ملخص الأداء</h2>
            <div className="space-y-4">
              <div className="rounded-xl bg-[var(--primary-50)] p-4">
                <p className="text-[11px] font-semibold text-[var(--muted-foreground)]">مواعيد الشهر</p>
                <p className="mt-1 text-2xl font-extrabold text-[var(--foreground)]" style={TN}>{monthApts}</p>
              </div>
              <div className="rounded-xl bg-[var(--success-light)] p-4">
                <p className="text-[11px] font-semibold text-[var(--muted-foreground)]">إيرادات الشهر</p>
                <p className="mt-1 text-2xl font-extrabold text-[var(--success)]" style={TN}>{formatCurrency(monthRev)} <span className="text-xs font-semibold">SAR</span></p>
              </div>
              <div className="rounded-xl bg-[var(--info-light)] p-4">
                <p className="text-[11px] font-semibold text-[var(--muted-foreground)]">متوسط الفاتورة</p>
                <p className="mt-1 text-2xl font-extrabold text-[var(--info)]" style={TN}>
                  {monthApts > 0 ? formatCurrency(Math.round(monthRev / monthApts)) : '0'} <span className="text-xs font-semibold">SAR</span>
                </p>
              </div>
            </div>
          </div>
        </Glass>
      </section>
    </div>
  );
}
