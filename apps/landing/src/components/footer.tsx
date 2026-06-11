import Link from 'next/link';
import { Mail, MapPin, Phone, MessageCircle, FileText, Hash, Share2 } from 'lucide-react';
import { fetchLegalInfo, formatPhoneLink, hasValue, buildSocialChannels } from '@/lib/legal-info';

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3000';

const productLinks = [
  { label: 'المميزات',    href: '#capabilities' },
  { label: 'الأسعار',     href: '#pricing' },
  { label: 'كيف تبدأين',  href: '#how-it-works' },
];

const accountLinks = [
  { label: 'تسجيل الدخول', href: `${DASHBOARD_URL}/login` },
  { label: 'إنشاء حساب',   href: `${DASHBOARD_URL}/register` },
];

const legalLinks = [
  { label: 'الشروط والأحكام',          href: '/terms' },
  { label: 'سياسة الخصوصية',           href: '/privacy' },
  { label: 'الإلغاء والاسترداد',       href: '/refund-policy' },
  { label: 'تواصل معنا',               href: '/contact' },
  { label: 'تقديم شكوى',               href: '/complaints' },
  { label: 'بيانات المنشأة',           href: '/about' },
];

export default async function Footer() {
  const info = await fetchLegalInfo();
  const locationLine =
    [info.merchant.city, info.merchant.country].filter(hasValue).join('، ') || null;
  const socialChannels = buildSocialChannels(info.social);

  return (
    <footer style={{ borderTop: '1px solid var(--border)' }}>
      <div className="relative mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">

          {/* Brand column */}
          <div className="lg:col-span-2">
            <Link href="/" className="inline-flex items-center gap-2">
              <span className="text-xl font-black" style={{ color: 'var(--fg)' }}>
                {info.merchant.nameEn || 'SERVIX'}
              </span>
            </Link>

            <p className="mt-4 max-w-xs text-sm leading-relaxed" style={{ color: 'var(--fg-secondary)' }}>
              منصة ذكية لإدارة صالونات التجميل السعودية — مواعيد، فواتير ZATCA، واتساب، وتقارير متقدمة.
            </p>

            <div className="mt-5 space-y-2">
              {locationLine && (
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--fg-secondary)' }}>
                  <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--gold)' }} />
                  {locationLine}
                </div>
              )}

              {hasValue(info.support.email) && (
                <a
                  href={`mailto:${info.support.email}`}
                  className="flex items-center gap-2 text-sm hover:opacity-80"
                  style={{ color: 'var(--fg-secondary)' }}
                  dir="ltr"
                >
                  <Mail className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--gold)' }} />
                  {info.support.email}
                </a>
              )}

              {hasValue(info.support.phone) && (
                <a
                  href={`tel:${formatPhoneLink(info.support.phone)}`}
                  className="flex items-center gap-2 text-sm hover:opacity-80"
                  style={{ color: 'var(--fg-secondary)' }}
                  dir="ltr"
                >
                  <Phone className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--gold)' }} />
                  {info.support.phone}
                </a>
              )}

              {hasValue(info.support.whatsapp) && (
                <a
                  href={
                    info.support.whatsapp.startsWith('http')
                      ? info.support.whatsapp
                      : `https://wa.me/${formatPhoneLink(info.support.whatsapp).replace(/^\+/, '')}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-sm hover:opacity-80"
                  style={{ color: 'var(--fg-secondary)' }}
                >
                  <MessageCircle className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--gold)' }} />
                  واتساب الدعم
                </a>
              )}

              {hasValue(info.merchant.crNumber) && (
                <div
                  className="flex items-center gap-2 text-xs"
                  style={{ color: 'var(--fg-muted)' }}
                  dir="ltr"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--gold)' }} />
                  س.ت: {info.merchant.crNumber}
                </div>
              )}

              {hasValue(info.merchant.vatNumber) && (
                <div
                  className="flex items-center gap-2 text-xs"
                  style={{ color: 'var(--fg-muted)' }}
                  dir="ltr"
                >
                  <Hash className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--gold)' }} />
                  VAT: {info.merchant.vatNumber}
                </div>
              )}
            </div>

            {socialChannels.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                {socialChannels.map((ch) => (
                  <a
                    key={ch.key}
                    href={ch.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={ch.label}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs hover:opacity-80"
                    style={{ borderColor: 'var(--border)', color: 'var(--fg-secondary)' }}
                  >
                    <Share2 className="h-3 w-3" style={{ color: 'var(--gold)' }} />
                    {ch.label}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Product links */}
          <FooterColumn title="المنتج">
            {productLinks.map((l) => (
              <FooterLink key={l.href} href={l.href} label={l.label} />
            ))}
          </FooterColumn>

          {/* Legal links */}
          <FooterColumn title="قانوني">
            {legalLinks.map((l) => (
              <FooterLink key={l.href} href={l.href} label={l.label} />
            ))}
          </FooterColumn>

          {/* Account links */}
          <FooterColumn title="الحساب">
            {accountLinks.map((l) => (
              <FooterLink key={l.href} href={l.href} label={l.label} external />
            ))}
          </FooterColumn>
        </div>

        {/* Bottom bar */}
        <div
          className="mt-12 flex flex-col items-center justify-between gap-4 pt-8 sm:flex-row"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <p className="text-sm" style={{ color: 'var(--fg-secondary)' }}>
            © {new Date().getFullYear()} {info.merchant.nameEn || 'SERVIX'}. جميع الحقوق محفوظة.
          </p>
          <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
            {info.merchant.country || 'المملكة العربية السعودية'}
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-4 text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--gold)' }}>
        {title}
      </h4>
      <ul className="space-y-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({ href, label, external }: { href: string; label: string; external?: boolean }) {
  if (external) {
    return (
      <li>
        <Link
          href={href}
          className="text-sm transition-colors hover:opacity-80"
          style={{ color: 'var(--fg-secondary)' }}
        >
          {label}
        </Link>
      </li>
    );
  }
  return (
    <li>
      <Link
        href={href}
        className="text-sm transition-colors hover:opacity-80"
        style={{ color: 'var(--fg-muted)' }}
      >
        {label}
      </Link>
    </li>
  );
}
