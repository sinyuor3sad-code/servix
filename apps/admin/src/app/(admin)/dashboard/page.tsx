'use client';

import { useState, useEffect, useRef, type ReactElement } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { adminService, type AdminStats } from '@/services/admin.service';
import { SovereignCanvas } from '@/components/nexus/AmbientCanvas';

/* ═══════════════════════════════════════════════════════════════
   COUNTUP — Numbers emerge with purpose
   ═══════════════════════════════════════════════════════════════ */
function CountUp({ target, duration = 2000 }: { target: number; duration?: number }) {
  const [val, setVal] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (target === 0) { setVal(0); return; }
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      setVal(Math.round((1 - Math.pow(1 - t, 5)) * target));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return <>{val.toLocaleString('en-US')}</>;
}

/* ═══════════════════════════════════════════════════════════════
   METRIC ORB COMPONENT
   ═══════════════════════════════════════════════════════════════ */
function MetricOrb({ value, suffix, label, delay }: {
  value: number; suffix?: string; label: string; delay?: number;
}) {
  const r = 65; // radius
  const circumference = 2 * Math.PI * r;

  return (
    <div className="sv-orb">
      <div className="sv-orb-ring">
        <svg viewBox="0 0 140 140">
          <circle cx="70" cy="70" r={r} className="sv-orb-ring-bg" />
          <circle cx="70" cy="70" r={r} className="sv-orb-ring-progress"
            style={{ strokeDasharray: circumference, strokeDashoffset: circumference }}
          />
        </svg>
        <div className="sv-orb-glow" />
        <span className="sv-orb-value">
          <CountUp target={value} />
          {suffix && <span className="sv-orb-suffix">{suffix}</span>}
        </span>
      </div>
      <span className="sv-orb-label">{label}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   NEXUS PAGE — THE SOVEREIGN COMMAND SURFACE
   ═══════════════════════════════════════════════════════════════ */
export default function NexusPage(): ReactElement {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState('');
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    adminService.getStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    }));
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  const totalTenants = stats?.totalTenants ?? 0;
  const activeTenants = stats?.activeTenants ?? 0;
  const monthlyRevenue = stats?.monthlyRevenue ?? 0;

  // Letter-by-letter logo
  const logoLetters = 'SERVIX'.split('');

  // Status line text
  const statusText = loading
    ? 'جاري الاتصال بالأنظمة...'
    : totalTenants === 0
      ? 'النظام في حالة استعداد تام'
      : `${totalTenants} إقليم مسجل · ${activeTenants} نشط`;

  const statusCount = totalTenants === 0 ? '0 إقليم نشط' : `${activeTenants} إقليم نشط`;

  return (
    <>
      {/* THE LIVING CANVAS */}
      <SovereignCanvas />

      <div className="sv-chamber">

        {/* ════════════════════════════════════════════════════
            ZONE 1: SOVEREIGNTY — Identity + Status + Pulse
            ════════════════════════════════════════════════════ */}
        <section className="sv-sovereignty">
          {/* Concentric breathing rings */}
          <div className="sv-radial-pulse">
            <div className="sv-ring sv-ring-1" />
            <div className="sv-ring sv-ring-2" />
            <div className="sv-ring sv-ring-3" />
            <div className="sv-ring sv-ring-4" />
          </div>

          {/* SERVIX — letter-by-letter reveal */}
          <div className="sv-logo">
            <div className="sv-logo-text">
              {logoLetters.map((letter, i) => (
                <span
                  key={i}
                  className="sv-logo-letter"
                  style={{ animationDelay: `${0.1 + i * 0.12}s` }}
                >
                  {letter}
                </span>
              ))}
            </div>
          </div>

          {/* Subtitle */}
          <p className="sv-subtitle">مركز القيادة السيادي</p>

          {/* Command bar — slides in after 0.8s */}
          <div className="sv-command-bar">
            <span className="sv-cmd-dot" />
            <span className="sv-cmd-text">
              {statusText} — <strong>{statusCount}</strong>
            </span>
            <span className="sv-cmd-divider" />
            <span className="sv-cmd-time">{clock}</span>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════
            ZONE 2: INTELLIGENCE — Metric Orbs + Signal
            ════════════════════════════════════════════════════ */}
        <section className="sv-intelligence">
          {/* Three metric orbs */}
          <div className="sv-metric-cluster">
            <MetricOrb
              value={activeTenants}
              label="صالون نشط"
            />
            <MetricOrb
              value={monthlyRevenue}
              suffix="SAR"
              label="إيرادات الشهر"
            />
            <MetricOrb
              value={totalTenants}
              label="إجمالي الأقاليم"
            />
          </div>

          {/* Waiting for first signal */}
          {totalTenants === 0 && !loading && (
            <div className="sv-signal">
              <div className="sv-signal-line" />
              <span className="sv-signal-text">في انتظار الإشارة الأولى</span>
              <span className="sv-signal-dot" />
              <div className="sv-signal-line" style={{ transform: 'scaleX(-1)' }} />
            </div>
          )}
        </section>

        {/* ════════════════════════════════════════════════════
            ZONE 3: EXPANSION — Dormant Action Triggers
            ════════════════════════════════════════════════════ */}
        <section className="sv-expansion">
          <Link href="/tenants" className="sv-trigger">
            <span className="sv-trigger-dot" />
            <span className="sv-trigger-text">أضف أول إقليم</span>
          </Link>
          <Link href="/subscriptions" className="sv-trigger">
            <span className="sv-trigger-dot" />
            <span className="sv-trigger-text">هيّئ بنية الإيرادات</span>
          </Link>
          <Link href="/analytics" className="sv-trigger">
            <span className="sv-trigger-dot" />
            <span className="sv-trigger-text">فعّل الذكاء التشغيلي</span>
          </Link>
        </section>

      </div>
    </>
  );
}
