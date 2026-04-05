'use client';

import { useState, useEffect, type ReactElement } from 'react';
import {
  Shield, Sparkles, Crown, Check, X, Users, Edit,
  Save, Loader2, DollarSign, User, CalendarDays,
} from 'lucide-react';
import { Glass, PageTitle, TN } from '@/components/ui/glass';
import { adminService } from '@/services/admin.service';

interface PlanFeatureItem {
  planId: string;
  featureId: string;
  feature: {
    id: string;
    code: string;
    nameAr: string;
  };
}

interface PlanData {
  id: string;
  name: string;
  nameAr: string;
  priceMonthly: number;
  priceYearly: number;
  maxEmployees: number;
  maxClients: number;
  maxAppointmentsMonth: number | null;
  descriptionAr: string | null;
  isActive: boolean;
  sortOrder: number;
  activeSubscriptions: number;
  planFeatures: PlanFeatureItem[];
}

const PLAN_ICONS: Record<string, typeof Shield> = {
  basic: Shield,
  pro: Sparkles,
  enterprise: Crown,
};

const PLAN_COLORS: Record<string, string> = {
  basic: '#94A3B8',
  pro: '#A78BFA',
  enterprise: '#C9A84C',
};

function getPlanMeta(name: string) {
  const n = name.toLowerCase();
  if (n.includes('enterprise') || n.includes('مؤسس')) return { icon: Crown, color: '#C9A84C' };
  if (n.includes('pro') || n.includes('احترافي')) return { icon: Sparkles, color: '#A78BFA' };
  return { icon: Shield, color: '#94A3B8' };
}

