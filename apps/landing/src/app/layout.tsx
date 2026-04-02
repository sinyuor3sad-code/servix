import type { Metadata } from 'next';
import { Cairo } from 'next/font/google';
import './globals.css';
import { I18nProvider } from '@/lib/i18n';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
});

export const metadata: Metadata = {
  title: 'SERVIX — أدِر صالونك بذكاء',
  description:
    'منصة إدارة صالونات التجميل — مواعيد ذكية، فواتير احترافية، واتساب، وتقارير. جرّب مجاناً 14 يوم.',
  keywords: ['صالون', 'إدارة صالون', 'حجز مواعيد', 'فواتير', 'واتساب', 'SERVIX'],
  metadataBase: new URL('https://servi-x.com'),
  alternates: { canonical: '/' },
  manifest: '/manifest.json',
  openGraph: {
    title: 'SERVIX — أدِر صالونك بذكاء',
    description: 'منصة إدارة صالونات التجميل — جرّب مجاناً 14 يوم بلا بطاقة.',
    type: 'website',
    locale: 'ar_SA',
    url: 'https://servi-x.com',
    siteName: 'SERVIX',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SERVIX — أدِر صالونك بذكاء',
    description: 'منصة إدارة صالونات التجميل — جرّب مجاناً 14 يوم.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.ReactElement {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <body className="min-h-screen antialiased">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
