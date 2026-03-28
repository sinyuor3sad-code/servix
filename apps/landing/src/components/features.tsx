'use client';

import { motion, useInView } from 'motion/react';
import { useRef } from 'react';
import {
  Calendar, CreditCard, MessageCircle,
  BarChart3, Users, Star, Smartphone,
  FileText, Cpu, Shield, Zap, Clock,
} from 'lucide-react';

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

interface BentoCard {
  icon: React.ElementType;
  title: string;
  desc: string;
  wide?: boolean;
  tall?: boolean;
  accent: { from: string; to: string; glow: string; border: string; iconBg: string };
  tag?: string;
  visual?: React.ReactNode;
}

/* ─── Mini Visuals ─── */

function CalendarVisual() {
  const slots = ['10:00', '11:30', '13:00', '14:30', '16:00', '17:30'];
  const statuses = ['active', 'booked', 'free', 'booked', 'free', 'booked'];
  return (
    <div className="mt-3 grid grid-cols-3 gap-1.5">
      {slots.map((t, i) => (
        <div
          key={t}
          className="rounded-lg px-2 py-1.5 text-center"
          style={{
            background: statuses[i] === 'active' ? 'rgba(168,85,247,0.2)' :
                        statuses[i] === 'booked' ? 'rgba(34,211,238,0.08)' :
                        'rgba(255,255,255,0.03)',
            border: `1px solid ${
              statuses[i] === 'active' ? 'rgba(168,85,247,0.45)' :
              statuses[i] === 'booked' ? 'rgba(34,211,238,0.25)' :
              'rgba(255,255,255,0.05)'
            }`,
          }}
        >
          <div className="text-[10px] font-bold" style={{
            color: statuses[i] === 'active' ? '#d8b4fe' :
                   statuses[i] === 'booked' ? '#a5f3fc' : 'rgba(255,255,255,0.25)',
          }}>{t}</div>
        </div>
      ))}
    </div>
  );
}

function RevenueChart() {
  const bars = [0.45, 0.60, 0.55, 0.80, 0.72, 0.95, 1.0];
  return (
    <div className="mt-3 flex items-end gap-1.5" style={{ height: 48 }}>
      {bars.map((h, i) => (
        <motion.div
          key={i}
          className="flex-1 rounded-t-sm"
          style={{
            background: `linear-gradient(to top, rgba(168,85,247,0.7), rgba(129,140,248,0.5))`,
            height: `${h * 100}%`,
          }}
          initial={{ scaleY: 0, originY: 1 }}
          whileInView={{ scaleY: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: i * 0.08, ease: EASE }}
        />
      ))}
    </div>
  );
}

function WhatsAppMsgs() {
  return (
    <div className="mt-3 space-y-1.5">
      {[
        { text: '✅ تأكيد الحجز', color: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.2)' },
        { text: '⏰ تذكير الموعد', color: 'rgba(34,211,238,0.1)',  border: 'rgba(34,211,238,0.2)' },
        { text: '🧾 إرسال الفاتورة', color: 'rgba(168,85,247,0.1)', border: 'rgba(168,85,247,0.2)' },
      ].map((m) => (
        <div
          key={m.text}
          className="rounded-lg px-2.5 py-1.5 text-[11px] text-white/60"
          style={{ background: m.color, border: `1px solid ${m.border}` }}
        >
          {m.text}
        </div>
      ))}
    </div>
  );
}

const cards: BentoCard[] = [
  {
    icon: Calendar,
    title: 'إدارة المواعيد',
    desc: 'تقويم ذكي بعرض يومي وأسبوعي، تأكيد تلقائي، وحجز إلكتروني مباشر.',
    wide: true,
    tag: 'الأكثر استخداماً',
    accent: { from: 'rgba(168,85,247,0.12)', to: 'rgba(99,102,241,0.05)', glow: 'rgba(168,85,247,0.3)', border: 'rgba(168,85,247,0.22)', iconBg: 'rgba(168,85,247,0.15)' },
    visual: <CalendarVisual />,
  },
  {
    icon: MessageCircle,
    title: 'واتساب خاص لكل صالون',
    desc: 'اربطي رقمك الخاص — كل رسالة تُرسل من رقم صالونك.',
    tall: true,
    tag: 'حصري',
    accent: { from: 'rgba(34,211,238,0.1)', to: 'rgba(99,102,241,0.04)', glow: 'rgba(34,211,238,0.25)', border: 'rgba(34,211,238,0.2)', iconBg: 'rgba(34,211,238,0.12)' },
    visual: <WhatsAppMsgs />,
  },
  {
    icon: CreditCard,
    title: 'نقاط البيع',
    desc: 'فواتير احترافية مع QR كود ZATCA وطرق دفع متعددة.',
    accent: { from: 'rgba(244,114,182,0.1)', to: 'rgba(168,85,247,0.04)', glow: 'rgba(244,114,182,0.25)', border: 'rgba(244,114,182,0.2)', iconBg: 'rgba(244,114,182,0.12)' },
  },
  {
    icon: BarChart3,
    title: 'تقارير وإحصائيات',
    desc: 'إيرادات، الخدمات الأكثر طلباً، وأداء الموظفات في لوحة واحدة.',
    wide: true,
    accent: { from: 'rgba(251,191,36,0.1)', to: 'rgba(234,88,12,0.04)', glow: 'rgba(251,191,36,0.25)', border: 'rgba(251,191,36,0.2)', iconBg: 'rgba(251,191,36,0.12)' },
    visual: <RevenueChart />,
  },
  {
    icon: Users,
    title: 'إدارة العملاء',
    desc: 'سجل عميلة كامل مع تاريخ الزيارات والتفضيلات.',
    accent: { from: 'rgba(34,211,238,0.08)', to: 'rgba(99,102,241,0.04)', glow: 'rgba(34,211,238,0.2)', border: 'rgba(34,211,238,0.15)', iconBg: 'rgba(34,211,238,0.1)' },
  },
  {
    icon: Star,
    title: 'نظام الولاء',
    desc: 'نقاط وكوبونات تشجع عميلاتك على العودة.',
    accent: { from: 'rgba(251,191,36,0.1)', to: 'transparent', glow: 'rgba(251,191,36,0.2)', border: 'rgba(251,191,36,0.15)', iconBg: 'rgba(251,191,36,0.1)' },
  },
  {
    icon: Smartphone,
    title: 'صفحة حجز خاصة',
    desc: 'رابط فريد لصالونك — موبايل، سريع، وجميل.',
    accent: { from: 'rgba(168,85,247,0.1)', to: 'rgba(99,102,241,0.04)', glow: 'rgba(168,85,247,0.2)', border: 'rgba(168,85,247,0.15)', iconBg: 'rgba(168,85,247,0.1)' },
  },
  {
    icon: FileText,
    title: 'فواتير ZATCA',
    desc: 'فواتير إلكترونية متوافقة مع هيئة الزكاة — QR كود وضريبة 15٪.',
    tag: 'ZATCA ✓',
    accent: { from: 'rgba(74,222,128,0.1)', to: 'rgba(34,211,238,0.04)', glow: 'rgba(74,222,128,0.2)', border: 'rgba(74,222,128,0.15)', iconBg: 'rgba(74,222,128,0.1)' },
  },
];

