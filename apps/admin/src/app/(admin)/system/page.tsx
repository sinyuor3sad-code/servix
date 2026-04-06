'use client';

import { useState, useEffect, useCallback, type ReactElement } from 'react';
import {
  Activity, Server, Database, Clock, Shield,
  RefreshCw, CheckCircle, XCircle, Zap, Cpu, HardDrive,
} from 'lucide-react';
import { Glass, PageTitle, TN } from '@/components/ui/glass';
import { adminService } from '@/services/admin.service';

type Health = 'healthy' | 'warning' | 'critical' | 'offline' | 'checking';

const HEALTH: Record<Health, { label: string; badge: string }> = {
  healthy:  { label: 'يعمل',   badge: 'nx-badge--green' },
  warning:  { label: 'تحذير',  badge: 'nx-badge--amber' },
  critical: { label: 'حرج',    badge: 'nx-badge--red' },
  offline:  { label: 'متوقف',  badge: 'nx-badge--red' },
  checking: { label: 'فحص...', badge: 'nx-badge--blue' },
};

const FLAG_KEYS = [
  { key: 'maintenance_mode', label: 'وضع الصيانة', desc: 'تعطيل الوصول لجميع الصالونات', danger: true },
  { key: 'new_registrations', label: 'التسجيل الجديد', desc: 'السماح بتسجيل صالونات جديدة', danger: false },
  { key: 'online_booking', label: 'الحجز الإلكتروني', desc: 'تفعيل صفحات الحجز العامة', danger: false },
];

interface Service { name: string; status: Health; icon: typeof Server; }

interface HealthResponse {
  status: string;
  resources: { cpu: number; memory: number; disk: number; memoryTotal: string; memoryUsed: string; diskTotal: string; diskUsed: string; };
  uptime: { formatted: string; };
}

