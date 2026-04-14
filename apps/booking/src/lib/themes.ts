/**
 * SERVIX Booking — Theme Engine (v4.0)
 *
 * Architecture change:
 *  - The booking page uses the SALON's own colors (primaryColor + accentColor).
 *  - There are NO predefined visual themes.
 *  - 5 seasonal overlays add decorative elements (banners, SVGs) ON TOP of
 *    salon colors. They are NOT separate color schemes.
 *
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │  Seasonal overlay   │ Calendar        │ Window                            │
 * ├─────────────────────┼─────────────────┼───────────────────────────────────┤
 * │  ramadan            │ Hijri month 9   │ 1 → 29 Ramadan                   │
 * │  eid-fitr           │ Hijri 10/1–3    │ 1 → 3 Shawwal                    │
 * │  eid-adha           │ Hijri 12/10–13  │ 10 → 13 Dhul Hijjah             │
 * │  national-day       │ Gregorian       │ Sep 22 → Sep 24                  │
 * │  foundation-day     │ Gregorian       │ Feb 21 → Feb 23                  │
 * └─────────────────────┴─────────────────┴───────────────────────────────────┘
 *
 * Client-bundle safety:
 *   resolveTheme() is async and imports bookingApi (server-only).
 *   Client Components import only types and pure helpers.
 */

import { bookingApi } from '@/lib/api';

// ────────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────────

/** Seasonal overlay identifiers. */
export type SeasonalId =
  | 'ramadan'
  | 'eid-fitr'
  | 'eid-adha'
  | 'national-day'
  | 'foundation-day';

/** Decorative info for a seasonal overlay. */
export interface SeasonalOverlay {
  id:           SeasonalId;
  /** Banner text shown at top of the booking page */
  bannerText:   string;
  /** Accent color for the overlay decorations */
  accentColor:  string;
  /** Secondary accent */
  accentColor2: string;
  /** Whether to show particles (Ramadan lantern-like sparkles) */
  particles:    boolean;
}

/** Fully resolved result of resolveTheme(). */
export interface ResolvedTheme {
  /** Salon's primary brand color (#rrggbb). Falls back to #a855f7. */
  primaryColor: string;
  /** Salon's accent/secondary color (#rrggbb). Falls back to null. */
  accentColor:  string | null;
  /** Auto-detected mode based on primary color luminance: 'light' or 'dark'. */
  mode:         'light' | 'dark';
  /** Active seasonal overlay, or null if no season is active. */
  seasonal:     SeasonalOverlay | null;
  /** Whether the manager has disabled seasonal overlays. */
  seasonalDisabledByOwner: boolean;
  /** Menu layout style chosen by the salon manager. */
  themeLayout:  'luxe' | 'bloom' | 'glamour' | 'golden' | 'banan';
}

// ────────────────────────────────────────────────────────────────────────────
// SEASONAL OVERLAY DEFINITIONS
// ────────────────────────────────────────────────────────────────────────────

const SEASONAL_OVERLAYS: Record<SeasonalId, SeasonalOverlay> = {
  ramadan: {
    id:           'ramadan',
    bannerText:   'رمضان كريم 🌙',
    accentColor:  '#f0c040',
    accentColor2: '#7ec8e3',
    particles:    true,
  },
  'eid-fitr': {
    id:           'eid-fitr',
    bannerText:   'عيدكم مبارك ✨',
    accentColor:  '#059669',
    accentColor2: '#d4af37',
    particles:    false,
  },
  'eid-adha': {
    id:           'eid-adha',
    bannerText:   'عيد أضحى مبارك 🕌',
    accentColor:  '#0d7377',
    accentColor2: '#b87333',
    particles:    false,
  },
  'national-day': {
    id:           'national-day',
    bannerText:   'همّة حتى القمة 🇸🇦',
    accentColor:  '#006c35',
    accentColor2: '#c8a400',
    particles:    false,
  },
  'foundation-day': {
    id:           'foundation-day',
    bannerText:   'يوم بدينا 🏛️',
    accentColor:  '#7c4a1e',
    accentColor2: '#d4a054',
    particles:    false,
  },
};

