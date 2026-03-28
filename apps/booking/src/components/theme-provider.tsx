/**
 * ThemeProvider — Booking page theme context (Client Component)
 *
 * Architecture v4.0:
 *  - Takes salon's primaryColor + accentColor
 *  - Generates CSS variable overrides from them
 *  - Sets variables on #salon-root
 *  - No predefined themes — salon colors drive everything
 */

'use client';

import {
  createContext,
  useContext,
  useEffect,
  type ReactNode,
} from 'react';
import type { SeasonalOverlay } from '@/lib/themes';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ThemeContextValue {
  primaryColor:  string;
  accentColor:   string | null;
  mode:          'light' | 'dark';
  seasonal:      SeasonalOverlay | null;
}

const ThemeContext = createContext<ThemeContextValue>({
  primaryColor: '#a855f7',
  accentColor:  null,
  mode:         'light',
  seasonal:     null,
});

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ROOT_ID = 'salon-root';

// ── Provider ──────────────────────────────────────────────────────────────────

interface ThemeProviderProps {
  children:      ReactNode;
  primaryColor:  string;
  accentColor?:  string | null;
  mode:          'light' | 'dark';
  seasonal?:     SeasonalOverlay | null;
}

export function ThemeProvider({
  children,
  primaryColor,
  accentColor = null,
  mode,
  seasonal    = null,
}: ThemeProviderProps): React.ReactElement {

  // ── Generate and apply full color palette from primaryColor ────────────────
  useEffect(() => {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;

    // Core primary family
    root.style.setProperty('--color-primary',        primaryColor);
    root.style.setProperty('--color-primary-hover',  darken(primaryColor, 0.12));
    root.style.setProperty('--color-primary-fg',     mode === 'dark' ? '#000000' : '#ffffff');
    root.style.setProperty('--color-primary-subtle', rgba(primaryColor, 0.08));
    root.style.setProperty('--color-primary-border', rgba(primaryColor, 0.20));
    root.style.setProperty('--color-primary-shadow', rgba(primaryColor, 0.22));

    // Accent
    if (accentColor) {
      root.style.setProperty('--color-accent',       accentColor);
      root.style.setProperty('--color-accent-hover', darken(accentColor, 0.12));
    }

    // Hero gradient
    const endColor = accentColor ?? darken(primaryColor, 0.2);
    root.style.setProperty(
      '--hero-gradient',
      `linear-gradient(135deg, ${primaryColor} 0%, ${endColor} 100%)`,
    );

    // Particle colors
    root.style.setProperty('--particle-color-1', rgba(primaryColor, 0.45));
    root.style.setProperty('--particle-color-2', rgba(accentColor ?? primaryColor, 0.30));

  }, [primaryColor, accentColor, mode]);

  // ── Sync color-scheme meta ────────────────────────────────────────────────
  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
    if (!meta) {
      meta = Object.assign(document.createElement('meta'), { name: 'color-scheme' });
      document.head.appendChild(meta);
    }
    meta.content = mode === 'dark' ? 'dark' : 'light';
  }, [mode]);

  return (
    <ThemeContext.Provider value={{ primaryColor, accentColor, mode, seasonal }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ── Color helpers (client-side, zero deps) ──────────────────────────────────

function parse(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  return [
    parseInt(c.substring(0, 2), 16),
    parseInt(c.substring(2, 4), 16),
    parseInt(c.substring(4, 6), 16),
  ];
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = parse(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function darken(hex: string, amount: number): string {
  const [r, g, b] = parse(hex);
  const f = 1 - amount;
  const to2 = (n: number) => Math.max(0, Math.min(255, Math.round(n * f)))
    .toString(16).padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}
