import type { Metadata } from 'next';
import { Cairo } from 'next/font/google';
import './globals.css';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SERVIX — منصة إدارة صالونات التجميل',
  description: 'أدير صالونك بسهولة — مواعيد، فواتير، عملاء، واتساب. جرّب مجاناً 14 يوم.',
  openGraph: {
    title: 'SERVIX — منصة إدارة صالونات التجميل',
    description: 'أدير صالونك بسهولة — مواعيد، فواتير، عملاء، واتساب. جرّب مجاناً 14 يوم.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.ReactElement {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)] font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
