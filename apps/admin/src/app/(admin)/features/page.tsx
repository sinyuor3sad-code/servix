'use client';

import { useState, useEffect, type ReactElement } from 'react';
import { ToggleRight, Shield, Sparkles, Crown, Check, X, Loader2 } from 'lucide-react';
import { Glass, PageTitle } from '@/components/ui/glass';
import { adminService } from '@/services/admin.service';

/* ── Types matching real backend response ── */
interface PlanFeatureItem {
  planId: string;
  featureId: string;
  feature: { id: string; code: string; nameAr: string; nameEn?: string };
}

interface PlanData {
  id: string;
  name: string;
  nameAr: string;
  isActive: boolean;
  planFeatures: PlanFeatureItem[];
}

/* ── Plan icons by name ── */
function getPlanMeta(name: string) {
  const n = (name || '').toLowerCase();
  if (n.includes('enterprise') || n.includes('مؤسس'))
    return { icon: Crown, color: '#C9A84C', label: 'Enterprise' };
  if (n.includes('pro') || n.includes('احترافي'))
    return { icon: Sparkles, color: '#A78BFA', label: 'Pro' };
  return { icon: Shield, color: '#94A3B8', label: 'Basic' };
}

function Chk({ on }: { on: boolean }) {
  return on
    ? <span style={{ width: 24, height: 24, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(52,211,153,0.1)' }}>
        <Check size={14} style={{ color: '#34D399' }} strokeWidth={2.5} />
      </span>
    : <span style={{ width: 24, height: 24, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)' }}>
        <X size={14} style={{ color: 'var(--ghost)', opacity: 0.4 }} />
      </span>;
}

export default function FeaturesPage(): ReactElement {
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    adminService.getPlans()
      .then((data: any) => {
        setPlans(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        console.error('Features fetch error:', e);
        setError('فشل تحميل البيانات');
      })
      .finally(() => setLoading(false));
  }, []);

  // Build a unique list of all features across all plans
  const allFeatures = Array.from(
    new Map(
      plans.flatMap(p =>
        p.planFeatures.map(pf => [pf.feature.code, pf.feature])
      )
    ).values()
  );

  // Sort plans by their typical order (basic → pro → enterprise)
  const sortedPlans = [...plans].filter(p => p.isActive).sort((a, b) => {
    const order = (name: string) => {
      const n = name.toLowerCase();
      if (n.includes('basic') || n.includes('أساسي')) return 0;
      if (n.includes('pro') || n.includes('احترافي')) return 1;
      if (n.includes('enterprise') || n.includes('مؤسس')) return 2;
      return 3;
    };
    return order(a.name) - order(b.name);
  });

  return (
    <div className="nx-space-y">
      <PageTitle title="إدارة الميزات" desc={loading ? 'جاري التحميل...' : `${allFeatures.length} ميزة عبر ${sortedPlans.length} باقة`}
        icon={<ToggleRight size={20} style={{ color: '#A78BFA' }} strokeWidth={1.5} />}
      />

      <Glass>
        {loading ? (
          <div className="nx-empty">
            <Loader2 size={28} className="nx-spin" style={{ color: 'var(--ghost)' }} />
            <p className="nx-empty-desc" style={{ marginTop: 12 }}>جاري تحميل الميزات من قاعدة البيانات...</p>
          </div>
        ) : error ? (
          <div className="nx-empty">
            <X size={22} style={{ color: '#EF4444' }} />
            <p className="nx-empty-title" style={{ color: '#EF4444' }}>{error}</p>
          </div>
        ) : allFeatures.length === 0 ? (
          <div className="nx-empty">
            <div className="nx-empty-icon"><ToggleRight size={22} /></div>
            <p className="nx-empty-title">لا توجد ميزات</p>
            <p className="nx-empty-desc">لم يتم إنشاء أي ميزات في قاعدة البيانات بعد</p>
          </div>
        ) : (
          <div className="nx-table-mobile-wrap"><table className="nx-table">
            <thead>
              <tr>
                <th style={{ width: '40%' }}>الميزة</th>
                {sortedPlans.map((p) => {
                  const meta = getPlanMeta(p.name);
                  const Icon = meta.icon;
                  return (
                    <th key={p.id} style={{ textAlign: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Icon size={12} style={{ color: meta.color }} />{p.nameAr || p.name}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {allFeatures.map((f) => (
                <tr key={f.code}>
                  <td className="nx-td-primary" style={{ fontWeight: 500 }}>{f.nameAr || f.code}</td>
                  {sortedPlans.map((p) => {
                    const hasFeature = p.planFeatures.some(pf => pf.feature.code === f.code);
                    return (
                      <td key={p.id} style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center' }}><Chk on={hasFeature} /></div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Glass>
    </div>
  );
}
