'use client';

import { useState, useEffect, type ReactElement, type CSSProperties } from 'react';
import {
  CreditCard, Search, CheckCircle, XCircle, Clock,
  Crown, Sparkles, Shield, ChevronLeft, ChevronRight, X,
  AlertTriangle, Loader2, Eye, Pause, Play, CalendarPlus,
  ArrowUpDown, MoreHorizontal,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Glass, PageTitle } from '@/components/ui/glass';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { adminService } from '@/services/admin.service';

const EN: CSSProperties = {
  fontFeatureSettings: '"tnum" 1', fontVariantNumeric: 'tabular-nums',
  fontFamily: '"Inter","Outfit",system-ui,sans-serif', direction: 'ltr' as const, unicodeBidi: 'embed' as const,
};

const fmt = (n: number) => n.toLocaleString('en-US');
const fmtDate = (d: string) => {
  try { return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return '—'; }
};

const ST: Record<string, { label: string; badge: string; icon: typeof CheckCircle }> = {
  active:    { label: 'نشط',    badge: 'nx-badge--green',  icon: CheckCircle },
  expired:   { label: 'منتهي',  badge: 'nx-badge--red',    icon: XCircle },
  cancelled: { label: 'ملغي',   badge: 'nx-badge--red',    icon: XCircle },
  trial:     { label: 'تجريبي', badge: 'nx-badge--violet', icon: Clock },
  past_due:  { label: 'متأخر',  badge: 'nx-badge--amber',  icon: AlertTriangle },
};

function getPlanStyle(name: string) {
  const n = (name || '').toLowerCase();
  if (n.includes('enterprise') || n.includes('مؤسس')) return { icon: Crown, color: '#C9A84C' };
  if (n.includes('pro') || n.includes('احترافي')) return { icon: Sparkles, color: '#A78BFA' };
  return { icon: Shield, color: '#94A3B8' };
}

