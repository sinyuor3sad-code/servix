import type { Metadata, Viewport } from 'next';
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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#040406',
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'SERVIX — نظام القيادة',
  description: 'نظام القيادة السيادي لإدارة المنصة',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SERVIX',
  },
  icons: {
    apple: [
      { url: '/icons/icon-192.png', sizes: '192x192' },
      { url: '/icons/icon-152.png', sizes: '152x152' },
      { url: '/icons/icon-144.png', sizes: '144x144' },
      { url: '/icons/icon-128.png', sizes: '128x128' },
    ],
    icon: [
      { url: '/icons/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactElement {
  return (
    <html lang="ar" dir="rtl" className="dark" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152.png" />
        <link rel="apple-touch-icon" sizes="144x144" href="/icons/icon-144.png" />
        <link rel="apple-touch-icon" sizes="128x128" href="/icons/icon-128.png" />
      </head>
      <body className={`${inter.variable} ${cairo.variable} antialiased`}
        style={{ fontFamily: "'Inter', 'Cairo', system-ui, -apple-system, sans-serif" }}
      >
        <Providers>{children}</Providers>
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(function(regs) {
              if (regs.length > 0) {
                Promise.all(regs.map(function(r) { return r.unregister(); })).then(function() {
                  if ('caches' in window) {
                    caches.keys().then(function(names) {
                      Promise.all(names.map(function(n) { return caches.delete(n); })).then(function() {
                        window.location.reload();
                      });
                    });
                  } else {
                    window.location.reload();
                  }
                });
              }
            });
          }
        ` }} />
      </body>
    </html>
  );
}
