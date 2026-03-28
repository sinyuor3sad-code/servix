'use client';

import Link from 'next/link';
import {
  motion, useScroll, useTransform,
  AnimatePresence,
} from 'motion/react';
import {
  Sparkles, ArrowLeft, ShieldCheck, Clock,
  CreditCard, Activity, Brain, Zap,
  CheckCircle2, AlertTriangle, CalendarCheck,
  UserCheck, TrendingUp, Star,
} from 'lucide-react';
import { useRef, useState, useEffect } from 'react';

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3000';
const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

/* ─── Floating data-badge chip ─── */
interface DataChipProps {
  icon: React.ElementType;
  label: string;
  value: string;
  color: 'violet' | 'cyan' | 'green' | 'pink' | 'amber';
  className?: string;
  delay?: number;
}
const COLOR_MAP = {
  violet: { border: 'rgba(168,85,247,0.35)', bg: 'rgba(168,85,247,0.1)',  text: '#d8b4fe', icon: '#a855f7' },
  cyan:   { border: 'rgba(34,211,238,0.35)',  bg: 'rgba(34,211,238,0.08)',  text: '#a5f3fc', icon: '#22d3ee' },
  green:  { border: 'rgba(74,222,128,0.35)',  bg: 'rgba(74,222,128,0.08)',  text: '#86efac', icon: '#4ade80' },
  pink:   { border: 'rgba(244,114,182,0.35)', bg: 'rgba(244,114,182,0.08)', text: '#f9a8d4', icon: '#f472b6' },
  amber:  { border: 'rgba(251,191,36,0.35)',  bg: 'rgba(251,191,36,0.08)',  text: '#fde68a', icon: '#fbbf24' },
};

function DataChip({ icon: Icon, label, value, color, className = '', delay = 0 }: DataChipProps) {
  const c = COLOR_MAP[color];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.7, delay, ease: EASE }}
      className={`float-y-slow absolute flex items-center gap-2 rounded-xl px-3 py-2 text-xs backdrop-blur-2xl ${className}`}
      style={{
        border:     `1px solid ${c.border}`,
        background: c.bg,
        boxShadow:  `0 0 20px ${c.bg}, inset 0 1px 0 rgba(255,255,255,0.06)`,
      }}
    >
      <Icon style={{ color: c.icon }} className="h-3.5 w-3.5 shrink-0" />
      <div>
        <div className="font-bold leading-none" style={{ color: c.text }}>{value}</div>
        <div className="mt-0.5 text-[10px] opacity-60" style={{ color: c.text }}>{label}</div>
      </div>
    </motion.div>
  );
}

