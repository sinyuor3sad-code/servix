'use client';

import { useLocale } from '@/hooks/use-locale';
import type { Locale } from '@/lib/i18n';

/**
 * Language switcher button.
 * Toggles between Arabic and English.
 * Compact globe-icon style for header/sidebar placement.
 */
export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();

  const toggleLocale = () => {
    const next: Locale = locale === 'ar' ? 'en' : 'ar';
    setLocale(next);
  };

  return (
    <button
      onClick={toggleLocale}
      className="language-switcher"
      aria-label={locale === 'ar' ? 'Switch to English' : 'التبديل للعربية'}
      title={locale === 'ar' ? 'English' : 'العربية'}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
      <span className="language-switcher-label">
        {locale === 'ar' ? 'EN' : 'عربي'}
      </span>

      <style jsx>{`
        .language-switcher {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 8px;
          border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
          background: transparent;
          color: var(--text-secondary, rgba(255, 255, 255, 0.7));
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.2s ease;
          letter-spacing: 0.5px;
        }
        .language-switcher:hover {
          background: var(--hover-bg, rgba(255, 255, 255, 0.05));
          color: var(--text-primary, #fff);
          border-color: var(--accent-color, rgba(139, 92, 246, 0.5));
        }
        .language-switcher-label {
          font-family: ${locale === 'ar' ? 'Inter, sans-serif' : 'var(--font-cairo, Cairo, sans-serif)'};
        }
      `}</style>
    </button>
  );
}
