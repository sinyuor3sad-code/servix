'use client';

import { useI18n } from '@/lib/i18n';

export default function Marquee(): React.ReactElement {
  const { t, dir } = useI18n();

  const items = [
    t('marquee.salons'),
    t('marquee.appointments'),
    t('marquee.uptime'),
    t('marquee.rating'),
  ];

  const repeated = [...items, ...items, ...items, ...items];

  return (
    <section
      className="relative overflow-hidden py-6"
      style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
    >
      <div
        className="flex items-center gap-12 whitespace-nowrap"
        style={{
          animation: dir === 'rtl'
            ? 'marquee-rtl 40s linear infinite'
            : 'marquee 40s linear infinite',
          width: 'max-content',
        }}
      >
        {repeated.map((item, i) => (
          <div key={i} className="flex items-center gap-12">
            <span
              className="text-sm font-medium tracking-wide"
              style={{ color: 'var(--fg-muted)' }}
            >
              {item}
            </span>
            {i < repeated.length - 1 && (
              <span
                className="h-1 w-1 rounded-full"
                style={{ background: 'var(--gold)', opacity: 0.4 }}
              />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
