import type { Metadata } from 'next';
import { Cairo } from 'next/font/google';
import './globals.css';

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
  openGraph: {
    title: 'SERVIX — أدِر صالونك بذكاء',
    description: 'منصة إدارة صالونات التجميل — جرّب مجاناً 14 يوم بلا بطاقة.',
    type: 'website',
    locale: 'ar_SA',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SERVIX — أدِر صالونك بذكاء',
    description: 'منصة إدارة صالونات التجميل — جرّب مجاناً 14 يوم.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.ReactElement {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
