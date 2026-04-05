'use client';

import { useState, useEffect, type ReactElement, type CSSProperties } from 'react';
import {
  CreditCard, Search, CheckCircle, XCircle, Clock,
  Crown, Sparkles, Shield, ChevronLeft, ChevronRight, X,
  AlertTriangle, Users, TrendingUp, Loader2,
} from 'lucide-react';
import { Glass, PageTitle } from '@/components/ui/glass';
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

export default function SubscriptionsPage(): ReactElement {
  const [subs, setSubs] = useState<any[]>([]);
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
        setSubs(res.data ?? []);
        setTotal(res.meta?.total ?? 0);
      })
      .catch((e) => { console.error('Subs fetch error:', e); setSubs([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [page, search, statusFilter]);

  const pages = Math.max(1, Math.ceil(total / PER));

  // Counts from the current page data
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
                </tr>
              </thead>
              <tbody>
                {subs.map((s: any) => {
                  const st = ST[s.status] || ST.active;
                  const StIcon = st.icon;

                  // Read from Prisma relations (tenant, plan)
                  const tenantName = s.tenant?.nameAr || s.tenant?.nameEn || s.tenantName || '—';
                  const planName = s.plan?.nameAr || s.plan?.name || s.planName || '—';
                  const pl = getPlanStyle(planName);
                  const PlIcon = pl.icon;

                  // Price from plan relation
                  const price = s.billingCycle === 'yearly'
                    ? Number(s.plan?.priceYearly || 0)
                    : Number(s.plan?.priceMonthly || 0);

                  // Dates: Prisma uses currentPeriodStart/currentPeriodEnd
                  const startDate = s.currentPeriodStart || s.startDate || s.createdAt;
                  const endDate = s.currentPeriodEnd || s.endDate;

                  return (
                    <tr key={s.id}>
                      <td className="nx-td-primary">{tenantName}</td>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: pl.color }}>
                          <PlIcon size={13} />{planName}
                        </span>
                      </td>
                      <td>{s.billingCycle === 'monthly' ? 'شهري' : 'سنوي'}</td>
                      <td style={{ color: 'var(--gold)', fontWeight: 700, ...EN }}>
                        {fmt(price)} <span style={{ fontSize: 10, color: 'var(--ghost)' }}>SAR</span>
                      </td>
                      <td style={EN}>{fmtDate(startDate)}</td>
                      <td style={EN}>{fmtDate(endDate)}</td>
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
    </div>
  );
}
