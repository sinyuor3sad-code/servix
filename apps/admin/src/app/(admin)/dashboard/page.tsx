'use client';

import { useState, useEffect, useRef, type ReactElement } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { adminService, type AdminStats } from '@/services/admin.service';
import { Atmosphere } from '@/components/nexus/AmbientCanvas';
import {
  Building2, DollarSign, BarChart3, Shield, LogOut,
  Zap, TrendingUp, AlertTriangle, ChevronDown,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════ */
function CountUp({ target, duration = 2200 }: { target: number; duration?: number }) {
  const [v, setV] = useState(0);
  const r = useRef(0);
  useEffect(() => {
    if (target === 0) { setV(0); return; }
    const s = performance.now();
    const tick = (n: number) => {
      const t = Math.min((n - s) / duration, 1);
      setV(Math.round((1 - Math.pow(1 - t, 5)) * target));
      if (t < 1) r.current = requestAnimationFrame(tick);
    };
    r.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(r.current);
  }, [target, duration]);
  return <>{v.toLocaleString('en-US')}</>;
}

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVis(true); }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, className: `nx-reveal ${vis ? 'visible' : ''}` };
}

/* ═══════════════════════════════════════════════════════════════ */
function buildInsights(stats: AdminStats | null) {
  type I = { key: string; color: string; icon: typeof Zap; text: string };
  const r: I[] = [];
  if (!stats || stats.totalTenants === 0) {
    r.push(
      { key: 'r', color: '#C9A84C', icon: Zap, text: 'المنصة في حالة <strong>استعداد تام</strong> — البنية التحتية جاهزة للإطلاق' },
      { key: 's', color: '#6366F1', icon: Shield, text: 'جميع الأنظمة <strong>تعمل بكفاءة</strong> — API · قاعدة البيانات · التخزين' },
      { key: 'g', color: '#34D399', icon: TrendingUp, text: 'شارك <strong>رابط التسجيل</strong> لاستقبال أول صالون وبدء الإيرادات' },
    );
    return r;
  }
  if (stats.pendingTenants > 0) r.push({ key: 'p', color: '#F59E0B', icon: AlertTriangle, text: `<strong>${stats.pendingTenants}</strong> صالون بانتظار المراجعة` });
  const rate = stats.totalTenants > 0 ? Math.round((stats.activeTenants / stats.totalTenants) * 100) : 0;
  if (rate > 0) r.push({ key: 'a', color: rate >= 80 ? '#34D399' : '#EF4444', icon: TrendingUp, text: `معدل النشاط <strong>${rate}%</strong> — ${rate >= 80 ? 'ممتاز' : 'يحتاج متابعة'}` });
  if (stats.monthlyRevenue > 0) r.push({ key: 're', color: '#C9A84C', icon: DollarSign, text: `إيرادات الشهر <strong>${stats.monthlyRevenue.toLocaleString('en-US')} SAR</strong>` });
  if (r.length === 0) r.push({ key: 'ok', color: '#34D399', icon: Shield, text: '<strong>مستقر</strong> — لا تنبيهات حرجة' });
  return r;
}

const PORTALS = [
  { id: 'tenants', title: 'الأقاليم', desc: 'إدارة الصالونات المسجلة', href: '/tenants', icon: Building2, color: 'rgba(139,92,246,0.5)', bg: 'rgba(139,92,246,0.08)', iconColor: '#8B5CF6', metricKey: 'totalTenants' as const, metricLabel: 'صالون' },
  { id: 'revenue', title: 'الإيرادات', desc: 'الاشتراكات والمدفوعات', href: '/subscriptions', icon: DollarSign, color: 'rgba(52,211,153,0.5)', bg: 'rgba(52,211,153,0.08)', iconColor: '#34D399', metricKey: 'totalSubscriptions' as const, metricLabel: 'اشتراك' },
  { id: 'intel', title: 'الاستخبارات', desc: 'التحليلات والنشاط والتقارير', href: '/analytics', icon: BarChart3, color: 'rgba(99,102,241,0.5)', bg: 'rgba(99,102,241,0.08)', iconColor: '#6366F1', metricKey: 'planDistribution' as const, metricLabel: 'تحليل' },
  { id: 'codex', title: 'البنية التحتية', desc: 'صحة النظام والإعدادات', href: '/system', icon: Shield, color: 'rgba(201,168,76,0.5)', bg: 'rgba(201,168,76,0.08)', iconColor: '#C9A84C', metricKey: null, metricLabel: 'خدمة' },
];

