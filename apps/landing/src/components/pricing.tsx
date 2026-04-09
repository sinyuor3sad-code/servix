'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Check, Zap, Star, Crown, Loader2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3000';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

const PLAN_STYLES = [
  { icon: Zap,   cta: 'ابدأ مجاناً',           ctaEn: 'Start Free' },
  { icon: Star,  cta: 'جرّبي ١٤ يوم مجاناً',    ctaEn: 'Try 14 Days Free', popular: true },
  { icon: Crown, cta: 'ابدئي الآن',             ctaEn: 'Start Now' },
];

interface ApiPlan {
  id: string;
  name: string;
  nameAr: string;
  descriptionAr: string;
  priceMonthly: number;
  priceYearly: number;
  maxEmployees: number;
  maxClients: number;
  features: { nameAr: string; code: string }[];
}

const FALLBACK_PLANS: ApiPlan[] = [
  {
    id: '1', name: 'basic', nameAr: 'أساسي', descriptionAr: 'للصالون الصغير يبدأ رحلته',
    priceMonthly: 199, priceYearly: 1910, maxEmployees: 3, maxClients: 100,
    features: [
      { nameAr: 'إدارة الخدمات والفئات', code: 'services' },
      { nameAr: 'حتى ١٠٠ عميلة', code: 'clients' },
      { nameAr: 'حتى ٣ موظفات', code: 'employees' },
      { nameAr: 'المواعيد والتقويم', code: 'appointments' },
      { nameAr: 'نقاط البيع والفواتير', code: 'pos' },
      { nameAr: 'التقارير الأساسية', code: 'reports' },
    ],
  },
  {
    id: '2', name: 'pro', nameAr: 'احترافي', descriptionAr: 'الأنسب للصالونات النشطة والمتنامية',
    priceMonthly: 399, priceYearly: 3830, maxEmployees: 10, maxClients: -1,
    features: [
      { nameAr: 'كل مميزات الأساسي', code: 'all_basic' },
      { nameAr: 'عملاء غير محدودات', code: 'unlimited_clients' },
      { nameAr: 'حتى ١٠ موظفات', code: 'employees' },
      { nameAr: 'صفحة الحجز الإلكتروني', code: 'booking' },
      { nameAr: 'التقارير المتقدمة', code: 'advanced_reports' },
      { nameAr: 'صلاحيات RBAC تفصيلية', code: 'rbac' },
      { nameAr: 'فواتير ZATCA', code: 'zatca' },
    ],
  },
  {
    id: '3', name: 'enterprise', nameAr: 'مميز', descriptionAr: 'لصالونات متعددة الفروع والخدمات الموسعة',
    priceMonthly: 699, priceYearly: 6710, maxEmployees: -1, maxClients: -1,
    features: [
      { nameAr: 'كل مميزات الاحترافي', code: 'all_pro' },
      { nameAr: 'موظفات غير محدودات', code: 'unlimited_employees' },
      { nameAr: 'تعدد الفروع', code: 'branches' },
      { nameAr: 'واتساب خاص بالصالون', code: 'whatsapp' },
      { nameAr: 'نظام الولاء والنقاط', code: 'loyalty' },
      { nameAr: 'الكوبونات والعروض', code: 'coupons' },
      { nameAr: 'تقارير AI متقدمة', code: 'ai_reports' },
    ],
  },
];

export default function Pricing(): React.ReactElement {
  const [plans, setPlans] = useState<ApiPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const res = await fetch(`${API_URL}/health/plans`, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) throw new Error('API error');
        const json = await res.json();
        const data: ApiPlan[] = json?.data ?? json;
        if (Array.isArray(data) && data.length > 0) {
          setPlans(data);
        } else {
          setPlans(FALLBACK_PLANS);
        }
      } catch {
        setPlans(FALLBACK_PLANS);
      } finally {
        setLoading(false);
      }
    };
    fetchPlans();
  }, []);

  return (
    <section id="pricing" className="relative overflow-hidden py-24 sm:py-32">
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.8, ease: EASE }}
          className="mx-auto mb-16 max-w-xl text-center"
        >
          <h2 className="text-4xl font-black tracking-tight sm:text-5xl" style={{ color: 'var(--fg)' }}>
            {t('pricing.title')}{' '}
            <span style={{ color: 'var(--gold)' }}>{t('pricing.titleAccent')}</span>
          </h2>
          <p className="mt-4 text-base" style={{ color: 'var(--fg-secondary)' }}>
            {t('pricing.subtitle')}
          </p>
        </motion.div>

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--gold)' }} />
          </div>
        ) : (
          /* Cards */
          <div className="grid gap-6 md:grid-cols-3 md:items-start">
            {plans.map((plan, i) => {
              const style = PLAN_STYLES[i] ?? PLAN_STYLES[0];
              const Icon = style.icon;
              const isPopular = !!style.popular;

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.8, delay: i * 0.12, ease: EASE }}
                  whileHover={{ scale: 1.02, transition: { duration: 0.25 } }}
                  className="card-luxury relative overflow-hidden p-8"
                  style={isPopular ? {
                    borderColor: 'var(--border-gold)',
                    boxShadow: '0 16px 64px rgba(200,169,126,0.1)',
                  } : undefined}
                >
                  {/* Popular badge */}
                  {isPopular && (
                    <div className="absolute -top-px inset-x-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, var(--gold), transparent)' }} />
                  )}

                  {/* Plan header */}
                  <div className="mb-6 flex items-center gap-3">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-xl"
                      style={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <Icon className="h-5 w-5" style={{ color: isPopular ? 'var(--gold)' : 'var(--fg-secondary)' }} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold" style={{ color: 'var(--fg)' }}>{plan.nameAr}</h3>
                      <p className="text-sm" style={{ color: 'var(--fg-secondary)' }}>{plan.descriptionAr}</p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-7 flex items-baseline gap-1.5">
                    <span
                      className="text-5xl font-black leading-none"
                      style={{ color: isPopular ? 'var(--gold)' : 'var(--fg)' }}
                    >
                      {plan.priceMonthly.toLocaleString('ar-SA')}
                    </span>
                    <div className="text-sm" style={{ color: 'var(--fg-secondary)' }}>
                      <div>ر.س</div>
                      <div>شهرياً</div>
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="mb-8 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f.code} className="flex items-start gap-2.5 text-base" style={{ color: 'var(--fg)' }}>
                        <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--gold)' }} />
                        {f.nameAr}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Link
                    href={`${DASHBOARD_URL}/register`}
                    className={`block w-full rounded-xl py-3.5 text-center text-sm font-bold transition-all duration-300 ${
                      isPopular ? 'btn-gold justify-center' : 'btn-outline justify-center'
                    }`}
                  >
                    {style.cta}
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Note */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-10 text-center text-sm"
          style={{ color: 'var(--fg-secondary)' }}
        >
          {t('pricing.note')}
        </motion.p>
      </div>
    </section>
  );
}
