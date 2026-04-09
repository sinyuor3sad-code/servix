'use client';

import Link from 'next/link';
import { motion, useScroll, useTransform } from 'motion/react';
import { ArrowLeft, ShieldCheck, Clock, CreditCard } from 'lucide-react';
import { useRef } from 'react';
import { useI18n } from '@/lib/i18n';

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3000';
const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

/* ─── Static Product Mockup ─── */
function ProductMockup() {
  const kpis = [
    { label: 'المواعيد', value: '١٨٤', color: '#C8A97E' },
    { label: 'الإيرادات', value: '٤٢,٨٠٠', color: '#C8A97E' },
    { label: 'الرضا', value: '٩٣٪', color: '#4ade80' },
  ];

  const appointments = [
    { name: 'سارة المطيري', service: 'قص وصبغ', time: '10:00', status: 'confirmed' },
    { name: 'نورة العتيبي', service: 'بروتين كيراتين', time: '11:30', status: 'confirmed' },
    { name: 'لولوة الشمري', service: 'مانيكير + بديكير', time: '13:00', status: 'pending' },
    { name: 'منى الدوسري', service: 'صبغة + سشوار', time: '14:30', status: 'confirmed' },
  ];

  const bars = [0.45, 0.62, 0.55, 0.78, 0.68, 0.88, 1.0];

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl"
      style={{
        background: '#0C0C0C',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 40px 100px rgba(0,0,0,0.6), 0 10px 30px rgba(0,0,0,0.4)',
        aspectRatio: '16/11',
        maxWidth: 560,
      }}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-black" style={{ color: 'var(--gold)' }}>SERVIX</span>
          <span className="text-[10px] font-medium" style={{ color: 'var(--fg-muted)' }}>لوحة التحكم</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: '#4ade80' }} />
          <span className="text-[10px]" style={{ color: 'var(--fg-muted)' }}>مباشر</span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 px-5 py-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-xl p-3 text-center"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}
          >
            <div className="text-xl font-black leading-none" style={{ color: k.color }}>{k.value}</div>
            <div className="mt-1.5 text-[10px]" style={{ color: 'var(--fg-muted)' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      <div className="px-5">
        <div className="text-[10px] font-semibold mb-2" style={{ color: 'var(--fg-muted)' }}>إيرادات الأسبوع</div>
        <div className="flex items-end gap-1.5" style={{ height: 48 }}>
          {bars.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-sm transition-all"
              style={{
                height: `${h * 100}%`,
                background: i === bars.length - 1
                  ? 'var(--gold)'
                  : 'rgba(200, 169, 126, 0.25)',
              }}
            />
          ))}
        </div>
      </div>

      {/* Appointments */}
      <div className="px-5 py-4">
        <div className="text-[10px] font-semibold mb-2" style={{ color: 'var(--fg-muted)' }}>مواعيد اليوم</div>
        <div className="space-y-1.5">
          {appointments.map((a) => (
            <div
              key={a.name}
              className="flex items-center justify-between rounded-lg px-3 py-2"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)' }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ background: 'rgba(200,169,126,0.12)', color: 'var(--gold)' }}
                >
                  {a.name.charAt(0)}
                </div>
                <div>
                  <div className="text-[11px] font-semibold" style={{ color: 'var(--fg)' }}>{a.name}</div>
                  <div className="text-[9px]" style={{ color: 'var(--fg-muted)' }}>{a.service}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium" style={{ color: 'var(--fg-secondary)' }}>{a.time}</span>
                <div
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: a.status === 'confirmed' ? '#4ade80' : '#fbbf24' }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Screen reflection */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, transparent 40%)',
          borderRadius: '1rem',
        }}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   HERO
══════════════════════════════════════════════════════════════ */
export default function Hero(): React.ReactElement {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const mockupY = useTransform(scrollYProgress, [0, 1], ['0%', '12%']);
  const opacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const { t } = useI18n();

  return (
    <section
      ref={ref}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden pt-28 pb-20"
    >
      {/* Subtle background glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 75% 25%, rgba(200,169,126,0.05) 0%, transparent 70%)',
        }}
      />

      <motion.div
        style={{ opacity }}
        className="relative z-10 w-full"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex flex-col items-center gap-16 lg:flex-row lg:items-center lg:justify-between">

            {/* ─ Text column ─ */}
            <div className="max-w-2xl text-center lg:text-start">

              {/* Tagline */}
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
                className="mb-6 text-sm font-medium tracking-wider uppercase"
                style={{ color: 'var(--gold)', letterSpacing: '0.12em' }}
              >
                {t('hero.tagline')}
              </motion.p>

              {/* Headline */}
              <motion.h1
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2, ease: EASE }}
                className="text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl xl:text-8xl"
                style={{ color: 'var(--fg)' }}
              >
                {t('hero.title1')}
                <br />
                <span style={{ color: 'var(--gold)' }}>{t('hero.titleAccent')}</span>
              </motion.h1>

              {/* Subtitle */}
              <motion.p
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.35, ease: EASE }}
                className="mt-6 max-w-lg text-base leading-relaxed sm:text-lg"
                style={{ color: 'var(--fg-secondary)' }}
              >
                {t('hero.subtitle')}
              </motion.p>

              {/* CTA */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5, ease: EASE }}
                className="mt-10 flex flex-col items-center gap-4 sm:flex-row lg:justify-start"
              >
                <Link
                  href={`${DASHBOARD_URL}/register`}
                  className="btn-gold group rounded-2xl px-10 py-4 text-base font-bold"
                >
                  {t('hero.cta')}
                  <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
                </Link>
              </motion.div>

              {/* Trust strip */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.7 }}
                className="mt-10 flex flex-wrap items-center justify-center gap-6 lg:justify-start"
              >
                {[
                  { icon: ShieldCheck, label: t('hero.trust1') },
                  { icon: Clock,       label: t('hero.trust2') },
                  { icon: CreditCard,  label: t('hero.trust3') },
                ].map(({ icon: Icon, label }, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs" style={{ color: 'var(--fg-muted)' }}>
                    <Icon className="h-3.5 w-3.5" style={{ color: 'var(--gold-dim)', opacity: 0.7 }} />
                    {label}
                  </div>
                ))}
              </motion.div>
            </div>

            {/* ─ Product mockup column ─ */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.4, ease: EASE }}
              style={{
                y: mockupY,
                perspective: '1200px',
              }}
              className="relative w-full max-w-xl lg:max-w-none lg:flex-1"
            >
              <div
                style={{
                  transform: 'perspective(1200px) rotateY(-6deg) rotateX(3deg)',
                  transformStyle: 'preserve-3d',
                }}
              >
                <ProductMockup />
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Bottom fade */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 inset-x-0 h-32"
        style={{ background: 'linear-gradient(to bottom, transparent, var(--bg))' }}
      />
    </section>
  );
}