/* ─── Healing system: absence → reschedule ─── */
function HealingSystem() {
  const [phase, setPhase] = useState<'alert' | 'processing' | 'done'>('alert');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('processing'), 2200);
    const t2 = setTimeout(() => setPhase('done'),       4000);
    const t3 = setTimeout(() => setPhase('alert'),      7000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div
      className="glass-holo w-full overflow-hidden rounded-2xl p-4"
      style={{ minHeight: 110 }}
    >
      <div className="mb-2 flex items-center gap-2">
        <Activity className="h-3.5 w-3.5 text-violet-400" />
        <span className="terminal-text text-[11px] text-violet-300/70">نظام الإصلاح الذاتي</span>
        <span className="status-online mr-auto text-[10px] text-green-400/70">نشط</span>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'alert' && (
          <motion.div key="alert"
            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
            className="flex items-start gap-2.5"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div>
              <p className="text-xs font-bold text-amber-300">غياب موظفة — سارة المطيري</p>
              <p className="mt-0.5 text-[10px] text-white/45">3 مواعيد تأثرت · الساعة 10:00 — 13:00</p>
            </div>
          </motion.div>
        )}
        {phase === 'processing' && (
          <motion.div key="proc"
            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
            className="flex items-start gap-2.5"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
            >
              <Zap className="h-4 w-4 text-cyan-400" />
            </motion.div>
            <div>
              <p className="text-xs font-bold text-cyan-300">الذكاء الاصطناعي يعيد الجدولة…</p>
              <p className="mt-0.5 text-[10px] text-white/45">يبحث عن موظفة متاحة + يُرسل إشعار للعملاء</p>
            </div>
          </motion.div>
        )}
        {phase === 'done' && (
          <motion.div key="done"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              <p className="text-xs font-bold text-green-300">تمت إعادة الجدولة تلقائياً ✓</p>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {['نورة ← 10:00', 'لولوة ← 11:30', 'منى ← 13:00'].map((slot) => (
                <div key={slot}
                  className="rounded-lg bg-green-500/10 px-2 py-1 text-center text-[10px] text-green-300/80"
                  style={{ border: '1px solid rgba(74,222,128,0.2)' }}
                >
                  {slot}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Client DNA holographic ring ─── */
function ClientDNA() {
  const rings = [
    { r: 80,  speed: 12, color: 'rgba(168,85,247,0.6)',  nodes: 8 },
    { r: 56,  speed: 8,  color: 'rgba(34,211,238,0.5)',  nodes: 6 },
    { r: 34,  speed: 15, color: 'rgba(244,114,182,0.4)', nodes: 5 },
  ];

  const dataPoints = [
    { label: 'VIP عميلة', value: '★★★', color: '#fbbf24' },
    { label: 'خطر الابتعاد', value: '٢٪', color: '#4ade80' },
    { label: 'زيارات', value: '٤٧', color: '#c084fc' },
    { label: 'آخر زيارة', value: '٣ أيام', color: '#22d3ee' },
  ];

  return (
    <div className="relative flex items-center justify-center" style={{ width: 220, height: 220 }}>
      {/* Central avatar */}
      <div
        className="absolute z-10 flex h-16 w-16 items-center justify-center rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(168,85,247,0.4) 0%, rgba(99,102,241,0.2) 60%, transparent 100%)',
          border: '1px solid rgba(168,85,247,0.5)',
          boxShadow: '0 0 30px rgba(168,85,247,0.5)',
        }}
      >
        {/* Stylized silhouette using CSS */}
        <div className="relative">
          <div className="h-6 w-6 rounded-full" style={{ background: 'rgba(220,190,255,0.8)' }} />
          <div
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 h-5 w-8 rounded-t-full"
            style={{ background: 'rgba(220,190,255,0.5)' }}
          />
        </div>
      </div>

      {/* Orbiting rings */}
      {rings.map((ring, ri) => (
        <motion.div
          key={ri}
          className="absolute rounded-full"
          style={{
            width:  ring.r * 2,
            height: ring.r * 2,
            border: `1px solid ${ring.color}`,
            boxShadow: `0 0 8px ${ring.color}`,
          }}
          animate={{ rotate: ri % 2 === 0 ? 360 : -360 }}
          transition={{ duration: ring.speed, repeat: Infinity, ease: 'linear' }}
        >
          {/* Orbit node dots */}
          {Array.from({ length: ring.nodes }).map((_, ni) => {
            const angle = (ni / ring.nodes) * 360;
            return (
              <div
                key={ni}
                className="absolute h-2 w-2 rounded-full"
                style={{
                  background: ring.color,
                  boxShadow: `0 0 6px ${ring.color}`,
                  top:  '50%',
                  left: '50%',
                  transform: `rotate(${angle}deg) translateX(${ring.r - 4}px) translateY(-50%)`,
                }}
              />
            );
          })}
        </motion.div>
      ))}

      {/* Floating data points */}
      {dataPoints.map((dp, i) => {
        const angle = (i / dataPoints.length) * 360;
        const rad   = (angle * Math.PI) / 180;
        const cx    = 90 * Math.cos(rad);
        const cy    = 90 * Math.sin(rad);
        return (
          <motion.div
            key={i}
            className="absolute rounded-lg px-2 py-1"
            style={{
              transform: `translate(${cx}px, ${cy}px)`,
              background: 'rgba(10,8,30,0.85)',
              border: `1px solid ${dp.color}44`,
              backdropFilter: 'blur(12px)',
              minWidth: 64,
            }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2 + i * 0.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="text-center text-[10px] font-bold" style={{ color: dp.color }}>{dp.value}</div>
            <div className="text-center text-[9px] text-white/40">{dp.label}</div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ─── Mini dashboard panel ─── */
function MiniDashboard() {
  const kpis = [
    { label: 'الإيرادات', value: '٤٢,٨٠٠', unit: 'ر.س', color: '#a855f7', trend: '+١٢٪' },
    { label: 'المواعيد', value: '١٨٤',       unit: '',     color: '#22d3ee', trend: '+٧٪' },
    { label: 'العملاء',  value: '٩٣',        unit: '%',    color: '#4ade80', trend: 'رضا' },
  ];

  return (
    <div className="glass-holo w-full rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="terminal-text text-[11px] text-violet-300/70">لوحة تحكم · مباشر</span>
        <span className="flex items-center gap-1 text-[10px] text-green-400">
          <span className="h-1.5 w-1.5 rounded-full bg-green-400 node-pulse inline-block" />
          مباشر
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {kpis.map((k) => (
          <div key={k.label}
            className="rounded-xl p-2.5 text-center"
            style={{ background: `${k.color}12`, border: `1px solid ${k.color}28` }}
          >
            <div className="text-lg font-black leading-none" style={{ color: k.color }}>
              {k.value}<span className="text-xs">{k.unit}</span>
            </div>
            <div className="mt-1 text-[9px] text-white/40">{k.label}</div>
            <div className="mt-0.5 text-[9px] font-semibold" style={{ color: k.color }}>{k.trend}</div>
          </div>
        ))}
      </div>
      {/* mini bar chart */}
      <div className="mt-3 flex items-end justify-between gap-1" style={{ height: 32 }}>
        {[0.4, 0.6, 0.5, 0.8, 0.7, 0.9, 1.0].map((h, i) => (
          <motion.div
            key={i}
            className="flex-1 rounded-sm"
            style={{ background: `rgba(168,85,247,0.5)`, height: `${h * 100}%` }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.6, delay: 1.2 + i * 0.08, ease: EASE }}
          />
        ))}
      </div>
      <div className="mt-1 text-center text-[9px] text-white/25">إيرادات الأسبوع</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   HERO
══════════════════════════════════════════════════════════════ */
export default function Hero(): React.ReactElement {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const bgY     = useTransform(scrollYProgress, [0, 1], ['0%',  '30%']);
  const fgY     = useTransform(scrollYProgress, [0, 1], ['0%',  '-8%']);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  const trustBadges = [
    { icon: ShieldCheck, label: 'بيانات معزولة ومشفرة' },
    { icon: Clock,       label: 'تجربة مجانية ١٤ يوم' },
    { icon: CreditCard,  label: 'بلا بطاقة ائتمان' },
  ];

  return (
    <section
      ref={ref}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden pt-28 pb-16"
    >
      {/* ── Parallax deep background glow ── */}
      <motion.div
        aria-hidden
        style={{ y: bgY }}
        className="pointer-events-none absolute inset-0 -z-0"
      >
        <div
          className="absolute -top-32 end-0 h-[700px] w-[700px] rounded-full opacity-30"
          style={{
            background: 'radial-gradient(circle, rgba(147,51,234,0.5) 0%, rgba(99,102,241,0.2) 40%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div
          className="absolute top-1/3 start-0 h-[500px] w-[500px] rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, rgba(34,211,238,0.4) 0%, transparent 70%)',
            filter: 'blur(70px)',
          }}
        />
      </motion.div>

      {/* ── Scan sweep line ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 h-px opacity-30"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.8), rgba(34,211,238,0.6), transparent)',
          animation: 'scan-sweep 8s linear infinite',
          top: 0,
        }}
      />

      {/* ── Foreground content ── */}
      <motion.div
        style={{ y: fgY, opacity }}
        className="relative z-10 w-full"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">

          {/* ── Top: text left, DNA right ── */}
          <div className="flex flex-col items-center gap-12 lg:flex-row lg:items-center lg:justify-between">

            {/* ─ Text column ─ */}
            <div className="max-w-xl text-center lg:text-start">

              {/* Live badge */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="mb-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5"
                style={{
                  border: '1px solid rgba(168,85,247,0.3)',
                  background: 'rgba(168,85,247,0.1)',
                  backdropFilter: 'blur(12px)',
                }}
              >
                <span className="relative flex h-2 w-2">
                  <span className="pulse-ring absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-400" />
                </span>
                <span className="text-sm font-semibold text-violet-300">
                  الإصدار ٢.٠ · ZATCA + واتساب مخصص
                </span>
              </motion.div>

              {/* Neon headline */}
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2, ease: EASE }}
                className="text-5xl font-black leading-tight tracking-tight sm:text-6xl lg:text-7xl"
              >
                <span className="neon-text neon-flicker block">المستقبل</span>
                <span className="neon-text neon-flicker block" style={{ animationDelay: '0.4s' }}>هو الآن</span>
                <span className="gradient-text block mt-1">مع SERVIX</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.4 }}
                className="mt-5 text-base leading-relaxed text-white/50 sm:text-lg"
              >
                منصة إدارة صالونات التجميل المدعومة بالذكاء الاصطناعي —
                جدولة ذاتية، فواتير ZATCA، وذاكرة عميلة كاملة.
              </motion.p>

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.55 }}
                className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start"
              >
                <Link
                  href={`${DASHBOARD_URL}/register`}
                  className="btn-primary group relative inline-flex items-center gap-2.5 rounded-2xl px-8 py-4 text-base font-bold text-white"
                >
                  <Sparkles className="h-5 w-5" />
                  ابدأ تجربتك المجانية
                  <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
                </Link>
                <a
                  href="#features"
                  className="inline-flex items-center gap-2 rounded-2xl px-8 py-4 text-base font-medium text-white/65 backdrop-blur-sm transition-all duration-200 hover:text-white"
                  style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  اكتشف المنصة
                </a>
              </motion.div>

              {/* Trust badges */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.75 }}
                className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 lg:justify-start"
              >
                {trustBadges.map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-1.5 text-xs text-white/35">
                    <Icon className="h-3.5 w-3.5 text-violet-400/60" />
                    {label}
                  </div>
                ))}
              </motion.div>
            </div>

            {/* ─ Holographic DNA column ─ */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.5, ease: EASE }}
              className="relative flex items-center justify-center"
              style={{ minWidth: 260 }}
            >
              {/* Outer glow ring */}
              <div
                className="absolute rounded-full"
                style={{
                  width: 280, height: 280,
                  background: 'radial-gradient(circle, rgba(168,85,247,0.14) 0%, transparent 70%)',
                  border: '1px solid rgba(168,85,247,0.15)',
                  boxShadow: '0 0 60px rgba(168,85,247,0.2)',
                }}
              />
              <div
                className="rotate-slow absolute rounded-full"
                style={{
                  width: 260, height: 260,
                  border: '1px dashed rgba(168,85,247,0.2)',
                }}
              />
              <div
                className="rotate-reverse absolute rounded-full"
                style={{
                  width: 230, height: 230,
                  border: '1px dashed rgba(34,211,238,0.15)',
                }}
              />

              {/* Central holographic label */}
              <div className="absolute top-0 z-20">
                <div
                  className="rounded-full px-3 py-1 text-[11px] font-bold text-cyan-300"
                  style={{
                    background: 'rgba(34,211,238,0.1)',
                    border: '1px solid rgba(34,211,238,0.25)',
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  DNA عميلة · AI
                </div>
              </div>

              <ClientDNA />

              {/* Floating data chips around the ring */}
              <DataChip icon={Brain}      label="توصية ذكية" value="بروتين"    color="violet" className="-top-8 -start-16" delay={0.9} />
              <DataChip icon={TrendingUp} label="إنفاق شهري" value="٨٢٠ ر.س" color="cyan"   className="top-1/3 -end-20"  delay={1.1} />
              <DataChip icon={Star}       label="تقييم"      value="٤.٩ ★"    color="amber"  className="-bottom-4 start-0" delay={1.3} />
              <DataChip icon={UserCheck}  label="عميلة VIP"  value="نشطة"      color="green"  className="top-1/4 -start-20" delay={1.0} />
            </motion.div>
          </div>

          {/* ── Bottom cards row ── */}
          <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Card 1: Mini dashboard */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.0, ease: EASE }}
            >
              <MiniDashboard />
            </motion.div>

            {/* Card 2: Healing system */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.15, ease: EASE }}
            >
              <HealingSystem />
            </motion.div>

            {/* Card 3: WhatsApp live preview */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.3, ease: EASE }}
            >
              <div className="glass-holo w-full rounded-2xl p-4">
                <div className="mb-3 flex items-center gap-2">
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-full"
                    style={{ background: 'rgba(74,222,128,0.2)', border: '1px solid rgba(74,222,128,0.35)' }}
                  >
                    <span className="text-[10px]">📱</span>
                  </div>
                  <span className="terminal-text text-[11px] text-green-300/70">واتساب · صالون الأناقة</span>
                  <CalendarCheck className="mr-auto h-3.5 w-3.5 text-green-400" />
                </div>
                <div className="space-y-2">
                  {[
                    { msg: '✅ تم تأكيد حجزك — السبت 10:00', from: 'sent', color: 'rgba(74,222,128,0.12)' },
                    { msg: '⏰ تذكير: موعدك غداً الساعة 10', from: 'sent', color: 'rgba(34,211,238,0.1)' },
                    { msg: '🧾 فاتورتك: ٣٢٠ ر.س — شكراً!', from: 'sent', color: 'rgba(168,85,247,0.1)' },
                  ].map((m, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 1.5 + i * 0.3 }}
                      className="rounded-xl px-3 py-2 text-[11px] text-white/70"
                      style={{ background: m.color, border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      {m.msg}
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* ── Bottom fade ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 inset-x-0 h-40"
        style={{ background: 'linear-gradient(to bottom, transparent, rgba(3,2,10,0.9))' }}
      />
    </section>
  );
}
