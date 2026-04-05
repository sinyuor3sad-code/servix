'use client';

import { useState, useEffect, type ReactElement } from 'react';
import {
  BarChart3, Building2, DollarSign, TrendingUp, Users,
  Crown, Sparkles, Shield as ShieldIcon, MapPin,
} from 'lucide-react';
import { Glass, PageTitle, TN } from '@/components/ui/glass';
import { adminService, type AdminStats, type Tenant } from '@/services/admin.service';

export default function AnalyticsPage(): ReactElement {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminService.getStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const total = stats?.totalTenants ?? 0;
  const active = stats?.activeTenants ?? 0;
  const pending = stats?.pendingTenants ?? 0;
  const suspended = total - active - pending;
  const revenue = stats?.monthlyRevenue ?? 0;
  const newThis = stats?.newTenantsThisMonth ?? 0;
  const plans = stats?.planDistribution ?? [];
  const recent = stats?.recentTenants ?? [];
  const subs = stats?.totalSubscriptions ?? 0;

  const kpis = [
    { label: 'إجمالي الأقاليم', value: total, icon: Building2, color: '#8B5CF6' },
    { label: 'إيرادات الشهر', value: revenue, suffix: ' ر.س', icon: DollarSign, color: '#34D399' },
    { label: 'أقاليم جديدة', value: newThis, icon: TrendingUp, color: '#C9A84C' },
    { label: 'اشتراكات فعّالة', value: subs, icon: Users, color: '#6366F1' },
  ];

  // Status distribution
  const statuses = [
    { label: 'نشط', count: active, color: '#34D399' },
    { label: 'بانتظار', count: pending, color: '#A78BFA' },
    { label: 'معلّق', count: suspended > 0 ? suspended : 0, color: '#FBBF24' },
  ];
  const maxStatus = Math.max(...statuses.map(s => s.count), 1);

  // Plan icons
  const planIcon = (name: string) => {
    if (name.toLowerCase().includes('enterprise') || name.toLowerCase().includes('متقدم')) return Crown;
    if (name.toLowerCase().includes('pro') || name.toLowerCase().includes('احترافي')) return Sparkles;
    return ShieldIcon;
  };
  const planTotal = plans.reduce((s, p) => s + p.count, 0) || 1;

  return (
    <div className="nx-space-y">
      <PageTitle
        title="التحليلات والتقارير"
        desc="إحصائيات تفصيلية عن أداء المنصة"
        icon={<BarChart3 size={20} style={{ color: '#6366F1' }} strokeWidth={1.5} />}
      />

      {/* ── KPI Cards ── */}
      <div className="nx-stats-grid">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Glass key={k.label} hover>
              <div className="nx-stat">
                <div className="nx-stat-icon" style={{ background: `${k.color}10` }}>
                  <Icon size={18} style={{ color: k.color, opacity: 0.85 }} strokeWidth={1.5} />
                </div>
                <div>
                  <div className="nx-stat-label">{k.label}</div>
                  <div className="nx-stat-value" style={TN}>
                    {loading ? '—' : k.value.toLocaleString()}{k.suffix || ''}
                  </div>
                </div>
              </div>
            </Glass>
          );
        })}
      </div>

      <div className="nx-grid-2">
        {/* ── Status Distribution ── */}
        <Glass>
          <div style={{ padding: '20px 20px 24px' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate)', marginBottom: 20 }}>
              حالات الأقاليم
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {statuses.map((s) => (
                <div key={s.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{s.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: s.color, ...TN }}>{s.count}</span>
                  </div>
                  <div className="nx-progress">
                    <div className="nx-progress-fill" style={{
                      width: `${(s.count / maxStatus) * 100}%`,
                      background: s.color,
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Glass>

        {/* ── Plan Distribution ── */}
        <Glass>
          <div style={{ padding: '20px' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate)', marginBottom: 20 }}>
              توزيع الباقات
            </h3>
            {plans.length === 0 && !loading ? (
              <div className="nx-empty" style={{ padding: '30px 20px' }}>
                <div className="nx-empty-icon"><Crown size={20} /></div>
                <p className="nx-empty-desc">لا توجد باقات مُفعّلة بعد</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {plans.map((p) => {
                  const Icon = planIcon(p.plan);
                  const pct = Math.round((p.count / planTotal) * 100);
                  return (
                    <div key={p.plan} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <Icon size={14} style={{ color: 'var(--gold)' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate)' }}>{p.plan}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', ...TN }}>{p.count} ({pct}%)</span>
                        </div>
                        <div className="nx-progress" style={{ marginTop: 6 }}>
                          <div className="nx-progress-fill" style={{ width: `${pct}%`, background: 'var(--gold)' }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Glass>
      </div>

      {/* ── Recent Tenants ── */}
      <Glass>
        <div style={{ padding: '20px 20px 8px' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate)' }}>
            أحدث الصالونات المسجلة
          </h3>
        </div>
        {recent.length === 0 ? (
          <div className="nx-empty" style={{ padding: '30px' }}>
            <div className="nx-empty-icon"><Building2 size={20} /></div>
            <p className="nx-empty-title">لا توجد صالونات مسجلة</p>
            <p className="nx-empty-desc">ستظهر هنا أحدث الصالونات عند التسجيل</p>
          </div>
        ) : (
          <div className="nx-table-mobile-wrap"><table className="nx-table">
            <thead>
              <tr>
                <th>الصالون</th>
                <th>المدينة</th>
                <th>الحالة</th>
                <th>تاريخ التسجيل</th>
              </tr>
            </thead>
            <tbody>
              {recent.slice(0, 5).map((t) => {
                const stCls = t.status === 'active' ? 'nx-badge--green'
                  : t.status === 'pending' ? 'nx-badge--violet'
                  : 'nx-badge--amber';
                const stLabel = t.status === 'active' ? 'نشط' : t.status === 'pending' ? 'بانتظار' : 'معلّق';
                return (
                  <tr key={t.id}>
                    <td className="nx-td-primary">{t.nameAr || t.nameEn}</td>
                    <td><span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12} style={{ color: 'var(--ghost)' }} />{t.city || '—'}</span></td>
                    <td><span className={`nx-badge ${stCls}`}><span className="nx-badge-dot" />{stLabel}</span></td>
                    <td style={TN}>{new Date(t.createdAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </Glass>
    </div>
  );
}