/* ── Edit Plan Modal ── */
function EditPlanModal({ plan, onClose, onSaved }: {
  plan: PlanData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    nameAr: plan.nameAr,
    name: plan.name,
    priceMonthly: Number(plan.priceMonthly),
    priceYearly: Number(plan.priceYearly),
    maxEmployees: plan.maxEmployees,
    maxClients: plan.maxClients,
    maxAppointmentsMonth: plan.maxAppointmentsMonth ?? 0,
    descriptionAr: plan.descriptionAr ?? '',
    isActive: plan.isActive,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await adminService.updatePlan(plan.id, form);
      onSaved();
    } catch (e: any) {
      setError(e.message || 'حدث خطأ في الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, key: keyof typeof form, type: 'text' | 'number' = 'text') => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{label}</label>
      <input
        className="nx-input"
        type={type}
        value={form[key] as string | number}
        onChange={(e) => setForm(prev => ({ ...prev, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
      />
    </div>
  );

  const meta = getPlanMeta(plan.name);

  return (
    <div className="nx-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="nx-modal" style={{ maxWidth: 520 }}>
        <div className="nx-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <meta.icon size={18} style={{ color: meta.color }} />
            <span>تعديل باقة {plan.nameAr}</span>
          </div>
          <button className="nx-modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="nx-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="nx-grid-2" style={{ gap: 14 }}>
            {field('الاسم بالعربي', 'nameAr')}
            {field('الاسم بالإنجليزي', 'name')}
          </div>

          <div className="nx-grid-2" style={{ gap: 14 }}>
            {field('السعر الشهري (ر.س)', 'priceMonthly', 'number')}
            {field('السعر السنوي (ر.س)', 'priceYearly', 'number')}
          </div>

          <div className="nx-grid-2" style={{ gap: 14 }}>
            {field('حد الموظفين', 'maxEmployees', 'number')}
            {field('حد العملاء', 'maxClients', 'number')}
          </div>

          {field('حد المواعيد الشهرية', 'maxAppointmentsMonth', 'number')}
          {field('الوصف بالعربي', 'descriptionAr')}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              className={`nx-toggle ${form.isActive ? 'nx-toggle--on' : ''}`}
              onClick={() => setForm(prev => ({ ...prev, isActive: !prev.isActive }))}
            >
              <span className="nx-toggle-knob" />
            </button>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>
              {form.isActive ? 'مفعّلة' : 'متوقفة'}
            </span>
          </div>

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', color: '#EF4444', fontSize: 13, fontWeight: 600 }}>
              {error}
            </div>
          )}
        </div>

        <div className="nx-modal-footer">
          <button className="nx-btn" onClick={onClose}>إلغاء</button>
          <button className="nx-btn nx-btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={14} className="nx-spin" /> : <Save size={14} />}
            {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function PlansPage(): ReactElement {
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editPlan, setEditPlan] = useState<PlanData | null>(null);

  const fetchPlans = () => {
    setLoading(true);
    adminService.getPlans()
      .then((data: any) => setPlans(Array.isArray(data) ? data : []))
      .catch((e) => console.error('Plans fetch error:', e))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPlans(); }, []);

  const allFeatures = Array.from(
    new Map(
      plans.flatMap(p => p.planFeatures.map(pf => [pf.feature.code, pf.feature]))
    ).values()
  );

  return (
    <div className="nx-space-y">
      <PageTitle title="الباقات والأسعار" desc="إدارة باقات الاشتراك وتعديل الأسعار والميزات"
        icon={<Crown size={20} style={{ color: '#C9A84C' }} strokeWidth={1.5} />}
      />

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Loader2 size={28} className="nx-spin" style={{ color: 'var(--ghost)' }} />
        </div>
      ) : plans.length === 0 ? (
        <Glass>
          <div className="nx-empty" style={{ padding: '60px 20px' }}>
            <div className="nx-empty-icon"><Crown size={24} /></div>
            <p className="nx-empty-title">لا توجد باقات</p>
            <p className="nx-empty-desc">لم يتم إنشاء أي باقات بعد في قاعدة البيانات</p>
          </div>
        </Glass>
      ) : (
        <div className="nx-grid-3">
          {plans.map((p) => {
            const meta = getPlanMeta(p.name);
            const Icon = meta.icon;
            const featureCodes = new Set(p.planFeatures.map(pf => pf.feature.code));

            return (
              <Glass key={p.id} hover>
                <div style={{ padding: 28, position: 'relative' }}>
                  {!p.isActive && (
                    <span className="nx-badge nx-badge--red" style={{ position: 'absolute', top: 16, left: 16, fontSize: 10 }}>
                      متوقفة
                    </span>
                  )}

                  {/* Plan Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${meta.color}10` }}>
                        <Icon size={22} style={{ color: meta.color }} strokeWidth={1.6} />
                      </div>
                      <div>
                        <p style={{ fontSize: 18, fontWeight: 800, color: meta.color }}>{p.nameAr}</p>
                        <p style={{ fontSize: 11, color: 'var(--ghost)' }}>{p.name}</p>
                      </div>
                    </div>
                    <button className="nx-btn nx-btn--ghost" onClick={() => setEditPlan(p)} title="تعديل">
                      <Edit size={15} />
                    </button>
                  </div>

                  {/* Pricing */}
                  <div style={{ marginBottom: 24 }}>
                    <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--slate)', ...TN }}>{Number(p.priceMonthly).toLocaleString()}</span>
                    <span style={{ fontSize: 14, color: 'var(--ghost)', marginInlineStart: 6 }}>ر.س /شهر</span>
                    <p style={{ fontSize: 12, color: 'var(--ghost)', marginTop: 4, ...TN }}>
                      {Number(p.priceYearly).toLocaleString()} ر.س /سنة
                    </p>
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <Users size={14} style={{ color: 'var(--ghost)' }} />
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                        <strong style={{ fontWeight: 700, color: 'var(--slate)', ...TN }}>{p.activeSubscriptions}</strong> مشترك
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <User size={14} style={{ color: 'var(--ghost)' }} />
                      <span style={{ fontSize: 11, color: 'var(--ghost)', ...TN }}>{p.maxEmployees}</span>
                    </div>
                  </div>

                  {/* Features */}
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {allFeatures.map((f) => {
                      const has = featureCodes.has(f.code);
                      return (
                        <li key={f.code} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                          {has
                            ? <Check size={15} style={{ color: '#34D399' }} strokeWidth={2.5} />
                            : <X size={15} style={{ color: 'var(--ghost)', opacity: 0.4 }} strokeWidth={2} />
                          }
                          <span style={{ color: has ? 'var(--muted)' : 'var(--ghost)', textDecoration: has ? 'none' : 'line-through' }}>{f.nameAr}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </Glass>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editPlan && (
        <EditPlanModal
          plan={editPlan}
          onClose={() => setEditPlan(null)}
          onSaved={() => { setEditPlan(null); fetchPlans(); }}
        />
      )}
    </div>
  );
}
