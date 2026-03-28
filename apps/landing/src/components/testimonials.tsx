'use client';

import { motion } from 'motion/react';
import { Star, Quote, TrendingUp } from 'lucide-react';

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

const testimonials = [
  {
    name:   'سارة الغامدي',
    role:   'صاحبة صالون لومينا — الرياض',
    quote:  'قبل SERVIX كنت أدير كل شيء على واتساب وورق. الآن الحجوزات تأتي تلقائياً، الواتساب يرسل من رقمي، والتقارير جاهزة بضغطة.',
    stars:  5, avatar: 'س',
    color: '#a855f7', border: 'rgba(168,85,247,0.22)',
    stat: { value: '+٣٢٪', label: 'نمو الإيرادات' },
  },
  {
    name:   'نورة العتيبي',
    role:   'مديرة صالون نقش — جدة',
    quote:  'نظام الولاء غيّر كل شيء — عميلاتنا عادوا بشكل ملحوظ بعد ما أضفنا النقاط. الإيرادات ارتفعت ٣٢٪ في أول شهرين.',
    stars:  5, avatar: 'ن',
    color: '#22d3ee', border: 'rgba(34,211,238,0.22)',
    stat: { value: '+٤٧٪', label: 'معدل العودة' },
  },
  {
    name:   'منى الشمري',
    role:   'مديرة صالون رويال — الدمام',
    quote:  'فواتير ZATCA أنقذتنا من التدقيق الضريبي. كل شيء موثق ودقيق. SERVIX استثمار حقيقي وليس مجرد برنامج.',
    stars:  5, avatar: 'م',
    color: '#4ade80', border: 'rgba(74,222,128,0.22)',
    stat: { value: '١٠٠٪', label: 'امتثال ZATCA' },
  },
];

export default function Testimonials(): React.ReactElement {
  return (
    <section id="testimonials" className="relative overflow-hidden py-24 sm:py-32">
      <div aria-hidden className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(168,85,247,0.06) 0%, transparent 70%)' }} />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.7 }}
          className="mx-auto mb-16 max-w-xl text-center"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold text-violet-300"
            style={{ border: '1px solid rgba(168,85,247,0.25)', background: 'rgba(168,85,247,0.1)' }}>
            <Star className="h-3.5 w-3.5" /> آراء العملاء
          </div>
          <h2 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
            صاحبات الصالونات
            <span className="gradient-text"> يتحدثن</span>
          </h2>
        </motion.div>

        {/* Cards */}
        <div className="grid gap-5 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <motion.div key={t.name}
              initial={{ opacity: 0, y: 36 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ duration: 0.7, delay: i * 0.13, ease: EASE }}
              whileHover={{ y: -4, transition: { duration: 0.25 } }}
              className="group relative overflow-hidden rounded-2xl p-6"
              style={{
                background: `linear-gradient(145deg, ${t.color}08 0%, rgba(7,5,26,0.8) 100%)`,
                border: `1px solid ${t.border}`,
                backdropFilter: 'blur(20px)',
              }}
            >
              <div className="absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{ background: `linear-gradient(90deg, transparent, ${t.color}80, transparent)` }} />

              {/* Quote big bg */}
              <Quote className="absolute -top-1 -end-1 h-14 w-14 opacity-[0.06]" style={{ color: t.color }} strokeWidth={1} />

              {/* Stat chip */}
              <div className="mb-4 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5"
                style={{ background: `${t.color}12`, border: `1px solid ${t.color}25` }}>
                <TrendingUp className="h-3.5 w-3.5" style={{ color: t.color }} />
                <span className="text-xs font-bold" style={{ color: t.color }}>{t.stat.value}</span>
                <span className="text-[10px] text-white/40">{t.stat.label}</span>
              </div>

              {/* Stars */}
              <div className="mb-3 flex gap-0.5">
                {Array.from({ length: t.stars }).map((_, si) => (
                  <Star key={si} className="h-3.5 w-3.5 fill-current" style={{ color: '#fbbf24' }} />
                ))}
              </div>

              <p className="mb-5 text-sm leading-relaxed text-white/60 group-hover:text-white/72 transition-colors">
                &ldquo;{t.quote}&rdquo;
              </p>

              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black text-white"
                  style={{
                    background: `linear-gradient(135deg, ${t.color}55, ${t.color}25)`,
                    border: `1px solid ${t.color}35`,
                    boxShadow: `0 0 14px ${t.color}30`,
                  }}>
                  {t.avatar}
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{t.name}</div>
                  <div className="text-xs text-white/40">{t.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Social proof strip */}
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-14 flex flex-wrap items-center justify-center gap-x-10 gap-y-5"
        >
          {[
            { value: '+٢٠٠', label: 'صالون نشط' },
            { value: '+٥٠,٠٠٠', label: 'موعد شهرياً' },
            { value: '٩٩.٩٪', label: 'وقت تشغيل' },
            { value: '٤.٩ ★', label: 'متوسط التقييم' },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1">
              <span className="gradient-text text-2xl font-black">{s.value}</span>
              <span className="text-sm text-white/30">{s.label}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
