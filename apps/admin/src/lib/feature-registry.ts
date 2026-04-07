/**
 * SERVIX Feature Registry
 * Central source of truth for feature metadata used in the admin UI.
 * The database stores assignments (which features belong to which plans),
 * while this registry provides display metadata.
 */

export interface FeatureCategory {
  key: string;
  labelAr: string;
  labelEn: string;
  color: string;
}

export const FEATURE_CATEGORIES: FeatureCategory[] = [
  { key: 'operations', labelAr: 'العمليات', labelEn: 'Operations', color: '#60A5FA' },
  { key: 'customers', labelAr: 'العملاء', labelEn: 'Customers', color: '#34D399' },
  { key: 'scheduling', labelAr: 'الجدولة', labelEn: 'Scheduling', color: '#FBBF24' },
  { key: 'pos', labelAr: 'نقاط البيع', labelEn: 'POS / Billing', color: '#F97316' },
  { key: 'reports', labelAr: 'التقارير', labelEn: 'Reports', color: '#A78BFA' },
  { key: 'marketing', labelAr: 'التسويق', labelEn: 'Marketing', color: '#EC4899' },
  { key: 'staff', labelAr: 'الموظفون', labelEn: 'Staff & Permissions', color: '#14B8A6' },
  { key: 'inventory', labelAr: 'المخزون', labelEn: 'Inventory', color: '#8B5CF6' },
  { key: 'finance', labelAr: 'المالية', labelEn: 'Finance', color: '#EF4444' },
  { key: 'integrations', labelAr: 'التكاملات', labelEn: 'Integrations', color: '#06B6D4' },
  { key: 'ai', labelAr: 'الذكاء الاصطناعي', labelEn: 'AI / Automation', color: '#C9A84C' },
  { key: 'system', labelAr: 'النظام', labelEn: 'System Tools', color: '#64748B' },
];

export const CATEGORY_MAP = new Map(FEATURE_CATEGORIES.map(c => [c.key, c]));

export function getCategoryLabel(key: string | null | undefined): string {
  if (!key) return 'عام';
  return CATEGORY_MAP.get(key)?.labelAr || key;
}

export function getCategoryColor(key: string | null | undefined): string {
  if (!key) return '#64748B';
  return CATEGORY_MAP.get(key)?.color || '#64748B';
}

export const PLAN_BADGES = [
  { key: 'most_popular', labelAr: 'الأكثر شعبية', color: '#F97316' },
  { key: 'best_value', labelAr: 'أفضل قيمة', color: '#34D399' },
  { key: 'enterprise', labelAr: 'مؤسسي', color: '#C9A84C' },
  { key: 'new', labelAr: 'جديد', color: '#60A5FA' },
] as const;

export const SUBSCRIPTION_STATES = [
  { key: 'active', labelAr: 'نشط', color: '#34D399' },
  { key: 'trial', labelAr: 'تجريبي', color: '#60A5FA' },
  { key: 'expired', labelAr: 'منتهي', color: '#EF4444' },
  { key: 'cancelled', labelAr: 'ملغي', color: '#64748B' },
  { key: 'past_due', labelAr: 'متأخر الدفع', color: '#F97316' },
] as const;