export default function SystemPage(): ReactElement {
  const [services, setServices] = useState<Service[]>([
    { name: 'NestJS API',  status: 'checking', icon: Server },
    { name: 'الداشبورد',   status: 'checking', icon: Database },
    { name: 'صفحة الحجز',  status: 'checking', icon: Zap },
    { name: 'صفحة الهبوط', status: 'checking', icon: Activity },
  ]);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [lastCheck, setLastCheck] = useState('');
  const [uptime, setUptime] = useState('—');
  const [resources, setResources] = useState([
    { label: 'CPU', value: 0, color: '#34D399', icon: Cpu, detail: '' },
    { label: 'ذاكرة', value: 0, color: '#6366F1', icon: Database, detail: '' },
    { label: 'تخزين', value: 0, color: '#C9A84C', icon: HardDrive, detail: '' },
  ]);
  const [flagsLoading, setFlagsLoading] = useState(false);

  const checkHealth = useCallback(async () => {
    setServices(prev => prev.map(s => ({ ...s, status: 'checking' as Health })));
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

    // API health check — uses actual health endpoint
    const checkApi = async (): Promise<{ status: Health; data: HealthResponse | null }> => {
      try {
        const res = await fetch(`${apiUrl}/health`, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return { status: 'warning', data: null };
        const json = await res.json();
        const data = json?.data ?? json;
        const s: Health = data?.status === 'healthy' ? 'healthy' : 'warning';
        return { status: s, data };
      } catch {
        return { status: 'offline', data: null };
      }
    };

    // External services — use no-cors HEAD
    const checkExternal = async (url: string): Promise<Health> => {
      try {
        await fetch(url, { method: 'HEAD', mode: 'no-cors', signal: AbortSignal.timeout(5000) });
        return 'healthy';
      } catch {
        return 'offline';
      }
    };

    const [apiResult, dashStatus, bookingStatus, landingStatus] = await Promise.all([
      checkApi(),
      checkExternal('https://app.servi-x.com'),
      checkExternal('https://booking.servi-x.com'),
      checkExternal('https://servi-x.com'),
    ]);

    setServices([
      { name: 'NestJS API', status: apiResult.status, icon: Server },
      { name: 'الداشبورد', status: dashStatus, icon: Database },
      { name: 'صفحة الحجز', status: bookingStatus, icon: Zap },
      { name: 'صفحة الهبوط', status: landingStatus, icon: Activity },
    ]);

    // Update real resource metrics from API response
    if (apiResult.data?.resources) {
      const r = apiResult.data.resources;
      setResources([
        { label: 'CPU', value: r.cpu, color: r.cpu > 80 ? '#EF4444' : r.cpu > 60 ? '#F59E0B' : '#34D399', icon: Cpu, detail: `${r.cpu}%` },
        { label: 'ذاكرة', value: r.memory, color: r.memory > 80 ? '#EF4444' : r.memory > 60 ? '#F59E0B' : '#6366F1', icon: Database, detail: `${r.memoryUsed} / ${r.memoryTotal}` },
        { label: 'تخزين', value: r.disk, color: r.disk > 80 ? '#EF4444' : r.disk > 60 ? '#F59E0B' : '#C9A84C', icon: HardDrive, detail: `${r.diskUsed} / ${r.diskTotal}` },
      ]);
    }

    if (apiResult.data?.uptime) {
      setUptime(apiResult.data.uptime.formatted);
    }

    setLastCheck(new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  }, []);

  // Load feature flags from settings API
  const loadFlags = useCallback(async () => {
    try {
      const settings = await adminService.getSettings();
      const flagState: Record<string, boolean> = {};
      for (const f of FLAG_KEYS) {
        flagState[f.key] = settings[f.key] === 'true';
      }
      setFlags(flagState);
    } catch {
      // If settings API fails, default to false
      const flagState: Record<string, boolean> = {};
      for (const f of FLAG_KEYS) {
        flagState[f.key] = false;
      }
      setFlags(flagState);
    }
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    checkHealth();
    loadFlags();
    const interval = setInterval(() => {
      checkHealth();
    }, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, [checkHealth, loadFlags]);

  const toggleFlag = async (key: string) => {
    const newValue = !flags[key];
    setFlags(prev => ({ ...prev, [key]: newValue }));
    setFlagsLoading(true);
    try {
      await adminService.updateSettings({ [key]: String(newValue) });
    } catch {
      // Revert on failure
      setFlags(prev => ({ ...prev, [key]: !newValue }));
    } finally {
      setFlagsLoading(false);
    }
  };

  const healthy = services.filter(s => s.status === 'healthy').length;

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

        {/* ── Resources (REAL data from API) ── */}
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
                    <div className="nx-progress-fill" style={{ width: `${r.value}%`, background: r.color, transition: 'width 0.6s ease' }} />
                  </div>
                  {r.detail && (
                    <div style={{ fontSize: 11, color: 'var(--ghost)', marginTop: 6, textAlign: 'left', direction: 'ltr', ...TN }}>
                      {r.detail}
                    </div>
                  )}
                </div>
              </Glass>
            );
          })}
        </div>
      </div>

      {/* ── Feature Flags (connected to Settings API) ── */}
      <Glass>
        <div style={{ padding: '20px 20px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate)' }}>Feature Flags</h3>
          {flagsLoading && <span style={{ fontSize: 11, color: 'var(--ghost)' }}>جاري الحفظ...</span>}
        </div>
        {FLAG_KEYS.map((f, i) => (
          <div key={f.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < FLAG_KEYS.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate)' }}>{f.label}</p>
              <p style={{ fontSize: 11, color: 'var(--ghost)', marginTop: 2 }}>{f.desc}</p>
            </div>
            <button
              onClick={() => toggleFlag(f.key)}
              className={`nx-toggle ${flags[f.key] ? 'nx-toggle--on' : ''} ${f.danger ? 'nx-toggle--danger' : ''}`}
            >
              <span className="nx-toggle-knob" />
            </button>
          </div>
        ))}
      </Glass>
    </div>
  );
}
