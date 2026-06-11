import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail, MapPin, Phone, MessageCircle, ArrowRight, Zap, FileWarning, Share2 } from 'lucide-react';
import { fetchLegalInfo, formatPhoneLink, hasValue, buildSocialChannels } from '@/lib/legal-info';

export const metadata: Metadata = {
  title: 'تواصل معنا — SERVIX',
  description: 'تواصل مع فريق SERVIX للاستفسارات والدعم الفني. نحن هنا لمساعدتك.',
};

export const revalidate = 300;

export default async function ContactPage() {
  const info = await fetchLegalInfo();
  const socialChannels = buildSocialChannels(info.social);

  type Card = { icon: typeof Mail; title: string; value: string; href: string; desc: string; color: string };
  const cards: Card[] = [];

  if (hasValue(info.support.email)) {
    cards.push({
      icon: Mail, title: 'البريد الإلكتروني',
      value: info.support.email, href: `mailto:${info.support.email}`,
      desc: 'للاستفسارات العامة والشراكات', color: '#a855f7',
    });
  }
  if (hasValue(info.support.phone)) {
    cards.push({
      icon: Phone, title: 'الهاتف',
      value: info.support.phone, href: `tel:${formatPhoneLink(info.support.phone)}`,
      desc: hasValue(info.support.hours) ? info.support.hours : 'خلال ساعات الدعم الرسمية',
      color: '#22d3ee',
    });
  }
  if (hasValue(info.support.whatsapp)) {
    const wa = info.support.whatsapp.startsWith('http')
      ? info.support.whatsapp
      : `https://wa.me/${formatPhoneLink(info.support.whatsapp).replace(/^\+/, '')}`;
    cards.push({
      icon: MessageCircle, title: 'واتساب',
      value: 'محادثة مباشرة', href: wa,
      desc: 'دعم فوري عبر واتساب', color: '#22c55e',
    });
  }
  if (hasValue(info.merchant.city) || hasValue(info.merchant.country)) {
    cards.push({
      icon: MapPin, title: 'الموقع',
      value: [info.merchant.city, info.merchant.country].filter(hasValue).join('، '),
      href: hasValue(info.merchant.mapsUrl) ? info.merchant.mapsUrl : '#',
      desc: hasValue(info.merchant.address) ? info.merchant.address : 'المملكة العربية السعودية',
      color: '#f59e0b',
    });
  }

  return (
    <div className="min-h-screen" style={{ background: '#03020a' }} dir="rtl">
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

        {cards.length > 0 ? (
          <div className="mt-14 grid gap-4 sm:grid-cols-2">
            {cards.map((c) => {
              const Icon = c.icon;
              const isExternal = c.href.startsWith('http');
              return (
                <a
                  key={c.title}
                  href={c.href}
                  target={isExternal ? '_blank' : undefined}
                  rel={isExternal ? 'noreferrer' : undefined}
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
        ) : (
          <div
            className="mt-14 rounded-2xl border border-white/[0.07] p-8 text-center"
            style={{ background: 'rgba(255,255,255,0.02)' }}
          >
            <p className="text-white/60">يتم حالياً إعداد قنوات التواصل الرسمية.</p>
            <p className="mt-2 text-sm text-white/35">
              تقدر/ين بإرسال شكوى مباشرة عبر صفحة <Link href="/complaints" className="underline">الشكاوى</Link>.
            </p>
          </div>
        )}

        {socialChannels.length > 0 && (
          <div
            className="mt-10 rounded-2xl border border-white/[0.07] p-6"
            style={{ background: 'rgba(168,85,247,0.04)' }}
          >
            <div className="flex items-center gap-2 text-sm font-bold text-fuchsia-200/90">
              <Share2 className="h-4 w-4" /> تابعنا أو راسلنا عبر التواصل الاجتماعي
            </div>
            <p className="mt-2 text-xs text-white/40">
              يمكنك التواصل معنا أو تقديم شكوى عبر أي من هذه القنوات.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {socialChannels.map((ch) => (
                <a
                  key={ch.key} href={ch.url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-sm text-white/85 hover:bg-white/[0.04]"
                >
                  <Share2 className="h-4 w-4 text-fuchsia-300" />
                  <span>{ch.label}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        <div
          className="mt-10 rounded-2xl border border-white/[0.07] p-8 text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(244,114,182,0.05) 0%, rgba(168,85,247,0.03) 100%)',
          }}
        >
          <FileWarning className="mx-auto h-6 w-6" style={{ color: '#f472b6' }} />
          <h2 className="mt-3 text-xl font-bold text-white/80">عندك شكوى رسمية؟</h2>
          <p className="mt-2 text-sm text-white/40">
            استخدم/ي نموذج الشكاوى لتسجيل شكواك ومتابعتها برقم مرجعي.
          </p>
          <Link
            href="/complaints"
            className="mt-5 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white transition-all"
            style={{ background: '#a855f7' }}
          >
            تقديم شكوى
          </Link>
        </div>

        <div className="mt-14 rounded-2xl border border-white/[0.07] p-8 text-center"
          style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.05) 0%, rgba(99,102,241,0.03) 100%)' }}
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
      </main>
    </div>
  );
}
