'use client';

import type React from 'react';
import {
  Scissors, Sparkles, Star, Zap, Crown, Heart,
  Banknote, CreditCard, Building2, Smartphone,
} from 'lucide-react';
import type { ServiceCategory, Service, Client, Employee } from '@/types';
import type { ServiceBundle } from './pos-types';

/* ═══════════════════════════════════════════════════════════════════════════════
   CONSTANTS + HELPERS
   ═══════════════════════════════════════════════════════════════════════════════ */

export const TAX = 0.15;
export const TN: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' };
export function fmt(v: number) { return v.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
export function uid() { return Math.random().toString(36).slice(2, 10); }
export function now() { return new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }); }
export const isDev = (t: string | null) => !t || t.startsWith('dev-');

/* ═══════════════════════════════════════════════════════════════════════════════
   MOCK DATA
   ═══════════════════════════════════════════════════════════════════════════════ */

export const M_CATS: ServiceCategory[] = [
  { id: 'c1', nameAr: 'شعر',        nameEn: 'Hair',    sortOrder: 1, isActive: true },
  { id: 'c2', nameAr: 'بشرة',       nameEn: 'Skin',    sortOrder: 2, isActive: true },
  { id: 'c3', nameAr: 'مكياج',      nameEn: 'Makeup',  sortOrder: 3, isActive: true },
  { id: 'c4', nameAr: 'أظافر',      nameEn: 'Nails',   sortOrder: 4, isActive: true },
  { id: 'c5', nameAr: 'عروس',       nameEn: 'Bridal',  sortOrder: 5, isActive: true },
  { id: 'c6', nameAr: 'حمام مغربي', nameEn: 'Hammam',  sortOrder: 6, isActive: true },
];

export const M_SVCS: Service[] = [
  { id: 's1',  categoryId: 'c1', nameAr: 'قص شعر',          nameEn: 'Haircut',    descriptionAr: null, price: 80,   duration: 30,  isActive: true, sortOrder: 1, imageUrl: null },
  { id: 's2',  categoryId: 'c1', nameAr: 'صبغة شعر كامل',   nameEn: 'Full Color', descriptionAr: null, price: 250,  duration: 90,  isActive: true, sortOrder: 2, imageUrl: null },
  { id: 's3',  categoryId: 'c1', nameAr: 'بروتين شعر',      nameEn: 'Protein',    descriptionAr: null, price: 450,  duration: 120, isActive: true, sortOrder: 3, imageUrl: null },
  { id: 's4',  categoryId: 'c1', nameAr: 'سشوار',           nameEn: 'Blow Dry',   descriptionAr: null, price: 60,   duration: 30,  isActive: true, sortOrder: 4, imageUrl: null },
  { id: 's5',  categoryId: 'c1', nameAr: 'فرد كيراتين',     nameEn: 'Keratin',    descriptionAr: null, price: 550,  duration: 150, isActive: true, sortOrder: 5, imageUrl: null },
  { id: 's6',  categoryId: 'c1', nameAr: 'هايلايت',          nameEn: 'Highlights', descriptionAr: null, price: 350,  duration: 90,  isActive: true, sortOrder: 6, imageUrl: null },
  { id: 's7',  categoryId: 'c2', nameAr: 'تنظيف بشرة عميق', nameEn: 'Deep Facial',descriptionAr: null, price: 180,  duration: 45,  isActive: true, sortOrder: 1, imageUrl: null },
  { id: 's8',  categoryId: 'c2', nameAr: 'هيدرافيشل',       nameEn: 'HydraFacial',descriptionAr: null, price: 350,  duration: 60,  isActive: true, sortOrder: 2, imageUrl: null },
  { id: 's9',  categoryId: 'c2', nameAr: 'تقشير كيميائي',   nameEn: 'Chem Peel',  descriptionAr: null, price: 280,  duration: 40,  isActive: true, sortOrder: 3, imageUrl: null },
  { id: 's10', categoryId: 'c2', nameAr: 'ميزوثيرابي',      nameEn: 'Mesotherapy', descriptionAr: null, price: 500,  duration: 30,  isActive: true, sortOrder: 4, imageUrl: null },
  { id: 's11', categoryId: 'c3', nameAr: 'مكياج سهرة',      nameEn: 'Evening MU', descriptionAr: null, price: 300,  duration: 60,  isActive: true, sortOrder: 1, imageUrl: null },
  { id: 's12', categoryId: 'c3', nameAr: 'مكياج ناعم',      nameEn: 'Soft Makeup',descriptionAr: null, price: 200,  duration: 45,  isActive: true, sortOrder: 2, imageUrl: null },
  { id: 's13', categoryId: 'c3', nameAr: 'كونتور احترافي',   nameEn: 'Pro Contour',descriptionAr: null, price: 350,  duration: 50,  isActive: true, sortOrder: 3, imageUrl: null },
  { id: 's14', categoryId: 'c4', nameAr: 'أظافر جل',        nameEn: 'Gel Nails',  descriptionAr: null, price: 150,  duration: 45,  isActive: true, sortOrder: 1, imageUrl: null },
  { id: 's15', categoryId: 'c4', nameAr: 'بدكير ومنكير',    nameEn: 'Pedi&Mani',  descriptionAr: null, price: 120,  duration: 50,  isActive: true, sortOrder: 2, imageUrl: null },
  { id: 's16', categoryId: 'c4', nameAr: 'أظافر أكريليك',   nameEn: 'Acrylic',    descriptionAr: null, price: 200,  duration: 60,  isActive: true, sortOrder: 3, imageUrl: null },
  { id: 's17', categoryId: 'c5', nameAr: 'باكج عروس كامل', nameEn: 'Full Bridal',descriptionAr: null, price: 2500, duration: 240, isActive: true, sortOrder: 1, imageUrl: null },
  { id: 's18', categoryId: 'c5', nameAr: 'تسريحة عروس',    nameEn: 'Bridal Hair',descriptionAr: null, price: 500,  duration: 90,  isActive: true, sortOrder: 2, imageUrl: null },
  { id: 's19', categoryId: 'c6', nameAr: 'حمام مغربي',      nameEn: 'Moroc Bath', descriptionAr: null, price: 300,  duration: 60,  isActive: true, sortOrder: 1, imageUrl: null },
  { id: 's20', categoryId: 'c6', nameAr: 'حمام كليوباترا',  nameEn: 'Cleopatra',  descriptionAr: null, price: 450,  duration: 90,  isActive: true, sortOrder: 2, imageUrl: null },
];

