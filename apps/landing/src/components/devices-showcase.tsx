'use client';

import { motion, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';
import { Monitor, Tablet, Smartphone } from 'lucide-react';

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

/* ─── Shared mini dashboard screen content ─── */
function ScreenContent({ scale = 1 }: { scale?: number }) {
  const kpis = [
    { label: 'المواعيد', value: '١٨', color: '#a855f7' },
    { label: 'الإيرادات', value: '٤٢٠٠', color: '#22d3ee' },
    { label: 'الرضا', value: '٩٨٪', color: '#4ade80' },
  ];

  return (
    <div
      className="h-full w-full overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #07051a 0%, #0d0b24 100%)',
        fontFamily: 'Cairo, system-ui, sans-serif',
        direction: 'rtl',
        transform: `scale(${scale})`,
        transformOrigin: 'top center',
      }}
    >
      {/* Fake top bar */}
      <div
        className="flex items-center gap-1.5 px-2 py-1.5"
        style={{ background: 'rgba(168,85,247,0.08)', borderBottom: '1px solid rgba(168,85,247,0.12)' }}
      >
        <div className="h-1.5 w-1.5 rounded-full bg-violet-500" style={{ boxShadow: '0 0 4px #a855f7' }} />
        <span style={{ fontSize: 5 * scale + 'px', color: 'rgba(216,180,254,0.8)', fontWeight: 700 }}>SERVIX</span>
        <div className="mr-auto flex gap-1">
          {['#a855f7', '#22d3ee', '#4ade80'].map((c, i) => (
            <div key={i} className="rounded-sm" style={{ width: 8 * scale, height: 5 * scale, background: c + '40', border: `1px solid ${c}30` }} />
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-1 p-1.5">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-md p-1 text-center"
            style={{ background: k.color + '12', border: `1px solid ${k.color}20` }}
          >
            <div style={{ fontSize: 7 * scale + 'px', fontWeight: 900, color: k.color, lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 5 * scale + 'px', color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Appointment rows */}
      <div className="space-y-0.5 px-1.5">
        {[
          { name: 'سارة', svc: 'قص وصبغ', color: '#a855f7' },
          { name: 'نورة', svc: 'بروتين',  color: '#22d3ee' },
          { name: 'لولوة', svc: 'مانيكير', color: '#4ade80' },
        ].map((a) => (
          <div
            key={a.name}
            className="flex items-center gap-1 rounded px-1 py-0.5"
            style={{ background: 'rgba(255,255,255,0.025)' }}
          >
            <div className="rounded-full shrink-0" style={{ width: 3, height: 12 * scale, background: a.color }} />
            <div>
              <div style={{ fontSize: 5 * scale + 'px', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{a.name}</div>
              <div style={{ fontSize: 4 * scale + 'px', color: 'rgba(255,255,255,0.3)' }}>{a.svc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Mini bar chart */}
      <div className="flex items-end gap-0.5 px-1.5 pt-1" style={{ height: 20 * scale }}>
        {[0.5, 0.7, 0.6, 0.9, 0.8, 1.0].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm"
            style={{
              height: `${h * 100}%`,
              background: 'linear-gradient(to top, rgba(168,85,247,0.6), rgba(129,140,248,0.4))',
            }}
          />
        ))}
      </div>

      {/* Glowing overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(168,85,247,0.06) 0%, transparent 70%)',
        }}
      />
    </div>
  );
}

/* ─── Laptop ─── */
function Laptop() {
  return (
    <div className="relative flex flex-col items-center">
      {/* Screen */}
      <div
        className="relative overflow-hidden rounded-t-xl"
        style={{
          width: 340,
          height: 210,
          background: '#07051a',
          border: '2px solid rgba(168,85,247,0.3)',
          borderBottom: 'none',
          boxShadow: '0 0 40px rgba(168,85,247,0.2), inset 0 0 20px rgba(168,85,247,0.04)',
        }}
      >
        {/* Camera dot */}
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-violet-500/40" />
        <div className="pt-4 h-full">
          <ScreenContent scale={1} />
        </div>
        {/* Screen reflection */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 50%)',
          }}
        />
      </div>
      {/* Hinge */}
      <div
        style={{
          width: 360,
          height: 6,
          background: 'linear-gradient(to bottom, rgba(168,85,247,0.15), rgba(100,80,200,0.1))',
          borderRadius: '0 0 2px 2px',
          border: '1px solid rgba(168,85,247,0.2)',
          borderTop: 'none',
        }}
      />
      {/* Base */}
      <div
        style={{
          width: 380,
          height: 10,
          background: 'linear-gradient(to bottom, rgba(168,85,247,0.1), rgba(50,30,120,0.08))',
          borderRadius: '0 0 8px 8px',
          border: '1px solid rgba(168,85,247,0.15)',
          borderTop: 'none',
        }}
      />
    </div>
  );
}

/* ─── Tablet ─── */
function TabletDevice() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      style={{
        width: 160,
        height: 210,
        background: '#07051a',
        border: '3px solid rgba(168,85,247,0.28)',
        boxShadow: '0 0 30px rgba(168,85,247,0.18), inset 0 0 10px rgba(168,85,247,0.04)',
      }}
    >
      {/* Home button */}
      <div
        className="absolute bottom-2 left-1/2 -translate-x-1/2 h-3 w-3 rounded-full"
        style={{ border: '1px solid rgba(168,85,247,0.35)' }}
      />
      {/* Camera */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-violet-500/40" />

      <div className="pt-5 pb-6 h-full">
        <ScreenContent scale={0.88} />
      </div>
    </div>
  );
}

/* ─── Phone ─── */
function PhoneDevice() {
  return (
    <div
      className="relative overflow-hidden rounded-3xl"
      style={{
        width: 100,
        height: 200,
        background: '#07051a',
        border: '3px solid rgba(34,211,238,0.28)',
        boxShadow: '0 0 25px rgba(34,211,238,0.15), inset 0 0 10px rgba(34,211,238,0.03)',
      }}
    >
      {/* Notch */}
      <div
        className="absolute top-2 left-1/2 -translate-x-1/2 h-2 w-10 rounded-full"
        style={{ background: 'rgba(34,211,238,0.15)', border: '1px solid rgba(34,211,238,0.2)' }}
      />
      {/* Home indicator */}
      <div
        className="absolute bottom-2 left-1/2 -translate-x-1/2 h-1 w-8 rounded-full"
        style={{ background: 'rgba(255,255,255,0.12)' }}
      />

      <div className="pt-5 pb-5 h-full">
        <ScreenContent scale={0.62} />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   DEVICES SHOWCASE
══════════════════════════════════════════════════════════════ */
export default function DevicesShowcase(): React.ReactElement {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y1 = useTransform(scrollYProgress, [0, 1], [30,  -30]);
  const y2 = useTransform(scrollYProgress, [0, 1], [60,  -60]);
  const y3 = useTransform(scrollYProgress, [0, 1], [10,  -10]);

  const devices = [
    { component: <PhoneDevice />,  label: 'موبايل',  sub: 'iOS & Android', y: y1, delay: 0.1,  icon: Smartphone, color: '#22d3ee' },
    { component: <TabletDevice />, label: 'تابلت',   sub: 'iPad & Android', y: y2, delay: 0,    icon: Tablet,     color: '#a855f7' },
    { component: <Laptop />,       label: 'لابتوب',  sub: 'Mac & Windows', y: y3, delay: 0.2,  icon: Monitor,    color: '#818cf8' },
  ];

  return (
    <section ref={ref} className="relative overflow-hidden py-24 sm:py-32">
      {/* Background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% 100%, rgba(99,102,241,0.07) 0%, transparent 70%)',
        }}
      />
      <div aria-hidden className="hex-grid absolute inset-0 opacity-60" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="mx-auto mb-16 max-w-2xl text-center"
        >
          <div
            className="mb-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold text-indigo-300"
            style={{ border: '1px solid rgba(129,140,248,0.25)', background: 'rgba(129,140,248,0.1)' }}
          >
            <Monitor className="h-3.5 w-3.5" />
            التوافق الشامل
          </div>
          <h2 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
            يعمل على
            <span className="gradient-text"> كل أجهزتك</span>
          </h2>
          <p className="mt-4 text-lg text-white/45">
            واجهة واحدة متكاملة — موبايل، تابلت، أو لابتوب. كل شيء يتزامن لحظياً.
          </p>
        </motion.div>

        {/* Devices */}
        <div className="flex flex-col items-center gap-10 md:flex-row md:items-end md:justify-center md:gap-8 lg:gap-12">
          {devices.map(({ component, label, sub, y, delay, icon: Icon, color }) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 50, scale: 0.92 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay, ease: EASE }}
              style={{ y }}
              className="flex flex-col items-center gap-4"
            >
              {/* Device with outer glow */}
              <div
                className="relative"
                style={{
                  filter: `drop-shadow(0 0 24px ${color}55) drop-shadow(0 0 60px ${color}22)`,
                }}
              >
                {component}
              </div>

              {/* Label */}
              <div
                className="flex items-center gap-2 rounded-xl px-4 py-2"
                style={{
                  background: `${color}10`,
                  border: `1px solid ${color}25`,
                  backdropFilter: 'blur(12px)',
                }}
              >
                <Icon className="h-4 w-4" style={{ color }} />
                <div>
                  <div className="text-sm font-bold text-white">{label}</div>
                  <div className="text-[11px] text-white/40">{sub}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Sync indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-14 flex items-center justify-center gap-4"
        >
          <div className="h-px flex-1 max-w-xs" style={{ background: 'linear-gradient(to right, transparent, rgba(168,85,247,0.4))' }} />
          <div
            className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-violet-300"
            style={{ border: '1px solid rgba(168,85,247,0.25)', background: 'rgba(168,85,247,0.08)' }}
          >
            <span className="h-2 w-2 rounded-full bg-green-400 node-pulse inline-block" />
            تزامن فوري بين جميع الأجهزة
          </div>
          <div className="h-px flex-1 max-w-xs" style={{ background: 'linear-gradient(to left, transparent, rgba(168,85,247,0.4))' }} />
        </motion.div>
      </div>
    </section>
  );
}
