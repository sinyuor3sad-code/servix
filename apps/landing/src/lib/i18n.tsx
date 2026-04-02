'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

export type Locale = 'ar' | 'en';

interface I18nContextValue {
  locale: Locale;
  dir: 'rtl' | 'ltr';
  toggle: () => void;
  t: (key: string) => string;
}

const translations: Record<Locale, Record<string, string>> = {
  ar: {
    // Navbar
    'nav.features': 'المميزات',
    'nav.howItWorks': 'كيف تبدأين',
    'nav.devices': 'الأجهزة',
    'nav.pricing': 'الأسعار',
    'nav.login': 'تسجيل الدخول',
    'nav.cta': 'جرّب مجاناً',
    'nav.ctaMobile': 'جرّب مجاناً ١٤ يوم',

    // Hero
    'hero.badge': 'منصة إدارة الصالونات #1 في السعودية',
    'hero.title': 'أدِري صالونك بذكاء',
    'hero.subtitle': 'مواعيد — فواتير — واتساب — تقارير — كل شيء في مكان واحد',
    'hero.cta': 'جرّبي مجاناً ١٤ يوم',
    'hero.ctaSub': 'بدون بطاقة ائتمانية',

    // Features
    'features.title': 'كل ما تحتاجينه لإدارة صالونك',
    'features.subtitle': 'أدوات ذكية تسهّل عملك اليومي',

    // How it works
    'howItWorks.title': 'ابدئي في ٣ خطوات',
    'howItWorks.step1.title': 'سجّلي حسابك',
    'howItWorks.step1.desc': 'أنشئي حسابك مجاناً خلال دقيقة',
    'howItWorks.step2.title': 'أعدّي صالونك',
    'howItWorks.step2.desc': 'أضيفي خدماتك وموظفاتك وساعات العمل',
    'howItWorks.step3.title': 'ابدئي العمل',
    'howItWorks.step3.desc': 'استقبلي الحجوزات وأديري كل شيء من لوحة التحكم',

    // Pricing
    'pricing.title': 'باقات تناسب كل صالون',
    'pricing.monthly': 'شهري',
    'pricing.annual': 'سنوي',
    'pricing.currency': 'ر.س',
    'pricing.perMonth': '/شهر',
    'pricing.subscribe': 'اشتركي الآن',
    'pricing.trial': 'جرّبي مجاناً',

    // FAQ
    'faq.title': 'أسئلة شائعة',

    // CTA
    'cta.title': 'جاهزة تبدئين؟',
    'cta.subtitle': 'انضمّي لأكثر من ١٠٠ صالون يدير أعماله بذكاء مع SERVIX',
    'cta.button': 'ابدئي تجربتك المجانية',

    // Footer
    'footer.rights': 'جميع الحقوق محفوظة',
    'footer.terms': 'الشروط والأحكام',
    'footer.privacy': 'سياسة الخصوصية',
    'footer.contact': 'تواصل معنا',
  },
  en: {
    // Navbar
    'nav.features': 'Features',
    'nav.howItWorks': 'How it Works',
    'nav.devices': 'Devices',
    'nav.pricing': 'Pricing',
    'nav.login': 'Login',
    'nav.cta': 'Try Free',
    'nav.ctaMobile': 'Try Free for 14 Days',

    // Hero
    'hero.badge': '#1 Salon Management Platform in Saudi Arabia',
    'hero.title': 'Manage Your Salon Smartly',
    'hero.subtitle': 'Appointments — Invoices — WhatsApp — Reports — All in one place',
    'hero.cta': 'Try Free for 14 Days',
    'hero.ctaSub': 'No credit card required',

    // Features
    'features.title': 'Everything You Need to Run Your Salon',
    'features.subtitle': 'Smart tools to simplify your daily work',

    // How it works
    'howItWorks.title': 'Get Started in 3 Steps',
    'howItWorks.step1.title': 'Create Your Account',
    'howItWorks.step1.desc': 'Sign up free in under a minute',
    'howItWorks.step2.title': 'Set Up Your Salon',
    'howItWorks.step2.desc': 'Add your services, staff, and working hours',
    'howItWorks.step3.title': 'Start Working',
    'howItWorks.step3.desc': 'Accept bookings and manage everything from your dashboard',

    // Pricing
    'pricing.title': 'Plans for Every Salon',
    'pricing.monthly': 'Monthly',
    'pricing.annual': 'Annual',
    'pricing.currency': 'SAR',
    'pricing.perMonth': '/mo',
    'pricing.subscribe': 'Subscribe Now',
    'pricing.trial': 'Try Free',

    // FAQ
    'faq.title': 'Frequently Asked Questions',

    // CTA
    'cta.title': 'Ready to Start?',
    'cta.subtitle': 'Join 100+ salons managing their business smartly with SERVIX',
    'cta.button': 'Start Your Free Trial',

    // Footer
    'footer.rights': 'All rights reserved',
    'footer.terms': 'Terms of Service',
    'footer.privacy': 'Privacy Policy',
    'footer.contact': 'Contact Us',
  },
};

const I18nContext = createContext<I18nContextValue>({
  locale: 'ar',
  dir: 'rtl',
  toggle: () => {},
  t: (key) => key,
});

export function I18nProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [locale, setLocale] = useState<Locale>('ar');

  const toggle = useCallback(() => {
    setLocale((prev) => (prev === 'ar' ? 'en' : 'ar'));
  }, []);

  const t = useCallback(
    (key: string) => translations[locale][key] || key,
    [locale],
  );

  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  // Update document direction and lang when locale changes
  useEffect(() => {
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', locale);
  }, [locale, dir]);

  return (
    <I18nContext.Provider value={{ locale, dir, toggle, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