export const M_EMP: Employee[] = [
  { id: 'e1', userId: null, fullName: 'سارة القحطاني', phone: null, email: null, role: 'stylist', commissionType: 'percentage', commissionValue: 15, isActive: true, salary: 0, avatarUrl: null, createdAt: '', updatedAt: '' },
  { id: 'e2', userId: null, fullName: 'هند الشمري',    phone: null, email: null, role: 'stylist', commissionType: 'percentage', commissionValue: 12, isActive: true, salary: 0, avatarUrl: null, createdAt: '', updatedAt: '' },
  { id: 'e3', userId: null, fullName: 'أمل الزهراني',  phone: null, email: null, role: 'stylist', commissionType: 'percentage', commissionValue: 10, isActive: true, salary: 0, avatarUrl: null, createdAt: '', updatedAt: '' },
  { id: 'e4', userId: null, fullName: 'ديما البقمي',   phone: null, email: null, role: 'stylist', commissionType: 'fixed',      commissionValue: 50, isActive: true, salary: 0, avatarUrl: null, createdAt: '', updatedAt: '' },
  { id: 'e5', userId: null, fullName: 'منيرة الدوسري', phone: null, email: null, role: 'stylist', commissionType: 'percentage', commissionValue: 8,  isActive: true, salary: 0, avatarUrl: null, createdAt: '', updatedAt: '' },
];

export const M_CLI: Client[] = [
  { id: 'cl1', fullName: 'نورة الأحمد',   phone: '0551234567', email: null, gender: 'female', dateOfBirth: null, notes: 'تفضل صبغة شقراء',       source: 'online',   totalVisits: 12, totalSpent: 4200,  lastVisitAt: '2026-03-20', isActive: true, createdAt: '', updatedAt: '' },
  { id: 'cl2', fullName: 'ريم العتيبي',   phone: '0559876543', email: null, gender: 'female', dateOfBirth: null, notes: 'حساسية من بعض المنتجات', source: 'walk_in',  totalVisits: 8,  totalSpent: 2800,  lastVisitAt: '2026-03-15', isActive: true, createdAt: '', updatedAt: '' },
  { id: 'cl3', fullName: 'لطيفة المطيري', phone: '0541112233', email: null, gender: 'female', dateOfBirth: null, notes: null,                     source: 'phone',    totalVisits: 3,  totalSpent: 950,   lastVisitAt: '2026-03-10', isActive: true, createdAt: '', updatedAt: '' },
  { id: 'cl4', fullName: 'هيا السبيعي',   phone: '0567778899', email: null, gender: 'female', dateOfBirth: null, notes: 'عميلة VIP',              source: 'referral', totalVisits: 25, totalSpent: 12500, lastVisitAt: '2026-03-25', isActive: true, createdAt: '', updatedAt: '' },
];

export const M_BUNDLES: ServiceBundle[] = [
  { id: 'b1', nameAr: 'باقة العروس الذهبية',   services: [{ serviceId: 's17' }, { serviceId: 's11' }, { serviceId: 's14' }], price: 2700, savings: 250 },
  { id: 'b2', nameAr: 'باقة العناية المتكاملة', services: [{ serviceId: 's7' }, { serviceId: 's15' }, { serviceId: 's4' }],  price: 300,  savings: 60 },
  { id: 'b3', nameAr: 'باقة تجديد الشعر',       services: [{ serviceId: 's1' }, { serviceId: 's2' }, { serviceId: 's4' }],  price: 350,  savings: 40 },
];

export const DEFAULT_FAVS = ['s1', 's4', 's7', 's11', 's14'];
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
