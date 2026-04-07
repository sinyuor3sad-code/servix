'use client';

import { useState, useEffect, useCallback, type ReactElement, type CSSProperties } from 'react';
import {
  Shield, Sparkles, Crown, Check, X, Users, Edit,
  Save, Loader2, User, CalendarDays, TrendingUp,
  Zap, Hash, FileText, ToggleLeft, Clock,
  Percent, Receipt, Package, ArrowUpDown, Plus,
  Copy, Eye, EyeOff, Star, Lock, Unlock,
  ChevronDown, ChevronUp, Settings, Layers,
  Globe, BookOpen, AlertTriangle,
} from 'lucide-react';
import { Glass, PageTitle } from '@/components/ui/glass';
import { adminService } from '@/services/admin.service';
import { FEATURE_CATEGORIES, getCategoryLabel, getCategoryColor, PLAN_BADGES } from '@/lib/feature-registry';

/* ── Force English numerals ── */
const EN: CSSProperties = {
  fontFeatureSettings: '"tnum" 1',
  fontVariantNumeric: 'tabular-nums',
  fontFamily: '"Inter", "Outfit", system-ui, sans-serif',
  direction: 'ltr' as const,
  unicodeBidi: 'embed' as const,
};
const fmt = (n: number) => n.toLocaleString('en-US');

/* ── Types ── */
interface FeatureItem {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string | null;
  category: string | null;
  isAddon: boolean;
  sortOrder: number;
  planFeatures: { planId: string }[];
}

interface PlanFeatureItem {
  planId: string;
  featureId: string;
  feature: { id: string; code: string; nameAr: string; nameEn?: string; category?: string };
}

interface PlanData {
  id: string;
  name: string;
  nameAr: string;
  nameEn: string | null;
  slug: string | null;
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
  badge: string | null;
  isPublic: boolean;
  isInternal: boolean;
  setupFee: number;
  trialEnabled: boolean;
  upgradeAllowed: boolean;
  downgradeAllowed: boolean;
  metadata: Record<string, unknown> | null;
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
/*  REUSABLE FIELD COMPONENTS                          */
/* ═══════════════════════════════════════════════════ */

function FieldGroup({ label, icon: FIcon, color, suffix, children }: {
  label: string; icon: typeof Edit; color: string; suffix?: string; children: React.ReactNode;
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
  value: string | number; onChange: (v: string) => void; type?: 'text' | 'number'; placeholder?: string; dir?: string;
}) {
  return (
    <input className="nx-input" type={type} placeholder={placeholder} value={value} dir={dir}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...EN, width: '100%', fontSize: 14, fontWeight: 600, height: 44, borderRadius: 10,
        background: 'var(--surface)', border: '1px solid var(--border)' }}
    />
  );
}

function ToggleSwitch({ checked, onChange, label, desc, color }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string; color?: string;
}) {
  const c = color || (checked ? '#34D399' : '#64748B');
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 14px', borderRadius: 12,
      background: checked ? `${c}06` : 'transparent',
      border: `1px solid ${checked ? `${c}20` : 'var(--border)'}`,
    }}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--slate)', margin: 0 }}>{label}</p>
        {desc && <p style={{ fontSize: 11, color: 'var(--ghost)', margin: 0 }}>{desc}</p>}
      </div>
      <button onClick={() => onChange(!checked)} style={{
        width: 44, height: 24, borderRadius: 12, border: 'none',
        background: checked ? c : '#475569', position: 'relative', cursor: 'pointer', flexShrink: 0,
      }}>
        <span style={{
          position: 'absolute', top: 2, ...(checked ? { left: 2 } : { right: 2 }),
          width: 20, height: 20, borderRadius: '50%', background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'all 0.15s',
        }} />
      </button>
    </div>
  );
}

function InfoChip({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      padding: '8px 12px', borderRadius: 8,
      background: 'var(--surface)', border: '1px solid var(--border)', textAlign: 'center',
    }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--slate)', ...EN }}>{value}</div>
      <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--ghost)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════ */
/*  EDIT / CREATE PLAN MODAL — 8 Tabs                  */
/* ═══════════════════════════════════════════════════ */