/* ═══════════════════════════════════════════════════════════════
   THE PAGE
   ═══════════════════════════════════════════════════════════════ */
export default function NexusPage(): ReactElement {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState('');
  const [date, setDate] = useState('');
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const metricsReveal = useReveal();
  const intelReveal = useReveal();
  const portalReveal = useReveal();
  const triggerReveal = useReveal();

  useEffect(() => {
    adminService.getStats().then(setStats).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }));
      setDate(now.toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long' }));
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  const total = stats?.totalTenants ?? 0;
  const active = stats?.activeTenants ?? 0;
  const rev = stats?.monthlyRevenue ?? 0;
  const insights = buildInsights(stats);

  const getPortalMetric = (key: string | null) => {
    if (!key || !stats) return key === null ? 4 : 0;
    if (key === 'planDistribution') return stats.planDistribution?.length ?? 0;
    return (stats as Record<string, number>)[key] ?? 0;
  };

  const r = 54;
  const circ = 2 * Math.PI * r;

  const orbData = [
    { value: active, suffix: '', label: 'صالون نشط', sub: total === 0 ? 'في الانتظار' : `من ${total}`, color: '#8B5CF6', dashoffset: total > 0 ? circ * (1 - active / Math.max(total, 1)) : circ },
    { value: rev, suffix: 'SAR', label: 'إيرادات الشهر', sub: rev === 0 ? 'لم تبدأ بعد' : '', color: '#34D399', dashoffset: circ },
    { value: total, suffix: '', label: 'إجمالي الأقاليم', sub: total === 0 ? 'جاهز للإطلاق' : `+${stats?.newTenantsThisMonth ?? 0} هذا الشهر`, color: '#C9A84C', dashoffset: circ * 0.85 },
  ];

  return (
    <>
      <Atmosphere />
      <div className="nx-page">

        {/* ═══════════════════════════════════════════════════
            ACT I — THE OVERTURE
            ═══════════════════════════════════════════════════ */}
        <section className="nx-overture">
          {/* Rings */}
          <div className="nx-rings">
            <div className="nx-ring nx-ring--1" />
            <div className="nx-ring nx-ring--2" />
            <div className="nx-ring nx-ring--3" />
            <div className="nx-ring nx-ring--4" />
          </div>

          {/* Brand */}
          <div className="nx-brand">
            <div className="nx-logo">
              {'SERVIX'.split('').map((ch, i) => (
                <span key={i} className="nx-logo-char" style={{ animationDelay: `${0.15 + i * 0.1}s` }}>{ch}</span>
              ))}
            </div>
            <p className="nx-tagline">مركز القيادة السيادي</p>
          </div>

          {/* Status beacon */}
          <div className="nx-beacon">
            <span className="nx-beacon-dot" />
            <span className="nx-beacon-text">
              {loading ? 'جاري الاتصال...' : total === 0 ? 'النظام في حالة استعداد تام' : `${active} صالون نشط`}
            </span>
            <span className="nx-beacon-sep" />
            <span className="nx-beacon-time">{clock}</span>
          </div>

          {/* Corner time */}
          <div className="nx-corner-time">
            <div className="nx-corner-clock">{clock}</div>
            <div className="nx-corner-date">{date}</div>
          </div>

          {/* Corner exit */}
          <div className="nx-corner-exit">
            <button className="nx-exit-btn" onClick={logout} title="تسجيل الخروج">
              <LogOut size={16} strokeWidth={1.5} />
            </button>
          </div>

          {/* Scroll cue */}
          <div className="nx-scroll-cue">
            <span>التحكم</span>
            <div className="nx-scroll-line" />
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════
            ACT II — THE COMMAND SURFACE
            ═══════════════════════════════════════════════════ */}
        <div className="nx-command">

          {/* ── METRICS ── */}
          <div ref={metricsReveal.ref} className={metricsReveal.className}>
            <div className="nx-section-label"><span>مقاييس الإمبراطورية</span></div>
            <div className="nx-metrics-row">
              {orbData.map((orb, i) => (
                <div key={i} className="nx-orb-card">
                  <div className="nx-orb-svg">
                    <svg viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r={r} className="nx-orb-svg-bg" />
                      <circle cx="60" cy="60" r={r}
                        className="nx-orb-svg-ring"
                        style={{
                          stroke: orb.color,
                          strokeDasharray: circ,
                          strokeDashoffset: orb.dashoffset,
                          opacity: 0.25,
                        }}
                      />
                    </svg>
                    <div className="nx-orb-svg-glow" style={{ background: `radial-gradient(circle, ${orb.color}15, transparent 70%)` }} />
                    <div className="nx-orb-num">
                      <CountUp target={orb.value} />
                      {orb.suffix && <span className="nx-orb-suffix">{orb.suffix}</span>}
                    </div>
                  </div>
                  <div className="nx-orb-label">{orb.label}</div>
                  <div className="nx-orb-sub">{orb.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── INTELLIGENCE ── */}
          <div ref={intelReveal.ref} className={intelReveal.className}>
            <div className="nx-section-label"><span>استخبارات المنصة</span></div>
            <div className="nx-intel-row">
              {insights.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.key} className="nx-intel-line">
                    <div className="nx-intel-bar" style={{ background: item.color }} />
                    <Icon size={15} strokeWidth={1.5} style={{ color: item.color, opacity: 0.6, flexShrink: 0 }} />
                    <p className="nx-intel-msg" dangerouslySetInnerHTML={{ __html: item.text }} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── PORTALS ── */}
          <div ref={portalReveal.ref} className={portalReveal.className}>
            <div className="nx-section-label"><span>مراكز القيادة</span></div>
            <div className="nx-portals">
              {PORTALS.map((p) => {
                const Icon = p.icon;
                const metric = getPortalMetric(p.metricKey);
                return (
                  <Link key={p.id} href={p.href} className="nx-portal" style={{ '--portal-accent': p.color } as React.CSSProperties}>
                    <div className="nx-portal-icon" style={{ background: p.bg }}>
                      <Icon size={18} strokeWidth={1.5} style={{ color: p.iconColor }} />
                    </div>
                    <div className="nx-portal-title">{p.title}</div>
                    <div className="nx-portal-desc">{p.desc}</div>
                    <div className="nx-portal-stat">{metric.toLocaleString('en-US')}</div>
                    <div className="nx-portal-stat-label">{p.metricLabel}</div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* ── TRIGGERS ── */}
          <div ref={triggerReveal.ref} className={triggerReveal.className}>
            <div className="nx-triggers">
              <Link href="/tenants" className="nx-trigger">
                <span className="nx-trigger-dot" />
                <span className="nx-trigger-text">أضف أول إقليم</span>
              </Link>
              <Link href="/subscriptions" className="nx-trigger">
                <span className="nx-trigger-dot" />
                <span className="nx-trigger-text">هيّئ بنية الإيرادات</span>
              </Link>
              <Link href="/analytics" className="nx-trigger">
                <span className="nx-trigger-dot" />
                <span className="nx-trigger-text">فعّل الذكاء التشغيلي</span>
              </Link>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
