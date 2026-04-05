'use client';

import { useState, useEffect, type ReactElement } from 'react';
import { ScrollText, Search, LogIn, UserPlus, Trash2, Settings, CreditCard } from 'lucide-react';
import { Glass, PageTitle, TN } from '@/components/ui/glass';
import { adminService, type AuditLog } from '@/services/admin.service';

const ICON_MAP: Record<string, typeof LogIn> = {
  login: LogIn,
  tenant_create: UserPlus,
  tenant_delete: Trash2,
  settings_update: Settings,
  subscription: CreditCard,
};

export default function AuditLogsPage(): ReactElement {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    adminService.getAuditLogs(params.toString())
      .then(res => { setLogs(res.items ?? []); setTotal(res.meta?.total ?? 0); })
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <div className="nx-space-y">
      <PageTitle title="سجل العمليات" desc={loading ? 'جاري التحميل...' : `${total} عملية مسجلة`}
        icon={<ScrollText size={20} style={{ color: '#60A5FA' }} strokeWidth={1.5} />}
      />

      <Glass>
        <div style={{ padding: 14 }}>
          <div className="nx-input-icon" style={{ maxWidth: 320 }}>
            <Search size={16} />
            <input className="nx-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث في السجل..." />
          </div>
        </div>
      </Glass>

      <Glass>
        {loading ? (
          <div className="nx-empty">
            <div style={{ width: 28, height: 28, border: '2px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <p className="nx-empty-desc" style={{ marginTop: 12 }}>جاري التحميل...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="nx-empty">
            <div className="nx-empty-icon"><ScrollText size={22} /></div>
            <p className="nx-empty-title">لا توجد عمليات مسجلة</p>
          </div>
        ) : (
          <div className="nx-table-mobile-wrap">
            <table className="nx-table">
              <thead>
                <tr>
                  <th>العملية</th>
                  <th>المنفّذ</th>
                  <th>IP</th>
                  <th>الوقت</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l: any) => (
                  <tr key={l.id}>
                    <td className="nx-td-primary" style={{ fontWeight: 500 }}>{l.action || l.description || '—'}</td>
                    <td>{l.user?.fullName || l.userId?.slice(0, 8) || 'النظام'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--ghost)' }}>{l.ipAddress || l.ip || '—'}</td>
                    <td style={TN}>{l.createdAt ? new Date(l.createdAt).toLocaleString('ar-SA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Glass>
    </div>
  );
}
