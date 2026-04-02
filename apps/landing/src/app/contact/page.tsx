import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail, MapPin, Phone, MessageCircle, ArrowRight, Zap } from 'lucide-react';

export const metadata: Metadata = {
  title: 'تواصل معنا — SERVIX',
  description: 'تواصل مع فريق SERVIX للاستفسارات والدعم الفني. نحن هنا لمساعدتك.',
};

const CONTACTS = [
  {
    icon: Mail,
    title: 'البريد الإلكتروني',
    value: 'hello@servi-x.com',
    href: 'mailto:hello@servi-x.com',
    desc: 'للاستفسارات العامة والشراكات',
    color: '#a855f7',
  },
  {
    icon: Phone,
    title: 'الهاتف',
    value: '+966 50 000 0000',
    href: 'tel:+966500000000',
    desc: 'من الأحد إلى الخميس، 9 ص - 6 م',
    color: '#22d3ee',
  },
  {
    icon: MessageCircle,
    title: 'واتساب',
    value: 'محادثة مباشرة',
    href: 'https://wa.me/966500000000',
    desc: 'دعم فوري عبر واتساب',
    color: '#22c55e',
  },
  {
    icon: MapPin,
    title: 'الموقع',
    value: 'الرياض، السعودية',
    href: '#',
    desc: 'المملكة العربية السعودية',
    color: '#f59e0b',
  },
];

export default function ContactPage() {
  return (
    <div className="min-h-screen" style={{ background: '#03020a' }} dir="rtl">
      {/* Nav */}
      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-4 py-6 sm:px-6">
        <Link href="/" className="group inline-flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: 'linear-gradient(135deg, #9333ea, #6366f1)' }}
          >
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-black text-white">SERVIX</span>
        </Link>
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-white/40 transition-colors hover:text-white/70"
        >
          الرئيسية
          <ArrowRight className="h-3.5 w-3.5 rotate-180" />
        </Link>
      </nav>

      <main className="relative mx-auto max-w-4xl px-4 pb-20 pt-10 sm:px-6">
        {/* Header */}
        <div className="text-center">
          <h1
            className="text-4xl font-black text-white sm:text-5xl"
            style={{ textShadow: '0 0 40px rgba(168,85,247,0.3)' }}
          >
            تواصل معنا
          </h1>
          <p className="mt-4 text-lg text-white/40">
            فريقنا جاهز لمساعدتك. اختاري الطريقة المناسبة للتواصل.
          </p>
        </div>

        {/* Contact Cards */}
        <div className="mt-14 grid gap-4 sm:grid-cols-2">
          {CONTACTS.map((c) => {
            const Icon = c.icon;
            return (
              <a
                key={c.title}
                href={c.href}
                target={c.href.startsWith('http') ? '_blank' : undefined}
                rel={c.href.startsWith('http') ? 'noreferrer' : undefined}
                className="group relative overflow-hidden rounded-2xl border border-white/[0.07] p-6 transition-all duration-300 hover:border-white/[0.15]"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
                  backdropFilter: 'blur(20px)',
                }}
              >
                <div
                  className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{ background: `${c.color}15`, border: `1px solid ${c.color}20` }}
                >
                  <Icon className="h-5 w-5" style={{ color: c.color }} />
                </div>
                <h3 className="text-sm font-bold text-white/50">{c.title}</h3>
                <p className="mt-1 text-lg font-bold text-white/90 group-hover:text-white" dir="ltr">
                  {c.value}
                </p>
                <p className="mt-2 text-xs text-white/25">{c.desc}</p>
              </a>
            );
          })}
        </div>

        {/* FAQ prompt */}
        <div
          className="mt-14 rounded-2xl border border-white/[0.07] p-8 text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(168,85,247,0.05) 0%, rgba(99,102,241,0.03) 100%)',
          }}
        >
          <h2 className="text-xl font-bold text-white/70">لديك أسئلة شائعة؟</h2>
          <p className="mt-2 text-sm text-white/35">
            ربما تجدين الإجابة في قسم الأسئلة الشائعة على الصفحة الرئيسية.
          </p>
          <Link
            href="/#faq"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-purple-600 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-purple-500"
          >
            الأسئلة الشائعة
          </Link>
        </div>

        {/* Support email */}
        <div className="mt-10 text-center">
          <p className="text-xs text-white/20">
            للدعم الفني: <a href="mailto:support@servi-x.com" className="text-violet-400/50 hover:text-violet-400">support@servi-x.com</a>
            {' · '}
            لطلبات البيانات: <a href="mailto:privacy@servi-x.com" className="text-violet-400/50 hover:text-violet-400">privacy@servi-x.com</a>
          </p>
        </div>
      </main>
    </div>
  );
}
