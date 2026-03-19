import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'SERVIX — احجز موعدك',
  description: 'احجز موعدك في صالونك المفضل بسهولة وسرعة',
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        {children}
        <Toaster position="top-center" richColors dir="rtl" />
      </body>
    </html>
  );
}
