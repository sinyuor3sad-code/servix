'use client';

import { useState, useEffect, type ReactElement } from 'react';
import {
  HardDrive, CheckCircle, XCircle, Clock, AlertTriangle,
  Download, RefreshCw, Search, Shield, Loader2,
} from 'lucide-react';
import { Glass, PageTitle, TN } from '@/components/ui/glass';
import { adminService, type BackupRecord } from '@/services/admin.service';

type BackupStatus = 'success' | 'failed' | 'pending' | 'never';

const ST: Record<BackupStatus, { label: string; badge: string; icon: typeof CheckCircle }> = {
  success: { label: 'ناجح', badge: 'nx-badge--green', icon: CheckCircle },
  failed: { label: 'فاشل', badge: 'nx-badge--red', icon: XCircle },
  pending: { label: 'جاري...', badge: 'nx-badge--amber', icon: Clock },
  never: { label: 'لم يتم', badge: 'nx-badge--violet', icon: AlertTriangle },
};

export default function BackupsPage(): ReactElement {
  const [search, setSearch] = useState('');
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [backing, setBacking] = useState<string | null>(null);
  const [bulkBacking, setBulkBacking] = useState(false);

  const fetchBackups = () => {
    setLoading(true);
    adminService.getBackups()
      .then(data => setBackups(data ?? []))
      .catch(() => setBackups([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchBackups(); }, []);

  const filtered = backups.filter(b => !search || b.salonName.includes(search));

  const successCount = backups.filter(b => b.status === 'success').length;
  const failCount = backups.filter(b => b.status === 'failed').length;
  const neverCount = backups.filter(b => b.status === 'never').length;
  const totalSize = backups.filter(b => b.size !== '—' && b.size !== '0').reduce((s, b) => s + (parseInt(b.size) || 0), 0);

  const triggerBackup = async (id: string) => {
    setBacking(id);
    try {
      const updated = await adminService.triggerBackup(id);
      setBackups(prev => prev.map(b => b.id === id ? updated : b));
    } catch {
      // Show real failure — never fake success for a safety-critical operation
      setBackups(prev => prev.map(b =>
        b.id === id ? { ...b, status: 'failed' as BackupStatus } : b
      ));
    } finally {
      setBacking(null);
    }
  };

  const triggerAll = async () => {
    setBulkBacking(true);
    for (const b of backups) {
      await triggerBackup(b.id);
    }
    setBulkBacking(false);
  };

  const daysSince = (date: string | null) => {
    if (!date) return null;
    const diff = Date.now() - new Date(date).getTime();
    return Math.floor(diff / 86400000);
  };

  return (
    <div className="nx-space-y">
      <PageTitle
        title="النسخ الاحتياطي"
        desc={`مراقبة وإدارة النسخ الاحتياطي لـ ${backups.length} صالون`}
        icon={<HardDrive size={20} style={{ color: '#6366F1' }} strokeWidth={1.5} />}
      >
        <button className="nx-btn nx-btn--primary" onClick={triggerAll} disabled={bulkBacking || loading}>
          {bulkBacking ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} نسخ احتياطي شامل
        </button>
      </PageTitle>

      {/* Stats */}
      <div className="nx-stats-grid">
        {[
          { label: 'ناجح', value: successCount, color: '#34D399', icon: CheckCircle },
          { label: 'فشل', value: failCount, color: '#F87171', icon: XCircle },
          { label: 'لم يتم أبداً', value: neverCount, color: '#A78BFA', icon: AlertTriangle },
          { label: 'الحجم الإجمالي', value: totalSize > 0 ? `${totalSize} MB` : '—', color: '#C9A84C', icon: HardDrive },
        ].map(k => {
          const Icon = k.icon;
          return (
            <Glass key={k.label} hover>
              <div className="nx-stat">
                <div className="nx-stat-icon" style={{ background: `${k.color}10` }}>
                  <Icon size={16} style={{ color: k.color, opacity: 0.8 }} strokeWidth={1.5} />
                </div>
                <div>
                  <div className="nx-stat-label">{k.label}</div>
                  <div className="nx-stat-value" style={TN}>{loading ? '—' : k.value}</div>
                </div>
              </div>
            </Glass>
          );
        })}
      </div>

      {/* Search */}
      <Glass>
        <div style={{ padding: 14 }}>
          <div className="nx-input-icon" style={{ maxWidth: 320 }}>
            <Search size={16} />
            <input className="nx-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالصالون..." />
          </div>
        </div>
      </Glass>

      {/* Table */}
      <Glass>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Loader2 size={28} className="mx-auto animate-spin" style={{ color: 'var(--gold)' }} />
            <p style={{ fontSize: 13, color: 'var(--ghost)', marginTop: 12 }}>جاري تحميل الصالونات...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <HardDrive size={32} style={{ color: 'var(--ghost)', margin: '0 auto 12px', display: 'block' }} />
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--muted)' }}>لا توجد صالونات</p>
            <p style={{ fontSize: 12, color: 'var(--ghost)', marginTop: 4 }}>سيظهر هنا عند تسجيل أول صالون</p>
          </div>
        ) : (
          <div className="nx-table-mobile-wrap">
            <table className="nx-table">
              <thead>
                <tr>
                  <th>الصالون</th>
                  <th>آخر نسخة</th>
                  <th>منذ</th>
                  <th>الحجم</th>
                  <th>المنفّذ</th>
                  <th>تلقائي</th>
                  <th>الحالة</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => {
                  const status = (b.status || 'never') as BackupStatus;
                  const st = ST[status] || ST.never;
                  const days = daysSince(b.lastBackup);
                  const isOld = days !== null && days > 3;
                  return (
                    <tr key={b.id}>
                      <td className="nx-td-primary">{b.salonName}</td>
                      <td style={TN}>
                        {b.lastBackup
                          ? new Date(b.lastBackup).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : <span style={{ color: 'var(--ghost)' }}>—</span>
                        }
                      </td>
                      <td>
                        {days !== null ? (
                          <span style={{ fontSize: 12, fontWeight: 700, color: isOld ? '#FBBF24' : '#34D399', ...TN }}>
                            {days === 0 ? 'اليوم' : `${days} يوم`}
                          </span>
                        ) : (
                          <span style={{ color: '#F87171', fontSize: 12, fontWeight: 600 }}>لم يتم</span>
                        )}
                      </td>
                      <td style={TN}>{b.size}</td>
                      <td style={{ fontSize: 12 }}>{b.initiator}</td>
                      <td>
                        {b.autoBackup ? (
                          <span className="nx-badge nx-badge--green"><CheckCircle size={11} /> مفعّل</span>
                        ) : (
                          <span className="nx-badge nx-badge--red"><XCircle size={11} /> معطّل</span>
                        )}
                      </td>
                      <td>
                        <span className={`nx-badge ${st.badge}`}><st.icon size={11} />{st.label}</span>
                      </td>
                      <td>
                        <button
                          className="nx-btn"
                          style={{ padding: '6px 10px', fontSize: 11 }}
                          onClick={() => triggerBackup(b.id)}
                          disabled={backing === b.id}
                        >
                          {backing === b.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <><Download size={12} /> نسخ</>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Glass>

      {/* Warning for overdue backups */}
      {!loading && (failCount > 0 || neverCount > 0) && (
        <Glass>
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(248,113,113,0.08)' }}>
              <Shield size={18} style={{ color: '#F87171' }} />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate)' }}>
                تنبيه أمان
              </p>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                {neverCount > 0 && `${neverCount} صالون لم يتم نسخه احتياطياً أبداً. `}
                {failCount > 0 && `${failCount} عملية نسخ فشلت. `}
                يرجى المعالجة فوراً.
              </p>
            </div>
          </div>
        </Glass>
      )}
    </div>
  );
}
