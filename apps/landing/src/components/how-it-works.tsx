'use client';

import { motion } from 'motion/react';
import { UserPlus, Settings2, Rocket } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

export default function HowItWorks(): React.ReactElement {
  const { t } = useI18n();

  const steps = [
    {
      num: '01',
      icon: UserPlus,
      titleKey: 'howItWorks.step1.title',
      descKey: 'howItWorks.step1.desc',
    },
    {
      num: '02',
      icon: Settings2,
      titleKey: 'howItWorks.step2.title',
      descKey: 'howItWorks.step2.desc',
    },
    {
      num: '03',
      icon: Rocket,
      titleKey: 'howItWorks.step3.title',
      descKey: 'howItWorks.step3.desc',
    },
  ];

  return (
    <section id="how-it-works" className="relative overflow-hidden py-24 sm:py-32">
      {/* Subtle divider line */}
      <div className="gold-line-full absolute inset-x-0 top-0" />

      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.8, ease: EASE }}
          className="mx-auto mb-20 max-w-xl text-center"
        >
          <h2 className="text-4xl font-black tracking-tight sm:text-5xl" style={{ color: 'var(--fg)' }}>
            {t('howItWorks.title')}{' '}
            <span style={{ color: 'var(--gold)' }}>{t('howItWorks.titleAccent')}</span>
          </h2>
        </motion.div>

        {/* Steps */}
        <div className="relative grid gap-12 md:grid-cols-3 md:gap-8">

          {/* Connecting line (desktop) */}
          <div
            aria-hidden
            className="absolute top-24 start-[16.67%] end-[16.67%] hidden h-px md:block"
            style={{ background: 'var(--border)' }}
          />

          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.8, delay: i * 0.15, ease: EASE }}
                className="flex flex-col items-center text-center"
              >
                {/* Step number */}
                <div
                  className="mb-4 text-6xl font-black leading-none sm:text-7xl"
                  style={{ color: 'var(--gold)', opacity: 0.25 }}
                >
                  {step.num}
                </div>

                {/* Icon circle */}
                <div
                  className="relative mb-6 flex h-16 w-16 items-center justify-center rounded-full"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <Icon className="h-7 w-7" style={{ color: 'var(--gold)' }} strokeWidth={1.5} />
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold" style={{ color: 'var(--fg)' }}>
                  {t(step.titleKey)}
                </h3>

                {/* Description */}
                <p className="mt-3 max-w-xs text-sm leading-relaxed" style={{ color: 'var(--fg-secondary)' }}>
                  {t(step.descKey)}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
