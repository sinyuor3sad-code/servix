'use client';

import { motion, useInView } from 'motion/react';
import { useRef, useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n';

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

function AnimatedNumber({ value, suffix = '', prefix = '' }: { value: number; suffix?: string; prefix?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const duration = 1500;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      start = Math.round(eased * value);
      setDisplayed(start);
      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [isInView, value]);

  return (
    <span ref={ref}>
      {prefix}{displayed.toLocaleString()}{suffix}
    </span>
  );
}

export default function Stats(): React.ReactElement {
  const { t } = useI18n();

  const stats = [
    { value: 200, prefix: '+', suffix: '', labelKey: 'stats.salons' },
    { value: 50000, prefix: '+', suffix: '', labelKey: 'stats.appointments' },
    { value: 99.9, prefix: '', suffix: '٪', labelKey: 'stats.uptime' },
    { value: 4.9, prefix: '', suffix: ' ★', labelKey: 'stats.rating' },
  ];

  return (
    <section className="relative overflow-hidden py-20 sm:py-24">
      <div className="gold-line-full absolute inset-x-0 top-0" />
      <div className="gold-line-full absolute inset-x-0 bottom-0" />

      <div className="relative mx-auto max-w-5xl px-5 sm:px-8">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 sm:gap-12">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.labelKey}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.8, delay: i * 0.1, ease: EASE }}
              className="flex flex-col items-center text-center"
            >
              <div className="text-4xl font-black leading-none sm:text-5xl lg:text-6xl" style={{ color: 'var(--gold)' }}>
                {stat.value % 1 !== 0 ? (
                  <span>{stat.prefix}{stat.value}{stat.suffix}</span>
                ) : (
                  <AnimatedNumber value={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
                )}
              </div>
              <div className="mt-3 text-sm font-medium" style={{ color: 'var(--fg-secondary)' }}>
                {t(stat.labelKey)}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
