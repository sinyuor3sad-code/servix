'use client';

import { type ReactElement } from 'react';
import { Shield, Sparkles, Crown, Check, X, Users, Edit } from 'lucide-react';
import { Glass, PageTitle } from '@/components/ui/glass';

const PLANS = [
  {
    name: 'Basic', nameAr: 'أساسي', icon: Shield, price: 199, cycle: '/شهر',
    color: 'border-white/[0.08] from-white/[0.04] to-white/[0.01]', accent: 'text-white/60', badge: 'bg-white/[0.04] text-white/40 border-white/[0.06]',
    tenants: 12,
    features: [true, true, true, false, false, false, false, false],
  },
  {
    name: 'Pro', nameAr: 'احترافي', icon: Sparkles, price: 399, cycle: '/شهر',
    color: 'border-violet-500/20 from-violet-500/[0.06] to-violet-500/[0.01]', accent: 'text-violet-400', badge: 'bg-violet-500/10 text-violet-400 border-violet-500/18',
    tenants: 28, popular: true,
    features: [true, true, true, true, true, true, false, false],
  },
  {
    name: 'Enterprise', nameAr: 'مؤسسات', icon: Crown, price: 699, cycle: '/شهر',
    color: 'border-amber-500/20 from-amber-500/[0.06] to-amber-500/[0.01]', accent: 'text-amber-400', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/18',
    tenants: 7,
    features: [true, true, true, true, true, true, true, true],
  },
];

const FEATURE_NAMES = ['إدارة الخدمات', 'إدارة العملاء', 'المواعيد والحجوزات', 'صفحة الحجز الإلكتروني', 'التقارير المتقدمة', 'فوترة ZATCA', 'واتساب', 'متعدد الفروع'];

export default function PlansPage(): ReactElement {
  return (
    <div className="space-y-5">
      <PageTitle title="الباقات والأسعار" desc="إدارة باقات الاشتراك وتعديل الأسعار والميزات">
        <button className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-5 py-2.5 text-[13px] font-bold text-black shadow-lg shadow-amber-500/20 hover:shadow-xl active:scale-[0.97]">
          <Edit size={15} /> تعديل الباقات
        </button>
      </PageTitle>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {PLANS.map((p) => {
          const Icon = p.icon;
          return (
            <Glass key={p.name} hover className={`relative ${p.color.includes('amber') ? 'border-amber-500/20' : p.color.includes('violet') ? 'border-violet-500/20' : ''}`}>
              <div className="p-7">
                {p.popular && (
                  <span className="absolute top-4 left-4 rounded-full bg-violet-500/15 px-3 py-1 text-[10px] font-bold text-violet-400 border border-violet-500/20">الأكثر شيوعاً</span>
                )}
                <div className="mb-6 flex items-center gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.03] ${p.accent}`}>
                    <Icon size={22} strokeWidth={1.6} />
                  </div>
                  <div>
                    <p className={`text-lg font-extrabold ${p.accent}`}>{p.nameAr}</p>
                    <p className="text-[11px] text-white/25">{p.name}</p>
                  </div>
                </div>

                <div className="mb-6">
                  <span className="text-4xl font-extrabold text-white" style={{ fontFeatureSettings: '"tnum"' }}>{p.price}</span>
                  <span className="mr-1 text-sm text-white/25">ر.س {p.cycle}</span>
                </div>

                <div className="mb-6 flex items-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                  <Users size={14} className="text-white/25" />
                  <span className="text-[12px] text-white/40"><strong className="font-bold text-white/65">{p.tenants}</strong> شركة مشتركة</span>
                </div>

                <ul className="space-y-2.5">
                  {FEATURE_NAMES.map((f, i) => (
                    <li key={f} className="flex items-center gap-2.5 text-[13px]">
                      {p.features[i]
                        ? <Check size={15} className="text-emerald-400" strokeWidth={2.5} />
                        : <X size={15} className="text-white/12" strokeWidth={2} />
                      }
                      <span className={p.features[i] ? 'text-white/60' : 'text-white/18 line-through'}>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Glass>
          );
        })}
      </div>
    </div>
  );
}
