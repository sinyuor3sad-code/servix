import type { TenantTheme } from '@/types';

export interface ThemeConfig {
  name: string;
  nameAr: string;
  borderRadius: string;
  shadow: string;
  shadowHover: string;
  fontHeading: string;
  fontBody: string;
}

export const themeConfigs: Record<TenantTheme, ThemeConfig> = {
  elegance: {
    name: 'Elegance',
    nameAr: 'أناقة',
    borderRadius: '0.5rem',
    shadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
    shadowHover: '0 4px 12px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)',
    fontHeading: 'var(--font-cairo), serif',
    fontBody: 'var(--font-cairo), sans-serif',
  },
  modern: {
    name: 'Modern',
    nameAr: 'عصري',
    borderRadius: '0',
    shadow: '0 2px 8px rgba(0,0,0,0.12)',
    shadowHover: '0 8px 24px rgba(0,0,0,0.16)',
    fontHeading: 'var(--font-cairo), sans-serif',
    fontBody: 'var(--font-cairo), sans-serif',
  },
  vivid: {
    name: 'Vivid',
    nameAr: 'حيوي',
    borderRadius: '1rem',
    shadow: '0 4px 16px rgba(0,0,0,0.06)',
    shadowHover: '0 8px 32px rgba(0,0,0,0.1)',
    fontHeading: 'var(--font-cairo), sans-serif',
    fontBody: 'var(--font-cairo), sans-serif',
  },
  minimal: {
    name: 'Minimal',
    nameAr: 'بسيط',
    borderRadius: '0.375rem',
    shadow: 'none',
    shadowHover: 'none',
    fontHeading: 'var(--font-cairo), sans-serif',
    fontBody: 'var(--font-cairo), sans-serif',
  },
  corporate: {
    name: 'Corporate',
    nameAr: 'مؤسسي',
    borderRadius: '0.25rem',
    shadow: '0 1px 2px rgba(0,0,0,0.05)',
    shadowHover: '0 2px 8px rgba(0,0,0,0.1)',
    fontHeading: 'var(--font-cairo), sans-serif',
    fontBody: 'var(--font-cairo), sans-serif',
  },
  royal: {
    name: 'Royal',
    nameAr: 'ملكي',
    borderRadius: '0.75rem',
    shadow: '0 2px 12px rgba(0,0,0,0.15)',
    shadowHover: '0 8px 28px rgba(0,0,0,0.2)',
    fontHeading: 'var(--font-cairo), serif',
    fontBody: 'var(--font-cairo), sans-serif',
  },
};