/* ── Animated icon ring ── */
const floatingIcons = [Cpu, Shield, Zap, Clock];

export default function Features(): React.ReactElement {
  const headerRef = useRef(null);
  const headerInView = useInView(headerRef, { once: true });

  return (
    <section id="features" className="relative overflow-hidden py-24 sm:py-32">

      {/* Section background accent */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 70% 45% at 50% 0%, rgba(168,85,247,0.07) 0%, transparent 70%)',
        }}
      />
      <div aria-hidden className="dot-grid absolute inset-0 opacity-50" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">

        {/* ── Section header ── */}
        <div ref={headerRef} className="mx-auto mb-16 max-w-2xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={headerInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="mb-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold text-violet-300"
            style={{ border: '1px solid rgba(168,85,247,0.25)', background: 'rgba(168,85,247,0.1)' }}
          >
            <Zap className="h-3.5 w-3.5" />
            المميزات الأساسية
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            animate={headerInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-4xl font-black tracking-tight text-white sm:text-5xl"
          >
            كل ما تحتاجيه
            <br />
            <span className="gradient-text">في مكان واحد</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            animate={headerInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-4 text-lg text-white/45"
          >
            منصة متكاملة مصممة خصيصاً لصالونات التجميل السعودية
          </motion.p>

          {/* Floating tech icons */}
          <div className="mt-6 flex items-center justify-center gap-3">
            {floatingIcons.map((Icon, i) => (
              <motion.div
                key={i}
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{
                  background: 'rgba(168,85,247,0.1)',
                  border: '1px solid rgba(168,85,247,0.2)',
                }}
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 2.5, delay: i * 0.3, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Icon className="h-4 w-4 text-violet-400" />
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Bento Grid ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.article
                key={card.title}
                initial={{ opacity: 0, y: 36 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.65, delay: i * 0.07, ease: EASE }}
                whileHover={{ y: -4, transition: { duration: 0.25 } }}
                className={`group relative overflow-hidden rounded-2xl p-5 sm:p-6 cursor-default ${
                  card.wide ? 'bento-wide' : ''
                } ${card.tall ? 'bento-tall' : ''}`}
                style={{
                  background: `linear-gradient(145deg, ${card.accent.from}, ${card.accent.to})`,
                  border: `1px solid ${card.accent.border}`,
                  backdropFilter: 'blur(20px)',
                  transition: 'border-color 0.3s, box-shadow 0.3s',
                }}
              >
                {/* Hover glow overlay */}
                <div
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  style={{
                    background: `radial-gradient(circle at 30% 30%, ${card.accent.glow}22 0%, transparent 70%)`,
                  }}
                />

                {/* Top edge neon line on hover */}
                <div
                  className="absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{ background: `linear-gradient(90deg, transparent, ${card.accent.glow}, transparent)` }}
                />

                {/* Tag */}
                {card.tag && (
                  <span
                    className="relative z-10 mb-3 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold text-violet-300"
                    style={{ border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.12)' }}
                  >
                    {card.tag}
                  </span>
                )}

                {/* Icon */}
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  transition={{ duration: 0.2 }}
                  className="relative z-10 mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{
                    background: card.accent.iconBg,
                    border: `1px solid ${card.accent.border}`,
                    boxShadow: `0 0 16px ${card.accent.glow}50`,
                  }}
                >
                  <Icon className="h-5 w-5 text-white/80 transition-colors group-hover:text-white" />
                </motion.div>

                {/* Text */}
                <div className="relative z-10">
                  <h3 className="text-lg font-black text-white">{card.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/45 transition-colors group-hover:text-white/60">
                    {card.desc}
                  </p>
                </div>

                {/* Optional inline visual */}
                {card.visual && (
                  <div className="relative z-10">{card.visual}</div>
                )}

                {/* Decorative corner orb */}
                <div
                  aria-hidden
                  className="absolute -end-8 -bottom-8 h-28 w-28 rounded-full opacity-10 group-hover:opacity-25 transition-opacity duration-500"
                  style={{ background: `radial-gradient(circle, ${card.accent.glow} 0%, transparent 70%)` }}
                />
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
