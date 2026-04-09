'use client';

import { motion, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';
import { BarChart3, Calendar, DollarSign, Users } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

/* ─── Dashboard visual for the showcase ─── */
function DashboardVisual() {
  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl"
      style={{
        background: '#0A0A0A',
        border: '1px solid rgba(255,255,255,0.06)',
        aspectRatio: '16/9',
      }}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-6 py-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-black" style={{ color: 'var(--gold)' }}>SERVIX</span>
          <div className="flex gap-4">
            {['الرئيسية', 'المواعيد', 'العملاء', 'التقارير'].map((label, i) => (
              <span
                key={label}
                className="text-xs"
                style={{ color: i === 0 ? 'var(--fg)' : 'var(--fg-muted)' }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-full" style={{ background: 'rgba(200,169,126,0.15)', border: '1px solid rgba(200,169,126,0.2)' }} />
        </div>
      </div>

      {/* Main content area */}
      <div className="grid grid-cols-12 gap-3 p-4">
        {/* Sidebar */}
        <div className="col-span-2 space-y-2">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="rounded-lg py-2 px-2"
              style={{
                background: i === 0 ? 'rgba(200,169,126,0.08)' : 'transparent',
                borderRight: i === 0 ? '2px solid var(--gold)' : '2px solid transparent',
              }}
            >
              <div
                className="h-2 rounded-full"
                style={{
                  width: `${60 + Math.random() * 40}%`,
                  background: i === 0 ? 'var(--gold)' : 'rgba(255,255,255,0.06)',
                  opacity: i === 0 ? 0.5 : 1,
                }}
              />
            </div>
          ))}
        </div>

        {/* Main area */}
        <div className="col-span-10 space-y-3">
          {/* KPI row */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { value: '٤٢,٨٠٠', label: 'الإيرادات', trend: '+١٢٪' },
              { value: '١٨٤', label: 'المواعيد', trend: '+٧٪' },
              { value: '٩٣٪', label: 'رضا العملاء', trend: '+٣٪' },
              { value: '٤٧', label: 'عميلة جديدة', trend: '+١٥٪' },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-xl p-2.5"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
              >
                <div className="text-base font-black leading-none" style={{ color: 'var(--fg)' }}>{kpi.value}</div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[10px]" style={{ color: 'var(--fg-secondary)' }}>{kpi.label}</span>
                  <span className="text-[10px] font-semibold" style={{ color: '#4ade80' }}>{kpi.trend}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Chart area */}
          <div className="grid grid-cols-3 gap-2">
            <div
              className="col-span-2 rounded-xl p-3"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
            >
              <div className="text-[11px] font-semibold mb-2" style={{ color: 'var(--fg-secondary)' }}>إيرادات الشهر</div>
              <div className="flex items-end gap-1" style={{ height: 60 }}>
                {[0.3, 0.5, 0.4, 0.7, 0.6, 0.8, 0.75, 0.9, 0.85, 1.0, 0.7, 0.6].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-sm"
                    style={{
                      height: `${h * 100}%`,
                      background: i >= 8 ? 'var(--gold)' : 'rgba(200,169,126,0.2)',
                    }}
                  />
                ))}
              </div>
            </div>
            <div
              className="rounded-xl p-3"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
            >
              <div className="text-[11px] font-semibold mb-2" style={{ color: 'var(--fg-secondary)' }}>الخدمات الأكثر طلباً</div>
              <div className="space-y-1.5">
                {[
                  { name: 'قص وصبغ', pct: 85 },
                  { name: 'بروتين', pct: 65 },
                  { name: 'مانيكير', pct: 50 },
                  { name: 'سشوار', pct: 40 },
                ].map((s) => (
                  <div key={s.name}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px]" style={{ color: 'var(--fg-secondary)' }}>{s.name}</span>
                      <span className="text-[10px] font-semibold" style={{ color: 'var(--fg)' }}>{s.pct}٪</span>
                    </div>
                    <div className="h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: 'var(--gold)', opacity: 0.6 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Appointments table */}
          <div
            className="rounded-xl p-3"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
          >
            <div className="text-[11px] font-semibold mb-2" style={{ color: 'var(--fg-secondary)' }}>مواعيد اليوم</div>
            <div className="space-y-1">
              {[
                { name: 'سارة', time: '10:00', service: 'قص وصبغ', status: 'مؤكد' },
                { name: 'نورة', time: '11:30', service: 'بروتين', status: 'مؤكد' },
                { name: 'لولوة', time: '13:00', service: 'مانيكير', status: 'في الانتظار' },
              ].map((a) => (
                <div key={a.name} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                      style={{ background: 'rgba(200,169,126,0.1)', color: 'var(--gold)' }}>
                      {a.name.charAt(0)}
                    </div>
                    <span className="text-[11px]" style={{ color: 'var(--fg)' }}>{a.name}</span>
                  </div>
                  <span className="text-[10px]" style={{ color: 'var(--fg-secondary)' }}>{a.service}</span>
                  <span className="text-[10px]" style={{ color: 'var(--fg-secondary)' }}>{a.time}</span>
                  <span
                    className="text-[9px] rounded-full px-1.5 py-0.5"
                    style={{
                      background: a.status === 'مؤكد' ? 'rgba(74,222,128,0.1)' : 'rgba(251,191,36,0.1)',
                      color: a.status === 'مؤكد' ? '#4ade80' : '#fbbf24',
                    }}
                  >
                    {a.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Reflection overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.015) 0%, transparent 50%)', borderRadius: '1rem' }}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PRODUCT SHOWCASE
══════════════════════════════════════════════════════════════ */
export default function ProductShowcase(): React.ReactElement {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [40, -40]);
  const { t } = useI18n();

  const labels = [
    { icon: BarChart3, text: t('showcase.label2'), position: 'top-8 -start-4 sm:start-0' },
    { icon: Calendar,  text: t('showcase.label3'), position: 'top-1/3 -end-4 sm:end-0' },
    { icon: DollarSign, text: t('showcase.label4'), position: 'bottom-1/4 -start-4 sm:start-0' },
    { icon: Users,     text: t('showcase.label1'), position: 'bottom-8 -end-4 sm:end-0' },
  ];

  return (
    <section ref={ref} className="relative overflow-hidden py-24 sm:py-32">
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.8, ease: EASE }}
          className="mx-auto mb-16 max-w-2xl text-center"
        >
          <h2 className="text-4xl font-black tracking-tight sm:text-5xl" style={{ color: 'var(--fg)' }}>
            {t('showcase.title')}{' '}
            <span style={{ color: 'var(--gold)' }}>{t('showcase.titleAccent')}</span>
          </h2>
          <p className="mt-5 text-base leading-relaxed sm:text-lg" style={{ color: 'var(--fg-secondary)' }}>
            {t('showcase.subtitle')}
          </p>
        </motion.div>

        {/* Dashboard mockup with floating labels */}
        <motion.div
          style={{ y }}
          className="relative mx-auto max-w-5xl"
        >
          {/* Cinematic shadow */}
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.96 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 1, ease: EASE }}
            className="relative"
            style={{
              boxShadow: '0 60px 140px rgba(0,0,0,0.5), 0 20px 50px rgba(0,0,0,0.3)',
              borderRadius: '1rem',
            }}
          >
            <DashboardVisual />
          </motion.div>

          {/* Floating annotation labels */}
          {labels.map((label, i) => {
            const Icon = label.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: 0.3 + i * 0.12, ease: EASE }}
                className={`absolute hidden lg:flex items-center gap-2 rounded-xl px-4 py-2.5 ${label.position}`}
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                }}
              >
                <Icon className="h-4 w-4" style={{ color: 'var(--gold)' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>{label.text}</span>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
