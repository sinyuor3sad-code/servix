import Link from 'next/link';
import {
  Calendar,
  CreditCard,
  Users,
  BarChart3,
  MessageCircle,
  Sparkles,
  Check,
  ChevronDown,
  Menu,
} from 'lucide-react';

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3000';

const features = [
  {
    icon: Calendar,
    titleAr: 'إدارة المواعيد',
    titleEn: 'Appointments',
    desc: 'تقويم ذكي، تذكيرات تلقائية، وحجز إلكتروني للعملاء',
  },
  {
    icon: CreditCard,
    titleAr: 'نقاط البيع والفواتير',
    titleEn: 'POS & Invoices',
    desc: 'فواتير احترافية، مدفوعات متعددة، وربط واتساب',
  },
  {
    icon: Users,
    titleAr: 'إدارة العملاء والموظفات',
    titleEn: 'Clients & Staff',
    desc: 'سجل عملاء، نظام ولاء، وحضور وانصراف الموظفات',
  },
  {
    icon: BarChart3,
    titleAr: 'تقارير وإحصائيات',
    titleEn: 'Reports',
    desc: 'إيرادات، مواعيد، وعملاء — كل ما تحتاجيه في مكان واحد',
  },
  {
    icon: MessageCircle,
    titleAr: 'واتساب لكل صالون',
    titleEn: 'WhatsApp',
    desc: 'ربط واتسابك الخاص — تأكيد حجز، تذكيرات، وإرسال فواتير',
  },
  {
    icon: Sparkles,
    titleAr: 'صفحة حجز خاصة',
    titleEn: 'Booking Page',
    desc: 'رابط حجز فريد لصالونك — احجزي من أي مكان',
  },
];

const steps = [
  { num: 1, titleAr: 'سجّل', titleEn: 'Sign up', desc: 'أنشئ حسابك في دقائق' },
  { num: 2, titleAr: 'أعدّ', titleEn: 'Set up', desc: 'أضيفي خدماتك وموظفاتك' },
  { num: 3, titleAr: 'ابدأ', titleEn: 'Go live', desc: 'شاركي رابط الحجز وابدئي الاستقبال' },
];

const plans = [
  {
    name: 'أساسي',
    price: 199,
    features: ['إدارة الخدمات', '100 عميل', '3 موظفات', 'المواعيد والفواتير', 'التقارير الأساسية'],
    cta: 'ابدأ التجربة',
  },
  {
    name: 'احترافي',
    price: 399,
    popular: true,
    features: ['كل أساسي', 'عملاء غير محدود', '10 موظفات', 'صفحة الحجز', 'التقارير المتقدمة', 'صلاحيات تفصيلية'],
    cta: 'جرّب 14 يوم مجاناً',
  },
  {
    name: 'مميز',
    price: 699,
    features: ['كل احترافي', 'موظفات غير محدود', 'الكوبونات', 'نظام الولاء', 'واتساب', 'تعدد الفروع'],
    cta: 'ابدأ الآن',
  },
];

const faqs = [
  {
    q: 'هل أحتاج بطاقة ائتمان للتجربة؟',
    a: 'لا. التجربة المجانية 14 يوم لا تتطلب أي بطاقة. يمكنك الاستفادة من كل مميزات الباقة الاحترافية.',
  },
  {
    q: 'هل بياناتي آمنة؟',
    a: 'نعم. كل صالون له قاعدة بيانات منفصلة. البيانات مشفرة ومعزولة تماماً.',
  },
  {
    q: 'كيف أربط واتساب؟',
    a: 'كل صالون يربط حسابه الخاص من Meta Business. الرسائل تخرج من رقم الصالون نفسه.',
  },
  {
    q: 'هل يدعم اللغة العربية؟',
    a: 'نعم. المنصة عربية بالكامل مع دعم RTL. يمكن للعملاء الحجز بالعربية.',
  },
];

