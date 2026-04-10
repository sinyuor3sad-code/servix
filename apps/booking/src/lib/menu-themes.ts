/**
 * Smart Menu — 8 Brand Color Palettes
 * Each palette defines CSS variables for the menu page.
 */

export interface ColorPalette {
  id: string;
  label: string;
  labelEn: string;
  primary: string;
  primaryLight: string;
  primaryDark: string;
  bg: string;
  bgCard: string;
  text: string;
  textSecondary: string;
  border: string;
  accent: string;
}

export const COLOR_PALETTES: Record<string, ColorPalette> = {
  purple: {
    id: 'purple',
    label: 'بنفسجي ملكي',
    labelEn: 'Royal Purple',
    primary: '#7C3AED',
    primaryLight: '#A78BFA',
    primaryDark: '#5B21B6',
    bg: '#FAF5FF',
    bgCard: '#FFFFFF',
    text: '#1E1B2E',
    textSecondary: '#6B7280',
    border: '#E9D5FF',
    accent: '#DDD6FE',
  },
  gold: {
    id: 'gold',
    label: 'ذهبي دافئ',
    labelEn: 'Warm Gold',
    primary: '#B8860B',
    primaryLight: '#D4A843',
    primaryDark: '#8B6914',
    bg: '#FFFDF5',
    bgCard: '#FFFFFF',
    text: '#2D2006',
    textSecondary: '#78716C',
    border: '#FDE68A',
    accent: '#FEF3C7',
  },
  pink: {
    id: 'pink',
    label: 'وردي ناعم',
    labelEn: 'Soft Pink',
    primary: '#EC4899',
    primaryLight: '#F9A8D4',
    primaryDark: '#BE185D',
    bg: '#FFF1F6',
    bgCard: '#FFFFFF',
    text: '#1F0A14',
    textSecondary: '#9CA3AF',
    border: '#FBCFE8',
    accent: '#FCE7F3',
  },
  black: {
    id: 'black',
    label: 'أسود أنيق',
    labelEn: 'Elegant Black',
    primary: '#D4AF37',
    primaryLight: '#E8CC6E',
    primaryDark: '#9B7E1F',
    bg: '#0F0F0F',
    bgCard: '#1A1A1A',
    text: '#F5F5F5',
    textSecondary: '#A3A3A3',
    border: '#2D2D2D',
    accent: '#262626',
  },
  blue: {
    id: 'blue',
    label: 'أزرق هادئ',
    labelEn: 'Calm Blue',
    primary: '#3B82F6',
    primaryLight: '#93C5FD',
    primaryDark: '#1D4ED8',
    bg: '#F0F7FF',
    bgCard: '#FFFFFF',
    text: '#0F172A',
    textSecondary: '#64748B',
    border: '#BFDBFE',
    accent: '#DBEAFE',
  },
  green: {
    id: 'green',
    label: 'أخضر طبيعي',
    labelEn: 'Natural Green',
    primary: '#6B8E23',
    primaryLight: '#9CB663',
    primaryDark: '#4A6318',
    bg: '#F7FDF2',
    bgCard: '#FFFFFF',
    text: '#1A2E05',
    textSecondary: '#6B7280',
    border: '#D1E7B0',
    accent: '#E8F5D6',
  },
  brown: {
    id: 'brown',
    label: 'بني دافئ',
    labelEn: 'Warm Brown',
    primary: '#8B7355',
    primaryLight: '#B09E84',
    primaryDark: '#6B5740',
    bg: '#FBF9F5',
    bgCard: '#FFFFFF',
    text: '#2C1E0E',
    textSecondary: '#78716C',
    border: '#D6CFC3',
    accent: '#EFEBE3',
  },
  fuchsia: {
    id: 'fuchsia',
    label: 'فوشيا جريء',
    labelEn: 'Bold Fuchsia',
    primary: '#D946EF',
    primaryLight: '#E879F9',
    primaryDark: '#A21CAF',
    bg: '#FDF4FF',
    bgCard: '#FFFFFF',
    text: '#1E0A22',
    textSecondary: '#9CA3AF',
    border: '#F0ABFC',
    accent: '#FAE8FF',
  },
};

/**
 * Generate CSS variables string for a given palette
 */
export function getThemeCSSVars(paletteId: string): Record<string, string> {
  const p = COLOR_PALETTES[paletteId] || COLOR_PALETTES.purple;
  return {
    '--sm-primary': p.primary,
    '--sm-primary-light': p.primaryLight,
    '--sm-primary-dark': p.primaryDark,
    '--sm-bg': p.bg,
    '--sm-bg-card': p.bgCard,
    '--sm-text': p.text,
    '--sm-text-secondary': p.textSecondary,
    '--sm-border': p.border,
    '--sm-accent': p.accent,
  };
}

/**
 * Check if this is a dark theme
 */
export function isDarkTheme(paletteId: string): boolean {
  return paletteId === 'black';
}
