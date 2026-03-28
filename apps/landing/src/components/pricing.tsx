'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { Check, Zap, Star, Crown } from 'lucide-react';

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3000';
const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

interface Plan {
  name: string; price: number; period: string; desc: string;
  features: string[]; cta: string; popular?: boolean;
  icon: React.ElementType;
  gradient: string; border: string; glow: string; iconColor: string;
  tag?: string;
}

const plans: Plan[] = [
  {
    name: 'أساسي', price: 199, period: 'شهرياً', icon: Zap,
    desc: 'للصالون الصغير يبدأ رحلته',
    tag: 'ابدأ مجاناً',
    gradient: 'linear-gradient(145deg, rgba(168,85,247,0.06) 0%, rgba(99,102,241,0.03) 100%)',
    border: 'rgba(168,85,247,0.15)',
    glow: 'rgba(168,85,247,0.15)',
    iconColor: '#a855f7',
    features: [
      'إدارة الخدمات والفئات',
      'حتى ١٠٠ عميلة',
      'حتى ٣ موظفات',
      'المواعيد والتقويم',
      'نقاط البيع والفواتير',
      'التقارير الأساسية',
    ],
    cta: 'ابدأ مجاناً',
  },
  {
    name: 'احترافي', price: 399, period: 'شهرياً', icon: Star, popular: true,
    desc: 'الأنسب للصالونات النشطة والمتنامية',
    tag: 'الأكثر طلباً',
    gradient: 'linear-gradient(145deg, rgba(168,85,247,0.14) 0%, rgba(99,102,241,0.08) 50%, rgba(34,211,238,0.04) 100%)',
    border: 'rgba(168,85,247,0.45)',
    glow: 'rgba(168,85,247,0.35)',
    iconColor: '#c084fc',
    features: [
      'كل مميزات الأساسي',
      'عملاء غير محدودات',
      'حتى ١٠ موظفات',
      'صفحة الحجز الإلكتروني',
      'التقارير المتقدمة',
      'صلاحيات RBAC تفصيلية',
      'فواتير ZATCA',
    ],
    cta: 'جرّبي ١٤ يوم مجاناً',
  },
  {
    name: 'مميز', price: 699, period: 'شهرياً', icon: Crown,
    desc: 'لصالونات متعددة الفروع والخدمات الموسعة',
    tag: 'الأقوى',
    gradient: 'linear-gradient(145deg, rgba(251,191,36,0.06) 0%, rgba(168,85,247,0.04) 100%)',
    border: 'rgba(251,191,36,0.2)',
    glow: 'rgba(251,191,36,0.2)',
    iconColor: '#fbbf24',
    features: [
      'كل مميزات الاحترافي',
      'موظفات غير محدودات',
      'تعدد الفروع',
      'واتساب خاص بالصالون',
      'نظام الولاء والنقاط',
      'الكوبونات والعروض',
      'تقارير AI متقدمة',
    ],
    cta: 'ابدأي الآن',
  },
];

export default function Pricing(): React.ReactElement {
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

        {/* Cards */}
        <div className="grid gap-5 md:grid-cols-3 md:items-center">
          {plans.map((plan, i) => {
            const Icon = plan.icon;
            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 36 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: i * 0.12, ease: EASE }}
                whileHover={{ y: -4, transition: { duration: 0.25 } }}
                className="group relative overflow-hidden rounded-2xl p-7"
                style={{
                  background: plan.gradient,
                  border: `1px solid ${plan.border}`,
                  backdropFilter: 'blur(20px)',
                  ...(plan.popular ? {
                    boxShadow: `0 0 60px ${plan.glow}, 0 20px 60px ${plan.glow}50`,
                    transform: 'scale(1.03)',
                  } : {}),
                }}
              >
                {/* Hover top glow */}
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{ background: `linear-gradient(90deg, transparent, ${plan.border}, transparent)` }}
                />

                {/* Popular badge */}
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
                    <div
                      className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold text-white shadow-lg"
                      style={{
                        background: 'linear-gradient(135deg, #9333ea, #6366f1)',
                        boxShadow: '0 0 20px rgba(147,51,234,0.5)',
                      }}
                    >
                      <Zap className="h-3 w-3" />
                      {plan.tag}
                    </div>
                  </div>
                )}

                {/* Plan header */}
                <div className="mb-5 flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{
                      background: `${plan.iconColor}18`,
                      border: `1px solid ${plan.iconColor}30`,
                      boxShadow: `0 0 16px ${plan.iconColor}25`,
                    }}
                  >
                    <Icon className="h-5 w-5" style={{ color: plan.iconColor }} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">{plan.name}</h3>
                    <p className="text-sm text-white/40">{plan.desc}</p>
                  </div>
                </div>

                {/* Price */}
                <div className="mb-6 flex items-baseline gap-1.5">
                  <span
                    className="text-5xl font-black leading-none"
                    style={plan.popular ? {
                      background: 'linear-gradient(135deg, #f0e6ff, #d8b4fe, #a855f7)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    } : { color: 'white' }}
                  >
                    {plan.price.toLocaleString('ar-SA')}
                  </span>
                  <div className="text-sm text-white/40">
                    <div>ر.س</div>
                    <div>{plan.period}</div>
                  </div>
                </div>

                {/* Features */}
                <ul className="mb-7 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-white/60">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0"
                        style={{ color: plan.popular ? '#c084fc' : plan.iconColor }}
                      />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Link
                  href={`${DASHBOARD_URL}/register`}
                  className={`block w-full rounded-xl py-3.5 text-center text-sm font-bold transition-all duration-200 ${
                    plan.popular
                      ? 'btn-primary text-white'
                      : 'text-white/75 hover:text-white'
                  }`}
                  style={!plan.popular ? {
                    border: `1px solid ${plan.border}`,
                    background: `${plan.iconColor}08`,
                    backdropFilter: 'blur(10px)',
                  } : undefined}
                >
                  {plan.cta}
                </Link>

                {/* Background orb */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute -end-10 -bottom-10 h-32 w-32 rounded-full opacity-20 group-hover:opacity-40 transition-opacity duration-500"
                  style={{ background: `radial-gradient(circle, ${plan.glow} 0%, transparent 70%)` }}
                />
              </motion.div>
            );
          })}
        </div>

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
