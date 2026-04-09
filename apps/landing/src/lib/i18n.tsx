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
    'nav.capabilities': 'المميزات',
    'nav.howItWorks': 'كيف تبدأين',
    'nav.pricing': 'الأسعار',
    'nav.login': 'تسجيل الدخول',
    'nav.cta': 'جرّب مجاناً',
    'nav.ctaMobile': 'جرّب مجاناً ١٤ يوم',

    // Hero
    'hero.tagline': 'منصة إدارة الصالونات الأولى في السعودية',
    'hero.title1': 'أدِري صالونك',
    'hero.titleAccent': 'بذكاء',
    'hero.subtitle': 'مواعيد ذكية، فواتير ZATCA، واتساب مخصص، وتقارير متقدمة — كل شيء في منصة واحدة.',
    'hero.cta': 'ابدئي تجربتك المجانية',
    'hero.trust1': 'بيانات مشفرة',
    'hero.trust2': '١٤ يوم مجاناً',
    'hero.trust3': 'بلا بطاقة ائتمان',

    // Marquee
    'marquee.salons': '+٢٠٠ صالون يثق بنا',
    'marquee.appointments': '+٥٠,٠٠٠ موعد شهرياً',
    'marquee.uptime': '٩٩.٩٪ وقت تشغيل',
    'marquee.rating': '٤.٩ متوسط التقييم',

    // Product Showcase
    'showcase.title': 'شاهد النظام',
    'showcase.titleAccent': 'يعمل',
    'showcase.subtitle': 'لوحة تحكم ذكية تمنحك رؤية كاملة لصالونك — مواعيد، إيرادات، وأداء الفريق في مكان واحد.',
    'showcase.label1': 'لوحة تحكم مباشرة',
    'showcase.label2': 'تقارير ذكية',
    'showcase.label3': 'إدارة المواعيد',
    'showcase.label4': 'تتبع الإيرادات',

    // Capabilities
    'capabilities.title': 'ما يميّز',
    'capabilities.titleAccent': 'SERVIX',
    'capabilities.subtitle': 'أدوات متكاملة صُممت خصيصاً لصالونات التجميل السعودية',
    'capabilities.calendar.title': 'إدارة المواعيد',
    'capabilities.calendar.desc': 'تقويم ذكي بعرض يومي وأسبوعي، تأكيد تلقائي، وحجز إلكتروني مباشر.',
    'capabilities.whatsapp.title': 'واتساب خاص لكل صالون',
    'capabilities.whatsapp.desc': 'اربطي رقمك الخاص — تأكيدات، تذكيرات، وفواتير تُرسل من رقم صالونك.',
    'capabilities.pos.title': 'نقاط البيع وفواتير ZATCA',
    'capabilities.pos.desc': 'فواتير إلكترونية متوافقة مع هيئة الزكاة — QR كود وضريبة ١٥٪ تلقائياً.',
    'capabilities.reports.title': 'تقارير وإحصائيات',
    'capabilities.reports.desc': 'إيرادات، الخدمات الأكثر طلباً، وأداء الموظفات في لوحة واحدة.',
    'capabilities.loyalty.title': 'نظام الولاء',
    'capabilities.loyalty.desc': 'نقاط وكوبونات تشجع عميلاتك على العودة وزيادة معدل الزيارات.',
    'capabilities.booking.title': 'صفحة حجز خاصة',
    'capabilities.booking.desc': 'رابط فريد لصالونك — موبايل أولاً، سريع، واحترافي.',

    // How it works
    'howItWorks.title': 'ابدئي في',
    'howItWorks.titleAccent': '٣ خطوات',
    'howItWorks.step1.title': 'سجّلي حسابك',
    'howItWorks.step1.desc': 'أنشئي حسابك مجاناً خلال دقيقتين — بلا بطاقة ائتمان، بلا التزام.',
    'howItWorks.step2.title': 'جهّزي صالونك',
    'howItWorks.step2.desc': 'أضيفي خدماتك وموظفاتك وأوقات العمل — المعالج يرشدك خطوة بخطوة.',
    'howItWorks.step3.title': 'ابدئي الاستقبال',
    'howItWorks.step3.desc': 'شاركي رابط الحجز واستقبلي عميلاتك — SERVIX يدير الباقي.',

    // Stats
    'stats.salons': 'صالون نشط',
    'stats.appointments': 'موعد شهرياً',
    'stats.uptime': 'وقت تشغيل',
    'stats.rating': 'متوسط التقييم',

    // Testimonials
    'testimonials.title': 'صاحبات الصالونات',
    'testimonials.titleAccent': 'يتحدثن',

    // Pricing
    'pricing.title': 'خطة تناسب',
    'pricing.titleAccent': 'كل صالون',
    'pricing.subtitle': '١٤ يوم تجربة مجانية — لا بطاقة ائتمان مطلوبة',
    'pricing.note': '* جميع الأسعار شاملة ضريبة القيمة المضافة ١٥٪ · متاح اشتراك سنوي بخصم ٢٠٪',

    // FAQ
    'faq.title': 'أسئلتك',
    'faq.titleAccent': 'مجاوبة',

    // CTA
    'cta.tagline': '١٤ يوم مجاناً — بلا بطاقة',
    'cta.title': 'جاهزة لبدء رحلتك',
    'cta.titleAccent': 'مع SERVIX؟',
    'cta.subtitle': 'انضمي لمئات صاحبات الصالونات اللواتي حوّلن إدارة صالوناتهن بالكامل.',
    'cta.button': 'ابدئي تجربتك المجانية',
    'cta.trust1': 'لا بطاقة ائتمان',
    'cta.trust2': 'إلغاء في أي وقت',
    'cta.trust3': 'دعم عربي ٢٤/٧',

    // Footer
    'footer.desc': 'منصة ذكية لإدارة صالونات التجميل السعودية — مواعيد، فواتير ZATCA، واتساب، وتقارير متقدمة.',
    'footer.product': 'المنتج',
    'footer.legal': 'قانوني',
    'footer.account': 'الحساب',
    'footer.features': 'المميزات',
    'footer.pricing': 'الأسعار',
    'footer.howItWorks': 'كيف تبدأين',
    'footer.terms': 'الشروط والأحكام',
    'footer.privacy': 'سياسة الخصوصية',
    'footer.contact': 'تواصل معنا',
    'footer.login': 'تسجيل الدخول',
    'footer.register': 'إنشاء حساب',
    'footer.rights': '© {year} SERVIX. جميع الحقوق محفوظة.',
  },
  en: {
    // Navbar
    'nav.capabilities': 'Features',
    'nav.howItWorks': 'How it Works',
    'nav.pricing': 'Pricing',
    'nav.login': 'Login',
    'nav.cta': 'Try Free',
    'nav.ctaMobile': 'Try Free for 14 Days',

    // Hero
    'hero.tagline': '#1 Salon Management Platform in Saudi Arabia',
    'hero.title1': 'Manage Your Salon',
    'hero.titleAccent': 'Smartly',
    'hero.subtitle': 'Smart appointments, ZATCA invoices, dedicated WhatsApp, and advanced reports — all in one platform.',
    'hero.cta': 'Start Your Free Trial',
    'hero.trust1': 'Encrypted Data',
    'hero.trust2': '14 Days Free',
    'hero.trust3': 'No Credit Card',

    // Marquee
    'marquee.salons': '200+ Salons Trust Us',
    'marquee.appointments': '50,000+ Monthly Appointments',
    'marquee.uptime': '99.9% Uptime',
    'marquee.rating': '4.9 Average Rating',

    // Product Showcase
    'showcase.title': 'See the System',
    'showcase.titleAccent': 'in Action',
    'showcase.subtitle': 'A smart dashboard that gives you full visibility into your salon — appointments, revenue, and team performance in one place.',
    'showcase.label1': 'Live Dashboard',
    'showcase.label2': 'Smart Reports',
    'showcase.label3': 'Appointment Management',
    'showcase.label4': 'Revenue Tracking',

    // Capabilities
    'capabilities.title': 'What Makes',
    'capabilities.titleAccent': 'SERVIX Special',
    'capabilities.subtitle': 'Integrated tools built specifically for Saudi beauty salons',
    'capabilities.calendar.title': 'Appointment Management',
    'capabilities.calendar.desc': 'Smart calendar with daily and weekly views, auto-confirmation, and online booking.',
    'capabilities.whatsapp.title': 'Dedicated WhatsApp per Salon',
    'capabilities.whatsapp.desc': 'Connect your own number — confirmations, reminders, and invoices sent from your salon number.',
    'capabilities.pos.title': 'POS & ZATCA Invoices',
    'capabilities.pos.desc': 'Electronic invoices compliant with ZATCA — QR code and 15% VAT automatically applied.',
    'capabilities.reports.title': 'Reports & Analytics',
    'capabilities.reports.desc': 'Revenue, top services, and staff performance all in one dashboard.',
    'capabilities.loyalty.title': 'Loyalty System',
    'capabilities.loyalty.desc': 'Points and coupons that encourage your clients to return and increase visit frequency.',
    'capabilities.booking.title': 'Custom Booking Page',
    'capabilities.booking.desc': 'A unique link for your salon — mobile-first, fast, and professional.',

    // How it works
    'howItWorks.title': 'Get Started in',
    'howItWorks.titleAccent': '3 Steps',
    'howItWorks.step1.title': 'Create Your Account',
    'howItWorks.step1.desc': 'Sign up free in two minutes — no credit card, no commitment.',
    'howItWorks.step2.title': 'Set Up Your Salon',
    'howItWorks.step2.desc': 'Add your services, staff, and working hours — the wizard guides you step by step.',
    'howItWorks.step3.title': 'Start Receiving',
    'howItWorks.step3.desc': 'Share your booking link and welcome your clients — SERVIX handles the rest.',

    // Stats
    'stats.salons': 'Active Salons',
    'stats.appointments': 'Monthly Appointments',
    'stats.uptime': 'Uptime',
    'stats.rating': 'Average Rating',

    // Testimonials
    'testimonials.title': 'Salon Owners',
    'testimonials.titleAccent': 'Speak',

    // Pricing
    'pricing.title': 'A Plan for',
    'pricing.titleAccent': 'Every Salon',
    'pricing.subtitle': '14-day free trial — no credit card required',
    'pricing.note': '* All prices include 15% VAT · Annual subscription available with 20% discount',

    // FAQ
    'faq.title': 'Your Questions',
    'faq.titleAccent': 'Answered',

    // CTA
    'cta.tagline': '14 Days Free — No Card Needed',
    'cta.title': 'Ready to Start Your Journey',
    'cta.titleAccent': 'with SERVIX?',
    'cta.subtitle': 'Join hundreds of salon owners who have completely transformed their salon management.',
    'cta.button': 'Start Your Free Trial',
    'cta.trust1': 'No Credit Card',
    'cta.trust2': 'Cancel Anytime',
    'cta.trust3': '24/7 Arabic Support',

    // Footer
    'footer.desc': 'Smart platform for managing Saudi beauty salons — appointments, ZATCA invoices, WhatsApp, and advanced reports.',
    'footer.product': 'Product',
    'footer.legal': 'Legal',
    'footer.account': 'Account',
    'footer.features': 'Features',
    'footer.pricing': 'Pricing',
    'footer.howItWorks': 'How it Works',
    'footer.terms': 'Terms of Service',
    'footer.privacy': 'Privacy Policy',
    'footer.contact': 'Contact Us',
    'footer.login': 'Login',
    'footer.register': 'Create Account',
    'footer.rights': '© {year} SERVIX. All rights reserved.',
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
