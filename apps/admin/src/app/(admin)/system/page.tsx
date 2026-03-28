'use client';

import { useState, type ReactElement } from 'react';
import {
  Activity, Server, Database, Cpu, HardDrive, MemoryStick, Clock,
  Wifi, WifiOff, AlertTriangle, CheckCircle, XCircle, Zap,
  RefreshCw, ToggleLeft, ToggleRight, Search, Timer,
} from 'lucide-react';
import { Glass, PageTitle, TN } from '@/components/ui/glass';

type Health = 'healthy' | 'warning' | 'critical' | 'offline';

const HEALTH_CFG: Record<Health, { label: string; dot: string; cls: string; icon: React.ElementType }> = {
  healthy:  { label: 'يعمل',   dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]',  cls: 'text-emerald-400', icon: CheckCircle },
  warning:  { label: 'تحذير',  dot: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]',    cls: 'text-amber-400',   icon: AlertTriangle },
  critical: { label: 'حرج',    dot: 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.7)]',     cls: 'text-red-400',     icon: XCircle },
  offline:  { label: 'متوقف',  dot: 'bg-white/20',                                            cls: 'text-white/30',    icon: WifiOff },
};

const SERVICES = [
  { name: 'NestJS API',        status: 'healthy' as Health, uptime: '99.98%', responseMs: 42,   version: 'v3.2.1' },
  { name: 'PostgreSQL',        status: 'healthy' as Health, uptime: '99.99%', responseMs: 8,    version: '17.2' },
  { name: 'Redis Cache',       status: 'healthy' as Health, uptime: '99.97%', responseMs: 2,    version: '8.0.1' },
  { name: 'Next.js Dashboard', status: 'healthy' as Health, uptime: '99.95%', responseMs: 120,  version: '15.5.13' },
  { name: 'Next.js Booking',   status: 'warning' as Health, uptime: '98.20%', responseMs: 450,  version: '15.5.13' },
  { name: 'BullMQ Workers',    status: 'healthy' as Health, uptime: '99.90%', responseMs: 15,   version: '5.4.0' },
  { name: 'WebSocket (io)',    status: 'healthy' as Health, uptime: '99.88%', responseMs: 5,    version: '4.8.3' },
  { name: 'S3 Storage',        status: 'healthy' as Health, uptime: '100%',   responseMs: 65,   version: 'R2' },
];

const RESOURCES = [
  { name: 'CPU',    value: 34, icon: Cpu,         unit: '%', color: 'from-emerald-500/40 to-emerald-500/10' },
  { name: 'Memory', value: 62, icon: MemoryStick, unit: '%', color: 'from-amber-500/40 to-amber-500/10' },
  { name: 'Disk',   value: 41, icon: HardDrive,   unit: '%', color: 'from-violet-500/40 to-violet-500/10' },
];

const ERRORS = [
  { time: '2026-03-26T10:02:14', level: 'warn',  service: 'Booking',    message: 'Slow query detected (>500ms) — GET /api/v1/booking/demo/services' },
  { time: '2026-03-26T09:45:00', level: 'error', service: 'BullMQ',     message: 'WhatsApp job failed — tenant salon-123: ECONNREFUSED' },
  { time: '2026-03-26T03:01:22', level: 'info',  service: 'PostgreSQL', message: 'Daily backup completed — 47 tenant DBs + platform (2.4GB)' },
  { time: '2026-03-25T22:30:10', level: 'warn',  service: 'Redis',      message: 'Memory usage above 70% threshold — current 72%' },
  { time: '2026-03-25T16:15:00', level: 'info',  service: 'API',        message: 'Deployment v3.2.1 completed — 0 downtime' },
];

const LEVEL_CFG: Record<string, string> = {
  info:  'bg-sky-500/10 text-sky-400 border-sky-500/15',
  warn:  'bg-amber-500/10 text-amber-400 border-amber-500/18',
  error: 'bg-red-500/8 text-red-400 border-red-500/15',
};

const FLAGS = [
  { key: 'maintenance_mode',    label: 'وضع الصيانة',         desc: 'تعطيل الوصول لجميع الصالونات', on: false, danger: true },
  { key: 'whatsapp_enabled',    label: 'واتساب بزنس',         desc: 'تفعيل إرسال الرسائل عبر واتساب',   on: true,  danger: false },
  { key: 'online_booking',      label: 'الحجز الإلكتروني',    desc: 'تفعيل صفحات الحجز العامة',         on: true,  danger: false },
  { key: 'new_registrations',   label: 'التسجيل الجديد',      desc: 'السماح بتسجيل صالونات جديدة',     on: true,  danger: false },
  { key: 'zatca_einvoice',      label: 'فوترة ZATCA',         desc: 'تفعيل الفوترة الإلكترونية',        on: false, danger: false },
  { key: 'ai_recommendations',  label: 'توصيات AI',           desc: 'تفعيل التوصيات الذكية للخدمات',    on: false, danger: false },
];

