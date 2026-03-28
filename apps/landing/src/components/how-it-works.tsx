'use client';

import { motion, useInView } from 'motion/react';
import { useRef, useState, useEffect } from 'react';
import { UserPlus, Settings2, Rocket, Terminal } from 'lucide-react';

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

/* ─── Typewriter effect ─── */
function TypeWriter({ text, delay = 0 }: { text: string; delay?: number }) {
  const [displayed, setDisplayed] = useState('');
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    let i = 0;
    const t = setTimeout(() => {
      const id = setInterval(() => {
        setDisplayed(text.slice(0, ++i));
        if (i >= text.length) clearInterval(id);
      }, 35);
      return () => clearInterval(id);
    }, delay * 1000);
    return () => clearTimeout(t);
  }, [inView, text, delay]);

  return (
    <span ref={ref} className="terminal-text">
      {displayed}
      <span className="animate-blink">_</span>
    </span>
  );
}

const steps = [
  {
    num: '01',
    icon: UserPlus,
    title: 'سجّلي',
    desc: 'أنشئي حسابك في دقيقتين — بلا بطاقة ائتمان، بلا التزام.',
    cmd: '$ servix init --free-trial',
    output: '✓ تم إنشاء الحساب · 14 يوم مجاناً',
    color: '#a855f7',
    glow: 'rgba(168,85,247,0.4)',
    border: 'rgba(168,85,247,0.25)',
  },
  {
    num: '02',
    icon: Settings2,
    title: 'جهّزي صالونك',
    desc: 'أضيفي خدماتك وموظفاتك وأوقات العمل — المعالج يرشدك خطوة بخطوة.',
    cmd: '$ servix setup --wizard',
    output: '✓ الصالون جاهز · 5 خدمات · 3 موظفات',
    color: '#22d3ee',
    glow: 'rgba(34,211,238,0.4)',
    border: 'rgba(34,211,238,0.25)',
  },
  {
    num: '03',
    icon: Rocket,
    title: 'ابدئي الاستقبال',
    desc: 'شاركي رابط الحجز واستقبلي عميلاتك — SERVIX يدير الباقي.',
    cmd: '$ servix launch --booking-link',
    output: '✓ الرابط نشط · أول حجز جاء!',
    color: '#4ade80',
    glow: 'rgba(74,222,128,0.4)',
    border: 'rgba(74,222,128,0.25)',
  },
];

export default function HowItWorks(): React.ReactElement {
  const lineRef = useRef(null);
  const lineInView = useInView(lineRef, { once: true });

  return (
    <section id="how-it-works" className="relative overflow-hidden py-24 sm:py-32">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 100%, rgba(99,102,241,0.07) 0%, transparent 70%)',
        }}
      />
      <div aria-hidden className="scan-lines absolute inset-0 opacity-50" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="mx-auto mb-20 max-w-xl text-center"
        >
          <div
            className="mb-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold text-indigo-300"
            style={{ border: '1px solid rgba(129,140,248,0.25)', background: 'rgba(129,140,248,0.1)' }}
          >
            <Terminal className="h-3.5 w-3.5" />
            كيف تبدأين
          </div>
          <h2 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
            ٣ خطوات وصالونك
            <br />
            <span className="gradient-text">جاهز للعمل</span>
          </h2>
        </motion.div>

        {/* Steps */}
        <div className="relative grid gap-6 md:grid-cols-3">

          {/* Animated connecting line */}
          <div
            ref={lineRef}
            aria-hidden
            className="absolute top-14 start-[16.67%] end-[16.67%] hidden h-px overflow-hidden md:block"
            style={{ background: 'rgba(168,85,247,0.12)' }}
          >
            <motion.div
              initial={{ scaleX: 0, originX: 1 }}
              animate={lineInView ? { scaleX: 1 } : {}}
              transition={{ duration: 1.2, delay: 0.5, ease: EASE }}
              className="h-full"
              style={{
                background: 'linear-gradient(to left, rgba(74,222,128,0.5), rgba(34,211,238,0.5), rgba(168,85,247,0.5))',
              }}
            />
          </div>

          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 36 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ duration: 0.7, delay: i * 0.18, ease: EASE }}
                className="group flex flex-col items-center text-center"
              >
                {/* Icon circle */}
                <div className="relative mb-6">
                  {/* Outer glow ring */}
                  <div
                    className="absolute inset-0 rounded-full opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-70"
                    style={{ background: step.glow }}
                  />
                  {/* Pulsing outer ring */}
                  <div
                    className="absolute inset-0 rounded-full opacity-30"
                    style={{
                      border: `1px solid ${step.color}`,
                      transform: 'scale(1.35)',
                      animation: `node-pulse 3s ease-in-out ${i * 0.5}s infinite`,
                    }}
                  />
                  <div
                    className="relative flex h-28 w-28 items-center justify-center rounded-full transition-all duration-500 group-hover:scale-105"
                    style={{
                      background: `radial-gradient(circle at 40% 40%, ${step.color}25 0%, ${step.color}10 60%, transparent 100%)`,
                      border: `1px solid ${step.border}`,
                      boxShadow: `0 0 30px ${step.glow}40, inset 0 1px 0 rgba(255,255,255,0.06)`,
                      backdropFilter: 'blur(12px)',
                    }}
                  >
                    <Icon className="h-11 w-11" style={{ color: step.color }} strokeWidth={1.5} />
                  </div>

                  {/* Step number badge */}
                  <div
                    className="absolute -top-1 -end-1 flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black text-white/80"
                    style={{
                      background: '#07051a',
                      border: `1px solid ${step.border}`,
                      boxShadow: `0 0 10px ${step.glow}40`,
                    }}
                  >
                    {step.num}
                  </div>
                </div>

                {/* Title + desc */}
                <h3 className="text-2xl font-black text-white">{step.title}</h3>
                <p className="mt-3 max-w-xs text-base leading-relaxed text-white/45">{step.desc}</p>

                {/* Terminal block */}
                <div
                  className="mt-5 w-full max-w-xs rounded-xl p-3 text-start"
                  style={{
                    background: 'rgba(3,2,10,0.8)',
                    border: `1px solid ${step.border}`,
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    {['#ff5f57','#febc2e','#28c840'].map((c) => (
                      <div key={c} className="h-2 w-2 rounded-full" style={{ background: c, opacity: 0.5 }} />
                    ))}
                    <span className="mr-1 text-[9px] text-white/20">terminal</span>
                  </div>
                  <TypeWriter text={step.cmd} delay={0.5 + i * 0.4} />
                  <div className="mt-1.5 text-[11px] font-semibold" style={{ color: step.color + 'cc' }}>
                    {step.output}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