export default function LandingPage(): React.ReactElement {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--border)] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="text-xl font-bold text-[var(--brand-primary)]">
            SERVIX
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            <a href="#features" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
              المميزات
            </a>
            <a href="#pricing" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
              الأسعار
            </a>
            <a href="#faq" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
              الأسئلة
            </a>
            <Link
              href={`${DASHBOARD_URL}/register`}
              className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              جرّب مجاناً
            </Link>
          </nav>
          <button className="md:hidden" aria-label="القائمة">
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-24 pb-16 md:pt-32 md:pb-24">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
            أديري صالونك
            <br />
            <span className="text-[var(--brand-primary)]">بسهولة واحترافية</span>
          </h1>
          <p className="mt-6 text-lg text-[var(--muted-foreground)] md:text-xl">
            مواعيد، فواتير، عملاء، واتساب — كل ما تحتاجيه في منصة واحدة
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href={`${DASHBOARD_URL}/register`}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand-primary)] px-8 py-4 text-lg font-semibold text-white shadow-lg hover:opacity-90"
            >
              <Sparkles className="h-5 w-5" />
              جرّب مجاناً 14 يوم
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-8 py-4 text-lg font-medium hover:bg-[var(--muted)]"
            >
              اكتشفي المميزات
              <ChevronDown className="h-5 w-5" />
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-[var(--border)] bg-[var(--muted)]/30 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold md:text-4xl">لماذا SERVIX؟</h2>
          <p className="mt-4 text-center text-[var(--muted-foreground)]">
            كل ما تحتاجيه لإدارة صالونك من مكان واحد
          </p>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.titleAr}
                  className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--brand-primary)]/10">
                    <Icon className="h-6 w-6 text-[var(--brand-primary)]" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{f.titleAr}</h3>
                  <p className="mt-2 text-sm text-[var(--muted-foreground)]">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-4">
          <h2 className="text-center text-3xl font-bold md:text-4xl">كيف تبدأين؟</h2>
          <p className="mt-4 text-center text-[var(--muted-foreground)]">
            3 خطوات بسيطة وصالونك جاهز
          </p>
          <div className="mt-16 flex flex-col gap-8 md:flex-row md:justify-between">
            {steps.map((s) => (
              <div key={s.num} className="flex flex-col items-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--brand-primary)] text-2xl font-bold text-white">
                  {s.num}
                </div>
                <h3 className="mt-4 text-xl font-semibold">{s.titleAr}</h3>
                <p className="mt-2 text-sm text-[var(--muted-foreground)]">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-[var(--border)] bg-[var(--muted)]/30 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold md:text-4xl">الأسعار</h2>
          <p className="mt-4 text-center text-[var(--muted-foreground)]">
            خطط تناسب كل صالون — ابدئي بالتجربة المجانية
          </p>
          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {plans.map((p) => (
              <div
                key={p.name}
                className={`relative rounded-2xl border p-6 ${
                  p.popular
                    ? 'border-[var(--brand-primary)] bg-white shadow-lg'
                    : 'border-[var(--border)] bg-white'
                }`}
              >
                {p.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--brand-primary)] px-3 py-1 text-xs font-medium text-white">
                    الأكثر طلباً
                  </span>
                )}
                <h3 className="text-xl font-bold">{p.name}</h3>
                <p className="mt-2">
                  <span className="text-3xl font-bold">{p.price}</span>
                  <span className="text-[var(--muted-foreground)]"> ر.س/شهر</span>
                </p>
                <ul className="mt-6 space-y-3">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className="h-5 w-5 shrink-0 text-[var(--brand-primary)]" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`${DASHBOARD_URL}/register`}
                  className={`mt-8 block w-full rounded-lg py-3 text-center font-medium ${
                    p.popular
                      ? 'bg-[var(--brand-primary)] text-white hover:opacity-90'
                      : 'border border-[var(--border)] hover:bg-[var(--muted)]'
                  }`}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-center text-3xl font-bold md:text-4xl">الأسئلة الشائعة</h2>
          <div className="mt-16 space-y-6">
            {faqs.map((faq) => (
              <details
                key={faq.q}
                className="group rounded-xl border border-[var(--border)] p-4"
              >
                <summary className="cursor-pointer font-medium">{faq.q}</summary>
                <p className="mt-3 text-sm text-[var(--muted-foreground)]">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[var(--border)] bg-[var(--brand-primary)] py-20">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="text-3xl font-bold text-white md:text-4xl">
            جاهزة لبدء إدارة صالونك؟
          </h2>
          <p className="mt-4 text-lg text-white/90">
            انضمي لآلاف صاحبات الصالونات — جرّبي 14 يوم مجاناً
          </p>
          <Link
            href={`${DASHBOARD_URL}/register`}
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-lg font-semibold text-[var(--brand-primary)] hover:bg-white/90"
          >
            ابدئي الآن
            <Sparkles className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] bg-[var(--muted)]/50 py-12">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <Link href="/" className="text-xl font-bold text-[var(--brand-primary)]">
              SERVIX
            </Link>
            <nav className="flex flex-wrap justify-center gap-6">
              <Link href="/terms" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                الشروط والأحكام
              </Link>
              <Link href="/privacy" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                سياسة الخصوصية
              </Link>
              <Link href={`${DASHBOARD_URL}/login`} className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                تسجيل الدخول
              </Link>
            </nav>
          </div>
          <p className="mt-8 text-center text-sm text-[var(--muted-foreground)]">
            © {new Date().getFullYear()} SERVIX. جميع الحقوق محفوظة.
          </p>
        </div>
      </footer>
    </div>
  );
}
