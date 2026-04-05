import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import { tajawal, cairo, amiri } from '@/lib/fonts';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'SERVIX — احجز موعدك',
    template: '%s | SERVIX',
  },
  description: 'احجز موعدك في صالونك المفضل بسهولة وسرعة',
  robots: { index: true, follow: true },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SERVIX',
  },
  formatDetection: {
    telephone: true,
    email: false,
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'msapplication-TileColor': '#8B5CF6',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)',  color: '#07051a' },
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const fontClasses = [
    tajawal.variable,
    cairo.variable,
    amiri.variable,
  ].join(' ');

  return (
    <html
      lang="ar"
      dir="rtl"
      className={fontClasses}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* PWA Icons */}
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152.png" />
        <link rel="apple-touch-icon" sizes="144x144" href="/icons/icon-144.png" />
        <link rel="apple-touch-icon" sizes="128x128" href="/icons/icon-128.png" />
        {/* Splash screens for iOS */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body>
        {children}

        {/* Global toast notifications — RTL aware */}
        <Toaster
          position="top-center"
          richColors
          dir="rtl"
          toastOptions={{
            style: {
              fontFamily: 'var(--font-family-sans)',
              borderRadius: 'var(--theme-radius-lg, 1rem)',
            },
          }}
        />

        {/* Service Worker Registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(reg) {
                      console.log('[PWA] Service Worker registered:', reg.scope);
                    })
                    .catch(function(err) {
                      console.log('[PWA] SW registration failed:', err);
                    });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