export default function SystemPage(): ReactElement {
  const [flags, setFlags] = useState(FLAGS.map(f => f.on));
  const toggleFlag = (i: number) => setFlags(prev => prev.map((v, idx) => idx === i ? !v : v));

  const healthyCount = SERVICES.filter(s => s.status === 'healthy').length;
  const avgResponse = Math.round(SERVICES.reduce((s, v) => s + v.responseMs, 0) / SERVICES.length);

  return (
    <div className="space-y-5">
      <PageTitle title="صحة النظام" desc="مراقبة جميع الخدمات والموارد في الوقت الفعلي">
        <button className="group inline-flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-5 py-2.5 text-[13px] font-semibold text-white/50 transition-all hover:border-amber-500/20 hover:text-amber-400">
          <RefreshCw size={14} className="transition-transform group-hover:rotate-180 duration-500" /> تحديث
        </button>
      </PageTitle>

      {/* ── Overview KPIs ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'الخدمات النشطة', value: `${healthyCount} / ${SERVICES.length}`, icon: Activity, color: 'text-emerald-400' },
          { label: 'متوسط الاستجابة', value: `${avgResponse}ms`, icon: Timer, color: 'text-amber-400' },
          { label: 'وقت التشغيل', value: '99.97%', icon: Clock, color: 'text-violet-400' },
          { label: 'آخر نشر', value: 'منذ 14 ساعة', icon: Zap, color: 'text-sky-400' },
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

      {/* ── Services + Resources ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">

        {/* Services grid */}
        <div className="lg:col-span-8 space-y-2">
          <h2 className="mb-3 text-[14px] font-bold text-white/60">حالة الخدمات</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SERVICES.map((svc) => {
              const h = HEALTH_CFG[svc.status];
              return (
                <Glass key={svc.name} hover>
                  <div className="flex items-center gap-4 px-5 py-4">
                    <span className={`flex h-2.5 w-2.5 rounded-full ${h.dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-white/75">{svc.name}</p>
                      <p className="text-[11px] text-white/25">{svc.version} · {svc.uptime} uptime</p>
                    </div>
                    <div className="text-end">
                      <p className={`text-[13px] font-bold ${h.cls}`} style={TN}>{svc.responseMs}ms</p>
                      <p className={`text-[10px] font-semibold ${h.cls}`}>{h.label}</p>
                    </div>
                  </div>
                </Glass>
              );
            })}
          </div>
        </div>

        {/* Resources */}
        <div className="lg:col-span-4">
          <h2 className="mb-3 text-[14px] font-bold text-white/60">استهلاك الموارد</h2>
          <Glass>
            <div className="space-y-6 p-6">
              {RESOURCES.map((r) => {
                const Icon = r.icon;
                const warn = r.value > 80;
                const mid  = r.value > 60;
                return (
                  <div key={r.name}>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-2 text-[13px] font-semibold text-white/55">
                        <Icon size={15} className="text-white/25" />{r.name}
                      </span>
                      <span className={`text-[14px] font-extrabold ${warn ? 'text-red-400' : mid ? 'text-amber-400' : 'text-emerald-400'}`} style={TN}>
                        {r.value}{r.unit}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.04]">
                      <div
                        className={`h-full rounded-full bg-gradient-to-l ${r.color} transition-all duration-700`}
                        style={{ width: `${r.value}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Glass>
        </div>
      </div>

      {/* ── Error Logs ── */}
      <div>
        <h2 className="mb-3 text-[14px] font-bold text-white/60">آخر الأحداث</h2>
        <Glass className="overflow-hidden">
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-white/[0.05]">
              {['المستوى', 'الخدمة', 'الرسالة', 'الوقت'].map((h, i) => (
                <th key={i} className="px-5 py-3.5 text-start text-[11px] font-bold tracking-widest text-white/20">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {ERRORS.map((e, i) => (
                <tr key={i} className={`transition-colors hover:bg-white/[0.015] ${i < ERRORS.length - 1 ? 'border-b border-white/[0.03]' : ''}`}>
                  <td className="px-5 py-3"><span className={`inline-flex rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${LEVEL_CFG[e.level]}`}>{e.level}</span></td>
                  <td className="px-5 py-3 font-semibold text-white/50">{e.service}</td>
                  <td className="px-5 py-3 text-white/40 max-w-md truncate" dir="ltr">{e.message}</td>
                  <td className="px-5 py-3 text-white/25 whitespace-nowrap" style={TN}>{new Date(e.time).toLocaleString('ar-SA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Glass>
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
