'use client';

import { useState, useEffect, useCallback, type ReactElement, type CSSProperties } from 'react';
import {
  ToggleRight, Shield, Sparkles, Crown, Check, X,
  Loader2, Plus, Save, Layers, Filter,
} from 'lucide-react';
import { Glass, PageTitle } from '@/components/ui/glass';
import { adminService } from '@/services/admin.service';
import { FEATURE_CATEGORIES, getCategoryLabel, getCategoryColor } from '@/lib/feature-registry';

const EN: CSSProperties = {
  fontFeatureSettings: '"tnum" 1', fontVariantNumeric: 'tabular-nums',
  fontFamily: '"Inter", "Outfit", system-ui, sans-serif',
  direction: 'ltr' as const, unicodeBidi: 'embed' as const,
};

interface FeatureItem {
  id: string; code: string; nameAr: string; nameEn: string | null;
  category: string | null; isAddon: boolean; sortOrder: number;
  planFeatures: { planId: string }[];
}

interface PlanData {
  id: string; name: string; nameAr: string; isActive: boolean;
  planFeatures: { featureId: string; feature: { id: string; code: string; nameAr: string } }[];
}

function getPlanMeta(name: string) {
  const n = (name || '').toLowerCase();
  if (n.includes('enterprise') || n.includes('مؤسس') || n.includes('premium'))
    return { icon: Crown, color: '#C9A84C', label: 'Enterprise' };
  if (n.includes('pro') || n.includes('احترافي'))
    return { icon: Sparkles, color: '#A78BFA', label: 'Pro' };
  return { icon: Shield, color: '#94A3B8', label: 'Basic' };
}

