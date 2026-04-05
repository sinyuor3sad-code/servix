'use client';

import { type ReactElement } from 'react';
import { Shield, Sparkles, Crown, Check, X, Users, Edit } from 'lucide-react';
import { Glass, PageTitle } from '@/components/ui/glass';

const PLANS = [
  {
    name: 'Basic', nameAr: 'أساسي', icon: Shield, price: 199, cycle: '/شهر',
    color: '#94A3B8', tenants: 12,
    features: [true, true, true, false, false, false, false, false],
  },
  {
    name: 'Pro', nameAr: 'احترافي', icon: Sparkles, price: 399, cycle: '/شهر',
    color: '#A78BFA', tenants: 28, popular: true,
    features: [true, true, true, true, true, true, false, false],
  },
  {
    name: 'Enterprise', nameAr: 'مؤسسات', icon: Crown, price: 699, cycle: '/شهر',
    color: '#C9A84C', tenants: 7,
    features: [true, true, true, true, true, true, true, true],
  },
];

const FEATURES = ['إدارة الخدمات', 'إدارة العملاء', 'المواعيد والحجوزات', 'صفحة الحجز الإلكتروني', 'التقارير المتقدمة', 'فوترة ZATCA', 'واتساب', 'متعدد الفروع'];

export default function PlansPage(): ReactElement {
  return (
    <div className="nx-space-y">
      <PageTitle title="الباقات والأسعار" desc="إدارة باقات الاشتراك وتعديل الأسعار والميزات"
        icon={<Crown size={20} style={{ color: '#C9A84C' }} strokeWidth={1.5} />}
      >
        <button className="nx-btn nx-btn--primary">
          <Edit size={15} /> تعديل الباقات
        </button>
      </PageTitle>

      <div className="nx-grid-3">
        {PLANS.map((p) => {
          const Icon = p.icon;
          return (
            <Glass key={p.name} hover>
              <div style={{ padding: 28, position: 'relative' }}>
                {p.popular && (
                  <span className="nx-badge nx-badge--violet" style={{ position: 'absolute', top: 16, left: 16, fontSize: 10 }}>
                    الأكثر شيوعاً
                  </span>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${p.color}10` }}>
                    <Icon size={22} style={{ color: p.color }} strokeWidth={1.6} />
                  </div>
                  <div>
                    <p style={{ fontSize: 18, fontWeight: 800, color: p.color }}>{p.nameAr}</p>
                    <p style={{ fontSize: 11, color: 'var(--ghost)' }}>{p.name}</p>
                  </div>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--slate)', fontFeatureSettings: '"tnum"' }}>{p.price}</span>
                  <span style={{ fontSize: 14, color: 'var(--ghost)', marginInlineStart: 6 }}>ر.س {p.cycle}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 24 }}>
                  <Users size={14} style={{ color: 'var(--ghost)' }} />
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}><strong style={{ fontWeight: 700, color: 'var(--slate)' }}>{p.tenants}</strong> شركة مشتركة</span>
                </div>

                <ul style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {FEATURES.map((f, i) => (
                    <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                      {p.features[i]
                        ? <Check size={15} style={{ color: '#34D399' }} strokeWidth={2.5} />
                        : <X size={15} style={{ color: 'var(--ghost)', opacity: 0.4 }} strokeWidth={2} />
                      }
                      <span style={{ color: p.features[i] ? 'var(--muted)' : 'var(--ghost)', textDecoration: p.features[i] ? 'none' : 'line-through' }}>{f}</span>
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
