import Link from 'next/link';
import { Mail, MapPin } from 'lucide-react';

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3000';

const footerLinks = {
  product: [
    { label: 'المميزات',    href: '#capabilities' },
    { label: 'الأسعار',     href: '#pricing' },
    { label: 'كيف تبدأين',  href: '#how-it-works' },
  ],
  legal: [
    { label: 'الشروط والأحكام', href: '/terms' },
    { label: 'سياسة الخصوصية', href: '/privacy' },
    { label: 'تواصل معنا',     href: '/contact' },
  ],
  account: [
    { label: 'تسجيل الدخول', href: `${DASHBOARD_URL}/login` },
    { label: 'إنشاء حساب',   href: `${DASHBOARD_URL}/register` },
  ],
};

export default function Footer(): React.ReactElement {
  return (
    <footer style={{ borderTop: '1px solid var(--border)' }}>
      <div className="relative mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">

          {/* Brand column */}
          <div className="lg:col-span-2">
            <Link href="/" className="inline-flex items-center gap-2">
              <span className="text-xl font-black" style={{ color: 'var(--fg)' }}>SERVIX</span>
            </Link>

            <p className="mt-4 max-w-xs text-sm leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
              منصة ذكية لإدارة صالونات التجميل السعودية — مواعيد، فواتير ZATCA، واتساب، وتقارير متقدمة.
            </p>

            <div className="mt-5 space-y-2">
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--fg-muted)' }}>
                <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--gold)', opacity: 0.5 }} />
                الرياض، المملكة العربية السعودية
              </div>
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--fg-muted)' }}>
                <Mail className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--gold)', opacity: 0.5 }} />
                hello@servi-x.com
              </div>
            </div>
          </div>

          {/* Links columns */}
          {[
            { title: 'المنتج', links: footerLinks.product, isExternal: false },
            { title: 'قانوني', links: footerLinks.legal,   isExternal: false },
            { title: 'الحساب', links: footerLinks.account, isExternal: true },
          ].map(({ title, links, isExternal }) => (
            <div key={title}>
              <h4
                className="mb-4 text-xs font-bold uppercase tracking-widest"
                style={{ color: 'var(--gold)', opacity: 0.7 }}
              >
                {title}
              </h4>
              <ul className="space-y-2.5">
                {links.map((l) => (
                  <li key={l.href}>
                    {isExternal ? (
                      <Link
                        href={l.href}
                        className="text-sm transition-colors hover:opacity-80"
                        style={{ color: 'var(--fg-muted)' }}
                      >
                        {l.label}
                      </Link>
                    ) : (
                      <a
                        href={l.href}
                        className="text-sm transition-colors hover:opacity-80"
                        style={{ color: 'var(--fg-muted)' }}
                      >
                        {l.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          className="mt-12 flex flex-col items-center justify-between gap-4 pt-8 sm:flex-row"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
            © {new Date().getFullYear()} SERVIX. جميع الحقوق محفوظة.
          </p>
        </div>
      </div>
    </footer>
  );
}
