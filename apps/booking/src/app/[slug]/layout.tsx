/**
 * Salon Layout — app/[slug]/layout.tsx (Server Component)
 *
 * Architecture v4.0:
 *  1. Fetches salon → resolveTheme → gets salon colors + seasonal overlay
 *  2. Sets inline CSS vars for SSR (zero FOUC)
 *  3. ThemeProvider re-applies on client for hydration sync
 *  4. Seasonal banner with SVG decorations rendered conditionally
 *  5. Particles only for seasonal overlays that have particles: true
 */
import type { ReactNode } from 'react';
import { resolveTheme } from '@/lib/themes';
import { ThemeProvider } from '@/components/theme-provider';
import SeasonalParticles from '@/components/seasonal-particles';
import SeasonalDecorations from '@/components/seasonal-decorations';
import PWAInstall from '@/components/pwa-install';
import IOSInstallGuide from '@/components/ios-install-guide';

interface SalonLayoutProps {
  params: Promise<{ slug: string }>;
  children: ReactNode;
}

export default async function SalonLayout({ params, children }: SalonLayoutProps) {
  const { slug } = await params;
  const resolved = await resolveTheme(slug);

  return (
    <ThemeProvider
      primaryColor={resolved.primaryColor}
      accentColor={resolved.accentColor}
      mode={resolved.mode}
      seasonal={resolved.seasonal}
    >
      <div
        id="salon-root"
        className="relative min-h-dvh"
        data-seasonal={resolved.seasonal?.id ?? undefined}
        data-layout={resolved.themeLayout}
        suppressHydrationWarning
        style={{
          '--color-primary':        resolved.primaryColor,
          '--color-accent':         resolved.accentColor ?? undefined,
          '--hero-gradient':        `linear-gradient(135deg, ${resolved.primaryColor} 0%, ${resolved.accentColor ?? resolved.primaryColor} 100%)`,
        } as React.CSSProperties}
      >
        {/* Seasonal banner with SVG decorations */}
        {resolved.seasonal && (
          <div className="seasonal-banner" role="banner">
            <div className="mx-auto flex max-w-5xl items-center justify-center gap-3">
              <SeasonalDecorations seasonalId={resolved.seasonal.id} />
              <span>{resolved.seasonal.bannerText}</span>
              <SeasonalDecorations seasonalId={resolved.seasonal.id} />
            </div>
          </div>
        )}

        {/* Particles (only for seasonal overlays that enable them, e.g. Ramadan) */}
        <SeasonalParticles enabled={resolved.seasonal?.particles ?? false} />

        {children}

        {/* PWA Install Prompt */}
        <PWAInstall />
        <IOSInstallGuide />
      </div>
    </ThemeProvider>
  );
}
