'use client';

import { useState, useEffect, useRef, type ReactElement } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { adminService, type AdminStats } from '@/services/admin.service';
import { AmbientCanvas } from '@/components/nexus/AmbientCanvas';
import {
  Building2,
  DollarSign,
  BarChart3,
  Shield,
  LogOut,
  Zap,
  AlertTriangle,
  TrendingUp,
  Clock,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   COUNTUP — Numbers that reveal themselves with authority
   ═══════════════════════════════════════════════════════════════ */
function CountUp({ target, duration = 1500 }: { target: number; duration?: number }) {
  const [val, setVal] = useState(0);
  const raf = useRef(0);

  useEffect(() => {
    if (target === 0) { setVal(0); return; }
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 5);
      setVal(Math.round(eased * target));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);

  return <>{val.toLocaleString('en-US')}</>;
}

/* ═══════════════════════════════════════════════════════════════
   INTERSECTION OBSERVER HOOK — Reveal on scroll
   ═══════════════════════════════════════════════════════════════ */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

/* ═══════════════════════════════════════════════════════════════
   INSIGHT GENERATOR
   ═══════════════════════════════════════════════════════════════ */
function generateInsights(stats: AdminStats | null) {
  const items: { key: string; color: string; icon: React.ElementType; text: string }[] = [];

  if (!stats || stats.totalTenants === 0) {
    items.push({
      key: 'ready',
      color: '#C9A84C',
      icon: Zap,
      text: 'المنصة في حالة <strong>استعداد كامل</strong> — البنية التحتية جاهزة لاستقبال أول صالون',
    });
    items.push({
      key: 'power',
      color: '#6366F1',
      icon: Shield,
      text: 'جميع الأنظمة <strong>تعمل بكفاءة قصوى</strong> — قاعدة البيانات، التخزين، والـ API',
    });
    items.push({
      key: 'launch',
      color: '#10B981',
      icon: TrendingUp,
      text: 'شارك <strong>رابط التسجيل</strong> مع عملائك لبدء استقبال الصالونات وتفعيل الإيرادات',
    });
    return items;
  }

  if (stats.pendingTenants > 0) {
    items.push({
      key: 'pending',
      color: '#F59E0B',
      icon: AlertTriangle,
      text: `<strong>${stats.pendingTenants} صالون</strong> بانتظار مراجعتك — التفعيل السريع يزيد التحويل`,
    });
  }

  if (stats.activeTenants > 0) {
    const rate = Math.round((stats.activeTenants / stats.totalTenants) * 100);
    items.push({
      key: 'active',
      color: rate >= 80 ? '#10B981' : '#EF4444',
      icon: TrendingUp,
      text: `معدل النشاط <strong>${rate}%</strong> — ${rate >= 80 ? 'أداء ممتاز' : 'يحتاج متابعة'}`,
    });
  }

  if (stats.monthlyRevenue > 0) {
    items.push({
      key: 'rev',
      color: '#C9A84C',
      icon: DollarSign,
      text: `إيرادات الشهر <strong>${stats.monthlyRevenue.toLocaleString('en-US')} ر.س</strong>`,
    });
  }

  if (stats.newTenantsThisMonth > 0) {
    items.push({
      key: 'growth',
      color: '#6366F1',
      icon: Zap,
      text: `<strong>${stats.newTenantsThisMonth} صالون جديد</strong> انضم هذا الشهر`,
    });
  }

  if (items.length === 0) {
    items.push({
      key: 'stable',
      color: '#10B981',
      icon: Shield,
      text: 'الوضع <strong>مستقر</strong> — لا توجد تنبيهات تتطلب اهتماماً',
    });
  }

  return items;
}

/* ═══════════════════════════════════════════════════════════════
   PORTAL DATA
   ═══════════════════════════════════════════════════════════ */
const PORTALS = [
  {
    id: 'tenants',
    name: 'الأقاليم',
    desc: 'إدارة جميع الصالونات المسجلة',
    href: '/tenants',
    icon: Building2,
    color: 'rgba(139,92,246,0.5)',
    bg: 'rgba(139,92,246,0.08)',
    iconColor: '#8B5CF6',
    metricKey: 'totalTenants' as const,
    metricLabel: 'صالون مسجل',
  },
  {
    id: 'revenue',
    name: 'الإيرادات',
    desc: 'الاشتراكات والمدفوعات والفواتير',
    href: '/subscriptions',
    icon: DollarSign,
    color: 'rgba(16,185,129,0.5)',
    bg: 'rgba(16,185,129,0.08)',
    iconColor: '#10B981',
    metricKey: 'totalSubscriptions' as const,
    metricLabel: 'اشتراك نشط',
  },
  {
    id: 'intelligence',
    name: 'الاستخبارات',
    desc: 'التحليلات والتقارير والنشاط',
    href: '/analytics',
    icon: BarChart3,
    color: 'rgba(99,102,241,0.5)',
    bg: 'rgba(99,102,241,0.08)',
    iconColor: '#6366F1',
    metricKey: 'planDistribution' as const,
    metricLabel: 'تحليل متاح',
  },
  {
    id: 'codex',
    name: 'البنية التحتية',
    desc: 'صحة النظام والإعدادات والسجلات',
    href: '/system',
    icon: Shield,
    color: 'rgba(201,168,76,0.5)',
    bg: 'rgba(201,168,76,0.08)',
    iconColor: '#C9A84C',
    metricKey: null,
    metricLabel: 'خدمة نشطة',
  },
];

/* ═══════════════════════════════════════════════════════════════
   NEXUS PAGE
   ═══════════════════════════════════════════════════════════════ */
export default function NexusPage(): ReactElement {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState('');
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const intelReveal = useReveal();
  const portalReveal = useReveal();

  useEffect(() => {
    adminService.getStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    }));
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  const totalTenants = stats?.totalTenants ?? 0;
  const activeTenants = stats?.activeTenants ?? 0;
  const monthlyRevenue = stats?.monthlyRevenue ?? 0;
  const insights = generateInsights(stats);

  const getPortalMetric = (key: string | null): number => {
    if (!key || !stats) return key === null ? 4 : 0;
    if (key === 'planDistribution') return stats.planDistribution?.length ?? 0;
    return (stats as Record<string, number>)[key] ?? 0;
  };

  return (
    <>
      {/* AMBIENT LIVING BACKGROUND */}
      <AmbientCanvas />

      {/* ══════════════════════════════════════════════════════
          HERO SCENE — The Throne Entrance
          ══════════════════════════════════════════════════════ */}
      <section className="nx-hero">
        {/* Orbital rings */}
        <div className="nx-orbital-ring" />
        <div className="nx-orbital-ring nx-orbital-ring-2" />

        {/* Logout button — top left */}
        <button
          onClick={logout}
          style={{
            position: 'absolute',
            top: 28,
            left: 28,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 8,
            borderRadius: 10,
            transition: 'all 0.3s',
            zIndex: 10,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
          title="تسجيل الخروج"
        >
          <LogOut size={16} strokeWidth={1.5} color="rgba(255,255,255,0.15)" />
        </button>

        {/* System Insignia */}
        <div className="nx-insignia" style={{ opacity: 0, animation: 'nx-title-enter 1s var(--os-ease) 0.1s forwards' }}>
          <div className="nx-insignia-ring" />
          <div className="nx-insignia-ring nx-insignia-ring-2" />
          <div className="nx-insignia-core">
            {user?.fullName?.charAt(0) || 'S'}
          </div>
        </div>

        {/* Title */}
        <h1 className="nx-hero-title">
          {user?.fullName || 'مركز القيادة'}
        </h1>
        <p className="nx-hero-subtitle">
          SERVIX COMMAND NEXUS
        </p>

        {/* System Status Beacon */}
        <div className="nx-hero-status">
          <span className="nx-status-dot" />
          <span className="nx-status-text">
            {loading ? 'جاري الاتصال...' : 'جميع الأنظمة تعمل'}
          </span>
          <span className="nx-status-time">{time}</span>
        </div>

        {/* Empire Metrics */}
        <div className="nx-metrics">
          <div className="nx-metric">
            <div className="nx-metric-value">
              <CountUp target={activeTenants} />
            </div>
            <div className="nx-metric-label">صالون نشط</div>
          </div>
          <div className="nx-metric">
            <div className="nx-metric-value">
              <CountUp target={monthlyRevenue} />
              <span className="nx-metric-suffix">SAR</span>
            </div>
            <div className="nx-metric-label">إيرادات الشهر</div>
          </div>
          <div className="nx-metric">
            <div className="nx-metric-value">
              <CountUp target={totalTenants} />
            </div>
            <div className="nx-metric-label">إجمالي الصالونات</div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="nx-scroll-hint">
          <div className="nx-scroll-line" />
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          COMMAND FIELD — Below the fold
          ══════════════════════════════════════════════════════ */}
      <div className="nx-command-field">

        {/* Intelligence Stream */}
        <div ref={intelReveal.ref} className={`nx-reveal ${intelReveal.visible ? 'visible' : ''}`}>
          <div className="nx-section-marker">
            <span className="nx-section-marker-text">استخبارات المنصة</span>
          </div>
          <div className="nx-intel-stream">
            {insights.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.key} className="nx-intel-item">
                  <div className="nx-intel-dot" style={{ background: item.color }} />
                  <Icon size={16} strokeWidth={1.5} style={{ color: item.color, flexShrink: 0, opacity: 0.7 }} />
                  <p className="nx-intel-text" dangerouslySetInnerHTML={{ __html: item.text }} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Territory Portals */}
        <div ref={portalReveal.ref} className={`nx-reveal ${portalReveal.visible ? 'visible' : ''}`}>
          <div className="nx-section-marker">
            <span className="nx-section-marker-text">مراكز القيادة</span>
          </div>
          <div className="nx-portals">
            {PORTALS.map((p) => {
              const Icon = p.icon;
              const metric = getPortalMetric(p.metricKey);
              return (
                <Link
                  key={p.id}
                  href={p.href}
                  className="nx-portal"
                  style={{
                    '--portal-color': p.color,
                    '--portal-bg': p.bg,
                  } as React.CSSProperties}
                >
                  <div className="nx-portal-icon" style={{ background: p.bg }}>
                    <Icon size={20} strokeWidth={1.5} style={{ color: p.iconColor }} />
                  </div>
                  <div className="nx-portal-name">{p.name}</div>
                  <div className="nx-portal-desc">{p.desc}</div>
                  <div className="nx-portal-metric">
                    {metric.toLocaleString('en-US')}
                  </div>
                  <div className="nx-portal-metric-label">{p.metricLabel}</div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
