/**
 * SERVIX Dashboard — Theme Configuration
 *
 * 4 permanent themes, each with light + dark mode = 8 variations.
 * CSS variables are defined in globals.css via [data-style] + [data-theme].
 * The manager picks a theme from Settings → Branding.
 *
 * ┌──────────┬───────────────────────────────────────────────────────────┐
 * │ Theme    │ Personality                                               │
 * ├──────────┼───────────────────────────────────────────────────────────┤
 * │ Velvet   │ فخامة نسائية — بنفسجي غامق + ذهبي + Amiri headings      │
 * │ Crystal  │ حداثة ونظافة — أبيض ثلجي + وردي + أزرق + Tajawal        │
 * │ Orchid   │ دفء وطبيعة — وردي دافئ + أخضر زيتوني + Cairo            │
 * │ Noir     │ أناقة داكنة — أسود + ذهبي/فضي + dark-first              │
 * └──────────┴───────────────────────────────────────────────────────────┘
 */

import type { TenantTheme } from '@/types';

export interface ThemeConfig {
  /** English name */
  name:         string;
  /** Arabic name */
  nameAr:       string;
  /** Short Arabic description for the picker */
  description:  string;
  /** CSS border-radius token */
  borderRadius: string;
  /** CSS box-shadow default */
  shadow:       string;
  /** CSS box-shadow on hover */
  shadowHover:  string;
  /** Font for headings (CSS value) */
  fontHeading:  string;
  /** Font for body text (CSS value) */
  fontBody:     string;
  /** Preview colors for the theme selector card */
  preview: {
    bg:      string;
    primary: string;
    accent:  string;
  };
}

export const themeConfigs: Record<TenantTheme, ThemeConfig> = {

  // ── 1. VELVET — فخامة نسائية ──────────────────────────────────────────────
  velvet: {
    name:         'Velvet',
    nameAr:       'مخملي',
    description:  'بنفسجي غامق مع لمسات ذهبية — إحساس صالون فاخر',
    borderRadius: '0.75rem',
    shadow:       '0 2px 12px rgba(45, 27, 78, 0.08)',
    shadowHover:  '0 8px 28px rgba(45, 27, 78, 0.14)',
    fontHeading:  "var(--font-amiri, 'Amiri'), serif",
    fontBody:     "var(--font-tajawal, 'Tajawal'), sans-serif",
    preview: { bg: '#2d1b4e', primary: '#a855f7', accent: '#d4af37' },
  },

  // ── 2. CRYSTAL — حداثة ونظافة ─────────────────────────────────────────────
  crystal: {
    name:         'Crystal',
    nameAr:       'كريستال',
    description:  'أبيض ثلجي مع وردي وأزرق سماوي — عيادة تجميل عصرية',
    borderRadius: '0.375rem',
    shadow:       '0 1px 4px rgba(0, 0, 0, 0.06)',
    shadowHover:  '0 4px 16px rgba(0, 0, 0, 0.10)',
    fontHeading:  "var(--font-tajawal, 'Tajawal'), sans-serif",
    fontBody:     "var(--font-tajawal, 'Tajawal'), sans-serif",
    preview: { bg: '#f8fafc', primary: '#ec4899', accent: '#38bdf8' },
  },

  // ── 3. ORCHID — دفء وطبيعة ────────────────────────────────────────────────
  orchid: {
    name:         'Orchid',
    nameAr:       'أوركيد',
    description:  'وردي دافئ مع أخضر زيتوني — صالون بوتيك طبيعي',
    borderRadius: '1rem',
    shadow:       '0 2px 8px rgba(45, 31, 26, 0.06)',
    shadowHover:  '0 8px 24px rgba(45, 31, 26, 0.12)',
    fontHeading:  "var(--font-cairo, 'Cairo'), sans-serif",
    fontBody:     "var(--font-cairo, 'Cairo'), sans-serif",
    preview: { bg: '#fdf8f6', primary: '#d4627a', accent: '#84a98c' },
  },

  // ── 4. NOIR — أناقة داكنة ─────────────────────────────────────────────────
  noir: {
    name:         'Noir',
    nameAr:       'نوار',
    description:  'أسود أنيق مع لمسات ذهبية — صالون VIP حصري',
    borderRadius: '0.5rem',
    shadow:       '0 2px 10px rgba(0, 0, 0, 0.20)',
    shadowHover:  '0 8px 32px rgba(0, 0, 0, 0.30)',
    fontHeading:  "var(--font-cairo, 'Cairo'), sans-serif",
    fontBody:     "var(--font-cairo, 'Cairo'), sans-serif",
    preview: { bg: '#09090b', primary: '#fafafa', accent: '#d4af37' },
  },
};

/** All theme keys as a typed array */
export const THEME_KEYS = Object.keys(themeConfigs) as TenantTheme[];
