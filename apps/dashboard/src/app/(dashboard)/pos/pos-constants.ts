'use client';

import type React from 'react';
import {
  Scissors, Sparkles, Star, Zap, Crown, Heart,
  Banknote, CreditCard, Building2, Smartphone,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════════
   CONSTANTS + HELPERS
   ═══════════════════════════════════════════════════════════════════════════════ */

export const TAX = 0.15;
export const TN: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' };
export function fmt(v: number) { return v.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
export function uid() { return Math.random().toString(36).slice(2, 10); }
export function now() { return new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }); }

export const DEFAULT_FAVS: string[] = [];
export const CAT_ICO: Record<string, React.ElementType> = { 'شعر': Scissors, 'بشرة': Sparkles, 'مكياج': Star, 'أظافر': Zap, 'عروس': Crown, 'حمام مغربي': Heart };

export const PAY = [
  { id: 'cash',          label: 'نقدي',      icon: Banknote },
  { id: 'card',          label: 'بطاقة/مدى', icon: CreditCard },
  { id: 'bank_transfer', label: 'تحويل',     icon: Building2 },
  { id: 'apple_pay',     label: 'Apple Pay',  icon: Smartphone },
] as const;

/* ═══════════════════════════════════════════════════════════════════════════════
   DESIGN SYSTEM — Obsidian Nexus
   100% CSS Variables — zero hardcoded colors
   Supports: Velvet · Crystal · Orchid · Noir × light/dark
   ═══════════════════════════════════════════════════════════════════════════════ */

export const G1 = 'backdrop-blur-[36px] bg-[color-mix(in_srgb,var(--card)_35%,transparent)] border border-[color-mix(in_srgb,var(--foreground)_4%,transparent)]';
export const G2 = 'backdrop-blur-[48px] bg-[color-mix(in_srgb,var(--card)_55%,transparent)] border border-[color-mix(in_srgb,var(--foreground)_6%,transparent)] shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_3%,transparent)]';
export const G3 = 'backdrop-blur-[32px] bg-[color-mix(in_srgb,var(--card)_20%,transparent)] border border-[color-mix(in_srgb,var(--foreground)_3%,transparent)]';

export const T  = 'transition-all duration-[140ms] ease-[cubic-bezier(0.23,1,0.32,1)]';
export const TF = 'transition-all duration-[100ms] ease-[cubic-bezier(0.23,1,0.32,1)]';

export const B  = `${T} active:scale-[0.96] touch-manipulation select-none cursor-pointer`;
export const BS = `${TF} active:scale-[0.94] touch-manipulation select-none cursor-pointer`;

export const INP = `w-full rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--foreground)_6%,transparent)] bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]/30 focus:border-[var(--brand-accent)]/40 ${T}`;

export const accentBg    = { background: 'var(--brand-accent)' } as const;
export const accentColor = { color: 'var(--brand-accent)' } as const;
export const accentMix   = (pct: number) => ({ background: `color-mix(in srgb, var(--brand-accent) ${pct}%, transparent)` });
export const primaryBg   = { background: 'var(--brand-primary)' } as const;

export const brd = (pct: number) => `border-[color-mix(in_srgb,var(--foreground)_${pct}%,transparent)]`;
export const bg  = (pct: number) => `bg-[color-mix(in_srgb,var(--foreground)_${pct}%,transparent)]`;

export const ROLE_ICO: Record<string, string> = { stylist: '✂️', cashier: '💵', makeup: '💄', nails: '💅', skincare: '🧴' };
export const ROLE_LBL: Record<string, string> = { stylist: 'مصففة', cashier: 'كاشيرة', makeup: 'مكياج', nails: 'أظافر', skincare: 'عناية' };

export function fmtT(t: string | null) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h ?? '0', 10);
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'م' : 'ص'}`;
}
