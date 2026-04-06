'use client';

import { useState, useEffect, useCallback, type ReactElement, type CSSProperties } from 'react';
import {
  Shield, Sparkles, Crown, Check, X, Users, Edit,
  Save, Loader2, User, CalendarDays, TrendingUp,
  Zap, Hash, FileText, ToggleLeft, Clock,
  Percent, Receipt, Package, ArrowUpDown,
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
  revenueSharePercent: number;
  perAppointmentFee: number;
  includedAppointments: number;
  trialDays: number;
  descriptionAr: string | null;
  isActive: boolean;
  sortOrder: number;
  activeSubscriptions: number;
  planFeatures: PlanFeatureItem[];
}

function getPlanMeta(name: string) {
  const n = name.toLowerCase();
  if (n.includes('enterprise') || n.includes('premium') || n.includes('متميز') || n.includes('مؤسس'))
    return { icon: Crown, color: '#C9A84C', gradient: 'linear-gradient(135deg, #C9A84C15, #C9A84C08)', label: 'Premium' };
  if (n.includes('pro') || n.includes('احترافي'))
    return { icon: Sparkles, color: '#A78BFA', gradient: 'linear-gradient(135deg, #A78BFA15, #A78BFA08)', label: 'Pro' };
  return { icon: Shield, color: '#94A3B8', gradient: 'linear-gradient(135deg, #94A3B815, #94A3B808)', label: 'Basic' };
}