export default function FeaturesPage(): ReactElement {
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [features, setFeatures] = useState<FeatureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [plansData, featuresData] = await Promise.all([
        adminService.getPlans(),
        adminService.getFeatureCatalog(),
      ]);
      setPlans(Array.isArray(plansData) ? plansData as any : []);
      setFeatures(Array.isArray(featuresData) ? featuresData : []);
    } catch (e) {
      setError('فشل تحميل البيانات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const sortedPlans = [...plans].filter(p => p.isActive).sort((a, b) => {
    const order = (name: string) => {
      const n = name.toLowerCase();
      if (n.includes('basic') || n.includes('أساسي')) return 0;
      if (n.includes('pro') || n.includes('احترافي')) return 1;
      return 2;
    };
    return order(a.name) - order(b.name);
  });

  const toggleFeature = async (planId: string, featureId: string, currentlyEnabled: boolean) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;

    setSaving(`${planId}-${featureId}`);
    try {
      const currentFeatureIds = plan.planFeatures.map(pf => pf.featureId || pf.feature.id);
      let newFeatureIds: string[];
      if (currentlyEnabled) {
        newFeatureIds = currentFeatureIds.filter(id => id !== featureId);
      } else {
        newFeatureIds = [...currentFeatureIds, featureId];
      }
      await adminService.updatePlanFeatures(planId, newFeatureIds);
      await fetchData();
    } catch (e: any) {
      console.error('Toggle error:', e);
    } finally {
      setSaving(null);
    }
  };

  // Group features by category
  const categories = FEATURE_CATEGORIES.filter(c =>
    features.some(f => f.category === c.key)
  );

  const filteredFeatures = filterCategory
    ? features.filter(f => f.category === filterCategory)
    : features;

  // Group for display
  const grouped = categories.map(cat => ({
    ...cat,
    features: filteredFeatures.filter(f => f.category === cat.key),
  })).filter(g => g.features.length > 0);

  const uncategorized = filteredFeatures.filter(f => !f.category);
  if (uncategorized.length > 0 && !filterCategory) {
    grouped.push({ key: 'other', labelAr: 'أخرى', labelEn: 'Other', color: '#64748B', features: uncategorized });
  }

  return (
    <div className="nx-space-y">
      <PageTitle title="إدارة الميزات" desc={loading ? 'جاري التحميل...' : `${features.length} ميزة عبر ${sortedPlans.length} باقة`}
        icon={<Layers size={20} style={{ color: '#A78BFA' }} strokeWidth={1.5} />}
      />

      {/* Category Filter */}
      {!loading && features.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingBottom: 8 }}>
          <button onClick={() => setFilterCategory(null)}
            style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 600,
              border: !filterCategory ? '2px solid #A78BFA' : '1px solid var(--border)',
              background: !filterCategory ? '#A78BFA10' : 'transparent',
              color: !filterCategory ? '#A78BFA' : 'var(--ghost)', cursor: 'pointer',
            }}>الكل</button>
          {categories.map(cat => (
            <button key={cat.key} onClick={() => setFilterCategory(cat.key)}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                border: filterCategory === cat.key ? `2px solid ${cat.color}` : '1px solid var(--border)',
                background: filterCategory === cat.key ? `${cat.color}10` : 'transparent',
                color: filterCategory === cat.key ? cat.color : 'var(--ghost)', cursor: 'pointer',
              }}>{cat.labelAr}</button>
          ))}
        </div>
      )}

      {loading ? (
        <Glass>
          <div className="nx-empty">
            <Loader2 size={28} className="nx-spin" style={{ color: 'var(--ghost)' }} />
            <p className="nx-empty-desc" style={{ marginTop: 12 }}>جاري تحميل الميزات...</p>
          </div>
        </Glass>
      ) : error ? (
        <Glass>
          <div className="nx-empty">
            <X size={22} style={{ color: '#EF4444' }} />
            <p className="nx-empty-title" style={{ color: '#EF4444' }}>{error}</p>
          </div>
        </Glass>
      ) : (
        grouped.map(group => (
          <Glass key={group.key}>
            <div style={{ padding: '16px 18px' }}>
              {/* Category Header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
              }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%', background: group.color,
                }} />
                <span style={{ fontSize: 14, fontWeight: 800, color: group.color }}>{group.labelAr}</span>
                <span style={{ fontSize: 11, color: 'var(--ghost)', ...EN }}>
                  ({group.features.length} ميزة)
                </span>
              </div>

              {/* Feature Matrix */}
              <div className="nx-table-mobile-wrap">
                <table className="nx-table" style={{ marginBottom: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ width: '40%' }}>الميزة</th>
                      {sortedPlans.map((p) => {
                        const meta = getPlanMeta(p.name);
                        const PIcon = meta.icon;
                        return (
                          <th key={p.id} style={{ textAlign: 'center' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <PIcon size={12} style={{ color: meta.color }} />{p.nameAr || p.name}
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {group.features.map((f) => (
                      <tr key={f.code}>
                        <td className="nx-td-primary" style={{ fontWeight: 500 }}>
                          <div>
                            <span>{f.nameAr || f.code}</span>
                            {f.nameEn && <span style={{ fontSize: 10, color: 'var(--ghost)', display: 'block', ...EN }}>{f.nameEn}</span>}
                          </div>
                        </td>
                        {sortedPlans.map((p) => {
                          const hasFeature = p.planFeatures.some(pf => (pf.featureId || pf.feature?.id) === f.id);
                          const isSaving = saving === `${p.id}-${f.id}`;
                          return (
                            <td key={p.id} style={{ textAlign: 'center' }}>
                              <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <button onClick={() => toggleFeature(p.id, f.id, hasFeature)}
                                  disabled={!!saving}
                                  style={{
                                    width: 28, height: 28, borderRadius: 8,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    border: hasFeature ? '1px solid #34D39930' : '1px solid var(--border)',
                                    background: hasFeature ? 'rgba(52,211,153,0.1)' : 'var(--surface)',
                                    cursor: saving ? 'wait' : 'pointer',
                                    transition: 'all 0.15s',
                                  }}>
                                  {isSaving
                                    ? <Loader2 size={12} className="nx-spin" style={{ color: 'var(--ghost)' }} />
                                    : hasFeature
                                      ? <Check size={14} style={{ color: '#34D399' }} strokeWidth={2.5} />
                                      : <X size={12} style={{ color: 'var(--ghost)', opacity: 0.3 }} />
                                  }
                                </button>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Glass>
        ))
      )}
    </div>
  );
}
