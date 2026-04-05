'use client';

import { useState, useEffect, useRef, type ReactElement } from 'react';
import Link from 'next/link';
import {
  Building2, Users, DollarSign, TrendingUp, ArrowUpRight,
  Clock, AlertTriangle, Zap, Eye, ChevronLeft,
  Sparkles, Shield,
} from 'lucide-react';
import { adminService, type AdminStats } from '@/services/admin.service';

/* ═══════════════════════════════════════════════════════════════
   ANIMATED COUNTER
   ═══════════════════════════════════════════════════════════════ */

function AnimatedNumber({ value, duration = 1200, suffix }: { value: number; duration?: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number>(0);

  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    const start = ref.current;
    const diff = value - start;
    const startTime = performance.now();

    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4); // ease-out quart
      const current = Math.round(start + diff * eased);
      setDisplay(current);
      if (progress < 1) requestAnimationFrame(animate);
      else ref.current = value;
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return (
    <span className="nx-tn">
      {display.toLocaleString('ar-SA')}
      {suffix && <span className="mr-1 text-[0.4em] font-medium" style={{ color: 'var(--nx-text-3)' }}>{suffix}</span>}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MICRO SPARKLINE
   ═══════════════════════════════════════════════════════════════ */

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const h = 28;
  const w = 80;
  const step = w / (data.length - 1);

  const points = data.map((v, i) => `${i * step},${h - ((v - min) / range) * h}`).join(' ');

  return (
    <svg width={w} height={h} className="opacity-40">
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MOMENTUM INTELLIGENCE — Generated insights
   ═══════════════════════════════════════════════════════════════ */

interface Insight {
  id: string;
  type: 'gold' | 'signal' | 'alert' | 'accent';
  icon: React.ElementType;
  title: string;
  description: string;
}

function generateInsights(stats: AdminStats): Insight[] {
  const insights: Insight[] = [];
  const { totalTenants, activeTenants, monthlyRevenue, newTenantsThisMonth, pendingTenants } = stats;

  if (totalTenants > 0 && activeTenants > 0) {
    const convRate = Math.round((activeTenants / totalTenants) * 100);
    insights.push({
      id: 'conversion',
      type: convRate >= 70 ? 'signal' : 'alert',
      icon: TrendingUp,
      title: `معدل التفعيل ${convRate}%`,
      description: `${activeTenants} من ${totalTenants} صالون نشط حالياً`,
    });
  }

  if (newTenantsThisMonth > 0) {
    insights.push({
      id: 'growth',
      type: 'gold',
      icon: Sparkles,
      title: `${newTenantsThisMonth} صالون جديد هذا الشهر`,
      description: 'المنصة تنمو — استمر في التسويق',
    });
  }

  if (pendingTenants > 0) {
    insights.push({
      id: 'pending',
      type: 'alert',
      icon: AlertTriangle,
      title: `${pendingTenants} صالون بانتظار التفعيل`,
      description: 'تواصل معهم لإتمام عملية التفعيل',
    });
  }

  if (monthlyRevenue > 0) {
    insights.push({
      id: 'revenue',
      type: 'gold',
      icon: DollarSign,
      title: `إيرادات الشهر: ${monthlyRevenue.toLocaleString('ar-SA')} ر.س`,
      description: 'تتبع الإيرادات بدقة لتخطيط النمو',
    });
  }

  // Always show at least one insight
  if (insights.length === 0) {
    insights.push({
      id: 'ready',
      type: 'accent',
      icon: Shield,
      title: 'المنصة جاهزة للعمل',
      description: 'كل الأنظمة تعمل بشكل طبيعي',
    });
  }

  return insights;
}

/* ═══════════════════════════════════════════════════════════════
   COMMAND NUCLEUS — THE MAIN SURFACE
   ═══════════════════════════════════════════════════════════════ */

export default function DashboardPage(): ReactElement {
  const [ready, setReady] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setReady(true);
    adminService.getStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const s = stats ?? {
    totalTenants: 0, activeTenants: 0, pendingTenants: 0,
    totalSubscriptions: 0, monthlyRevenue: 0, newTenantsThisMonth: 0,
    planDistribution: [], recentTenants: [],
  };

  const insights = generateInsights(s);
  const sparkData = [12, 15, 13, 18, 22, 19, 25, 28, 24, 30];

  const stagger = (i: number): React.CSSProperties => ({
    opacity: ready ? 1 : 0,
    transform: ready ? 'translateY(0)' : 'translateY(20px)',
    transition: `all 0.8s cubic-bezier(0.23,1,0.32,1) ${i * 100}ms`,
  });

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">

      {/* ═══ GREETING — Contextual, intelligent ═══ */}
      <div style={stagger(0)}>
        <p className="text-[11px] font-semibold tracking-wider mb-1" style={{ color: 'var(--nx-text-3)', letterSpacing: '0.15em' }}>
          مركز القيادة
        </p>
        <h1 className="text-[1.75rem] font-extrabold tracking-tight nx-gold-glow" style={{ color: 'var(--nx-text-1)' }}>
          {loading ? 'جاري تحميل البيانات...' : (
            s.totalTenants === 0
              ? 'المنصة جاهزة — في انتظار أول عميل'
              : `${s.totalTenants} صالون على منصتك`
          )}
        </h1>
      </div>

      {/* ═══ PULSE STRIP — Unified metrics ribbon ═══ */}
      <div className="nx-pulse-strip" style={stagger(1)}>
        <div className="nx-pulse-cell">
          <p className="text-[10px] font-semibold tracking-wide mb-2" style={{ color: 'var(--nx-text-3)' }}>إجمالي الصالونات</p>
          <div className="flex items-end justify-between">
            <span className="nx-metric-lg"><AnimatedNumber value={s.totalTenants} /></span>
            <Building2 size={18} style={{ color: 'var(--nx-accent)', opacity: 0.4 }} strokeWidth={1.4} />
          </div>
        </div>

        <div className="nx-pulse-cell">
          <p className="text-[10px] font-semibold tracking-wide mb-2" style={{ color: 'var(--nx-text-3)' }}>صالونات نشطة</p>
          <div className="flex items-end justify-between">
            <span className="nx-metric-lg" style={{ color: 'var(--nx-signal)' }}><AnimatedNumber value={s.activeTenants} /></span>
            <Users size={18} style={{ color: 'var(--nx-signal)', opacity: 0.35 }} strokeWidth={1.4} />
          </div>
        </div>

        <div className="nx-pulse-cell">
          <p className="text-[10px] font-semibold tracking-wide mb-2" style={{ color: 'var(--nx-text-3)' }}>إيرادات الشهر</p>
          <div className="flex items-end justify-between">
            <span className="nx-metric-lg nx-gold-text"><AnimatedNumber value={s.monthlyRevenue} suffix="ر.س" /></span>
            <Sparkline data={sparkData} color="#d4a853" />
          </div>
        </div>

        <div className="nx-pulse-cell">
          <p className="text-[10px] font-semibold tracking-wide mb-2" style={{ color: 'var(--nx-text-3)' }}>نمو هذا الشهر</p>
          <div className="flex items-end justify-between">
            <span className="nx-metric-lg"><AnimatedNumber value={s.newTenantsThisMonth} /></span>
            <TrendingUp size={18} style={{ color: 'var(--nx-gold)', opacity: 0.4 }} strokeWidth={1.4} />
          </div>
        </div>
      </div>

      {/* ═══ INTELLIGENCE + MOMENTUM — Two columns ═══ */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">

        {/* ── MOMENTUM LENS (7/12) ── */}
        <div className="lg:col-span-7 nx-glass" style={stagger(2)}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="nx-section-label mb-1">أحدث الأحداث</p>
                <h2 className="text-[15px] font-bold" style={{ color: 'var(--nx-text-1)' }}>
                  عدسة الزخم
                </h2>
              </div>
              <Link href="/tenants" className="flex items-center gap-1 text-[11px] font-semibold transition-colors hover:text-[var(--nx-gold)]"
                style={{ color: 'var(--nx-text-3)' }}
              >
                عرض الكل <ChevronLeft size={12} />
              </Link>
            </div>

            {s.recentTenants.length === 0 ? (
              /* Luxury empty state */
              <div className="flex flex-col items-center justify-center py-16">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
                  style={{ background: 'rgba(212,168,83,0.06)', border: '1px solid rgba(212,168,83,0.08)' }}
                >
                  <Eye size={24} style={{ color: 'var(--nx-gold)', opacity: 0.5 }} />
                </div>
                <p className="text-[14px] font-semibold mb-1" style={{ color: 'var(--nx-text-2)' }}>
                  لا توجد أحداث بعد
                </p>
                <p className="text-[12px]" style={{ color: 'var(--nx-text-3)' }}>
                  ستظهر هنا أحدث التسجيلات والنشاطات
                </p>
              </div>
            ) : (
              <div className="space-y-0">
                {s.recentTenants.slice(0, 6).map((t, i) => {
                  const statusColor = t.status === 'active' ? 'var(--nx-signal)' : t.status === 'pending' ? 'var(--nx-gold)' : 'var(--nx-danger)';
                  const statusLabel = t.status === 'active' ? 'نشط' : t.status === 'pending' ? 'بانتظار' : 'معلق';
                  return (
                    <Link key={t.id} href={`/tenants/${t.id}`} className="nx-momentum-item group">
                      <div className="nx-momentum-dot" style={{ background: statusColor, boxShadow: `0 0 8px ${statusColor}` }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold transition-colors group-hover:text-white" style={{ color: 'var(--nx-text-1)' }}>
                          {t.nameAr || t.nameEn}
                        </p>
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--nx-text-3)' }}>
                          {t.city || 'غير محدد'} · التسجيل {new Date(t.createdAt).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      <span className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold"
                        style={{ background: `${statusColor}15`, color: statusColor, border: `1px solid ${statusColor}20` }}
                      >
                        {statusLabel}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── INTELLIGENCE FEED (5/12) ── */}
        <div className="lg:col-span-5 space-y-4" style={stagger(3)}>

          <div>
            <p className="nx-section-label mb-1">ذكاء تشغيلي</p>
            <h2 className="text-[15px] font-bold" style={{ color: 'var(--nx-text-1)' }}>
              رؤى استراتيجية
            </h2>
          </div>

          <div className="space-y-3">
            {insights.map((insight) => {
              const Icon = insight.icon;
              const colorMap = {
                gold: 'var(--nx-gold)',
                signal: 'var(--nx-signal)',
                alert: 'var(--nx-alert)',
                accent: 'var(--nx-accent)',
              };
              const c = colorMap[insight.type];

              return (
                <div key={insight.id} className={`nx-insight nx-insight-${insight.type}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: `${c}10` }}
                    >
                      <Icon size={15} style={{ color: c }} strokeWidth={1.8} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold" style={{ color: 'var(--nx-text-1)' }}>
                        {insight.title}
                      </p>
                      <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: 'var(--nx-text-3)' }}>
                        {insight.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Plan Distribution */}
          {s.planDistribution.length > 0 && (
            <div className="nx-glass">
              <div className="p-5">
                <p className="nx-section-label mb-3">توزيع الباقات</p>
                <div className="space-y-3">
                  {s.planDistribution.map((p) => {
                    const total = s.planDistribution.reduce((sum, x) => sum + x.count, 0);
                    const pct = total > 0 ? Math.round((p.count / total) * 100) : 0;
                    return (
                      <div key={p.plan}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[12px] font-semibold" style={{ color: 'var(--nx-text-2)' }}>{p.plan}</span>
                          <span className="text-[12px] font-bold nx-tn" style={{ color: 'var(--nx-text-3)' }}>{p.count}</span>
                        </div>
                        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--nx-border)' }}>
                          <div
                            className="h-full rounded-full transition-all duration-1000"
                            style={{
                              width: ready ? `${pct}%` : '0%',
                              background: 'linear-gradient(90deg, var(--nx-gold), rgba(212,168,83,0.3))',
                              transitionDelay: '600ms',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ EMPIRE STATUS — Constellation / Quick actions ═══ */}
      <div className="nx-glass" style={stagger(4)}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="nx-section-label mb-1">نظرة شاملة</p>
              <h2 className="text-[15px] font-bold" style={{ color: 'var(--nx-text-1)' }}>
                الوصول السريع
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: 'إدارة الصالونات', icon: Building2, href: '/tenants', color: 'var(--nx-accent)' },
              { label: 'الاشتراكات', icon: DollarSign, href: '/subscriptions', color: 'var(--nx-gold)' },
              { label: 'الفواتير', icon: Zap, href: '/invoices', color: 'var(--nx-signal)' },
              { label: 'تقارير وتحليلات', icon: TrendingUp, href: '/analytics', color: 'var(--nx-alert)' },
              { label: 'إعدادات المنصة', icon: Shield, href: '/settings', color: 'var(--nx-accent)' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.label} href={item.href}
                  className="group flex items-center gap-3 rounded-2xl p-4 transition-all duration-400 hover:bg-white/[0.02]"
                  style={{ border: '1px solid var(--nx-border)' }}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-105"
                    style={{ background: `${item.color}08` }}
                  >
                    <Icon size={18} style={{ color: item.color, opacity: 0.6 }} strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold transition-colors group-hover:text-white"
                      style={{ color: 'var(--nx-text-2)' }}
                    >
                      {item.label}
                    </p>
                  </div>
                  <ArrowUpRight size={14} className="shrink-0 opacity-0 transition-all duration-300 group-hover:opacity-50 -translate-x-1 group-hover:translate-x-0"
                    style={{ color: item.color }}
                  />
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══ EMPTY EMPIRE — Premium state when no data ═══ */}
      {!loading && s.totalTenants === 0 && (
        <div className="nx-glass" style={stagger(5)}>
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-6 relative">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl"
                style={{
                  background: 'linear-gradient(135deg, rgba(212,168,83,0.08) 0%, rgba(212,168,83,0.02) 100%)',
                  border: '1px solid rgba(212,168,83,0.1)',
                }}
              >
                <Sparkles size={32} style={{ color: 'var(--nx-gold)', opacity: 0.5 }} />
              </div>
              <div className="absolute -inset-4 rounded-[28px] nx-animate-glow"
                style={{ background: 'radial-gradient(circle, rgba(212,168,83,0.06) 0%, transparent 70%)' }}
              />
            </div>
            <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--nx-text-1)' }}>
              إمبراطوريتك تنتظر
            </h3>
            <p className="text-[13px] max-w-sm leading-relaxed" style={{ color: 'var(--nx-text-3)' }}>
              المنصة جاهزة بالكامل. شارك رابط التسجيل وسيظهر كل صالون هنا لحظة تسجيله.
            </p>
            <div className="mt-8 flex gap-3">
              <a href="https://servi-x.com" target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-[13px] font-bold transition-all duration-300 hover:shadow-lg active:scale-[0.97]"
                style={{
                  background: 'linear-gradient(135deg, #d4a853, #c49a3f)',
                  color: '#04040a',
                  boxShadow: '0 4px 24px rgba(212,168,83,0.2)',
                }}
              >
                <Zap size={15} />
                صفحة الهبوط
              </a>
              <Link href="/tenants"
                className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-[13px] font-semibold transition-all duration-300"
                style={{
                  border: '1px solid var(--nx-border-hover)',
                  color: 'var(--nx-text-2)',
                  background: 'rgba(255,255,255,0.02)',
                }}
              >
                إدارة الصالونات
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
