'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import {
  type Locale,
  getSavedLocale,
  saveLocale,
  createTranslator,
  getDirection,
} from '@/lib/i18n';

interface LocaleContextType {
  locale: Locale;
  dir: 'rtl' | 'ltr';
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextType | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('ar');

  // Load saved locale on mount
  useEffect(() => {
    setLocaleState(getSavedLocale());
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    saveLocale(newLocale);

    // Update document attributes
    document.documentElement.lang = newLocale;
    document.documentElement.dir = getDirection(newLocale);
  }, []);

  const t = createTranslator(locale);
  const dir = getDirection(locale);

  return (
    <LocaleContext.Provider value={{ locale, dir, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

/**
 * Hook to access i18n context.
 * Returns { locale, dir, setLocale, t }.
 *
 * Usage:
 *   const { t, locale, setLocale } = useLocale();
 *   <h1>{t('dashboard.title')}</h1>
 *   <button onClick={() => setLocale('en')}>English</button>
 */
export function useLocale(): LocaleContextType {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
}
