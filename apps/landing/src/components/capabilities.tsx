'use client';

import { motion } from 'motion/react';
import {
  Calendar, MessageCircle, CreditCard,
  BarChart3, Star, Smartphone,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

export default function Capabilities(): React.ReactElement {
  const { t } = useI18n();

  const cards = [
    { icon: Calendar,      titleKey: 'capabilities.calendar.title',  descKey: 'capabilities.calendar.desc' },
    { icon: MessageCircle, titleKey: 'capabilities.whatsapp.title',  descKey: 'capabilities.whatsapp.desc' },
    { icon: CreditCard,    titleKey: 'capabilities.pos.title',       descKey: 'capabilities.pos.desc' },
    { icon: BarChart3,     titleKey: 'capabilities.reports.title',   descKey: 'capabilities.reports.desc' },
    { icon: Star,          titleKey: 'capabilities.loyalty.title',   descKey: 'capabilities.loyalty.desc' },
    { icon: Smartphone,    titleKey: 'capabilities.booking.title',   descKey: 'capabilities.booking.desc' },
  ];

  return (
    <section id="capabilities" className="relative overflow-hidden py-24 sm:py-32">
      {/* Subtle background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(200,169,126,0.03) 0%, transparent 70%)',
        }}
      />

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
            {t('capabilities.title')}{' '}
            <span style={{ color: 'var(--gold)' }}>{t('capabilities.titleAccent')}</span>
          </h2>
          <p className="mt-5 text-base leading-relaxed sm:text-lg" style={{ color: 'var(--fg-secondary)' }}>
            {t('capabilities.subtitle')}
          </p>
        </motion.div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.article
                key={card.titleKey}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.8, delay: i * 0.08, ease: EASE }}
                whileHover={{ scale: 1.02, transition: { duration: 0.25 } }}
                className="card-luxury group cursor-default p-7 sm:p-8"
              >
                {/* Icon */}
                <div
                  className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl transition-colors duration-300"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <Icon
                    className="h-5 w-5 transition-colors duration-300"
                    style={{ color: 'var(--fg-muted)' }}
                  />
                </div>

                {/* Title */}
                <h3 className="text-lg font-bold" style={{ color: 'var(--fg)' }}>
                  {t(card.titleKey)}
                </h3>

                {/* Gold line */}
                <div className="gold-line mt-3 mb-4 transition-all duration-300 group-hover:w-16" />

                {/* Description */}
                <p className="text-sm leading-relaxed transition-colors duration-300" style={{ color: 'var(--fg-secondary)' }}>
                  {t(card.descKey)}
                </p>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