function PlanEditorModal({ plan, allFeatures, onClose, onSaved, isNew }: {
  plan: PlanData | null;
  allFeatures: FeatureItem[];
  onClose: () => void;
  onSaved: () => void;
  isNew?: boolean;
}) {
  const defaults = {
    nameAr: '', name: '', nameEn: '', slug: '',
    priceMonthly: 0, priceYearly: 0, maxEmployees: 5, maxClients: 100,
    maxAppointmentsMonth: 0, revenueSharePercent: 0, perAppointmentFee: 0,
    includedAppointments: 0, trialDays: 14, descriptionAr: '',
    isActive: true, sortOrder: 0, badge: '' as string,
    isPublic: true, isInternal: false, setupFee: 0,
    trialEnabled: true, upgradeAllowed: true, downgradeAllowed: true,
  };

  const [form, setForm] = useState(plan ? {
    nameAr: plan.nameAr, name: plan.name, nameEn: plan.nameEn || '',
    slug: plan.slug || '',
    priceMonthly: Number(plan.priceMonthly), priceYearly: Number(plan.priceYearly),
    maxEmployees: plan.maxEmployees, maxClients: plan.maxClients,
    maxAppointmentsMonth: plan.maxAppointmentsMonth ?? 0,
    revenueSharePercent: Number(plan.revenueSharePercent ?? 0),
    perAppointmentFee: Number(plan.perAppointmentFee ?? 0),
    includedAppointments: plan.includedAppointments ?? 0,
    trialDays: plan.trialDays ?? 14, descriptionAr: plan.descriptionAr ?? '',
    isActive: plan.isActive, sortOrder: plan.sortOrder ?? 0,
    badge: plan.badge || '', isPublic: plan.isPublic ?? true,
    isInternal: plan.isInternal ?? false, setupFee: Number(plan.setupFee ?? 0),
    trialEnabled: plan.trialEnabled ?? true,
    upgradeAllowed: plan.upgradeAllowed ?? true, downgradeAllowed: plan.downgradeAllowed ?? true,
  } : defaults);

  const [selectedFeatureIds, setSelectedFeatureIds] = useState<Set<string>>(
    new Set(plan?.planFeatures?.map(pf => pf.featureId) || [])
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  type TabKey = 'identity' | 'pricing' | 'limits' | 'features' | 'trial' | 'addons' | 'rules' | 'preview';
  const [activeTab, setActiveTab] = useState<TabKey>('identity');

  const meta = getPlanMeta(form.name || 'basic');
  const Icon = meta.icon;

  const toggleFeature = (fId: string) => {
    setSelectedFeatureIds(prev => {
      const next = new Set(prev);
      if (next.has(fId)) next.delete(fId); else next.add(fId);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (isNew) {
        await adminService.createPlan(form);
      } else if (plan) {
        await adminService.updatePlan(plan.id, form as any);
        // Also update features
        const oldFeatureIds = new Set(plan.planFeatures.map(pf => pf.featureId));
        const newFeatureIds = selectedFeatureIds;
        const changed = oldFeatureIds.size !== newFeatureIds.size ||
          [...oldFeatureIds].some(id => !newFeatureIds.has(id));
        if (changed) {
          await adminService.updatePlanFeatures(plan.id, [...newFeatureIds]);
        }
      }
      setSuccess(true);
      setTimeout(() => onSaved(), 500);
    } catch (e: any) {
      setError(e.message || 'حدث خطأ في الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const yearSaving = form.priceMonthly > 0
    ? Math.round(((form.priceMonthly * 12 - form.priceYearly) / (form.priceMonthly * 12)) * 100) : 0;

  const update = (key: string, value: unknown) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const tabs: { key: TabKey; label: string; icon: typeof Edit }[] = [
    { key: 'identity', label: 'الهوية', icon: FileText },
    { key: 'pricing', label: 'التسعير', icon: TrendingUp },
    { key: 'limits', label: 'الحدود', icon: Hash },
    { key: 'features', label: 'الميزات', icon: Layers },
    { key: 'trial', label: 'التجربة', icon: Clock },
    { key: 'rules', label: 'القواعد', icon: Settings },
    { key: 'preview', label: 'المعاينة', icon: Eye },
  ];

  // Group features by category
  const featuresByCategory = FEATURE_CATEGORIES.map(cat => ({
    ...cat,
    features: allFeatures.filter(f => f.category === cat.key),
  })).filter(g => g.features.length > 0);

  // Uncategorized
  const uncategorized = allFeatures.filter(f => !f.category || !FEATURE_CATEGORIES.some(c => c.key === f.category));
  if (uncategorized.length > 0) {
    featuresByCategory.push({ key: 'other', labelAr: 'أخرى', labelEn: 'Other', color: '#64748B', features: uncategorized });
  }

  return (
    <div className="nx-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ backdropFilter: 'blur(8px)', padding: '10px' }}>
      <div style={{
        background: 'var(--bg)', border: `1px solid ${meta.color}20`, borderRadius: 20,
        maxWidth: 640, width: '100%', maxHeight: '94dvh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: `0 25px 80px rgba(0,0,0,0.5), 0 0 60px ${meta.color}08`,
      }}>
        {/* ── Header ── */}
        <div style={{
          padding: '16px 20px', background: meta.gradient,
          borderBottom: `1px solid ${meta.color}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
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
                {isNew ? 'إنشاء باقة جديدة' : `تعديل باقة ${plan?.nameAr}`}
              </h3>
              <p style={{ fontSize: 11, color: 'var(--ghost)', margin: 0, ...EN }}>
                {isNew ? 'New Plan' : `${plan?.name} Plan`}
              </p>
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
          display: 'flex', gap: 1, padding: '10px 16px 0',
          borderBottom: '1px solid var(--border)',
          overflowX: 'auto', flexShrink: 0, WebkitOverflowScrolling: 'touch',
        }}>
          {tabs.map(t => {
            const TIcon = t.icon;
            const isActive = activeTab === t.key;
            return (
              <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '9px 11px', fontSize: 11, fontWeight: isActive ? 700 : 500,
                color: isActive ? meta.color : 'var(--muted)',
                background: 'transparent', border: 'none', cursor: 'pointer',
                borderBottom: isActive ? `2px solid ${meta.color}` : '2px solid transparent',
                transition: 'all 0.2s', whiteSpace: 'nowrap',
              }}>
                <TIcon size={12} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ── Body ── */}
        <div style={{
          padding: '18px 20px', flex: 1, overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {/* TAB: Identity */}
          {activeTab === 'identity' && (<>
            <FieldGroup label="الاسم بالعربي" icon={FileText} color={meta.color}>
              <FieldInput value={form.nameAr} onChange={(v) => update('nameAr', v)} placeholder="مثال: احترافي" />
            </FieldGroup>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FieldGroup label="الاسم بالإنجليزي" icon={FileText} color={meta.color}>
                <FieldInput value={form.name} onChange={(v) => update('name', v)} placeholder="e.g. Pro" dir="ltr" />
              </FieldGroup>
              <FieldGroup label="الرمز (Slug)" icon={Hash} color={meta.color}>
                <FieldInput value={form.slug} onChange={(v) => update('slug', v)} placeholder="e.g. pro" dir="ltr" />
              </FieldGroup>
            </div>
            <FieldGroup label="الوصف" icon={FileText} color={meta.color}>
              <textarea className="nx-input" placeholder="وصف الباقة..."
                value={form.descriptionAr} onChange={(e) => update('descriptionAr', e.target.value)}
                style={{ width: '100%', minHeight: 70, resize: 'vertical', fontSize: 13, fontWeight: 500,
                  borderRadius: 12, padding: '12px 14px', lineHeight: 1.7, height: 'auto' }}
              />
            </FieldGroup>

            {/* Badge */}
            <FieldGroup label="شارة الباقة" icon={Star} color={meta.color}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button onClick={() => update('badge', '')}
                  style={{
                    padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                    border: !form.badge ? `2px solid ${meta.color}` : '1px solid var(--border)',
                    background: !form.badge ? `${meta.color}10` : 'transparent',
                    color: !form.badge ? meta.color : 'var(--ghost)', cursor: 'pointer',
                  }}>بدون شارة</button>
                {PLAN_BADGES.map(b => (
                  <button key={b.key} onClick={() => update('badge', b.key)}
                    style={{
                      padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                      border: form.badge === b.key ? `2px solid ${b.color}` : '1px solid var(--border)',
                      background: form.badge === b.key ? `${b.color}15` : 'transparent',
                      color: form.badge === b.key ? b.color : 'var(--ghost)', cursor: 'pointer',
                    }}>{b.labelAr}</button>
                ))}
              </div>
            </FieldGroup>

            <FieldGroup label="ترتيب العرض" icon={ArrowUpDown} color={meta.color}>
              <FieldInput value={form.sortOrder} onChange={(v) => update('sortOrder', Number(v))} type="number" placeholder="0" />
            </FieldGroup>

            <ToggleSwitch checked={form.isActive} onChange={(v) => update('isActive', v)}
              label="حالة الباقة" desc={form.isActive ? 'مفعّلة — يمكن الاشتراك بها' : 'معطّلة — لا يمكن الاشتراك بها'} />
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
              <div style={{ padding: '10px 14px', borderRadius: 10, background: '#34D39910', border: '1px solid #34D39920',
                display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={13} style={{ color: '#34D399' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#34D399' }}>
                  خصم <span style={EN}>{yearSaving}%</span> على الاشتراك السنوي
                </span>
              </div>
            )}

            <FieldGroup label="رسوم التأسيس" icon={Receipt} color={meta.color} suffix="ر.س">
              <FieldInput value={form.setupFee} onChange={(v) => update('setupFee', Number(v))} type="number" />
            </FieldGroup>

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

          {/* TAB: Features — Interactive Toggle */}
          {activeTab === 'features' && (<>
            <div style={{ fontSize: 12, color: 'var(--ghost)', marginBottom: 4 }}>
              حدد الميزات المتاحة في هذه الباقة. <span style={{ ...EN, fontWeight: 700 }}>{selectedFeatureIds.size}</span> ميزة محددة من أصل <span style={{ ...EN, fontWeight: 700 }}>{allFeatures.length}</span>
            </div>
            {featuresByCategory.map(group => (
              <div key={group.key} style={{ marginBottom: 8 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
                  padding: '6px 10px', borderRadius: 8, background: `${group.color}08`,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: group.color }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: group.color }}>{group.labelAr}</span>
                  <span style={{ fontSize: 10, color: 'var(--ghost)', ...EN }}>({group.features.length})</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {group.features.map(f => {
                    const isOn = selectedFeatureIds.has(f.id);
                    return (
                      <button key={f.id} onClick={() => toggleFeature(f.id)} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                        borderRadius: 10, border: isOn ? `1px solid ${group.color}25` : '1px solid var(--border)',
                        background: isOn ? `${group.color}06` : 'transparent', cursor: 'pointer',
                        width: '100%', textAlign: 'right',
                      }}>
                        <div style={{
                          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: isOn ? `${group.color}15` : 'var(--surface)',
                          border: isOn ? `1px solid ${group.color}30` : '1px solid var(--border)',
                        }}>
                          {isOn ? <Check size={12} style={{ color: group.color }} strokeWidth={2.5} />
                            : <span style={{ width: 10 }} />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{
                            fontSize: 12, fontWeight: isOn ? 600 : 500,
                            color: isOn ? 'var(--slate)' : 'var(--ghost)',
                          }}>{f.nameAr}</span>
                        </div>
                        {f.isAddon && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                            background: '#F9731610', color: '#F97316',
                          }}>إضافة</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </>)}

          {/* TAB: Trial */}
          {activeTab === 'trial' && (<>
            <ToggleSwitch checked={form.trialEnabled} onChange={(v) => update('trialEnabled', v)}
              label="التجربة المجانية" desc={form.trialEnabled ? 'مفعّلة — يحصل العميل على فترة تجريبية' : 'معطّلة — لا توجد تجربة مجانية'} color="#60A5FA" />

            {form.trialEnabled && (
              <FieldGroup label="أيام التجربة المجانية" icon={Clock} color="#60A5FA" suffix="يوم">
                <FieldInput value={form.trialDays} onChange={(v) => update('trialDays', Number(v))} type="number" />
              </FieldGroup>
            )}
            <p style={{ fontSize: 11, color: 'var(--ghost)', padding: '0 4px' }}>
              {form.trialEnabled
                ? `العميل يحصل على ${form.trialDays} يوم مجاناً عند الاشتراك لأول مرة.`
                : 'لا توجد تجربة مجانية. يجب أن يدفع العميل فوراً.'
              }
            </p>
          </>)}

          {/* TAB: Rules */}
          {activeTab === 'rules' && (<>
            <ToggleSwitch checked={form.isPublic} onChange={(v) => update('isPublic', v)}
              label="ظاهرة في التسعير العام" desc={form.isPublic ? 'تظهر في صفحة الأسعار العامة' : 'مخفية من صفحة الأسعار'} color="#60A5FA" />
            <ToggleSwitch checked={form.isInternal} onChange={(v) => update('isInternal', v)}
              label="باقة داخلية" desc={form.isInternal ? 'باقة داخلية — لا يمكن للعملاء الاشتراك بها' : 'عامة — يمكن للعملاء الاشتراك بها'} color="#F97316" />

            <div style={{ height: 1, background: 'var(--border)' }} />

            <ToggleSwitch checked={form.upgradeAllowed} onChange={(v) => update('upgradeAllowed', v)}
              label="السماح بالترقية" desc="يمكن للعميل الترقية من هذه الباقة" color="#34D399" />
            <ToggleSwitch checked={form.downgradeAllowed} onChange={(v) => update('downgradeAllowed', v)}
              label="السماح بالتخفيض" desc="يمكن للعميل التخفيض من هذه الباقة" color="#F97316" />
          </>)}

          {/* TAB: Preview */}
          {activeTab === 'preview' && (<>
            <div style={{
              padding: 20, borderRadius: 16, background: meta.gradient,
              border: `1px solid ${meta.color}15`,
            }}>
              {/* Badge */}
              {form.badge && (
                <div style={{
                  display: 'inline-flex', padding: '4px 10px', borderRadius: 6,
                  background: `${PLAN_BADGES.find(b => b.key === form.badge)?.color || meta.color}15`,
                  color: PLAN_BADGES.find(b => b.key === form.badge)?.color || meta.color,
                  fontSize: 10, fontWeight: 700, marginBottom: 12,
                }}>
                  {PLAN_BADGES.find(b => b.key === form.badge)?.labelAr || form.badge}
                </div>
              )}

              <h3 style={{ fontSize: 20, fontWeight: 800, color: meta.color, margin: '0 0 4px' }}>{form.nameAr || '—'}</h3>
              <p style={{ fontSize: 12, color: 'var(--ghost)', margin: '0 0 16px', ...EN }}>{form.name || '—'}</p>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 16 }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--slate)', ...EN }}>{fmt(form.priceMonthly)}</span>
                <span style={{ fontSize: 12, color: 'var(--ghost)' }}>ر.س /شهر</span>
              </div>

              {/* Preview limits */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 16 }}>
                <InfoChip label="موظفين" value={form.maxEmployees} />
                <InfoChip label="عملاء" value={form.maxClients} />
                <InfoChip label="مواعيد/شهر" value={form.maxAppointmentsMonth} />
              </div>

              {/* Features preview */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {allFeatures.map(f => {
                  const has = selectedFeatureIds.has(f.id);
                  return (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '3px 0' }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: has ? '#34D39912' : 'transparent',
                        border: has ? '1px solid #34D39925' : '1px solid var(--border)',
                      }}>
                        {has ? <Check size={10} style={{ color: '#34D399' }} strokeWidth={2.5} />
                          : <X size={9} style={{ color: 'var(--ghost)', opacity: 0.3 }} strokeWidth={2} />}
                      </div>
                      <span style={{
                        color: has ? 'var(--muted)' : 'var(--ghost)',
                        textDecoration: has ? 'none' : 'line-through', fontWeight: has ? 500 : 400,
                      }}>{f.nameAr}</span>
                    </div>
                  );
                })}
              </div>

              {/* Visibility badges */}
              <div style={{ display: 'flex', gap: 6, marginTop: 16, flexWrap: 'wrap' }}>
                {!form.isPublic && <span className="nx-badge" style={{ background: '#F9731610', color: '#F97316', fontSize: 10 }}>🔒 مخفية من التسعير</span>}
                {form.isInternal && <span className="nx-badge" style={{ background: '#EF444410', color: '#EF4444', fontSize: 10 }}>🏢 داخلية فقط</span>}
                {!form.isActive && <span className="nx-badge" style={{ background: '#64748B10', color: '#64748B', fontSize: 10 }}>⏸ معطّلة</span>}
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
            {!isNew && plan && (<>
              <Users size={12} />
              <span style={EN}>{plan.activeSubscriptions}</span> مشترك نشط
            </>)}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{
              padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>إلغاء</button>
            <button onClick={handleSave} disabled={saving || success} style={{
              padding: '9px 20px', borderRadius: 10, border: 'none',
              background: success ? '#34D399' : `linear-gradient(135deg, ${meta.color}, ${meta.color}CC)`,
              color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: `0 4px 15px ${meta.color}30`, opacity: saving ? 0.7 : 1,
            }}>
              {saving ? <Loader2 size={14} className="nx-spin" />
                : success ? <Check size={14} /> : <Save size={14} />}
              {saving ? 'جاري الحفظ...' : success ? 'تم!' : isNew ? 'إنشاء' : 'حفظ'}
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
  const [allFeatures, setAllFeatures] = useState<FeatureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editPlan, setEditPlan] = useState<PlanData | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [plansData, featuresData] = await Promise.all([
        adminService.getPlans(),
        adminService.getFeatureCatalog(),
      ]);
      setPlans(Array.isArray(plansData) ? plansData as any : []);
      setAllFeatures(Array.isArray(featuresData) ? featuresData : []);
    } catch (e) {
      console.error('Fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDuplicate = async (planId: string) => {
    try {
      await adminService.duplicatePlan(planId);
      fetchData();
    } catch (e: any) {
      console.error('Duplicate error:', e);
    }
  };

  const totalSubs = plans.reduce((s, p) => s + p.activeSubscriptions, 0);

  return (
    <div className="nx-space-y">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <PageTitle title="الباقات والأسعار" desc="إدارة باقات الاشتراك وتعديل الأسعار والميزات والصلاحيات"
          icon={<Crown size={20} style={{ color: '#C9A84C' }} strokeWidth={1.5} />}
        />
        <button onClick={() => setShowCreate(true)} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px',
          borderRadius: 12, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #C9A84C, #C9A84CCC)',
          color: '#fff', fontSize: 13, fontWeight: 700,
          boxShadow: '0 4px 15px rgba(201,168,76,0.3)',
        }}>
          <Plus size={16} /> إنشاء باقة
        </button>
      </div>

      {/* Summary Stats */}
      {!loading && plans.length > 0 && (
        <div className="nx-stats-grid">
          {[
            { label: 'إجمالي الباقات', value: plans.length, icon: Crown, color: '#C9A84C' },
            { label: 'باقات مفعّلة', value: plans.filter(p => p.isActive).length, icon: Check, color: '#34D399' },
            { label: 'باقات مخفية', value: plans.filter(p => !p.isPublic || p.isInternal).length, icon: EyeOff, color: '#F97316' },
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
            <p className="nx-empty-desc">لم يتم إنشاء أي باقات بعد</p>
          </div>
        </Glass>
      ) : (
        <div className="nx-grid-3">
          {plans.map((p) => {
            const meta = getPlanMeta(p.name);
            const PIcon = meta.icon;
            const featureCodes = new Set(p.planFeatures.map(pf => pf.feature.code));
            const monthlyPrice = Number(p.priceMonthly);
            const yearlyPrice = Number(p.priceYearly);
            const yearSaving = monthlyPrice > 0
              ? Math.round(((monthlyPrice * 12 - yearlyPrice) / (monthlyPrice * 12)) * 100) : 0;

            return (
              <Glass key={p.id} hover>
                <div style={{ padding: '20px 18px', position: 'relative' }}>
                  {/* Badges */}
                  <div style={{ display: 'flex', gap: 6, position: 'absolute', top: 14, left: 14, flexWrap: 'wrap' }}>
                    {!p.isActive && <span className="nx-badge nx-badge--red" style={{ fontSize: 9 }}>متوقفة</span>}
                    {!p.isPublic && <span className="nx-badge" style={{ fontSize: 9, background: '#F9731610', color: '#F97316' }}>مخفية</span>}
                    {p.isInternal && <span className="nx-badge" style={{ fontSize: 9, background: '#EF444410', color: '#EF4444' }}>داخلية</span>}
                    {p.badge && (
                      <span className="nx-badge" style={{
                        fontSize: 9,
                        background: `${PLAN_BADGES.find(b => b.key === p.badge)?.color || '#C9A84C'}15`,
                        color: PLAN_BADGES.find(b => b.key === p.badge)?.color || '#C9A84C',
                      }}>
                        {PLAN_BADGES.find(b => b.key === p.badge)?.labelAr || p.badge}
                      </span>
                    )}
                  </div>

                  {/* Plan Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 12,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: meta.gradient, border: `1px solid ${meta.color}20`,
                      }}>
                        <PIcon size={20} style={{ color: meta.color }} strokeWidth={1.6} />
                      </div>
                      <div>
                        <p style={{ fontSize: 16, fontWeight: 800, color: meta.color, margin: 0 }}>{p.nameAr}</p>
                        <p style={{ fontSize: 11, color: 'var(--ghost)', margin: 0, ...EN }}>{p.name}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => handleDuplicate(p.id)} title="تكرار"
                        style={{
                          width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)',
                          background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', color: 'var(--ghost)',
                        }}>
                        <Copy size={12} />
                      </button>
                      <button onClick={() => setEditPlan(p)} title="تعديل"
                        style={{
                          width: 30, height: 30, borderRadius: 8, border: `1px solid ${meta.color}25`,
                          background: `${meta.color}08`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', color: meta.color,
                        }}>
                        <Edit size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Pricing */}
                  <div style={{
                    marginBottom: 16, padding: '14px 16px', borderRadius: 12,
                    background: meta.gradient, border: `1px solid ${meta.color}12`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--slate)', ...EN, lineHeight: 1 }}>
                        {fmt(monthlyPrice)}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--ghost)', fontWeight: 500 }}>ر.س /شهر</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--ghost)', ...EN }}>
                        {fmt(yearlyPrice)} ر.س /سنة
                      </span>
                      {yearSaving > 0 && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, color: '#34D399',
                          padding: '2px 8px', borderRadius: 6, background: '#34D39912', ...EN,
                        }}>-{yearSaving}%</span>
                      )}
                    </div>
                  </div>

                  {/* Trial badge */}
                  {(p.trialDays ?? 0) > 0 && p.trialEnabled && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 12px', borderRadius: 8,
                      background: '#60A5FA08', border: '1px solid #60A5FA15', marginBottom: 14,
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
                      { label: 'ميزات', value: p.planFeatures.length, icon: Layers },
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

                  {/* Features List (compact) */}
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: 5, margin: 0, padding: 0, listStyle: 'none' }}>
                    {allFeatures.slice(0, 8).map((f) => {
                      const has = featureCodes.has(f.code);
                      return (
                        <li key={f.code} style={{
                          display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '2px 0',
                        }}>
                          <div style={{
                            width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: has ? '#34D39910' : 'transparent',
                            border: has ? '1px solid #34D39920' : '1px solid var(--border)',
                          }}>
                            {has ? <Check size={9} style={{ color: '#34D399' }} strokeWidth={2.5} />
                              : <X size={8} style={{ color: 'var(--ghost)', opacity: 0.3 }} strokeWidth={2} />}
                          </div>
                          <span style={{
                            color: has ? 'var(--muted)' : 'var(--ghost)',
                            textDecoration: has ? 'none' : 'line-through', fontWeight: has ? 500 : 400,
                          }}>{f.nameAr}</span>
                        </li>
                      );
                    })}
                    {allFeatures.length > 8 && (
                      <li style={{ fontSize: 11, color: 'var(--ghost)', paddingRight: 24 }}>
                        و <span style={EN}>{allFeatures.length - 8}</span> ميزة أخرى...
                      </li>
                    )}
                  </ul>
                </div>
              </Glass>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editPlan && (
        <PlanEditorModal
          key={editPlan.id}
          plan={editPlan}
          allFeatures={allFeatures}
          onClose={() => setEditPlan(null)}
          onSaved={() => { setEditPlan(null); fetchData(); }}
        />
      )}

      {/* Create Modal */}
      {showCreate && (
        <PlanEditorModal
          plan={null}
          allFeatures={allFeatures}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); fetchData(); }}
          isNew
        />
      )}
    </div>
  );
}
