import type { Metadata } from 'next';
import { Cairo } from 'next/font/google';
import { Providers } from '@/lib/providers';
import './globals.css';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
  display: 'swap',
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
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${cairo.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
