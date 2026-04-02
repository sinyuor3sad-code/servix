import Link from 'next/link';
import { Mail, MapPin, Zap } from 'lucide-react';

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3000';

const footerLinks = {
  product: [
    { label: 'المميزات',    href: '#features' },
    { label: 'الأسعار',     href: '#pricing' },
    { label: 'كيف تبدأين',  href: '#how-it-works' },
    { label: 'الأجهزة',     href: '#devices' },
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
    <footer
      className="relative overflow-hidden"
      style={{ borderTop: '1px solid rgba(168,85,247,0.12)' }}
    >
      {/* Top neon line */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent 5%, rgba(168,85,247,0.5) 30%, rgba(34,211,238,0.35) 70%, transparent 95%)' }}
      />

      {/* Background glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-48"
        style={{ background: 'radial-gradient(ellipse 60% 100% at 50% 0%, rgba(168,85,247,0.05) 0%, transparent 100%)' }}
      />

      <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand column */}
          <div className="lg:col-span-2">
            <Link href="/" className="group inline-flex items-center gap-2.5">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-105"
                style={{
                  background: 'linear-gradient(135deg, #9333ea, #6366f1)',
                  boxShadow: '0 0 18px rgba(147,51,234,0.45)',
                }}
              >
                <Zap className="h-4 w-4 text-white" />
              </div>
              <span
                className="text-xl font-black text-white"
                style={{ textShadow: '0 0 20px rgba(168,85,247,0.4)' }}
              >
                SERVIX
              </span>
            </Link>

            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/38">
              منصة SaaS الذكية لإدارة صالونات التجميل السعودية — مواعيد، فواتير ZATCA، واتساب، وتقارير AI.
            </p>

            <div className="mt-5 space-y-2">
              <div className="flex items-center gap-2 text-sm text-white/32">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-violet-400/50" />
                الرياض، المملكة العربية السعودية
              </div>
              <div className="flex items-center gap-2 text-sm text-white/32">
                <Mail className="h-3.5 w-3.5 shrink-0 text-violet-400/50" />
                hello@servi-x.com
              </div>
            </div>

            {/* Status chip */}
            <div
              className="mt-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-green-400"
              style={{ border: '1px solid rgba(74,222,128,0.2)', background: 'rgba(74,222,128,0.06)' }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 node-pulse inline-block" />
              جميع الأنظمة تعمل بكفاءة ١٠٠٪
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
                style={{ color: 'rgba(168,85,247,0.7)' }}
              >
                {title}
              </h4>
              <ul className="space-y-2.5">
                {links.map((l) => (
                  <li key={l.href}>
                    {isExternal ? (
                      <Link
                        href={l.href}
                        className="text-sm text-white/38 transition-colors hover:text-white/80"
                      >
                        {l.label}
                      </Link>
                    ) : (
                      <a
                        href={l.href}
                        className="text-sm text-white/38 transition-colors hover:text-white/80"
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
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          <p className="text-xs text-white/22">
            © {new Date().getFullYear()} SERVIX. جميع الحقوق محفوظة.
          </p>
          <p className="terminal-text text-xs text-white/20">
            {'> built_with_passion = true // for_saudi_salons'}
          </p>
        </div>
      </div>
    </footer>
  );
}
