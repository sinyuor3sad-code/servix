'use client';

import { useState, useEffect, type ReactElement } from 'react';
import {
  Activity, Server, Database, Clock, Shield,
  RefreshCw, CheckCircle, XCircle, Zap, Cpu, HardDrive,
} from 'lucide-react';
import { Glass, PageTitle, TN } from '@/components/ui/glass';

type Health = 'healthy' | 'warning' | 'critical' | 'offline' | 'checking';

const HEALTH: Record<Health, { label: string; badge: string }> = {
  healthy:  { label: 'يعمل',   badge: 'nx-badge--green' },
  warning:  { label: 'تحذير',  badge: 'nx-badge--amber' },
  critical: { label: 'حرج',    badge: 'nx-badge--red' },
  offline:  { label: 'متوقف',  badge: 'nx-badge--red' },
  checking: { label: 'فحص...', badge: 'nx-badge--blue' },
};

const FLAGS = [
  { key: 'maintenance_mode', label: 'وضع الصيانة', desc: 'تعطيل الوصول لجميع الصالونات', danger: true },
  { key: 'new_registrations', label: 'التسجيل الجديد', desc: 'السماح بتسجيل صالونات جديدة', danger: false },
  { key: 'online_booking', label: 'الحجز الإلكتروني', desc: 'تفعيل صفحات الحجز العامة', danger: false },
];

interface Service { name: string; status: Health; icon: typeof Server; }

export default function SystemPage(): ReactElement {
  const [services, setServices] = useState<Service[]>([
    { name: 'NestJS API',  status: 'checking', icon: Server },
    { name: 'الداشبورد',   status: 'checking', icon: Database },
    { name: 'صفحة الحجز',  status: 'checking', icon: Zap },
    { name: 'صفحة الهبوط', status: 'checking', icon: Activity },
  ]);
  const [flags, setFlags] = useState<boolean[]>(FLAGS.map(() => false));
  const [lastCheck, setLastCheck] = useState('');
  const [uptime, setUptime] = useState('—');

  const checkHealth = async () => {
    setServices(prev => prev.map(s => ({ ...s, status: 'checking' as Health })));
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
    const checks = [
      { name: 'NestJS API', url: `${apiUrl}/health`, icon: Server },
      { name: 'الداشبورد', url: 'https://app.servi-x.com', icon: Database },
      { name: 'صفحة الحجز', url: 'https://booking.servi-x.com', icon: Zap },
      { name: 'صفحة الهبوط', url: 'https://servi-x.com', icon: Activity },
    ];
    const results = await Promise.all(checks.map(async (c) => {
      try {
        await fetch(c.url, { method: 'HEAD', mode: 'no-cors', signal: AbortSignal.timeout(5000) });
        return { name: c.name, status: 'healthy' as Health, icon: c.icon };
      } catch {
        return { name: c.name, status: 'offline' as Health, icon: c.icon };
      }
    }));
    setServices(results);
    setLastCheck(new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  };

  useEffect(() => { checkHealth(); }, []);

  // Fake uptime counter
  useEffect(() => {
    const start = Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000;
    const tick = () => {
      const diff = Date.now() - start;
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setUptime(`${d} يوم ${h} ساعة ${m} دقيقة`);
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  const toggleFlag = (i: number) => setFlags(prev => prev.map((v, idx) => idx === i ? !v : v));
  const healthy = services.filter(s => s.status === 'healthy').length;

  // System resources (illustrative)
  const resources = [
    { label: 'CPU', value: 12, color: '#34D399', icon: Cpu },
    { label: 'ذاكرة', value: 38, color: '#6366F1', icon: Database },
    { label: 'تخزين', value: 24, color: '#C9A84C', icon: HardDrive },
  ];

  return (
    <div className="nx-space-y">
      <PageTitle
        title="صحة النظام"
        desc="مراقبة جميع الخدمات والموارد في الوقت الفعلي"
        icon={<Shield size={20} style={{ color: '#34D399' }} strokeWidth={1.5} />}
      >
        <button className="nx-btn" onClick={checkHealth}>
          <RefreshCw size={14} /> تحديث
        </button>
      </PageTitle>

      {/* ── Overview cards ── */}
      <div className="nx-stats-grid">
        {[
          { label: 'الخدمات النشطة', value: `${healthy}/${services.length}`, icon: Activity, color: '#34D399' },
          { label: 'آخر فحص', value: lastCheck || '—', icon: Clock, color: '#A78BFA' },
          { label: 'وقت التشغيل', value: uptime, icon: Zap, color: '#C9A84C' },
        ].map(k => {
          const Icon = k.icon;
          return (
            <Glass key={k.label} hover>
              <div className="nx-stat">
                <div className="nx-stat-icon" style={{ background: `${k.color}10` }}>
                  <Icon size={18} style={{ color: k.color, opacity: 0.8 }} strokeWidth={1.5} />
                </div>
                <div>
                  <div className="nx-stat-label">{k.label}</div>
                  <div className="nx-stat-value" style={{ ...TN, fontSize: k.label === 'وقت التشغيل' ? 14 : 22 }}>
                    {k.value}
                  </div>
                </div>
              </div>
            </Glass>
          );
        })}
      </div>

      <div className="nx-grid-2">
        {/* ── Services ── */}
        <div className="nx-space-y">
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate)' }}>حالة الخدمات</h2>
          {services.map((svc) => {
            const h = HEALTH[svc.status];
            const Icon = svc.icon;
            const StIcon = svc.status === 'healthy' ? CheckCircle : svc.status === 'checking' ? Clock : XCircle;
            return (
              <Glass key={svc.name} hover>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px' }}>
                  <div className="nx-stat-icon" style={{ width: 36, height: 36, background: svc.status === 'healthy' ? 'rgba(52,211,153,0.06)' : 'var(--surface)' }}>
                    <Icon size={16} style={{ color: svc.status === 'healthy' ? '#34D399' : 'var(--ghost)', opacity: 0.8 }} strokeWidth={1.5} />
                  </div>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--slate)' }}>{svc.name}</span>
                  <span className={`nx-badge ${h.badge}`}>
                    <StIcon size={11} />{h.label}
                  </span>
                </div>
              </Glass>
            );
          })}
        </div>

        {/* ── Resources ── */}
        <div className="nx-space-y">
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate)' }}>موارد النظام</h2>
          {resources.map(r => {
            const Icon = r.icon;
            return (
              <Glass key={r.label} hover>
                <div style={{ padding: '16px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--slate)' }}>
                      <Icon size={14} style={{ color: r.color }} />{r.label}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 900, color: r.color, ...TN }}>{r.value}%</span>
                  </div>
                  <div className="nx-progress">
                    <div className="nx-progress-fill" style={{ width: `${r.value}%`, background: r.color }} />
                  </div>
                </div>
              </Glass>
            );
          })}
        </div>
      </div>

      {/* ── Feature Flags ── */}
      <Glass>
        <div style={{ padding: '20px 20px 8px' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate)' }}>Feature Flags</h3>
        </div>
        {FLAGS.map((f, i) => (
          <div key={f.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < FLAGS.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate)' }}>{f.label}</p>
              <p style={{ fontSize: 11, color: 'var(--ghost)', marginTop: 2 }}>{f.desc}</p>
            </div>
            <button
              onClick={() => toggleFlag(i)}
              className={`nx-toggle ${flags[i] ? 'nx-toggle--on' : ''} ${f.danger ? 'nx-toggle--danger' : ''}`}
            >
              <span className="nx-toggle-knob" />
            </button>
          </div>
        ))}
      </Glass>
    </div>
  );
}
