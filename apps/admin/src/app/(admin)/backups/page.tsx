'use client';

import { useState, type ReactElement } from 'react';
import {
  HardDrive, CheckCircle, XCircle, Clock, AlertTriangle,
  Download, RefreshCw, Search, Shield,
} from 'lucide-react';
import { Glass, PageTitle, TN } from '@/components/ui/glass';

type BackupStatus = 'success' | 'failed' | 'pending' | 'never';

const ST: Record<BackupStatus, { label: string; badge: string; icon: typeof CheckCircle }> = {
  success: { label: 'ناجح', badge: 'nx-badge--green', icon: CheckCircle },
  failed: { label: 'فاشل', badge: 'nx-badge--red', icon: XCircle },
  pending: { label: 'جاري...', badge: 'nx-badge--amber', icon: Clock },
  never: { label: 'لم يتم', badge: 'nx-badge--violet', icon: AlertTriangle },
};

interface BackupRecord {
  id: string;
  salonName: string;
  lastBackup: string | null;
  status: BackupStatus;
  size: string;
  initiator: string;
  autoBackup: boolean;
}

// Demo data - will be replaced with real API
const DEMO: BackupRecord[] = [
  { id: '1', salonName: 'صالون الأناقة الملكية', lastBackup: '2026-04-05T08:00:00', status: 'success', size: '42 MB', initiator: 'تلقائي', autoBackup: true },
  { id: '2', salonName: 'عيادة لؤلؤة الجمال', lastBackup: '2026-04-04T03:00:00', status: 'success', size: '28 MB', initiator: 'تلقائي', autoBackup: true },
  { id: '3', salonName: 'صالون بلوم', lastBackup: '2026-03-28T15:30:00', status: 'failed', size: '—', initiator: 'يدوي', autoBackup: false },
  { id: '4', salonName: 'صالون فيرا', lastBackup: '2026-04-05T03:00:00', status: 'success', size: '156 MB', initiator: 'تلقائي', autoBackup: true },
  { id: '5', salonName: 'استوديو ريماس', lastBackup: null, status: 'never', size: '—', initiator: '—', autoBackup: false },
  { id: '6', salonName: 'مركز أوبال', lastBackup: '2026-04-03T03:00:00', status: 'success', size: '18 MB', initiator: 'تلقائي', autoBackup: true },
  { id: '7', salonName: 'صالون غلام', lastBackup: '2026-04-01T12:00:00', status: 'success', size: '35 MB', initiator: 'يدوي', autoBackup: true },
];

export default function BackupsPage(): ReactElement {
  const [search, setSearch] = useState('');
  const [backups, setBackups] = useState(DEMO);
  const [backing, setBacking] = useState<string | null>(null);

  const filtered = backups.filter(b => !search || b.salonName.includes(search));

  const successCount = backups.filter(b => b.status === 'success').length;
  const failCount = backups.filter(b => b.status === 'failed').length;
  const neverCount = backups.filter(b => b.status === 'never').length;
  const totalSize = backups.filter(b => b.size !== '—').reduce((s, b) => s + parseInt(b.size) || 0, 0);

  const triggerBackup = async (id: string) => {
    setBacking(id);
    // Simulate backup
    await new Promise(r => setTimeout(r, 2000));
    setBackups(prev => prev.map(b =>
      b.id === id ? { ...b, status: 'success' as BackupStatus, lastBackup: new Date().toISOString(), initiator: 'يدوي (المدير)', size: Math.floor(Math.random() * 100 + 10) + ' MB' } : b
    ));
    setBacking(null);
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
        desc="مراقبة وإدارة النسخ الاحتياطي لجميع الصالونات"
        icon={<HardDrive size={20} style={{ color: '#6366F1' }} strokeWidth={1.5} />}
      >
        <button className="nx-btn nx-btn--primary" onClick={() => {
          // Trigger backup for all
          DEMO.forEach(b => triggerBackup(b.id));
        }}>
          <RefreshCw size={14} /> نسخ احتياطي شامل
        </button>
      </PageTitle>

      {/* Stats */}
      <div className="nx-stats-grid">
        {[
          { label: 'ناجح', value: successCount, color: '#34D399', icon: CheckCircle },
          { label: 'فشل', value: failCount, color: '#F87171', icon: XCircle },
          { label: 'لم يتم أبداً', value: neverCount, color: '#A78BFA', icon: AlertTriangle },
          { label: 'الحجم الإجمالي', value: `${totalSize} MB`, color: '#C9A84C', icon: HardDrive },
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
                  <div className="nx-stat-value" style={TN}>{k.value}</div>
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
                const st = ST[b.status];
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
                          <span style={{ width: 14, height: 14, border: '2px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', display: 'inline-block' }} />
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
      </Glass>

      {/* Warning for overdue backups */}
      {(failCount > 0 || neverCount > 0) && (
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
