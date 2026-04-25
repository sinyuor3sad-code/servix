import type { Metadata } from 'next';
import Link from 'next/link';
import { Building2, FileText, Hash, MapPin, Mail, Phone, MessageCircle, Clock } from 'lucide-react';
import { fetchLegalInfo, formatPhoneLink, hasValue } from '@/lib/legal-info';

export const metadata: Metadata = {
  title: 'بيانات المنشأة — SERVIX',
  description: 'بيانات المنشأة الرسمية وقنوات التواصل لـ SERVIX — وفق متطلبات الشفافية في وزارة التجارة السعودية.',
};

export const revalidate = 300;

interface Row {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  href?: string;
  ltr?: boolean;
}

export default async function AboutPage() {
  const info = await fetchLegalInfo();

  const merchantRows: Row[] = [
    { icon: Building2, label: 'الاسم التجاري', value: info.merchant.nameAr || 'سيرفكس' },
    { icon: Building2, label: 'الاسم بالإنجليزية', value: info.merchant.nameEn || 'SERVIX', ltr: true },
  ];
  if (hasValue(info.merchant.crNumber)) {
    merchantRows.push({ icon: FileText, label: 'رقم السجل التجاري', value: info.merchant.crNumber, ltr: true });
  }
  if (hasValue(info.merchant.vatNumber)) {
    merchantRows.push({ icon: Hash, label: 'الرقم الضريبي (VAT)', value: info.merchant.vatNumber, ltr: true });
  }
  if (hasValue(info.merchant.city) || hasValue(info.merchant.country)) {
    merchantRows.push({
      icon: MapPin,
      label: 'الموقع',
      value: [info.merchant.city, info.merchant.country].filter(hasValue).join('، '),
      href: hasValue(info.merchant.mapsUrl) ? info.merchant.mapsUrl : undefined,
    });
  }
  if (hasValue(info.merchant.address)) {
    merchantRows.push({ icon: MapPin, label: 'العنوان', value: info.merchant.address });
  }

  const supportRows: Row[] = [];
  if (hasValue(info.support.email)) {
    supportRows.push({
      icon: Mail, label: 'البريد الإلكتروني',
      value: info.support.email, href: `mailto:${info.support.email}`, ltr: true,
    });
  }
  if (hasValue(info.support.phone)) {
    supportRows.push({
      icon: Phone, label: 'الهاتف',
      value: info.support.phone, href: `tel:${formatPhoneLink(info.support.phone)}`, ltr: true,
    });
  }
  if (hasValue(info.support.whatsapp)) {
    const wa = info.support.whatsapp.startsWith('http')
      ? info.support.whatsapp
      : `https://wa.me/${formatPhoneLink(info.support.whatsapp).replace(/^\+/, '')}`;
    supportRows.push({
      icon: MessageCircle, label: 'واتساب الدعم',
      value: info.support.whatsapp, href: wa, ltr: true,
    });
  }
  if (hasValue(info.support.hours)) {
    supportRows.push({ icon: Clock, label: 'ساعات الدعم', value: info.support.hours });
  }

  const missingMerchantData =
    !hasValue(info.merchant.crNumber) && !hasValue(info.merchant.vatNumber);

  return (
    <div className="min-h-screen">
      <header className="glass sticky top-0 z-40 border-b border-white/[0.07]">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600">
              <span className="text-xs font-black text-white">SX</span>
            </div>
            <span className="text-lg font-black text-white">SERVIX</span>
          </Link>
          <Link href="/" className="text-sm text-white/50 hover:text-white transition-colors">
            العودة للرئيسية
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-16" dir="rtl">
        <h1 className="text-3xl font-black text-white">بيانات المنشأة</h1>
        <p className="mt-2 text-white/40">
          البيانات الرسمية المعتمدة لمنصة سيرفكس وقنوات التواصل المعلنة.
        </p>

        <section className="mt-10 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
          <h2 className="text-lg font-bold text-white">المنشأة</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            {merchantRows.map((r) => <RowCard key={r.label} row={r} />)}
          </dl>

          {missingMerchantData && (
            <p className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 text-xs leading-relaxed text-amber-100/70">
              لم يتم بعد إعداد رقم السجل التجاري أو الرقم الضريبي في إعدادات المنصة. سيتم عرضها هنا
              فور تحديثها من قِبل الإدارة. لا نعرض أي أرقام تجارية تجريبية.
            </p>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
          <h2 className="text-lg font-bold text-white">قنوات التواصل والدعم</h2>

          {supportRows.length ? (
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              {supportRows.map((r) => <RowCard key={r.label} row={r} />)}
            </dl>
          ) : (
            <p className="mt-4 text-sm text-white/50">
              يتم حالياً إعداد قنوات التواصل الرسمية. يمكنك في الوقت الحالي تسجيل شكوى أو استفسار عبر{' '}
              <Link href="/complaints" className="underline">صفحة الشكاوى</Link>.
            </p>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
          <h2 className="text-lg font-bold text-white">السياسات والوثائق</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            <PolicyLink href="/terms"          title="الشروط والأحكام" />
            <PolicyLink href="/privacy"        title="سياسة الخصوصية" />
            <PolicyLink href="/refund-policy"  title="الإلغاء والاسترداد" />
            <PolicyLink href="/complaints"     title="تقديم شكوى" />
            <PolicyLink href="/contact"        title="تواصل معنا" />
          </ul>
        </section>
      </main>
    </div>
  );
}

function RowCard({ row }: { row: Row }) {
  const Icon = row.icon;
  const content = (
    <>
      <dt className="flex items-center gap-2 text-xs font-bold text-white/40">
        <Icon className="h-3.5 w-3.5" /> {row.label}
      </dt>
      <dd className="mt-1.5 text-sm font-bold text-white/85" dir={row.ltr ? 'ltr' : undefined}>
        {row.value}
      </dd>
    </>
  );
  return row.href ? (
    <a
      href={row.href}
      target={row.href.startsWith('http') ? '_blank' : undefined}
      rel={row.href.startsWith('http') ? 'noreferrer' : undefined}
      className="block rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 transition-colors hover:border-white/15 hover:bg-white/[0.04]"
    >
      {content}
    </a>
  ) : (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
      {content}
    </div>
  );
}

function PolicyLink({ href, title }: { href: string; title: string }) {
  return (
    <li>
      <Link
        href={href}
        className="block rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-sm font-bold text-white/85 transition-colors hover:border-violet-400/30 hover:bg-violet-400/[0.05]"
      >
        {title}
      </Link>
    </li>
  );
}
