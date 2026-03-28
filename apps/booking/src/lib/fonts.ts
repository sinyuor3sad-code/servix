/**
 * SERVIX Font System — lib/fonts.ts
 *
 * 3 Arabic font families loaded via next/font/google.
 * Each family injects one CSS variable onto <html> that is consumed by
 * [data-theme] blocks in globals.css via --theme-font-heading / --theme-font-body.
 *
 * ┌─────────────┬───────────────────┬──────────────────────────────────────┐
 * │ Font        │ CSS variable      │ Role                                 │
 * ├─────────────┼───────────────────┼──────────────────────────────────────┤
 * │ Tajawal     │ --font-tajawal    │ Body / default (preloaded)           │
 * │ Cairo       │ --font-cairo      │ Headings & CTAs (preloaded)          │
 * │ Amiri       │ --font-amiri      │ Luxury + Ramadan serif (lazy)        │
 * └─────────────┴───────────────────┴──────────────────────────────────────┘
 *
 * Usage in app/layout.tsx:
 *   const fontClasses = [tajawal.variable, cairo.variable, amiri.variable].join(' ');
 *   <html className={fontClasses}>
 */

import { Tajawal, Cairo, Amiri } from 'next/font/google';

// ── Tajawal — body text, clean, excellent Arabic readability ──────────────────
export const tajawal = Tajawal({
  subsets:  ['arabic', 'latin'],
  variable: '--font-tajawal',
  display:  'swap',
  weight:   ['300', '400', '500', '700', '800'],
  preload:  true,
});

// ── Cairo — headings, buttons, numerals — strong geometric Arabic ─────────────
export const cairo = Cairo({
  subsets:  ['arabic', 'latin'],
  variable: '--font-cairo',
  display:  'swap',
  weight:   ['400', '500', '600', '700', '800', '900'],
  preload:  true,
});

// ── Amiri — classical Arabic serif — luxury & Ramadan themes only ─────────────
// preload: false — this font is loaded on-demand only for themes that use it.
export const amiri = Amiri({
  subsets:  ['arabic', 'latin'],
  variable: '--font-amiri',
  display:  'swap',
  weight:   ['400', '700'],
  preload:  false,
});