/* ── Extend Trial Modal ── */
function ExtendTrialModal({ subId, onClose, onDone }: { subId: string; onClose: () => void; onDone: () => void }) {
  const [days, setDays] = useState(7);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      await adminService.extendTrial(subId, days, reason || undefined);
      onDone();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="nx-modal-overlay" onClick={onClose}>
      <div className="nx-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 className="nx-modal-title" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarPlus size={18} style={{ color: '#A78BFA' }} /> تمديد فترة التجربة
          </h2>
          <button className="nx-hamburger" style={{ width: 32, height: 32 }} onClick={onClose}><X size={16} /></button>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#F87171', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div className="nx-form-group">
          <label className="nx-form-label">عدد أيام التمديد</label>
          <input className="nx-form-input" type="number" value={days} onChange={e => setDays(Number(e.target.value))} min={1} max={365} dir="ltr" style={EN} />
        </div>

        <div className="nx-form-group">
          <label className="nx-form-label">السبب (اختياري)</label>
          <textarea className="nx-form-input" value={reason} onChange={e => setReason(e.target.value)} placeholder="مثال: عميل VIP يحتاج وقت إضافي..." rows={3} style={{ resize: 'vertical' }} />
        </div>

        <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)', marginBottom: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#A78BFA', margin: 0 }}>
            ℹ️ سيتم تمديد تاريخ انتهاء الاشتراك بـ {days} يوم مع تسجيل ذلك في سجل التدقيق.
          </p>
        </div>

        <div className="nx-form-actions">
          <button className="nx-btn" onClick={onClose}>إلغاء</button>
          <button className="nx-btn nx-btn--primary" onClick={submit} disabled={loading || days < 1}>
            {loading ? <span style={{ width: 16, height: 16, border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 1s linear infinite', display: 'inline-block' }} /> : <><CalendarPlus size={14} /> تمديد {days} يوم</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Status Change Modal ── */
function StatusModal({ subId, currentStatus, action, onClose, onDone }: {
  subId: string; currentStatus: string; action: 'cancel' | 'activate' | 'suspend';
  onClose: () => void; onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const statusMap: Record<string, { newStatus: string; title: string; btnLabel: string; color: string; dangerColor: string }> = {
    cancel: { newStatus: 'cancelled', title: 'إلغاء الاشتراك', btnLabel: 'تأكيد الإلغاء', color: '#F87171', dangerColor: 'rgba(248,113,113,0.08)' },
    suspend: { newStatus: 'expired', title: 'تعليق الاشتراك', btnLabel: 'تأكيد التعليق', color: '#FBBF24', dangerColor: 'rgba(251,191,36,0.08)' },
    activate: { newStatus: 'active', title: 'إعادة تفعيل الاشتراك', btnLabel: 'تأكيد التفعيل', color: '#34D399', dangerColor: 'rgba(52,211,153,0.08)' },
  };
  const cfg = statusMap[action];

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      await adminService.updateSubscription(subId, { status: cfg.newStatus, reason: reason || undefined });
      onDone();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="nx-modal-overlay" onClick={onClose}>
      <div className="nx-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 className="nx-modal-title" style={{ marginBottom: 0, color: cfg.color }}>{cfg.title}</h2>
          <button className="nx-hamburger" style={{ width: 32, height: 32 }} onClick={onClose}><X size={16} /></button>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#F87171', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {action !== 'activate' && (
          <div style={{ padding: '12px 14px', borderRadius: 10, background: cfg.dangerColor, border: `1px solid ${cfg.color}25`, marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: cfg.color, margin: 0 }}>
              ⚠️ {action === 'cancel' ? 'سيتم إلغاء الاشتراك نهائياً وتعليق المنشأة.' : 'سيتم تعليق الاشتراك وإيقاف خدمات المنشأة.'}
            </p>
          </div>
        )}

        <div className="nx-form-group">
          <label className="nx-form-label">السبب {action !== 'activate' ? '*' : '(اختياري)'}</label>
          <textarea className="nx-form-input" value={reason} onChange={e => setReason(e.target.value)} placeholder="سبب التعديل..." rows={3} style={{ resize: 'vertical' }} />
        </div>

        <div className="nx-form-actions">
          <button className="nx-btn" onClick={onClose}>تراجع</button>
          <button className="nx-btn nx-btn--primary" onClick={submit} disabled={loading} style={{ background: cfg.color }}>
            {loading ? <span style={{ width: 16, height: 16, border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 1s linear infinite', display: 'inline-block' }} /> : cfg.btnLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Change Plan Modal ── */
function ChangePlanModal({ subId, currentPlanId, onClose, onDone }: {
  subId: string; currentPlanId: string; onClose: () => void; onDone: () => void;
}) {
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    adminService.getPlans()
      .then(p => { setPlans(p); })
      .catch(() => setPlans([]))
      .finally(() => setLoadingPlans(false));
  }, []);

  const submit = async () => {
    if (!selectedPlanId) return;
    setLoading(true);
    setError('');
    try {
      await adminService.updateSubscription(subId, { planId: selectedPlanId, reason: 'تغيير الباقة من لوحة الإدارة' });
      onDone();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="nx-modal-overlay" onClick={onClose}>
      <div className="nx-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 className="nx-modal-title" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ArrowUpDown size={18} style={{ color: '#6366F1' }} /> تغيير الباقة
          </h2>
          <button className="nx-hamburger" style={{ width: 32, height: 32 }} onClick={onClose}><X size={16} /></button>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#F87171', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {loadingPlans ? (
          <div className="nx-empty" style={{ padding: 40 }}><Loader2 size={24} className="nx-spin" style={{ color: 'var(--ghost)' }} /></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {plans.map(p => {
              const isCurrent = p.id === currentPlanId;
              const isSelected = p.id === selectedPlanId;
              const pl = getPlanStyle(p.nameAr || p.name);
              const PlIcon = pl.icon;
              return (
                <button
                  key={p.id}
                  onClick={() => !isCurrent && setSelectedPlanId(p.id)}
                  disabled={isCurrent}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                    borderRadius: 12, border: `2px solid ${isSelected ? '#6366F1' : isCurrent ? 'var(--border)' : 'transparent'}`,
                    background: isSelected ? 'rgba(99,102,241,0.06)' : isCurrent ? 'var(--surface)' : 'transparent',
                    cursor: isCurrent ? 'not-allowed' : 'pointer', opacity: isCurrent ? 0.5 : 1,
                    textAlign: 'right', width: '100%', transition: 'all 0.15s',
                    color: 'var(--muted)',
                  }}
                >
                  <PlIcon size={18} style={{ color: pl.color }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{p.nameAr || p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ghost)', marginTop: 2, ...EN }}>
                      {Number(p.priceMonthly).toLocaleString()} SAR/mo · {Number(p.priceYearly).toLocaleString()} SAR/yr
                    </div>
                  </div>
                  {isCurrent && <span className="nx-badge nx-badge--green" style={{ fontSize: 10 }}>الحالية</span>}
                  {isSelected && <CheckCircle size={18} style={{ color: '#6366F1' }} />}
                </button>
              );
            })}
          </div>
        )}

        <div className="nx-form-actions">
          <button className="nx-btn" onClick={onClose}>إلغاء</button>
          <button className="nx-btn nx-btn--primary" onClick={submit} disabled={loading || !selectedPlanId}>
            {loading ? <span style={{ width: 16, height: 16, border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 1s linear infinite', display: 'inline-block' }} /> : <><ArrowUpDown size={14} /> تطبيق الباقة</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SubscriptionsPage(): ReactElement {
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const PER = 10;
  const router = useRouter();

  // Modal states
  const [extendModal, setExtendModal] = useState<string | null>(null);
  const [statusModal, setStatusModal] = useState<{ id: string; status: string; action: 'cancel' | 'activate' | 'suspend' } | null>(null);
  const [changePlanModal, setChangePlanModal] = useState<{ id: string; planId: string } | null>(null);

  const fetchSubs = () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', page.toString());
    params.set('perPage', PER.toString());
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);

    adminService.getSubscriptions(params.toString())
      .then((res) => {
        setSubs(res.data ?? []);
        setTotal(res.meta?.total ?? 0);
      })
      .catch((e) => { console.error('Subs fetch error:', e); setSubs([]); setTotal(0); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchSubs(); }, [page, search, statusFilter]);

  const pages = Math.max(1, Math.ceil(total / PER));
  const activeCount = subs.filter(s => s.status === 'active').length;
  const trialCount = subs.filter(s => s.status === 'trial').length;

  return (
    <div className="nx-space-y">
      <PageTitle
        title="الاشتراكات والخطط"
        desc={loading ? 'جاري التحميل...' : `${total} اشتراك في المنصة`}
        icon={<CreditCard size={20} style={{ color: '#34D399' }} strokeWidth={1.5} />}
      />

      {/* Stats */}
      <div className="nx-stats-grid">
        {[
          { label: 'إجمالي الاشتراكات', value: total, icon: CreditCard, color: '#6366F1' },
          { label: 'نشط', value: activeCount, icon: CheckCircle, color: '#34D399' },
          { label: 'تجريبي', value: trialCount, icon: Clock, color: '#A78BFA' },
        ].map(k => {
          const KIcon = k.icon;
          return (
            <Glass key={k.label} hover>
              <div className="nx-stat">
                <div className="nx-stat-icon" style={{ background: `${k.color}10` }}>
                  <KIcon size={16} style={{ color: k.color, opacity: 0.8 }} strokeWidth={1.5} />
                </div>
                <div>
                  <div className="nx-stat-label">{k.label}</div>
                  <div className="nx-stat-value" style={EN}>{loading ? '—' : k.value}</div>
                </div>
              </div>
            </Glass>
          );
        })}
      </div>

      {/* Filters */}
      <Glass>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 14 }}>
          <div className="nx-input-icon" style={{ flex: 1, minWidth: 200 }}>
            <Search size={16} />
            <input className="nx-input" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="بحث بالاسم..." />
          </div>
          <select className="nx-select" value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">جميع الحالات</option>
            <option value="active">نشط</option>
            <option value="trial">تجريبي</option>
            <option value="expired">منتهي</option>
            <option value="cancelled">ملغي</option>
          </select>
          {(search || statusFilter) && (
            <button className="nx-btn" onClick={() => { setSearch(''); setStatusFilter(''); setPage(1); }}>
              <X size={14} /> مسح
            </button>
          )}
        </div>
      </Glass>

      {/* Table */}
      <Glass>
        {loading ? (
          <div className="nx-empty">
            <Loader2 size={28} className="nx-spin" style={{ color: 'var(--ghost)' }} />
            <p className="nx-empty-desc" style={{ marginTop: 12 }}>جاري التحميل...</p>
          </div>
        ) : subs.length === 0 ? (
          <div className="nx-empty">
            <div className="nx-empty-icon"><CreditCard size={22} /></div>
            <p className="nx-empty-title">لا توجد اشتراكات</p>
            <p className="nx-empty-desc">ستظهر هنا عند اشتراك أول صالون</p>
          </div>
        ) : (
          <>
            <div className="nx-table-mobile-wrap"><table className="nx-table">
              <thead>
                <tr>
                  <th>الصالون</th>
                  <th>الباقة</th>
                  <th>الدورة</th>
                  <th>المبلغ</th>
                  <th>البداية</th>
                  <th>الانتهاء</th>
                  <th>الحالة</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s: any) => {
                  const st = ST[s.status] || ST.active;
                  const StIcon = st.icon;
                  const tenantName = s.tenant?.nameAr || s.tenant?.nameEn || s.tenantName || '—';
                  const planName = s.plan?.nameAr || s.plan?.name || s.planName || '—';
                  const pl = getPlanStyle(planName);
                  const PlIcon = pl.icon;
                  const price = s.billingCycle === 'yearly'
                    ? Number(s.plan?.priceYearly || 0)
                    : Number(s.plan?.priceMonthly || 0);
                  const startDate = s.currentPeriodStart || s.startDate || s.createdAt;
                  const endDate = s.currentPeriodEnd || s.endDate;

                  // Build dropdown items
                  const menuItems: { label: string; icon: React.ReactNode; color?: string; danger?: boolean; onClick: () => void }[] = [
                    {
                      label: 'عرض التفاصيل',
                      icon: <Eye size={14} />,
                      color: '#94A3B8',
                      onClick: () => router.push(`/subscriptions/${s.id}`),
                    },
                    {
                      label: 'تغيير الباقة',
                      icon: <ArrowUpDown size={14} />,
                      color: '#6366F1',
                      onClick: () => setChangePlanModal({ id: s.id, planId: s.planId }),
                    },
                  ];

                  if (s.status === 'trial') {
                    menuItems.push({
                      label: 'تمديد التجربة',
                      icon: <CalendarPlus size={14} />,
                      color: '#A78BFA',
                      onClick: () => setExtendModal(s.id),
                    });
                  }

                  if (s.status === 'active' || s.status === 'trial') {
                    menuItems.push({
                      label: 'تعليق الاشتراك',
                      icon: <Pause size={14} />,
                      color: '#FBBF24',
                      onClick: () => setStatusModal({ id: s.id, status: s.status, action: 'suspend' }),
                    });
                    menuItems.push({
                      label: 'إلغاء الاشتراك',
                      icon: <XCircle size={14} />,
                      danger: true,
                      onClick: () => setStatusModal({ id: s.id, status: s.status, action: 'cancel' }),
                    });
                  }

                  if (s.status === 'cancelled' || s.status === 'expired') {
                    menuItems.push({
                      label: 'إعادة التفعيل',
                      icon: <Play size={14} />,
                      color: '#34D399',
                      onClick: () => setStatusModal({ id: s.id, status: s.status, action: 'activate' }),
                    });
                  }

                  return (
                    <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/subscriptions/${s.id}`)}>
                      <td className="nx-td-primary">{tenantName}</td>
                      <td data-label="الباقة">
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: pl.color }}>
                          <PlIcon size={13} />{planName}
                        </span>
                      </td>
                      <td data-label="الدورة">{s.billingCycle === 'monthly' ? 'شهري' : 'سنوي'}</td>
                      <td data-label="المبلغ" style={{ color: 'var(--gold)', fontWeight: 700, ...EN }}>
                        {fmt(price)} <span style={{ fontSize: 10, color: 'var(--ghost)' }}>SAR</span>
                      </td>
                      <td data-label="البداية" style={EN}>{fmtDate(startDate)}</td>
                      <td data-label="الانتهاء" style={EN}>{fmtDate(endDate)}</td>
                      <td data-label="الحالة">
                        <span className={`nx-badge ${st.badge}`}>
                          <StIcon size={12} />{st.label}
                        </span>
                      </td>
                      <td data-label="" onClick={e => e.stopPropagation()}>
                        <DropdownMenu items={menuItems} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
            {pages > 1 && (
              <div className="nx-pagination">
                <span className="nx-pagination-info" style={EN}>
                  Page {page} of {pages} · {total} total
                </span>
                <div className="nx-pagination-btns">
                  <button className="nx-pagination-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                    <ChevronRight size={14} />
                  </button>
                  {Array.from({ length: Math.min(pages, 5) }, (_, i) => i + 1).map(p => (
                    <button key={p} className={`nx-pagination-btn ${page === p ? 'nx-pagination-btn--active' : ''}`}
                      onClick={() => setPage(p)} style={EN}>{p}</button>
                  ))}
                  <button className="nx-pagination-btn" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}>
                    <ChevronLeft size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Glass>

      {/* Modals */}
      {extendModal && <ExtendTrialModal subId={extendModal} onClose={() => setExtendModal(null)} onDone={fetchSubs} />}
      {statusModal && <StatusModal subId={statusModal.id} currentStatus={statusModal.status} action={statusModal.action} onClose={() => setStatusModal(null)} onDone={fetchSubs} />}
      {changePlanModal && <ChangePlanModal subId={changePlanModal.id} currentPlanId={changePlanModal.planId} onClose={() => setChangePlanModal(null)} onDone={fetchSubs} />}
    </div>
  );
}
