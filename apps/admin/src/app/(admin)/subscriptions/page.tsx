'use client';

import { useState, useEffect, type ReactElement } from 'react';
import {
  CreditCard, Search, CheckCircle, XCircle, Clock,
  AlertTriangle, Crown, Sparkles, Shield, ChevronLeft, ChevronRight, X,
} from 'lucide-react';
import { Glass, PageTitle, TN } from '@/components/ui/glass';
import { adminService, type Subscription } from '@/services/admin.service';

const ST: Record<string, { label: string; badge: string; icon: typeof CheckCircle }> = {
  active:    { label: 'نشط',    badge: 'nx-badge--green',  icon: CheckCircle },
  expired:   { label: 'منتهي',  badge: 'nx-badge--red',    icon: XCircle },
  cancelled: { label: 'ملغي',   badge: 'nx-badge--red',    icon: XCircle },
  trial:     { label: 'تجريبي', badge: 'nx-badge--violet', icon: Clock },
};

const PL: Record<string, { icon: typeof Crown; color: string }> = {
  enterprise: { icon: Crown,    color: '#C9A84C' },
  pro:        { icon: Sparkles, color: '#A78BFA' },
  basic:      { icon: Shield,   color: 'var(--muted)' },
};

export default function SubscriptionsPage(): ReactElement {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const PER = 10;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', page.toString());
    params.set('perPage', PER.toString());
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);

    adminService.getSubscriptions(params.toString())
      .then((res) => {
        setSubs(res.items ?? []);
        setTotal(res.meta?.total ?? 0);
      })
      .catch(() => { setSubs([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [page, search, statusFilter]);

  const pages = Math.max(1, Math.ceil(total / PER));

  // Counts
  const activeCount = subs.filter(s => s.status === 'active').length;
  const trialCount = subs.filter(s => s.status === 'trial').length;
  const totalRev = subs.reduce((s, sub) => s + (sub.price || 0), 0);

  return (
    <div className="nx-space-y">
      <PageTitle
        title="الاشتراكات والخطط"
        desc={loading ? 'جاري التحميل...' : `${total} اشتراك في المنصة`}
        icon={<CreditCard size={20} style={{ color: '#34D399' }} strokeWidth={1.5} />}
      />

      {/* ── Stats ── */}
      <div className="nx-stats-grid">
        {[
          { label: 'إجمالي الاشتراكات', value: total, color: '#6366F1' },
          { label: 'نشط', value: activeCount, color: '#34D399' },
          { label: 'تجريبي', value: trialCount, color: '#A78BFA' },
          { label: 'إيرادات الصفحة', value: totalRev, suffix: ' ر.س', color: '#C9A84C' },
        ].map(k => (
          <Glass key={k.label} hover>
            <div className="nx-stat">
              <div className="nx-stat-icon" style={{ background: `${k.color}10` }}>
                <CreditCard size={16} style={{ color: k.color, opacity: 0.8 }} strokeWidth={1.5} />
              </div>
              <div>
                <div className="nx-stat-label">{k.label}</div>
                <div className="nx-stat-value" style={TN}>
                  {loading ? '—' : k.value.toLocaleString()}{k.suffix || ''}
                </div>
              </div>
            </div>
          </Glass>
        ))}
      </div>

      {/* ── Filters ── */}
      <Glass>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 14 }}>
          <div className="nx-input-icon" style={{ flex: 1, minWidth: 200 }}>
            <Search size={16} />
            <input
              className="nx-input"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="بحث بالاسم..."
            />
          </div>
          <select className="nx-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
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

      {/* ── Table ── */}
      <Glass>
        {loading ? (
          <div className="nx-empty">
            <div style={{ width: 28, height: 28, border: '2px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
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
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => {
                  const st = ST[s.status] || ST.active;
                  const plan = s.planName?.toLowerCase() || '';
                  const pl = plan.includes('enterprise') ? PL.enterprise
                    : plan.includes('pro') ? PL.pro : PL.basic;
                  const PlIcon = pl.icon;
                  const StIcon = st.icon;
                  return (
                    <tr key={s.id}>
                      <td className="nx-td-primary">{s.tenantName}</td>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: pl.color }}>
                          <PlIcon size={13} />{s.planName}
                        </span>
                      </td>
                      <td>{s.billingCycle === 'monthly' ? 'شهري' : 'سنوي'}</td>
                      <td style={{ color: 'var(--gold)', fontWeight: 700, ...TN }}>
                        {s.price?.toLocaleString() || 0} <span style={{ fontSize: 10, color: 'var(--ghost)' }}>ر.س</span>
                      </td>
                      <td style={TN}>{new Date(s.startDate).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                      <td style={TN}>{new Date(s.endDate).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                      <td>
                        <span className={`nx-badge ${st.badge}`}>
                          <StIcon size={12} />{st.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
            {pages > 1 && (
              <div className="nx-pagination">
                <span className="nx-pagination-info">صفحة {page} من {pages} · {total} اشتراك</span>
                <div className="nx-pagination-btns">
                  <button className="nx-pagination-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                    <ChevronRight size={14} />
                  </button>
                  {Array.from({ length: Math.min(pages, 5) }, (_, i) => i + 1).map(p => (
                    <button key={p} className={`nx-pagination-btn ${page === p ? 'nx-pagination-btn--active' : ''}`} onClick={() => setPage(p)}>{p}</button>
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
    </div>
  );
}
