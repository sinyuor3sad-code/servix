'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowLeft, ShieldCheck, Clock, Headphones } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3000';
const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

export default function CTASection(): React.ReactElement {
  const { t } = useI18n();

  return (
    <section className="relative overflow-hidden py-24 sm:py-32">
      {/* Top line */}
      <div className="gold-line-full absolute inset-x-0 top-0" />

      {/* Subtle background glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(200,169,126,0.04) 0%, transparent 70%)',
        }}
      />

      <div className="relative mx-auto max-w-4xl px-5 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 36, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.8, ease: EASE }}
          className="relative overflow-hidden rounded-2xl p-10 text-center sm:p-16"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
          }}
        >
          {/* Top gold line */}
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent 10%, var(--gold) 50%, transparent 90%)', opacity: 0.4 }}
          />

          {/* Content */}
          <div className="relative z-10">
            {/* Tagline */}
            <div
              className="mb-5 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold"
              style={{ border: '1px solid var(--border-gold)', color: 'var(--gold)', background: 'rgba(200,169,126,0.06)' }}
            >
              {t('cta.tagline')}
            </div>

            <h2
              className="mt-2 text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl"
              style={{ color: 'var(--fg)' }}
            >
              {t('cta.title')}
              <br />
              <span style={{ color: 'var(--gold)' }}>{t('cta.titleAccent')}</span>
            </h2>

            <p className="mx-auto mt-6 max-w-lg text-base sm:text-lg" style={{ color: 'var(--fg-secondary)' }}>
              {t('cta.subtitle')}
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href={`${DASHBOARD_URL}/register`}
                className="btn-gold group rounded-2xl px-10 py-4 text-base font-bold"
              >
                {t('cta.button')}
                <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
              </Link>
            </div>

            {/* Trust row */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {[
                { icon: ShieldCheck, label: t('cta.trust1') },
                { icon: Clock,       label: t('cta.trust2') },
                { icon: Headphones,  label: t('cta.trust3') },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-sm" style={{ color: 'var(--fg-muted)' }}>
                  <Icon className="h-3.5 w-3.5" style={{ color: 'var(--gold)', opacity: 0.5 }} />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
