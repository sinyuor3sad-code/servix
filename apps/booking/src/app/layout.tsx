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
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: dark)',  color: '#07051a' },
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
  ],
};

/**
 * Root layout — loads ALL font variable classes on <html>.
 * Each font is available as a CSS variable (--font-cairo, --font-tajawal, etc.)
 * so that theme CSS ([data-theme="X"]) can reference them via
 * `var(--theme-font-heading)` → resolved to the correct family at runtime.
 *
 * preload: true only on Cairo + Tajawal (default themes).
 * Others are loaded with display: swap and no explicit preload.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  // Combine all font variable classNames — this is how next/font injects
  // the CSS custom properties (--font-cairo, etc.) into the DOM.
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
        {/* Preconnect to Google Fonts CDN (next/font uses it under the hood) */}
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
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
      </body>
    </html>
  );
}
