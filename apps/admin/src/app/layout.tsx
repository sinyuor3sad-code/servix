import type { Metadata } from 'next';
import { Inter, Cairo } from 'next/font/google';
import { Providers } from '@/lib/providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SERVIX — Nexus',
  description: 'Owner Command Environment',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactElement {
  return (
    <html lang="ar" dir="rtl" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} ${cairo.variable} antialiased`}
        style={{ fontFamily: "'Inter', 'Cairo', system-ui, -apple-system, sans-serif" }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
