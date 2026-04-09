'use client';

import { motion } from 'motion/react';
import { Star } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

const testimonials = [
  {
    name:  'سارة الغامدي',
    role:  'صاحبة صالون لومينا — الرياض',
    quote: 'قبل SERVIX كنت أدير كل شيء على واتساب وورق. الآن الحجوزات تأتي تلقائياً، الواتساب يرسل من رقمي، والتقارير جاهزة بضغطة.',
    avatar: 'س',
  },
  {
    name:  'نورة العتيبي',
    role:  'مديرة صالون نقش — جدة',
    quote: 'نظام الولاء غيّر كل شيء — عميلاتنا عادوا بشكل ملحوظ بعد ما أضفنا النقاط. الإيرادات ارتفعت ٣٢٪ في أول شهرين.',
    avatar: 'ن',
  },
  {
    name:  'منى الشمري',
    role:  'مديرة صالون رويال — الدمام',
    quote: 'فواتير ZATCA أنقذتنا من التدقيق الضريبي. كل شيء موثق ودقيق. SERVIX استثمار حقيقي وليس مجرد برنامج.',
    avatar: 'م',
  },
];

export default function Testimonials(): React.ReactElement {
  const { t } = useI18n();

  return (
    <section id="testimonials" className="relative overflow-hidden py-24 sm:py-32">
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.8, ease: EASE }}
          className="mx-auto mb-16 max-w-xl text-center"
        >
          <h2 className="text-4xl font-black tracking-tight sm:text-5xl" style={{ color: 'var(--fg)' }}>
            {t('testimonials.title')}{' '}
            <span style={{ color: 'var(--gold)' }}>{t('testimonials.titleAccent')}</span>
          </h2>
        </motion.div>

        {/* Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((item, i) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.8, delay: i * 0.12, ease: EASE }}
              whileHover={{ scale: 1.02, transition: { duration: 0.25 } }}
              className="card-luxury p-8"
            >
              {/* Quote mark */}
              <div
                className="mb-4 text-4xl font-black leading-none"
                style={{ color: 'var(--gold)', opacity: 0.3 }}
              >
                &ldquo;
              </div>

              {/* Stars */}
              <div className="mb-4 flex gap-1">
                {Array.from({ length: 5 }).map((_, si) => (
                  <Star key={si} className="h-4 w-4 fill-current" style={{ color: 'var(--gold)' }} />
                ))}
              </div>

              {/* Quote */}
              <p className="mb-6 text-base leading-relaxed" style={{ color: 'var(--fg)' }}>
                {item.quote}
              </p>

              {/* Divider */}
              <div className="gold-line mb-6" />

              {/* Author */}
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                  style={{
                    background: 'rgba(200,169,126,0.1)',
                    border: '1px solid var(--border-gold)',
                    color: 'var(--gold)',
                  }}
                >
                  {item.avatar}
                </div>
                <div>
                  <div className="text-sm font-bold" style={{ color: 'var(--fg)' }}>{item.name}</div>
                  <div className="text-sm" style={{ color: 'var(--fg-secondary)' }}>{item.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