/* ═══════════════════════════════════════════════════ */
/*  EDIT PLAN MODAL — Complete Edit                    */
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
    revenueSharePercent: Number(plan.revenueSharePercent ?? 0),
    perAppointmentFee: Number(plan.perAppointmentFee ?? 0),
    includedAppointments: plan.includedAppointments ?? 0,
    trialDays: plan.trialDays ?? 14,
    descriptionAr: plan.descriptionAr ?? '',
    isActive: plan.isActive,
    sortOrder: plan.sortOrder ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'identity' | 'pricing' | 'limits' | 'advanced'>('identity');

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

  const update = (key: string, value: unknown) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const tabs = [
    { key: 'identity' as const, label: 'الهوية', icon: FileText },
    { key: 'pricing' as const, label: 'التسعير', icon: TrendingUp },
    { key: 'limits' as const, label: 'الحدود', icon: Hash },
    { key: 'advanced' as const, label: 'متقدم', icon: Zap },
  ];

  return (
    <div className="nx-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ backdropFilter: 'blur(8px)', padding: '10px' }}
    >
      <div style={{
        background: 'var(--bg)',
        border: `1px solid ${meta.color}20`,
        borderRadius: 20,
        maxWidth: 580,
        width: '100%',
        maxHeight: '92dvh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: `0 25px 80px rgba(0,0,0,0.5), 0 0 60px ${meta.color}08`,
      }}>
        {/* ── Header ── */}
        <div style={{
          padding: '18px 20px',
          background: meta.gradient,
          borderBottom: `1px solid ${meta.color}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `${meta.color}18`, border: `1px solid ${meta.color}25`,
            }}>
              <Icon size={18} style={{ color: meta.color }} strokeWidth={1.6} />
            </div>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--slate)', margin: 0 }}>
                تعديل باقة {plan.nameAr}
              </h3>
              <p style={{ fontSize: 11, color: 'var(--ghost)', margin: 0, ...EN }}>{plan.name} Plan</p>
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 34, height: 34, borderRadius: 10, border: '1px solid var(--border)',
            background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--ghost)',
          }}>
            <X size={15} />
          </button>
        </div>

        {/* ── Tabs ── */}
        <div style={{
          display: 'flex', gap: 2, padding: '12px 20px 0',
          borderBottom: '1px solid var(--border)',
          overflowX: 'auto', flexShrink: 0,
          WebkitOverflowScrolling: 'touch',
        }}>
          {tabs.map(t => {
            const TIcon = t.icon;
            const isActive = activeTab === t.key;
            return (
              <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 14px', fontSize: 12, fontWeight: isActive ? 700 : 500,
                color: isActive ? meta.color : 'var(--muted)',
                background: 'transparent', border: 'none', cursor: 'pointer',
                borderBottom: isActive ? `2px solid ${meta.color}` : '2px solid transparent',
                transition: 'all 0.2s', whiteSpace: 'nowrap',
              }}>
                <TIcon size={13} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ── Body ── */}
        <div style={{
          padding: '20px 20px', flex: 1, overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 18,
        }}>

          {/* TAB: Identity */}
          {activeTab === 'identity' && (<>
            <FieldGroup label="الاسم بالعربي" icon={FileText} color={meta.color}>
              <FieldInput value={form.nameAr} onChange={(v) => update('nameAr', v)} placeholder="مثال: احترافي" />
            </FieldGroup>
            <FieldGroup label="الاسم بالإنجليزي" icon={FileText} color={meta.color}>
              <FieldInput value={form.name} onChange={(v) => update('name', v)} placeholder="e.g. Pro" dir="ltr" />
            </FieldGroup>
            <FieldGroup label="الوصف" icon={FileText} color={meta.color}>
              <textarea
                className="nx-input"
                placeholder="وصف مختصر للباقة يظهر للعملاء..."
                value={form.descriptionAr}
                onChange={(e) => update('descriptionAr', e.target.value)}
                style={{
                  width: '100%', minHeight: 80, resize: 'vertical',
                  fontSize: 13, fontWeight: 500, borderRadius: 12,
                  padding: '12px 14px', lineHeight: 1.7, height: 'auto',
                }}
              />
            </FieldGroup>
            <FieldGroup label="ترتيب العرض" icon={ArrowUpDown} color={meta.color}>
              <FieldInput value={form.sortOrder} onChange={(v) => update('sortOrder', Number(v))} type="number" placeholder="0" />
            </FieldGroup>

            {/* Status Toggle */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', borderRadius: 14,
              background: form.isActive ? '#34D39908' : '#EF444408',
              border: `1px solid ${form.isActive ? '#34D39920' : '#EF444420'}`,
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
                onClick={() => update('isActive', !form.isActive)}
                style={{
                  width: 48, height: 26, borderRadius: 13, border: 'none',
                  background: form.isActive ? '#34D399' : '#64748B',
                  position: 'relative', cursor: 'pointer',
                }}
              >
                <span style={{
                  position: 'absolute', top: 3,
                  ...(form.isActive ? { left: 3 } : { right: 3 }),
                  width: 20, height: 20, borderRadius: '50%',
                  background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
              </button>
            </div>
          </>)}

          {/* TAB: Pricing */}
          {activeTab === 'pricing' && (<>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FieldGroup label="السعر الشهري" icon={TrendingUp} color={meta.color} suffix="ر.س">
                <FieldInput value={form.priceMonthly} onChange={(v) => update('priceMonthly', Number(v))} type="number" />
              </FieldGroup>
              <FieldGroup label="السعر السنوي" icon={TrendingUp} color={meta.color} suffix="ر.س">
                <FieldInput value={form.priceYearly} onChange={(v) => update('priceYearly', Number(v))} type="number" />
              </FieldGroup>
            </div>
            {yearSaving > 0 && (
              <div style={{
                padding: '10px 14px', borderRadius: 10,
                background: '#34D39910', border: '1px solid #34D39920',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <Zap size={13} style={{ color: '#34D399' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#34D399' }}>
                  خصم <span style={EN}>{yearSaving}%</span> على الاشتراك السنوي
                </span>
              </div>
            )}

            <div style={{ height: 1, background: 'var(--border)' }} />

            <div style={{ fontSize: 12, fontWeight: 700, color: meta.color, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Percent size={13} /> التسعير المتقدم (Usage-Based)
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FieldGroup label="نسبة العمولة %" icon={Percent} color={meta.color} suffix="%">
                <FieldInput value={form.revenueSharePercent} onChange={(v) => update('revenueSharePercent', Number(v))} type="number" />
              </FieldGroup>
              <FieldGroup label="رسوم الموعد" icon={Receipt} color={meta.color} suffix="ر.س">
                <FieldInput value={form.perAppointmentFee} onChange={(v) => update('perAppointmentFee', Number(v))} type="number" />
              </FieldGroup>
            </div>
            <FieldGroup label="المواعيد المشمولة مجاناً" icon={Package} color={meta.color}>
              <FieldInput value={form.includedAppointments} onChange={(v) => update('includedAppointments', Number(v))} type="number" placeholder="0 = غير محدود" />
            </FieldGroup>
          </>)}

          {/* TAB: Limits */}
          {activeTab === 'limits' && (<>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <FieldGroup label="الموظفين" icon={Users} color={meta.color}>
                <FieldInput value={form.maxEmployees} onChange={(v) => update('maxEmployees', Number(v))} type="number" />
              </FieldGroup>
              <FieldGroup label="العملاء" icon={User} color={meta.color}>
                <FieldInput value={form.maxClients} onChange={(v) => update('maxClients', Number(v))} type="number" />
              </FieldGroup>
              <FieldGroup label="مواعيد/شهر" icon={CalendarDays} color={meta.color}>
                <FieldInput value={form.maxAppointmentsMonth} onChange={(v) => update('maxAppointmentsMonth', Number(v))} type="number" placeholder="0 = لا حد" />
              </FieldGroup>
            </div>
            <p style={{ fontSize: 11, color: 'var(--ghost)', padding: '0 4px' }}>
              القيمة <span style={{ ...EN, fontWeight: 700 }}>0</span> تعني &quot;غير محدود&quot; — لن يتم تقييد المستخدم.
            </p>
          </>)}

          {/* TAB: Advanced */}
          {activeTab === 'advanced' && (<>
            <FieldGroup label="أيام التجربة المجانية" icon={Clock} color={meta.color} suffix="يوم">
              <FieldInput value={form.trialDays} onChange={(v) => update('trialDays', Number(v))} type="number" />
            </FieldGroup>
            <p style={{ fontSize: 11, color: 'var(--ghost)', padding: '0 4px' }}>
              عدد الأيام المجانية التي يحصل عليها العميل عند الاشتراك لأول مرة. القيمة <span style={{ ...EN, fontWeight: 700 }}>0</span> تعني لا توجد تجربة مجانية.
            </p>

            <div style={{ height: 1, background: 'var(--border)' }} />

            {/* Info card */}
            <div style={{
              padding: '14px 16px', borderRadius: 12,
              background: `${meta.color}06`, border: `1px solid ${meta.color}12`,
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={14} style={{ color: meta.color }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: meta.color }}>معلومات الباقة</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <InfoChip label="المشتركين النشطين" value={plan.activeSubscriptions} />
                <InfoChip label="الميزات المفعّلة" value={plan.planFeatures.length} />
              </div>
            </div>
          </>)}

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
          padding: '14px 20px', borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--surface)', flexShrink: 0,
        }}>
          <div style={{ fontSize: 11, color: 'var(--ghost)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={12} />
            <span style={EN}>{plan.activeSubscriptions}</span> مشترك نشط
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{
              padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--muted)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              إلغاء
            </button>
            <button onClick={handleSave} disabled={saving || success} style={{
              padding: '9px 20px', borderRadius: 10, border: 'none',
              background: success ? '#34D399' : `linear-gradient(135deg, ${meta.color}, ${meta.color}CC)`,
              color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: `0 4px 15px ${meta.color}30`,
              opacity: saving ? 0.7 : 1,
            }}>
              {saving ? <Loader2 size={14} className="nx-spin" />
                : success ? <Check size={14} />
                : <Save size={14} />}
              {saving ? 'جاري الحفظ...' : success ? 'تم!' : 'حفظ'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Reusable Field Components ── */

function FieldGroup({ label, icon: FIcon, color, suffix, children }: {
  label: string;
  icon: typeof Edit;
  color: string;
  suffix?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{
        fontSize: 11, fontWeight: 700, color: 'var(--ghost)',
        letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${color}12`,
        }}>
          <FIcon size={11} style={{ color, opacity: 0.7 }} />
        </div>
        {label}
        {suffix && <span style={{ marginRight: 'auto', ...EN, opacity: 0.5 }}>({suffix})</span>}
      </label>
      {children}
    </div>
  );
}

