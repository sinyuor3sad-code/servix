'use client';

import { useState, useEffect, type ReactElement } from 'react';
import {
  Activity, Server, Database, Cpu, HardDrive, MemoryStick, Clock,
  Wifi, WifiOff, AlertTriangle, CheckCircle, XCircle, Zap,
  RefreshCw, Timer,
} from 'lucide-react';
import { Glass, PageTitle, TN } from '@/components/ui/glass';

type Health = 'healthy' | 'warning' | 'critical' | 'offline' | 'checking';

const HEALTH_CFG: Record<Health, { label: string; dot: string; cls: string }> = {
  healthy:  { label: 'يعمل',     dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]',  cls: 'text-emerald-400' },
  warning:  { label: 'تحذير',    dot: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]',    cls: 'text-amber-400' },
  critical: { label: 'حرج',      dot: 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.7)]',     cls: 'text-red-400' },
  offline:  { label: 'متوقف',    dot: 'bg-white/20',                                            cls: 'text-white/30' },
  checking: { label: 'فحص...',   dot: 'bg-white/20 animate-pulse',                              cls: 'text-white/30' },
};

interface ServiceCheck {
  name: string;
  status: Health;
  url?: string;
}

const FLAGS = [
  { key: 'maintenance_mode',    label: 'وضع الصيانة',         desc: 'تعطيل الوصول لجميع الصالونات', danger: true },
  { key: 'new_registrations',   label: 'التسجيل الجديد',      desc: 'السماح بتسجيل صالونات جديدة',     danger: false },
  { key: 'online_booking',      label: 'الحجز الإلكتروني',    desc: 'تفعيل صفحات الحجز العامة',         danger: false },
];

export default function SystemPage(): ReactElement {
  const [services, setServices] = useState<ServiceCheck[]>([
    { name: 'NestJS API',        status: 'checking', url: '/api/v1/health' },
    { name: 'الداشبورد',         status: 'checking' },
    { name: 'صفحة الحجز',        status: 'checking' },
    { name: 'صفحة الهبوط',       status: 'checking' },
  ]);
  const [flags, setFlags] = useState<boolean[]>(FLAGS.map(() => false));
  const [lastCheck, setLastCheck] = useState<string>('');

  const checkHealth = async () => {
    setServices(prev => prev.map(s => ({ ...s, status: 'checking' as Health })));

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
    const checks: { name: string; url: string }[] = [
      { name: 'NestJS API',        url: `${apiUrl}/health` },
      { name: 'الداشبورد',         url: 'https://app.servi-x.com' },
      { name: 'صفحة الحجز',        url: 'https://booking.servi-x.com' },
      { name: 'صفحة الهبوط',       url: 'https://servi-x.com' },
    ];

    const results = await Promise.all(checks.map(async (c) => {
      try {
        const res = await fetch(c.url, { method: 'HEAD', mode: 'no-cors', signal: AbortSignal.timeout(5000) });
        return { name: c.name, status: 'healthy' as Health };
      } catch {
        return { name: c.name, status: 'offline' as Health };
      }
    }));

    setServices(results);
    setLastCheck(new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  };

  useEffect(() => { checkHealth(); }, []);

  const toggleFlag = (i: number) => setFlags(prev => prev.map((v, idx) => idx === i ? !v : v));
  const healthyCount = services.filter(s => s.status === 'healthy').length;

  return (
    <div className="space-y-5">
      <PageTitle title="صحة النظام" desc="مراقبة جميع الخدمات والموارد في الوقت الفعلي">
        <button onClick={checkHealth} className="group inline-flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-5 py-2.5 text-[13px] font-semibold text-white/50 transition-all hover:border-amber-500/20 hover:text-amber-400">
          <RefreshCw size={14} className="transition-transform group-hover:rotate-180 duration-500" /> تحديث
        </button>
      </PageTitle>

      {/* ── Overview ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {[
          { label: 'الخدمات النشطة', value: `${healthyCount} / ${services.length}`, icon: Activity, color: 'text-emerald-400' },
          { label: 'آخر فحص', value: lastCheck || '—', icon: Clock, color: 'text-violet-400' },
          { label: 'البيئة', value: 'Production', icon: Server, color: 'text-amber-400' },
        ].map((k) => {
          const Icon = k.icon;
          return (
            <Glass key={k.label} hover>
              <div className="flex items-center gap-4 px-5 py-[18px]">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.025]">
                  <Icon size={18} className={`${k.color} opacity-75`} strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-white/25">{k.label}</p>
                  <p className={`text-lg font-extrabold ${k.color}`} style={TN}>{k.value}</p>
                </div>
              </div>
            </Glass>
          );
        })}
      </div>

      {/* ── Services ── */}
      <div>
        <h2 className="mb-3 text-[14px] font-bold text-white/60">حالة الخدمات</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {services.map((svc) => {
            const h = HEALTH_CFG[svc.status];
            return (
              <Glass key={svc.name} hover>
                <div className="flex items-center gap-4 px-5 py-4">
                  <span className={`flex h-2.5 w-2.5 rounded-full ${h.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-white/75">{svc.name}</p>
                  </div>
                  <p className={`text-[12px] font-bold ${h.cls}`}>{h.label}</p>
                </div>
              </Glass>
            );
          })}
        </div>
      </div>

      {/* ── Feature Flags ── */}
      <div>
        <h2 className="mb-3 text-[14px] font-bold text-white/60">Feature Flags</h2>
        <Glass>
          <div className="divide-y divide-white/[0.04]">
            {FLAGS.map((f, i) => (
              <div key={f.key} className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-white/[0.015]">
                <div>
                  <p className="text-[13px] font-bold text-white/70">{f.label}</p>
                  <p className="text-[11px] text-white/25">{f.desc}</p>
                </div>
                <button
                  onClick={() => toggleFlag(i)}
                  className={`relative flex h-7 w-12 items-center rounded-full border transition-all duration-300 ${
                    flags[i]
                      ? f.danger ? 'border-red-500/25 bg-red-500/15' : 'border-emerald-500/25 bg-emerald-500/15'
                      : 'border-white/[0.08] bg-white/[0.03]'
                  }`}
                >
                  <span className={`absolute h-5 w-5 rounded-full transition-all duration-300 ${
                    flags[i]
                      ? f.danger
                        ? 'left-[2px] bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]'
                        : 'left-[2px] bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'
                      : 'left-[calc(100%-22px)] bg-white/25'
                  }`} />
                </button>
              </div>
            ))}
          </div>
        </Glass>
      </div>
    </div>
  );
}
