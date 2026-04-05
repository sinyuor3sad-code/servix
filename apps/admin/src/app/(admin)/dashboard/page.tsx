'use client';

import { useState, useEffect, useRef, type ReactElement } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { adminService, type AdminStats } from '@/services/admin.service';
import { Fabric } from '@/components/nexus/AmbientCanvas';
import {
  Building2, DollarSign, BarChart3, Shield, Settings,
  LogOut, Zap, AlertTriangle, TrendingUp,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   COUNTUP — Numbers emerge from the void with purpose
   ═══════════════════════════════════════════════════════════════ */
function CountUp({ target, duration = 2000 }: { target: number; duration?: number }) {
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
   TEMPORAL INTELLIGENCE
   ═══════════════════════════════════════════════════════════════ */
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return 'مسيطر على الليل';
  if (h < 12) return 'صباح القيادة';
  if (h < 17) return 'ذروة التشغيل';
  if (h < 21) return 'فترة المراجعة';
  return 'الحراسة الليلية';
}

/* ═══════════════════════════════════════════════════════════════
   INSIGHT GENERATOR — Intelligence, not notifications
   ═══════════════════════════════════════════════════════════════ */
function generateInsights(stats: AdminStats | null) {
  const items: { key: string; color: string; text: string }[] = [];

  if (!stats || stats.totalTenants === 0) {
    items.push(
      { key: 'ready', color: '#b8993e', text: '<strong>جاهز للإطلاق</strong> — البنية التحتية مفعّلة بالكامل' },
      { key: 'power', color: '#6366F1', text: '<strong>الأنظمة الأساسية</strong> — قاعدة البيانات · الـ API · التخزين' },
      { key: 'await', color: '#10b981', text: '<strong>في انتظار</strong> أول صالون يدخل المنصة' },
    );
    return items;
  }

  if (stats.pendingTenants > 0) {
    items.push({ key: 'p', color: '#F59E0B', text: `<strong>${stats.pendingTenants}</strong> بانتظار التفعيل` });
  }
  if (stats.activeTenants > 0) {
    const r = Math.round((stats.activeTenants / stats.totalTenants) * 100);
    items.push({ key: 'a', color: r >= 80 ? '#10b981' : '#EF4444', text: `معدل النشاط <strong>${r}%</strong>` });
  }
  if (stats.monthlyRevenue > 0) {
    items.push({ key: 'r', color: '#b8993e', text: `إيرادات الشهر <strong>${stats.monthlyRevenue.toLocaleString('en-US')} SAR</strong>` });
  }
  if (stats.newTenantsThisMonth > 0) {
    items.push({ key: 'n', color: '#6366F1', text: `<strong>+${stats.newTenantsThisMonth}</strong> صالون جديد هذا الشهر` });
  }
  if (items.length === 0) {
    items.push({ key: 's', color: '#10b981', text: '<strong>مستقر</strong> — لا تنبيهات' });
  }
  return items;
}

/* ═══════════════════════════════════════════════════════════════
   TERRITORY PORTALS
   ═══════════════════════════════════════════════════════════════ */
const PORTALS = [
  { id: 'tenants',  name: 'الأقاليم',    href: '/tenants',       icon: Building2 },
  { id: 'revenue',  name: 'الإيرادات',   href: '/subscriptions', icon: DollarSign },
  { id: 'intel',    name: 'الاستخبارات', href: '/analytics',     icon: BarChart3 },
  { id: 'codex',    name: 'البنية',      href: '/system',        icon: Shield },
  { id: 'config',   name: 'الإعدادات',   href: '/settings',      icon: Settings },
];

/* ═══════════════════════════════════════════════════════════════
   NEXUS — THE SUPREME COMMAND SURFACE
   ═══════════════════════════════════════════════════════════════ */
export default function NexusPage(): ReactElement {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState('');
  const [date, setDate] = useState('');
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    adminService.getStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
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

  const totalTenants = stats?.totalTenants ?? 0;
  const activeTenants = stats?.activeTenants ?? 0;
  const monthlyRevenue = stats?.monthlyRevenue ?? 0;
  const totalSubs = stats?.totalSubscriptions ?? 0;
  const pendingTenants = stats?.pendingTenants ?? 0;
  const newThisMonth = stats?.newTenantsThisMonth ?? 0;
  const insights = generateInsights(stats);

  return (
    <>
      {/* THE LIVING FABRIC */}
      <Fabric />

      {/* THE VIEWPORT */}
      <div className="sv-viewport">

        {/* ── TIME ZONE ── */}
        <div className="sv-time">
          <div className="sv-time-clock">{clock}</div>
          <div className="sv-time-date">{date}</div>
          <div className="sv-time-greeting">{getGreeting()}</div>
        </div>

        {/* ── THE CROWN ── */}
        <div className="sv-crown">
          <h1 className="sv-crown-name">{user?.fullName || 'SERVIX'}</h1>
          <p className="sv-crown-title">
            {loading ? '— جاري الاتصال بالنظام —' : 'مركز القيادة السيادي'}
          </p>
        </div>

        {/* ── STATUS ZONE ── */}
        <div className="sv-status">
          <div className="sv-heartbeat">
            <span className="sv-heartbeat-dot" />
            <span className="sv-heartbeat-text">OPERATIONAL</span>
          </div>
          <span className="sv-uptime">UPTIME 99.9%</span>
          <button
            onClick={logout}
            style={{
              marginTop: 8, background: 'none', border: 'none', cursor: 'pointer',
              padding: 6, borderRadius: 6, transition: 'all 0.3s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
            title="تسجيل الخروج"
          >
            <LogOut size={14} strokeWidth={1.5} color="rgba(255,255,255,0.1)" />
          </button>
        </div>

        {/* ── LEFT RAIL ── */}
        <div className="sv-left">
          <div className="sv-data-point">
            <div className="sv-data-value"><CountUp target={totalSubs} /></div>
            <div className="sv-data-label">اشتراك نشط</div>
          </div>
          <div className="sv-data-point">
            <div className="sv-data-value"><CountUp target={pendingTenants} /></div>
            <div className="sv-data-label">بانتظار التفعيل</div>
          </div>
        </div>

        {/* ── THE CORE — Central metrics as environment ── */}
        <div className="sv-core">
          {/* Nerve line */}
          <div className="sv-nerve">
            <div className="sv-nerve-line">
              <div className="sv-nerve-pulse" />
            </div>
          </div>

          <div className="sv-core-metrics">
            <div className="sv-core-metric">
              <div className="sv-metric-num">
                <CountUp target={activeTenants} />
              </div>
              <div className="sv-metric-label">صالون نشط</div>
              {totalTenants === 0 && (
                <div className="sv-dormant-line">في انتظار الإطلاق</div>
              )}
            </div>

            <div className="sv-core-metric">
              <div className="sv-metric-num">
                <CountUp target={monthlyRevenue} />
                <span className="sv-metric-suffix">SAR</span>
              </div>
              <div className="sv-metric-label">إيرادات الشهر</div>
            </div>

            <div className="sv-core-metric">
              <div className="sv-metric-num">
                <CountUp target={totalTenants} />
              </div>
              <div className="sv-metric-label">إجمالي الأقاليم</div>
            </div>
          </div>
        </div>

        {/* ── RIGHT RAIL ── */}
        <div className="sv-right">
          <div className="sv-data-point">
            <div className="sv-data-value"><CountUp target={newThisMonth} /></div>
            <div className="sv-data-label">جديد هذا الشهر</div>
          </div>
          <div className="sv-data-point">
            <div className="sv-data-value">
              {stats?.planDistribution?.length ?? 0}
            </div>
            <div className="sv-data-label">باقة مفعّلة</div>
          </div>
        </div>

        {/* ── INTEL STREAM ── */}
        <div className="sv-intel">
          <div className="sv-intel-marker">استخبارات</div>
          {insights.map((item) => (
            <div key={item.key} className="sv-intel-item">
              <div className="sv-intel-bar" style={{ background: item.color }} />
              <p className="sv-intel-text" dangerouslySetInnerHTML={{ __html: item.text }} />
            </div>
          ))}
        </div>

        {/* ── GROUND — Territory portals ── */}
        <div className="sv-ground">
          {PORTALS.map((p) => {
            const Icon = p.icon;
            return (
              <Link key={p.id} href={p.href} className="sv-portal">
                <Icon size={18} strokeWidth={1.2} className="sv-portal-icon" />
                <span className="sv-portal-name">{p.name}</span>
              </Link>
            );
          })}
        </div>

        {/* ── NAV — Minimal bottom-right ── */}
        <div className="sv-nav">
          <Link href="/dashboard" className="sv-nav-item active">NEXUS</Link>
          <Link href="/audit-logs" className="sv-nav-item">LOG</Link>
          <Link href="/plans" className="sv-nav-item">PLANS</Link>
          <Link href="/features" className="sv-nav-item">FLAGS</Link>
        </div>

      </div>
    </>
  );
}