function FieldInput({ value, onChange, type = 'text', placeholder, dir }: {
  value: string | number;
  onChange: (v: string) => void;
  type?: 'text' | 'number';
  placeholder?: string;
  dir?: string;
}) {
  return (
    <input
      className="nx-input"
      type={type}
      placeholder={placeholder}
      value={value}
      dir={dir}
      onChange={(e) => onChange(e.target.value)}
      style={{
        ...EN, width: '100%',
        fontSize: 14, fontWeight: 600,
        height: 44, borderRadius: 10,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
    />
  );
}

function InfoChip({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      padding: '8px 12px', borderRadius: 8,
      background: 'var(--surface)', border: '1px solid var(--border)',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--slate)', ...EN }}>{value}</div>
      <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--ghost)', marginTop: 2 }}>{label}</div>
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
                <div style={{ padding: '20px 18px', position: 'relative' }}>
                  {/* Status Badge */}
                  {!p.isActive && (
                    <span className="nx-badge nx-badge--red" style={{
                      position: 'absolute', top: 14, left: 14, fontSize: 10,
                    }}>
                      متوقفة
                    </span>
                  )}

                  {/* Plan Header */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 16,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 12,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: meta.gradient,
                        border: `1px solid ${meta.color}20`,
                      }}>
                        <Icon size={20} style={{ color: meta.color }} strokeWidth={1.6} />
                      </div>
                      <div>
                        <p style={{ fontSize: 16, fontWeight: 800, color: meta.color, margin: 0 }}>{p.nameAr}</p>
                        <p style={{ fontSize: 11, color: 'var(--ghost)', margin: 0, ...EN }}>{p.name}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setEditPlan(p)}
                      title="تعديل"
                      style={{
                        width: 34, height: 34, borderRadius: 10,
                        border: `1px solid ${meta.color}25`, background: `${meta.color}08`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: meta.color,
                      }}
                    >
                      <Edit size={14} />
                    </button>
                  </div>

                  {/* Pricing */}
                  <div style={{
                    marginBottom: 16, padding: '14px 16px', borderRadius: 12,
                    background: meta.gradient, border: `1px solid ${meta.color}12`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontSize: 30, fontWeight: 800, color: 'var(--slate)', ...EN, lineHeight: 1 }}>
                        {fmt(monthlyPrice)}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--ghost)', fontWeight: 500 }}>ر.س /شهر</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      <span style={{ fontSize: 12, color: 'var(--ghost)', ...EN }}>
                        {fmt(yearlyPrice)} ر.س /سنة
                      </span>
                      {yearSaving > 0 && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, color: '#34D399',
                          padding: '2px 8px', borderRadius: 6, background: '#34D39912', ...EN,
                        }}>
                          -{yearSaving}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Trial badge */}
                  {(p.trialDays ?? 0) > 0 && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 12px', borderRadius: 8,
                      background: '#60A5FA08', border: '1px solid #60A5FA15',
                      marginBottom: 14,
                    }}>
                      <Clock size={12} style={{ color: '#60A5FA' }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#60A5FA' }}>
                        تجربة مجانية <span style={EN}>{p.trialDays}</span> يوم
                      </span>
                    </div>
                  )}

                  {/* Stats Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 16 }}>
                    {[
                      { label: 'مشتركين', value: p.activeSubscriptions, icon: Users },
                      { label: 'موظفين', value: p.maxEmployees, icon: User },
                      { label: 'عملاء', value: p.maxClients, icon: User },
                    ].map(s => {
                      const SIcon = s.icon;
                      return (
                        <div key={s.label} style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                          padding: '8px 4px', borderRadius: 8,
                          background: 'var(--surface)', border: '1px solid var(--border)',
                        }}>
                          <SIcon size={12} style={{ color: 'var(--ghost)', opacity: 0.6 }} />
                          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--slate)', ...EN }}>{s.value}</span>
                          <span style={{ fontSize: 9, color: 'var(--ghost)', fontWeight: 600 }}>{s.label}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Features */}
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: 0, padding: 0, listStyle: 'none' }}>
                    {allFeatures.map((f) => {
                      const has = featureCodes.has(f.code);
                      return (
                        <li key={f.code} style={{
                          display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
                          padding: '4px 0',
                        }}>
                          <div style={{
                            width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: has ? '#34D39912' : 'transparent',
                            border: has ? '1px solid #34D39925' : '1px solid var(--border)',
                          }}>
                            {has
                              ? <Check size={10} style={{ color: '#34D399' }} strokeWidth={2.5} />
                              : <X size={9} style={{ color: 'var(--ghost)', opacity: 0.3 }} strokeWidth={2} />
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
