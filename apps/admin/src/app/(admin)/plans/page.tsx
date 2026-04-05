'use client';

import { useState, useEffect, useCallback, type ReactElement, type CSSProperties } from 'react';
import {
  Shield, Sparkles, Crown, Check, X, Users, Edit,
  Save, Loader2, User, CalendarDays, TrendingUp,
  Zap, Hash, FileText, ToggleLeft,
} from 'lucide-react';
import { Glass, PageTitle } from '@/components/ui/glass';
import { adminService } from '@/services/admin.service';

/* ── Force English numerals everywhere ── */
const EN: CSSProperties = {
  fontFeatureSettings: '"tnum" 1',
  fontVariantNumeric: 'tabular-nums',
  fontFamily: '"Inter", "Outfit", system-ui, sans-serif',
  direction: 'ltr' as const,
  unicodeBidi: 'embed' as const,
};

const fmt = (n: number) => n.toLocaleString('en-US');

/* ── Types ── */
interface PlanFeatureItem {
  planId: string;
  featureId: string;
  feature: { id: string; code: string; nameAr: string };
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

function getPlanMeta(name: string) {
  const n = name.toLowerCase();
  if (n.includes('enterprise') || n.includes('مؤسس'))
    return { icon: Crown, color: '#C9A84C', gradient: 'linear-gradient(135deg, #C9A84C15, #C9A84C08)' };
  if (n.includes('pro') || n.includes('احترافي'))
    return { icon: Sparkles, color: '#A78BFA', gradient: 'linear-gradient(135deg, #A78BFA15, #A78BFA08)' };
  return { icon: Shield, color: '#94A3B8', gradient: 'linear-gradient(135deg, #94A3B815, #94A3B808)' };
}

/* ═══════════════════════════════════════════════════ */
/*  EDIT PLAN MODAL — Premium Design                  */
/* ═══════════════════════════════════════════════════ */

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
  const [success, setSuccess] = useState(false);

