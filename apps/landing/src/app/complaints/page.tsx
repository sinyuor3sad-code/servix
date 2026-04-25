import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Zap, Clock, FileText, MessageCircle, Mail, Share2 } from 'lucide-react';
import { fetchLegalInfo, hasValue, formatPhoneLink, buildSocialChannels } from '@/lib/legal-info';
import ComplaintForm from './complaint-form';

export const metadata: Metadata = {
  title: 'تقديم شكوى — SERVIX',
  description: 'نموذج تقديم الشكاوى الرسمي مع رقم مرجعي ومتابعة موثقة وفق متطلبات وزارة التجارة.',
};

export const revalidate = 300;

export default async function ComplaintsPage() {
  const info = await fetchLegalInfo();
  const socialChannels = buildSocialChannels(info.social);
  const whatsappUrl = hasValue(info.support.whatsapp)
    ? info.support.whatsapp.startsWith('http')
      ? info.support.whatsapp
      : `https://wa.me/${formatPhoneLink(info.support.whatsapp).replace(/^\+/, '')}`
    : null;
  const hasAltChannels = whatsappUrl !== null || hasValue(info.support.email) || socialChannels.length > 0;

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

      <main className="relative mx-auto max-w-3xl px-4 pb-20 pt-10 sm:px-6">
        <div className="text-center">
          <FileText className="mx-auto h-8 w-8" style={{ color: '#a855f7' }} />
          <h1 className="mt-4 text-3xl font-black text-white sm:text-4xl">تقديم شكوى</h1>
          <p className="mt-3 text-base text-white/50">
            نسعى لمعالجة كل شكوى بشكل عادل وموثق. سيصلك رقم مرجعي بعد الإرسال للمتابعة.
          </p>
        </div>

        {(hasValue(info.complaints.responseTimeAr) || hasValue(info.complaints.resolutionTimeAr)) && (
          <div
            className="mt-10 grid gap-4 sm:grid-cols-2"
          >
            {hasValue(info.complaints.responseTimeAr) && (
              <div className="rounded-2xl border border-white/[0.07] p-5"
                style={{ background: 'rgba(34,197,94,0.04)' }}>
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-300/80">
                  <Clock className="h-3.5 w-3.5" /> وقت الرد
                </div>
                <p className="mt-2 text-base text-white/85">{info.complaints.responseTimeAr}</p>
              </div>
            )}
            {hasValue(info.complaints.resolutionTimeAr) && (
              <div className="rounded-2xl border border-white/[0.07] p-5"
                style={{ background: 'rgba(168,85,247,0.04)' }}>
                <div className="flex items-center gap-2 text-xs font-bold text-fuchsia-300/80">
                  <Clock className="h-3.5 w-3.5" /> وقت المعالجة
                </div>
                <p className="mt-2 text-base text-white/85">{info.complaints.resolutionTimeAr}</p>
              </div>
            )}
          </div>
        )}

        <ComplaintForm />

        {hasAltChannels && (
          <section
            className="mt-10 rounded-2xl border border-white/[0.07] p-6"
            style={{ background: 'rgba(99,102,241,0.04)' }}
          >
            <div className="flex items-center gap-2 text-sm font-bold text-indigo-200/90">
              <Share2 className="h-4 w-4" /> قنوات بديلة لتقديم الشكوى
            </div>
            <p className="mt-2 text-xs text-white/50">
              يمكنك أيضًا تقديم شكوى عبر القنوات التالية، وسيتم منحك رقمًا مرجعيًا قابلاً للمتابعة.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {whatsappUrl && (
                <a
                  href={whatsappUrl} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-sm text-white/85 hover:bg-white/[0.04]"
                >
                  <MessageCircle className="h-4 w-4 text-emerald-300" />
                  <span>واتساب الدعم</span>
                </a>
              )}
              {hasValue(info.support.email) && (
                <a
                  href={`mailto:${info.support.email}?subject=${encodeURIComponent('شكوى رسمية')}`}
                  className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-sm text-white/85 hover:bg-white/[0.04]"
                  dir="ltr"
                >
                  <Mail className="h-4 w-4 text-violet-300" />
                  <span>{info.support.email}</span>
                </a>
              )}
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
            <p className="mt-3 text-[11px] text-white/30">
              ملاحظة: نموذج الموقع هو القناة الرسمية الموثقة — القنوات الأخرى تُحوَّل داخليًا إلى نفس نظام التتبع.
            </p>
          </section>
        )}

        <div className="mt-10 text-center text-xs text-white/30">
          سياسة الخصوصية تطبق على هذا النموذج. راجع/ي{' '}
          <Link href="/privacy" className="underline">سياسة الخصوصية</Link> و{' '}
          <Link href="/terms" className="underline">الشروط والأحكام</Link>.
        </div>
      </main>
    </div>
  );
}
