'use client';

import { useState, useEffect, useRef, useCallback, type ReactElement } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { adminService, type AdminStats } from '@/services/admin.service';
import { Atmosphere } from '@/components/nexus/AmbientCanvas';
import {
  Building2, DollarSign, BarChart3, Shield, LogOut,
  Zap, TrendingUp, AlertTriangle, Sun, Moon,
  ChevronRight,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   NEXUS v9 — PLANETARY COMMAND HUD
   Everything visible in the first viewport.
   Metrics orbit SERVIX as satellite stations.
   No empty hero. No scrolling needed for the core experience.
   ═══════════════════════════════════════════════════════════════ */

function CountUp({ target, dur = 2200 }: { target: number; dur?: number }) {
  const [v, setV] = useState(0);
  const r = useRef(0);
  useEffect(() => {
    if (target === 0) { setV(0); return; }
    const s = performance.now();
    const tick = (n: number) => {
      const t = Math.min((n - s) / dur, 1);
      setV(Math.round((1 - Math.pow(1 - t, 5)) * target));
      if (t < 1) r.current = requestAnimationFrame(tick);
    };
    r.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(r.current);
  }, [target, dur]);
  return <>{v.toLocaleString('en-US')}</>;
}

/* ═══ ORBITAL STATION — a floating metric satellite ═══ */
function OrbitalStation({
  value, label, sub, color, icon: Icon, angle, radius, delay,
}: {
  value: number; label: string; sub: string; color: string;
  icon: typeof Building2; angle: number; radius: number; delay: number;
}) {
  return (
    <div
      className="nx-station"
      style={{
        '--station-x': `${Math.cos(angle) * radius}px`,
        '--station-y': `${Math.sin(angle) * radius}px`,
        '--station-color': color,
        '--station-delay': `${delay}s`,
      } as React.CSSProperties}
    >
      <div className="nx-station-ring">
        <svg viewBox="0 0 64 64" className="nx-station-svg">
          <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.1" />
          <circle cx="32" cy="32" r="28" fill="none" stroke={color} strokeWidth="1.5"
            strokeDasharray={`${28 * 2 * Math.PI}`}
            strokeDashoffset={`${28 * 2 * Math.PI * 0.75}`}
            strokeLinecap="round" style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
          />
        </svg>
        <div className="nx-station-icon">
          <Icon size={16} strokeWidth={1.5} style={{ color }} />
        </div>
      </div>
      <div className="nx-station-data">
        <div className="nx-station-value">
          <CountUp target={value} />
        </div>
        <div className="nx-station-label">{label}</div>
        <div className="nx-station-sub">{sub}</div>
      </div>
    </div>
  );
}

/* ═══ QUICK PORTAL — command surface entry point ═══ */
function QuickPortal({
  title, href, icon: Icon, color, stat,
}: {
  title: string; href: string; icon: typeof Building2; color: string; stat: number;
}) {
  return (
    <Link href={href} className="nx-qportal">
      <div className="nx-qportal-icon" style={{ background: `${color}12`, color }}>
        <Icon size={14} strokeWidth={1.5} />
      </div>
      <span className="nx-qportal-title">{title}</span>
      <span className="nx-qportal-stat">{stat}</span>
      <ChevronRight size={12} className="nx-qportal-arrow" />
    </Link>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
export default function NexusPage(): ReactElement {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState('');
  const [date, setDate] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    const saved = localStorage.getItem('nexus-theme');
    if (saved === 'light' || saved === 'dark') {
      setTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
    } else {
      const h = new Date().getHours();
      const auto = h >= 6 && h < 18 ? 'light' : 'dark';
      setTheme(auto);
      document.documentElement.setAttribute('data-theme', auto);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('nexus-theme', next);
  }, [theme]);

  useEffect(() => {
    adminService.getStats().then(setStats).catch((e) => console.error('Stats error:', e)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
      setDate(now.toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long' }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const active = stats?.activeTenants ?? 0;
  const total = stats?.totalTenants ?? 0;
  const rev = stats?.revenueThisMonth ?? 0;
  const subs = stats?.totalSubscriptions ?? 0;
  const pending = stats?.pendingTenants ?? 0;

  // Orbital stations — positioned around center
  const PI = Math.PI;
  const stationData = [
    { value: total, label: 'إجمالي الأقاليم', sub: total === 0 ? 'جاهز للإطلاق' : `+${stats?.newTenantsThisMonth ?? 0} هذا الشهر`, color: '#8B5CF6', icon: Building2, angle: -PI / 2 - 0.5, radius: 220 },
    { value: rev, label: 'إيرادات الشهر', sub: rev === 0 ? 'لم تبدأ بعد' : 'SAR', color: '#34D399', icon: DollarSign, angle: -PI / 2 + 0.5, radius: 220 },
    { value: active, label: 'صالون نشط', sub: total === 0 ? 'في الانتظار' : `من ${total}`, color: '#C9A84C', icon: TrendingUp, angle: PI / 2, radius: 200 },
  ];

  return (
    <>
      <Atmosphere />
      <div className="nx-page">

        {/* ═══════════════════════════════════════════
            THE COMMAND HUD — Single viewport
            ═══════════════════════════════════════════ */}
        <div className="nx-hud">

          {/* Top bar */}
          <div className="nx-topbar">
            <div className="nx-topbar-left">
              <button className="nx-ctrl-btn" onClick={toggleTheme} title={theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}>
                {theme === 'dark' ? <Sun size={14} strokeWidth={1.5} /> : <Moon size={14} strokeWidth={1.5} />}
              </button>
              <button className="nx-ctrl-btn nx-ctrl-danger" onClick={logout} title="تسجيل الخروج">
                <LogOut size={14} strokeWidth={1.5} />
              </button>
            </div>
            <div className="nx-topbar-center">
              <span className="nx-status-dot" />
              <span className="nx-status-text">
                {loading ? 'جاري الاتصال...' : total === 0 ? 'النظام في حالة استعداد تام' : `${active} صالون نشط`}
              </span>
            </div>
            <div className="nx-topbar-right">
              <span className="nx-topbar-date">{date}</span>
              <span className="nx-topbar-clock">{clock}</span>
            </div>
          </div>

          {/* Central core */}
          <div className="nx-core-zone">
            {/* CSS rings */}
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
                  <span key={i} className="nx-logo-char" style={{ animationDelay: `${0.2 + i * 0.08}s` }}>{ch}</span>
                ))}
              </div>
              <p className="nx-tagline">مركز القيادة السيادي</p>
            </div>

            {/* Orbital stations */}
            {stationData.map((s, i) => (
              <OrbitalStation key={i} {...s} delay={1.2 + i * 0.3} />
            ))}
          </div>

          {/* Bottom command strip */}
          <div className="nx-cmdstrip">
            {/* Intelligence line */}
            <div className="nx-intel-strip">
              {pending > 0 ? (
                <span className="nx-intel-item nx-intel-warn">
                  <AlertTriangle size={12} />
                  <strong>{pending}</strong> صالون بانتظار المراجعة
                </span>
              ) : (
                <span className="nx-intel-item">
                  <Shield size={12} />
                  <strong>مستقر</strong> — جميع الأنظمة تعمل
                </span>
              )}
            </div>

            {/* Quick portals */}
            <div className="nx-qportals">
              <QuickPortal title="الأقاليم" href="/tenants" icon={Building2} color="#8B5CF6" stat={total} />
              <QuickPortal title="الاشتراكات" href="/subscriptions" icon={DollarSign} color="#34D399" stat={subs} />
              <QuickPortal title="التحليلات" href="/analytics" icon={BarChart3} color="#6366F1" stat={stats?.planDistribution?.length ?? 0} />
              <QuickPortal title="النظام" href="/system" icon={Shield} color="#C9A84C" stat={stats?.activeSubscriptions ?? 0} />
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