  const meta = getPlanMeta(plan.name);
  const Icon = meta.icon;

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await adminService.updatePlan(plan.id, form);
      setSuccess(true);
      setTimeout(() => onSaved(), 600);
    } catch (e: any) {
      setError(e.message || 'حدث خطأ في الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const yearSaving = form.priceMonthly > 0
    ? Math.round(((form.priceMonthly * 12 - form.priceYearly) / (form.priceMonthly * 12)) * 100)
    : 0;

  const inputField = (
    label: string,
    key: keyof typeof form,
    icon: typeof Edit,
    opts: { type?: 'text' | 'number'; suffix?: string; placeholder?: string } = {}
  ) => {
    const FieldIcon = icon;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ghost)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {label}
        </label>
        <div style={{ position: 'relative' }}>
          <div style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            width: 28, height: 28, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `${meta.color}12`,
          }}>
            <FieldIcon size={13} style={{ color: meta.color, opacity: 0.7 }} />
          </div>
          <input
            className="nx-input"
            type={opts.type || 'text'}
            placeholder={opts.placeholder}
            value={form[key] as string | number}
            onChange={(e) => setForm(prev => ({
              ...prev,
              [key]: opts.type === 'number' ? Number(e.target.value) : e.target.value
            }))}
            style={{
              ...EN,
              paddingRight: 48,
              paddingLeft: opts.suffix ? 50 : 14,
              fontSize: 14,
              fontWeight: 600,
              height: 46,
              borderRadius: 12,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
          />
          {opts.suffix && (
            <span style={{
              position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
              fontSize: 11, fontWeight: 700, color: 'var(--ghost)', pointerEvents: 'none',
            }}>
              {opts.suffix}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="nx-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ backdropFilter: 'blur(8px)' }}
    >
      <div className="nx-modal" style={{
        maxWidth: 560,
        borderRadius: 20,
        overflow: 'hidden',
        border: `1px solid ${meta.color}20`,
        boxShadow: `0 25px 80px rgba(0,0,0,0.5), 0 0 60px ${meta.color}08`,
      }}>
        {/* ── Header with gradient accent ── */}
        <div style={{
          padding: '24px 28px',
          background: meta.gradient,
          borderBottom: `1px solid ${meta.color}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `${meta.color}18`, border: `1px solid ${meta.color}25`,
            }}>
              <Icon size={20} style={{ color: meta.color }} strokeWidth={1.6} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--slate)', margin: 0 }}>
                تعديل باقة {plan.nameAr}
              </h3>
              <p style={{ fontSize: 11, color: 'var(--ghost)', margin: 0, ...EN }}>{plan.name} Plan</p>
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 34, height: 34, borderRadius: 10, border: '1px solid var(--border)',
            background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--ghost)', transition: 'all 0.2s',
          }}>
            <X size={15} />
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20, maxHeight: '60vh', overflowY: 'auto' }}>

          {/* Section: Identity */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: meta.color, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={13} /> الهوية
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {inputField('الاسم بالعربي', 'nameAr', FileText, { placeholder: 'مثال: احترافي' })}
              {inputField('الاسم بالإنجليزي', 'name', FileText, { placeholder: 'e.g. Pro' })}
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--border)', margin: '0 -28px', padding: '0 28px' }} />

          {/* Section: Pricing */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: meta.color, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingUp size={13} /> التسعير
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {inputField('السعر الشهري', 'priceMonthly', TrendingUp, { type: 'number', suffix: 'SAR/mo' })}
              {inputField('السعر السنوي', 'priceYearly', TrendingUp, { type: 'number', suffix: 'SAR/yr' })}
            </div>
            {yearSaving > 0 && (
              <div style={{
                marginTop: 10, padding: '8px 14px', borderRadius: 10,
                background: '#34D39910', border: '1px solid #34D39920',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <Zap size={13} style={{ color: '#34D399' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#34D399' }}>
                  خصم <span style={EN}>{yearSaving}%</span> على الاشتراك السنوي
                </span>
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--border)', margin: '0 -28px', padding: '0 28px' }} />

          {/* Section: Limits */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: meta.color, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Hash size={13} /> الحدود
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {inputField('الموظفين', 'maxEmployees', Users, { type: 'number' })}
              {inputField('العملاء', 'maxClients', User, { type: 'number' })}
              {inputField('المواعيد/شهر', 'maxAppointmentsMonth', CalendarDays, { type: 'number' })}
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--border)', margin: '0 -28px', padding: '0 28px' }} />

          {/* Section: Description */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: meta.color, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={13} /> الوصف
            </div>
            <textarea
              className="nx-input"
              placeholder="وصف مختصر للباقة يظهر للعملاء..."
              value={form.descriptionAr}
              onChange={(e) => setForm(prev => ({ ...prev, descriptionAr: e.target.value }))}
              style={{
                width: '100%', minHeight: 72, resize: 'vertical',
                fontSize: 13, fontWeight: 500, borderRadius: 12,
                padding: '12px 14px', lineHeight: 1.7,
              }}
            />
          </div>

          {/* Status Toggle */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 18px', borderRadius: 14,
            background: form.isActive ? '#34D39908' : '#EF444408',
            border: `1px solid ${form.isActive ? '#34D39920' : '#EF444420'}`,
            transition: 'all 0.3s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ToggleLeft size={16} style={{ color: form.isActive ? '#34D399' : '#EF4444' }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate)', margin: 0 }}>
                  حالة الباقة
                </p>
                <p style={{ fontSize: 11, color: 'var(--ghost)', margin: 0 }}>
                  {form.isActive ? 'ستظهر للعملاء عند اختيار الباقات' : 'لن تظهر للعملاء — مخفية'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setForm(prev => ({ ...prev, isActive: !prev.isActive }))}
              style={{
                width: 48, height: 26, borderRadius: 13, border: 'none',
                background: form.isActive ? '#34D399' : '#64748B',
                position: 'relative', cursor: 'pointer',
                transition: 'background 0.3s',
              }}
            >
              <span style={{
                position: 'absolute', top: 3,
                ...(form.isActive ? { left: 3 } : { right: 3 }),
                width: 20, height: 20, borderRadius: '50%',
                background: '#fff', transition: 'all 0.3s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }} />
            </button>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: '12px 16px', borderRadius: 12,
              background: '#EF444410', border: '1px solid #EF444425',
              color: '#EF4444', fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <X size={14} /> {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div style={{
              padding: '12px 16px', borderRadius: 12,
              background: '#34D39910', border: '1px solid #34D39925',
              color: '#34D399', fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Check size={14} /> تم حفظ التعديلات بنجاح
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: '18px 28px', borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--surface)',
        }}>
          <div style={{ fontSize: 11, color: 'var(--ghost)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={12} />
            <span style={EN}>{plan.activeSubscriptions}</span> مشترك نشط
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{
              padding: '10px 20px', borderRadius: 12, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--muted)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.2s',
            }}>
              إلغاء
            </button>
            <button onClick={handleSave} disabled={saving || success} style={{
              padding: '10px 24px', borderRadius: 12, border: 'none',
              background: success ? '#34D399' : `linear-gradient(135deg, ${meta.color}, ${meta.color}CC)`,
              color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: `0 4px 15px ${meta.color}30`,
              opacity: saving ? 0.7 : 1, transition: 'all 0.3s',
            }}>
              {saving ? <Loader2 size={14} className="nx-spin" />
                : success ? <Check size={14} />
                : <Save size={14} />}
              {saving ? 'جاري الحفظ...' : success ? 'تم الحفظ!' : 'حفظ التعديلات'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════ */
/*  PLANS PAGE — Main                                 */
/* ═══════════════════════════════════════════════════ */

export default function PlansPage(): ReactElement {
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editPlan, setEditPlan] = useState<PlanData | null>(null);

  const fetchPlans = useCallback(() => {
    setLoading(true);
    adminService.getPlans()
      .then((data: any) => setPlans(Array.isArray(data) ? data : []))
      .catch((e) => console.error('Plans fetch error:', e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const allFeatures = Array.from(
    new Map(
      plans.flatMap(p => p.planFeatures.map(pf => [pf.feature.code, pf.feature]))
    ).values()
  );

  const totalSubs = plans.reduce((s, p) => s + p.activeSubscriptions, 0);

  return (
    <div className="nx-space-y">
      <PageTitle title="الباقات والأسعار" desc="إدارة باقات الاشتراك وتعديل الأسعار والميزات"
        icon={<Crown size={20} style={{ color: '#C9A84C' }} strokeWidth={1.5} />}
      />

      {/* Summary Stats */}
      {!loading && plans.length > 0 && (
        <div className="nx-stats-grid">
          {[
            { label: 'إجمالي الباقات', value: plans.length, icon: Crown, color: '#C9A84C' },
            { label: 'باقات مفعّلة', value: plans.filter(p => p.isActive).length, icon: Check, color: '#34D399' },
            { label: 'إجمالي المشتركين', value: totalSubs, icon: Users, color: '#A78BFA' },
          ].map(k => {
            const KIcon = k.icon;
            return (
              <Glass key={k.label} hover>
                <div className="nx-stat">
                  <div className="nx-stat-icon" style={{ background: `${k.color}10` }}>
                    <KIcon size={18} style={{ color: k.color, opacity: 0.8 }} strokeWidth={1.5} />
                  </div>
                  <div>
                    <div className="nx-stat-label">{k.label}</div>
                    <div className="nx-stat-value" style={EN}>{k.value}</div>
                  </div>
                </div>
              </Glass>
            );
          })}
        </div>
      )}

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
            const monthlyPrice = Number(p.priceMonthly);
            const yearlyPrice = Number(p.priceYearly);
            const yearSaving = monthlyPrice > 0
              ? Math.round(((monthlyPrice * 12 - yearlyPrice) / (monthlyPrice * 12)) * 100) : 0;

            return (
              <Glass key={p.id} hover>
                <div style={{ padding: 28, position: 'relative' }}>
                  {/* Status Badge */}
                  {!p.isActive && (
                    <span className="nx-badge nx-badge--red" style={{
                      position: 'absolute', top: 16, left: 16, fontSize: 10,
                    }}>
                      متوقفة
                    </span>
                  )}

                  {/* Plan Header */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 20,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: 14,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: meta.gradient,
                        border: `1px solid ${meta.color}20`,
                      }}>
                        <Icon size={22} style={{ color: meta.color }} strokeWidth={1.6} />
                      </div>
                      <div>
                        <p style={{ fontSize: 18, fontWeight: 800, color: meta.color, margin: 0 }}>{p.nameAr}</p>
                        <p style={{ fontSize: 11, color: 'var(--ghost)', margin: 0, ...EN }}>{p.name}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setEditPlan(p)}
                      title="تعديل"
                      style={{
                        width: 36, height: 36, borderRadius: 10,
                        border: `1px solid ${meta.color}25`, background: `${meta.color}08`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: meta.color, transition: 'all 0.2s',
                      }}
                    >
                      <Edit size={14} />
                    </button>
                  </div>

                  {/* Pricing */}
                  <div style={{
                    marginBottom: 20, padding: '16px 18px', borderRadius: 14,
                    background: meta.gradient, border: `1px solid ${meta.color}12`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontSize: 34, fontWeight: 800, color: 'var(--slate)', ...EN, lineHeight: 1 }}>
                        {fmt(monthlyPrice)}
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--ghost)', fontWeight: 500 }}>ر.س /شهر</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--ghost)', ...EN }}>
                        {fmt(yearlyPrice)} ر.س /سنة
                      </span>
                      {yearSaving > 0 && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, color: '#34D399',
                          padding: '2px 8px', borderRadius: 6, background: '#34D39912',
                          ...EN,
                        }}>
                          -{yearSaving}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
                    {[
                      { label: 'مشتركين', value: p.activeSubscriptions, icon: Users },
                      { label: 'موظفين', value: p.maxEmployees, icon: User },
                      { label: 'عملاء', value: p.maxClients, icon: User },
                    ].map(s => {
                      const SIcon = s.icon;
                      return (
                        <div key={s.label} style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                          padding: '10px 6px', borderRadius: 10,
                          background: 'var(--surface)', border: '1px solid var(--border)',
                        }}>
                          <SIcon size={13} style={{ color: 'var(--ghost)', opacity: 0.6 }} />
                          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--slate)', ...EN }}>{s.value}</span>
                          <span style={{ fontSize: 9, color: 'var(--ghost)', fontWeight: 600 }}>{s.label}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Features */}
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: 0, padding: 0, listStyle: 'none' }}>
                    {allFeatures.map((f) => {
                      const has = featureCodes.has(f.code);
                      return (
                        <li key={f.code} style={{
                          display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
                          padding: '6px 0',
                        }}>
                          <div style={{
                            width: 20, height: 20, borderRadius: 6,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: has ? '#34D39912' : 'transparent',
                            border: has ? '1px solid #34D39925' : '1px solid var(--border)',
                          }}>
                            {has
                              ? <Check size={12} style={{ color: '#34D399' }} strokeWidth={2.5} />
                              : <X size={10} style={{ color: 'var(--ghost)', opacity: 0.3 }} strokeWidth={2} />
                            }
                          </div>
                          <span style={{
                            color: has ? 'var(--muted)' : 'var(--ghost)',
                            textDecoration: has ? 'none' : 'line-through',
                            fontWeight: has ? 500 : 400,
                          }}>
                            {f.nameAr}
                          </span>
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
          key={editPlan.id}
          plan={editPlan}
          onClose={() => setEditPlan(null)}
          onSaved={() => { setEditPlan(null); fetchPlans(); }}
        />
      )}
    </div>
  );
}
