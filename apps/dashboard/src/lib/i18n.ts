import arMessages from '@/locales/ar.json';
import enMessages from '@/locales/en.json';

export type Locale = 'ar' | 'en';
export type Messages = typeof arMessages;

const messages: Record<Locale, Messages> = {
  ar: arMessages,
  en: enMessages,
};

const LOCALE_STORAGE_KEY = 'servix-locale';

/**
 * Get saved locale from localStorage, defaulting to 'ar'.
 */
export function getSavedLocale(): Locale {
  if (typeof window === 'undefined') return 'ar';
  return (localStorage.getItem(LOCALE_STORAGE_KEY) as Locale) || 'ar';
}

/**
 * Save locale to localStorage.
 */
export function saveLocale(locale: Locale): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

/**
 * Get messages for a given locale.
 */
export function getMessages(locale: Locale): Messages {
  return messages[locale] || messages.ar;
}

/**
 * Get direction for a locale.
 */
export function getDirection(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

/**
 * Simple translation function.
 * Use dot notation: t('nav.dashboard') → 'لوحة التحكم'
 * Supports interpolation: t('dashboard.greeting', { name: 'أحمد' })
 */
export function createTranslator(locale: Locale) {
  const msgs = getMessages(locale);

  return function t(key: string, params?: Record<string, string | number>): string {
    const keys = key.split('.');
    let value: unknown = msgs;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        return key; // Fallback: return the key itself
      }
    }

    if (typeof value !== 'string') return key;

    // Interpolation: replace {name} with params.name
    if (params) {
      return value.replace(/\{(\w+)\}/g, (_, paramKey) => {
        return String(params[paramKey] ?? `{${paramKey}}`);
      });
    }

    return value;
  };
}
