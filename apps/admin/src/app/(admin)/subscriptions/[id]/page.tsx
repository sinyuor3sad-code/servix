'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  CreditCard, ArrowRight, CheckCircle, XCircle, Clock,
  Crown, Sparkles, Shield, CalendarPlus, Pause, Play,
  ArrowUpDown, FileText, User, Calendar, Loader2, X,
  AlertTriangle, History,
} from 'lucide-react';
import { Glass, PageTitle } from '@/components/ui/glass';
import { adminService } from '@/services/admin.service';

const EN: CSSProperties = {
  fontFeatureSettings: '"tnum" 1', fontVariantNumeric: 'tabular-nums',
  fontFamily: '"Inter","Outfit",system-ui,sans-serif', direction: 'ltr' as const, unicodeBidi: 'embed' as const,
};

const fmtDate = (d: string | Date | null) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return '—'; }
};

const fmtDateTime = (d: string | Date | null) => {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    return `${dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  } catch { return '—'; }
};

const ST: Record<string, { label: string; badge: string; icon: typeof CheckCircle; color: string }> = {
  active:    { label: 'نشط',    badge: 'nx-badge--green',  icon: CheckCircle,    color: '#34D399' },
  expired:   { label: 'منتهي',  badge: 'nx-badge--red',    icon: XCircle,        color: '#F87171' },
  cancelled: { label: 'ملغي',   badge: 'nx-badge--red',    icon: XCircle,        color: '#F87171' },
  trial:     { label: 'تجريبي', badge: 'nx-badge--violet', icon: Clock,          color: '#A78BFA' },
  past_due:  { label: 'متأخر',  badge: 'nx-badge--amber',  icon: AlertTriangle,  color: '#FBBF24' },
};

function getPlanStyle(name: string) {
  const n = (name || '').toLowerCase();
  if (n.includes('enterprise') || n.includes('مؤسس')) return { icon: Crown, color: '#C9A84C' };
  if (n.includes('pro') || n.includes('احترافي')) return { icon: Sparkles, color: '#A78BFA' };
  return { icon: Shield, color: '#94A3B8' };
}

/* ── Info Row ── */
function InfoRow({ label, value, style }: { label: string; value: string | number; style?: CSSProperties }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 13, color: 'var(--ghost)', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', ...style }}>{value}</span>
    </div>
  );
}

/* ── QuickAction button ── */
function QuickAction({ icon, label, color, onClick, disabled }: { icon: React.ReactNode; label: string; color: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        padding: '16px 12px', borderRadius: 14,
        border: `1px solid ${color}20`, background: `${color}08`,
        color, fontSize: 12, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1, transition: 'all 0.2s', minWidth: 100, flex: 1,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

/* ── Extend Trial Modal (inline) ── */
function ExtendTrialModal({ subId, onClose, onDone }: { subId: string; onClose: () => void; onDone: () => void }) {
  const [days, setDays] = useState(7);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setLoading(true); setError('');
    try {
      await adminService.extendTrial(subId, days, reason || undefined);
      onDone(); onClose();
    } catch (e: any) { setError(e?.message || 'خطأ'); } finally { setLoading(false); }
  };

  return (
    <div className="nx-modal-overlay" onClick={onClose}>
      <div className="nx-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h2 className="nx-modal-title" style={{ marginBottom: 0 }}>⏳ تمديد التجربة</h2>
          <button className="nx-hamburger" style={{ width: 30, height: 30 }} onClick={onClose}><X size={14} /></button>
        </div>
        {error && <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(248,113,113,0.08)', color: '#F87171', fontSize: 12, marginBottom: 12 }}>{error}</div>}
        <div className="nx-form-group"><label className="nx-form-label">عدد الأيام</label><input className="nx-form-input" type="number" value={days} onChange={e => setDays(Number(e.target.value))} min={1} max={365} dir="ltr" style={EN} /></div>
        <div className="nx-form-group"><label className="nx-form-label">السبب</label><textarea className="nx-form-input" value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="اختياري" style={{ resize: 'vertical' }} /></div>
        <div className="nx-form-actions"><button className="nx-btn" onClick={onClose}>إلغاء</button><button className="nx-btn nx-btn--primary" onClick={submit} disabled={loading || days < 1}>{loading ? '...' : `تمديد ${days} يوم`}</button></div>
      </div>
    </div>
  );
}

/* ── Status Change Modal ── */
function StatusModal({ subId, action, onClose, onDone }: { subId: string; action: 'cancel' | 'activate' | 'suspend'; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const map: Record<string, { status: string; title: string; btn: string; color: string }> = {
    cancel: { status: 'cancelled', title: 'إلغاء الاشتراك', btn: 'تأكيد الإلغاء', color: '#F87171' },
    suspend: { status: 'expired', title: 'تعليق الاشتراك', btn: 'تأكيد التعليق', color: '#FBBF24' },
    activate: { status: 'active', title: 'إعادة التفعيل', btn: 'تأكيد التفعيل', color: '#34D399' },
  };
  const c = map[action];
  const submit = async () => {
    setLoading(true); setError('');
    try { await adminService.updateSubscription(subId, { status: c.status, reason }); onDone(); onClose(); }
    catch (e: any) { setError(e?.message || 'خطأ'); } finally { setLoading(false); }
  };
  return (
    <div className="nx-modal-overlay" onClick={onClose}>
      <div className="nx-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
          <h2 className="nx-modal-title" style={{ marginBottom: 0, color: c.color }}>{c.title}</h2>
          <button className="nx-hamburger" style={{ width: 30, height: 30 }} onClick={onClose}><X size={14} /></button>
        </div>
        {error && <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(248,113,113,0.08)', color: '#F87171', fontSize: 12, marginBottom: 12 }}>{error}</div>}
        {action !== 'activate' && <div style={{ padding: '10px 12px', borderRadius: 8, background: `${c.color}10`, border: `1px solid ${c.color}20`, marginBottom: 12, fontSize: 12, fontWeight: 600, color: c.color }}>⚠️ هذا الإجراء سيؤثر على خدمات المنشأة</div>}
        <div className="nx-form-group"><label className="nx-form-label">السبب</label><textarea className="nx-form-input" value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="سبب الإجراء..." style={{ resize: 'vertical' }} /></div>
        <div className="nx-form-actions"><button className="nx-btn" onClick={onClose}>تراجع</button><button className="nx-btn nx-btn--primary" onClick={submit} disabled={loading} style={{ background: c.color }}>{loading ? '...' : c.btn}</button></div>
      </div>
    </div>
  );
}

/* ── Change Plan Modal ── */
function ChangePlanModal({ subId, currentPlanId, onClose, onDone }: { subId: string; currentPlanId: string; onClose: () => void; onDone: () => void }) {
  const [plans, setPlans] = useState<any[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { adminService.getPlans().then(setPlans).catch(() => setPlans([])).finally(() => setLoadingPlans(false)); }, []);

  const submit = async () => {
    if (!selected) return;
    setLoading(true); setError('');
    try { await adminService.updateSubscription(subId, { planId: selected, reason: 'تغيير الباقة من التفاصيل' }); onDone(); onClose(); }
    catch (e: any) { setError(e?.message || 'خطأ'); } finally { setLoading(false); }
  };

  return (
    <div className="nx-modal-overlay" onClick={onClose}>
      <div className="nx-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
          <h2 className="nx-modal-title" style={{ marginBottom: 0 }}>🔄 تغيير الباقة</h2>
          <button className="nx-hamburger" style={{ width: 30, height: 30 }} onClick={onClose}><X size={14} /></button>
        </div>
        {error && <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(248,113,113,0.08)', color: '#F87171', fontSize: 12, marginBottom: 12 }}>{error}</div>}
        {loadingPlans ? <div style={{ textAlign: 'center', padding: 30 }}><Loader2 size={20} className="nx-spin" /></div> :
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {plans.map(p => {
              const cur = p.id === currentPlanId;
              const sel = p.id === selected;
              const pl = getPlanStyle(p.nameAr || p.name);
              return (
                <button key={p.id} onClick={() => !cur && setSelected(p.id)} disabled={cur}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, border: `2px solid ${sel ? '#6366F1' : 'transparent'}`, background: sel ? 'rgba(99,102,241,0.06)' : 'transparent', cursor: cur ? 'not-allowed' : 'pointer', opacity: cur ? 0.4 : 1, width: '100%', textAlign: 'right', color: 'var(--muted)' }}>
                  <pl.icon size={16} style={{ color: pl.color }} />
                  <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 13 }}>{p.nameAr}</div><div style={{ fontSize: 10, color: 'var(--ghost)', ...EN }}>{Number(p.priceMonthly)} SAR/mo</div></div>
                  {cur && <span className="nx-badge nx-badge--green" style={{ fontSize: 9, padding: '3px 8px' }}>الحالية</span>}
                  {sel && <CheckCircle size={16} style={{ color: '#6366F1' }} />}
                </button>
              );
            })}
          </div>
        }
        <div className="nx-form-actions"><button className="nx-btn" onClick={onClose}>إلغاء</button><button className="nx-btn nx-btn--primary" onClick={submit} disabled={loading || !selected}>{loading ? '...' : 'تطبيق'}</button></div>
      </div>
    </div>
  );
}

/* ═══════════════════ Main Page ═══════════════════ */

export default function SubscriptionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [sub, setSub] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal states
  const [showExtend, setShowExtend] = useState(false);
  const [showStatus, setShowStatus] = useState<'cancel' | 'activate' | 'suspend' | null>(null);
  const [showChangePlan, setShowChangePlan] = useState(false);

  const fetchSub = () => {
    setLoading(true);
    adminService.getSubscriptionById(id)
      .then(setSub)
      .catch((e: any) => setError(e?.message || 'خطأ في تحميل الاشتراك'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchSub(); }, [id]);

  if (loading) {
    return (
      <div className="nx-space-y">
        <div className="nx-empty" style={{ minHeight: 400 }}>
          <Loader2 size={28} className="nx-spin" style={{ color: 'var(--ghost)' }} />
          <p className="nx-empty-desc" style={{ marginTop: 12 }}>جاري تحميل بيانات الاشتراك...</p>
        </div>
      </div>
    );
  }

  if (error || !sub) {
    return (
      <div className="nx-space-y">
        <div className="nx-empty" style={{ minHeight: 400 }}>
          <AlertTriangle size={28} style={{ color: '#F87171' }} />
          <p className="nx-empty-title" style={{ marginTop: 12 }}>خطأ</p>
          <p className="nx-empty-desc">{error || 'الاشتراك غير موجود'}</p>
          <button className="nx-btn" onClick={() => router.back()} style={{ marginTop: 16 }}><ArrowRight size={14} /> العودة</button>
        </div>
      </div>
    );
  }

  const st = ST[sub.status] || ST.active;
  const StIcon = st.icon;
  const planName = sub.plan?.nameAr || sub.plan?.name || '—';
  const pl = getPlanStyle(planName);
  const PlIcon = pl.icon;
  const tenantName = sub.tenant?.nameAr || sub.tenant?.nameEn || '—';

  // Timeline calculations
  const startMs = new Date(sub.currentPeriodStart).getTime();
  const endMs = new Date(sub.currentPeriodEnd).getTime();
  const nowMs = Date.now();
  const totalDays = Math.max(1, Math.round((endMs - startMs) / 86400000));
  const elapsedDays = Math.round((nowMs - startMs) / 86400000);
  const remainingDays = Math.max(0, totalDays - elapsedDays);
  const progressPct = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));

  return (
    <div className="nx-space-y">
      {/* Header with back button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="nx-btn" onClick={() => router.push('/subscriptions')} style={{ padding: '8px 12px' }}>
          <ArrowRight size={14} /> العودة
        </button>
      </div>

      {/* Title Card */}
      <Glass>
        <div style={{ padding: '20px 24px', display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${pl.color}15`, border: `1px solid ${pl.color}30` }}>
            <PlIcon size={24} style={{ color: pl.color }} />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--muted)' }}>{tenantName}</div>
            <div style={{ fontSize: 13, color: 'var(--ghost)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ color: pl.color, fontWeight: 700 }}>{planName}</span>
              <span>·</span>
              <span className={`nx-badge ${st.badge}`}><StIcon size={12} />{st.label}</span>
              <span>·</span>
              <span style={EN}>{sub.billingCycle === 'monthly' ? 'شهري' : 'سنوي'}</span>
            </div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--ghost)', ...EN }}>
            ID: {sub.id.slice(0, 8)}
          </div>
        </div>
      </Glass>

      {/* Timeline Progress */}
      <Glass>
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={14} style={{ color: st.color }} /> المدة الزمنية
            </span>
            <span style={{ fontSize: 12, fontWeight: 800, color: remainingDays <= 7 ? '#F87171' : st.color, ...EN }}>
              {remainingDays} يوم متبقي
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: 'var(--surface)', overflow: 'hidden', marginBottom: 10 }}>
            <div style={{
              height: '100%', borderRadius: 4,
              background: `linear-gradient(90deg, ${st.color}, ${st.color}80)`,
              width: `${progressPct}%`, transition: 'width 0.5s ease',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ghost)', ...EN }}>
            <span>{fmtDate(sub.currentPeriodStart)}</span>
            <span>{fmtDate(sub.currentPeriodEnd)}</span>
          </div>
        </div>
      </Glass>

      {/* Quick Actions */}
      <Glass>
        <div style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', marginBottom: 14 }}>⚡ إجراءات سريعة</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <QuickAction icon={<ArrowUpDown size={18} />} label="تغيير الباقة" color="#6366F1" onClick={() => setShowChangePlan(true)} />
            <QuickAction icon={<CalendarPlus size={18} />} label="تمديد التجربة" color="#A78BFA" onClick={() => setShowExtend(true)} disabled={sub.status !== 'trial'} />
            {(sub.status === 'active' || sub.status === 'trial') ? (
              <>
                <QuickAction icon={<Pause size={18} />} label="تعليق" color="#FBBF24" onClick={() => setShowStatus('suspend')} />
                <QuickAction icon={<XCircle size={18} />} label="إلغاء" color="#F87171" onClick={() => setShowStatus('cancel')} />
              </>
            ) : (
              <QuickAction icon={<Play size={18} />} label="إعادة تفعيل" color="#34D399" onClick={() => setShowStatus('activate')} />
            )}
          </div>
        </div>
      </Glass>

      {/* Details Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        {/* Plan Info */}
        <Glass>
          <div style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--muted)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CreditCard size={16} style={{ color: '#6366F1' }} /> بيانات الباقة
            </div>
            <InfoRow label="الباقة" value={planName} style={{ color: pl.color, fontWeight: 800 }} />
            <InfoRow label="السعر الشهري" value={`${Number(sub.plan?.priceMonthly || 0).toLocaleString()} SAR`} style={EN} />
            <InfoRow label="السعر السنوي" value={`${Number(sub.plan?.priceYearly || 0).toLocaleString()} SAR`} style={EN} />
            <InfoRow label="دورة الفوترة" value={sub.billingCycle === 'monthly' ? 'شهري' : 'سنوي'} />
            <InfoRow label="الحد الأقصى للموظفين" value={sub.plan?.maxEmployees || '—'} style={EN} />
            <InfoRow label="الحد الأقصى للعملاء" value={sub.plan?.maxClients || '—'} style={EN} />
          </div>
        </Glass>

        {/* Tenant Info */}
        <Glass>
          <div style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--muted)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <User size={16} style={{ color: '#34D399' }} /> بيانات المنشأة
            </div>
            <InfoRow label="اسم المنشأة" value={tenantName} />
            <InfoRow label="البريد" value={sub.tenant?.email || '—'} style={EN} />
            <InfoRow label="الهاتف" value={sub.tenant?.phone || '—'} style={EN} />
            <InfoRow label="المدينة" value={sub.tenant?.city || '—'} />
            <InfoRow label="حالة المنشأة" value={sub.tenant?.status || '—'} />
            <InfoRow label="تاريخ التسجيل" value={fmtDate(sub.tenant?.createdAt)} style={EN} />
          </div>
        </Glass>
      </div>

      {/* Invoices */}
      {sub.platformInvoices?.length > 0 && (
        <Glass>
          <div style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--muted)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={16} style={{ color: '#C9A84C' }} /> الفواتير ({sub.platformInvoices.length})
            </div>
            <div className="nx-table-mobile-wrap">
              <table className="nx-table">
                <thead><tr><th>رقم الفاتورة</th><th>المبلغ</th><th>الحالة</th><th>التاريخ</th></tr></thead>
                <tbody>
                  {sub.platformInvoices.map((inv: any) => (
                    <tr key={inv.id}>
                      <td data-label="رقم" style={{ fontFamily: 'monospace', fontSize: 11, color: '#A78BFA' }}>{inv.invoiceNumber}</td>
                      <td data-label="المبلغ" style={{ color: 'var(--gold)', fontWeight: 700, ...EN }}>{Number(inv.total).toLocaleString()} SAR</td>
                      <td data-label="الحالة"><span className={`nx-badge ${inv.status === 'paid' ? 'nx-badge--green' : 'nx-badge--amber'}`}><span className="nx-badge-dot" />{inv.status === 'paid' ? 'مدفوعة' : 'معلقة'}</span></td>
                      <td data-label="التاريخ" style={EN}>{fmtDate(inv.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Glass>
      )}

      {/* Audit Log */}
      <Glass>
        <div style={{ padding: '20px 24px' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--muted)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <History size={16} style={{ color: '#94A3B8' }} /> سجل التدقيق
          </div>
          {(!sub.auditLogs || sub.auditLogs.length === 0) ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--ghost)', fontSize: 13 }}>
              لا توجد سجلات بعد
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {sub.auditLogs.map((log: any) => {
                const actionMap: Record<string, { label: string; color: string }> = {
                  update_subscription: { label: 'تعديل الاشتراك', color: '#6366F1' },
                  extend_trial: { label: 'تمديد التجربة', color: '#A78BFA' },
                  update_status: { label: 'تغيير الحالة', color: '#FBBF24' },
                };
                const info = actionMap[log.action] || { label: log.action, color: '#94A3B8' };
                const changes = log.newValues as Record<string, any> || {};

                return (
                  <div key={log.id} style={{
                    padding: '14px 16px', borderRadius: 12,
                    background: 'var(--surface)', border: '1px solid var(--border)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: info.color }}>{info.label}</span>
                      <span style={{ fontSize: 10, color: 'var(--ghost)', ...EN }}>{fmtDateTime(log.createdAt)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ghost)' }}>
                      بواسطة: {log.user?.fullName || log.userId?.slice(0, 8)}
                    </div>
                    {changes.reason && (
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, padding: '6px 10px', borderRadius: 6, background: 'var(--bg)' }}>
                        💬 {changes.reason}
                      </div>
                    )}
                    {changes.days && (
                      <div style={{ fontSize: 11, color: '#A78BFA', marginTop: 4, ...EN }}>+{changes.days} days</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Glass>

      {/* Modals */}
      {showExtend && <ExtendTrialModal subId={id} onClose={() => setShowExtend(false)} onDone={fetchSub} />}
      {showStatus && <StatusModal subId={id} action={showStatus} onClose={() => setShowStatus(null)} onDone={fetchSub} />}
      {showChangePlan && <ChangePlanModal subId={id} currentPlanId={sub.planId} onClose={() => setShowChangePlan(false)} onDone={fetchSub} />}
    </div>
  );
}
