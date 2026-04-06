'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Check, Zap, Star, Crown, Loader2 } from 'lucide-react';

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3000';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

/* ── Plan icon / color map based on plan index ── */
const PLAN_STYLES = [
  {
    icon: Zap, tag: 'ابدأ مجاناً', cta: 'ابدأ مجاناً',
    gradient: 'linear-gradient(145deg, rgba(168,85,247,0.06) 0%, rgba(99,102,241,0.03) 100%)',
    border: 'rgba(168,85,247,0.15)', glow: 'rgba(168,85,247,0.15)', iconColor: '#a855f7',
  },
  {
    icon: Star, tag: 'الأكثر طلباً', cta: 'جرّبي ١٤ يوم مجاناً', popular: true,
    gradient: 'linear-gradient(145deg, rgba(168,85,247,0.14) 0%, rgba(99,102,241,0.08) 50%, rgba(34,211,238,0.04) 100%)',
    border: 'rgba(168,85,247,0.45)', glow: 'rgba(168,85,247,0.35)', iconColor: '#c084fc',
  },
  {
    icon: Crown, tag: 'الأقوى', cta: 'ابدأي الآن',
    gradient: 'linear-gradient(145deg, rgba(251,191,36,0.06) 0%, rgba(168,85,247,0.04) 100%)',
    border: 'rgba(251,191,36,0.2)', glow: 'rgba(251,191,36,0.2)', iconColor: '#fbbf24',
  },
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

// Fallback plans — used only if API is unreachable
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
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(168,85,247,0.06) 0%, transparent 70%)' }}
      />
      <div aria-hidden className="dot-grid absolute inset-0 opacity-40" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="mx-auto mb-16 max-w-xl text-center"
        >
          <div
            className="mb-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold text-violet-300"
            style={{ border: '1px solid rgba(168,85,247,0.25)', background: 'rgba(168,85,247,0.1)' }}
          >
            <Star className="h-3.5 w-3.5" />
            خطط الاشتراك
          </div>
          <h2 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
            خطة تناسب
            <span className="gradient-text"> كل صالون</span>
          </h2>
          <p className="mt-4 text-lg text-white/45">
            ١٤ يوم تجربة مجانية — لا بطاقة ائتمان مطلوبة
          </p>
        </motion.div>

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
          </div>
        ) : (
          /* Cards */
          <div className="grid gap-5 md:grid-cols-3 md:items-center">
            {plans.map((plan, i) => {
              const style = PLAN_STYLES[i] ?? PLAN_STYLES[0];
              const Icon = style.icon;
              const isPopular = !!style.popular;
              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 36 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: i * 0.12, ease: EASE }}
                  whileHover={{ y: -4, transition: { duration: 0.25 } }}
                  className="group relative overflow-hidden rounded-2xl p-7"
                  style={{
                    background: style.gradient,
                    border: `1px solid ${style.border}`,
                    backdropFilter: 'blur(20px)',
                    ...(isPopular ? {
                      boxShadow: `0 0 60px ${style.glow}, 0 20px 60px ${style.glow}50`,
                      transform: 'scale(1.03)',
                    } : {}),
                  }}
                >
                  {/* Hover top glow */}
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    style={{ background: `linear-gradient(90deg, transparent, ${style.border}, transparent)` }}
                  />

                  {/* Popular badge */}
                  {isPopular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
                      <div
                        className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold text-white shadow-lg"
                        style={{
                          background: 'linear-gradient(135deg, #9333ea, #6366f1)',
                          boxShadow: '0 0 20px rgba(147,51,234,0.5)',
                        }}
                      >
                        <Zap className="h-3 w-3" />
                        {style.tag}
                      </div>
                    </div>
                  )}

                  {/* Plan header */}
                  <div className="mb-5 flex items-center gap-3">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-xl"
                      style={{
                        background: `${style.iconColor}18`,
                        border: `1px solid ${style.iconColor}30`,
                        boxShadow: `0 0 16px ${style.iconColor}25`,
                      }}
                    >
                      <Icon className="h-5 w-5" style={{ color: style.iconColor }} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white">{plan.nameAr}</h3>
                      <p className="text-sm text-white/40">{plan.descriptionAr}</p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-6 flex items-baseline gap-1.5">
                    <span
                      className="text-5xl font-black leading-none"
                      style={isPopular ? {
                        background: 'linear-gradient(135deg, #f0e6ff, #d8b4fe, #a855f7)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                      } : { color: 'white' }}
                    >
                      {plan.priceMonthly.toLocaleString('ar-SA')}
                    </span>
                    <div className="text-sm text-white/40">
                      <div>ر.س</div>
                      <div>شهرياً</div>
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="mb-7 space-y-2.5">
                    {plan.features.map((f) => (
                      <li key={f.code} className="flex items-start gap-2.5 text-sm text-white/60">
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0"
                          style={{ color: isPopular ? '#c084fc' : style.iconColor }}
                        />
                        {f.nameAr}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Link
                    href={`${DASHBOARD_URL}/register`}
                    className={`block w-full rounded-xl py-3.5 text-center text-sm font-bold transition-all duration-200 ${
                      isPopular
                        ? 'btn-primary text-white'
                        : 'text-white/75 hover:text-white'
                    }`}
                    style={!isPopular ? {
                      border: `1px solid ${style.border}`,
                      background: `${style.iconColor}08`,
                      backdropFilter: 'blur(10px)',
                    } : undefined}
                  >
                    {style.cta}
                  </Link>

                  {/* Background orb */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -end-10 -bottom-10 h-32 w-32 rounded-full opacity-20 group-hover:opacity-40 transition-opacity duration-500"
                    style={{ background: `radial-gradient(circle, ${style.glow} 0%, transparent 70%)` }}
                  />
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
          transition={{ duration: 0.7, delay: 0.5 }}
          className="mt-10 text-center text-sm text-white/30"
        >
          * جميع الأسعار شاملة ضريبة القيمة المضافة ١٥٪ · متاح اشتراك سنوي بخصم ٢٠٪
        </motion.p>
      </div>
    </section>
  );
}
