import type { Metadata } from 'next';
import { Cairo, Tajawal, Amiri } from 'next/font/google';
import { Providers } from '@/lib/providers';
import './globals.css';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800', '900'],
  preload: true,
});

const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
  variable: '--font-tajawal',
  display: 'swap',
  weight: ['300', '400', '500', '700', '800'],
  preload: true,
});

const amiri = Amiri({
  subsets: ['arabic', 'latin'],
  variable: '--font-amiri',
  display: 'swap',
  weight: ['400', '700'],
  preload: false,
});

export const metadata: Metadata = {
  title: 'SERVIX — لوحة التحكم',
  description: 'منصة إدارة صالونات التجميل',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactElement {
  const fontClasses = [
    cairo.variable,
    tajawal.variable,
    amiri.variable,
  ].join(' ');

  return (
    <html lang="ar" dir="rtl" data-style="velvet" suppressHydrationWarning>
      <body className={`${fontClasses} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