// ────────────────────────────────────────────────────────────────────────────
// SEASONAL DETECTION (Hijri + Gregorian)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Detects the active seasonal overlay for the given date.
 *
 * Hijri events use `Intl.DateTimeFormat` with `ca-islamic-umalqura`
 * (the official calendar of Saudi Arabia) — accurate indefinitely.
 * Gregorian events use simple month/day checks.
 */
export function detectSeasonalTheme(now: Date = new Date()): SeasonalId | null {
  // ── Hijri calendar ───────────────────────────────────────────────────────
  try {
    const parts = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
      year: 'numeric', month: 'numeric', day: 'numeric',
    }).formatToParts(now);

    const get = (type: Intl.DateTimeFormatPartTypes): number =>
      Number(parts.find(p => p.type === type)?.value ?? 0);

    const hMonth = get('month');
    const hDay   = get('day');

    if (hMonth === 9)                            return 'ramadan';
    if (hMonth === 10 && hDay <= 3)              return 'eid-fitr';
    if (hMonth === 12 && hDay >= 10 && hDay <= 13) return 'eid-adha';
  } catch {
    // Fallback if Intl with umalqura is unavailable
  }

  // ── Gregorian Saudi events ───────────────────────────────────────────────
  const m = now.getMonth() + 1;
  const d = now.getDate();

  // Foundation Day: Feb 21–23
  if (m === 2 && d >= 21 && d <= 23) return 'foundation-day';
  // National Day: Sep 22–24
  if (m === 9 && d >= 22 && d <= 24) return 'national-day';

  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// COLOR UTILITIES
// ────────────────────────────────────────────────────────────────────────────

/**
 * Calculate relative luminance of a hex color.
 * Returns 0 (black) → 1 (white). Used to auto-detect light/dark mode.
 */
export function luminance(hex: string): number {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  const toLinear = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

// ────────────────────────────────────────────────────────────────────────────
// ASYNC RESOLVER (Server Components only)
// ────────────────────────────────────────────────────────────────────────────

const DEFAULT_PRIMARY = '#a855f7';

/**
 * Resolves the effective theme for a salon page.
 * Called once per request in `[slug]/layout.tsx`.
 *
 * Returns the salon's own colors + optional seasonal overlay.
 * Mode (light/dark) is auto-detected from the hero gradient:
 * the booking page background is always light; the hero adapts.
 */
export async function resolveTheme(slug: string): Promise<ResolvedTheme> {
  let primaryColor  = DEFAULT_PRIMARY;
  let accentColor:  string | null = null;
  let seasonalDisabledByOwner = false;
  let themeLayout: ResolvedTheme['themeLayout'] = 'bloom';

  try {
    const salon = await bookingApi.getSalonInfo(slug);
    if (salon.primaryColor)   primaryColor = salon.primaryColor;
    if (salon.secondaryColor) accentColor  = salon.secondaryColor;
    if (salon.themeLayout)    themeLayout  = salon.themeLayout;
    // TODO: read salon.settings.seasonal_themes_enabled when API supports it
  } catch {
    // Degrade gracefully — use defaults
  }

  // Auto-detect mode from primary color luminance
  const mode: 'light' | 'dark' = luminance(primaryColor) > 0.4 ? 'light' : 'dark';

  // Detect seasonal overlay
  let seasonal: SeasonalOverlay | null = null;
  if (!seasonalDisabledByOwner) {
    const seasonalId = detectSeasonalTheme();
    if (seasonalId) {
      seasonal = SEASONAL_OVERLAYS[seasonalId];
    }
  }

  return { primaryColor, accentColor, mode, seasonal, seasonalDisabledByOwner, themeLayout };
}

/** Get a seasonal overlay by ID (for client components). */
export function getSeasonalOverlay(id: SeasonalId): SeasonalOverlay {
  return SEASONAL_OVERLAYS[id];
}
