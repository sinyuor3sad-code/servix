'use client';

import { useState, type ReactElement } from 'react';
import {
  Bell, Send, CheckCheck, Clock, AlertTriangle, Plus, Search,
  Eye, Mail, Smartphone, X, Megaphone, BarChart3,
} from 'lucide-react';
import { Glass, PageTitle, TN } from '@/components/ui/glass';

type NStatus = 'sent' | 'scheduled' | 'draft';
type NChannel = 'sms' | 'email' | 'push' | 'whatsapp';

interface Notif {
  id: string; title: string; body: string; target: string;
  channel: NChannel; status: NStatus; sentAt: string | null;
  recipients: number; opened: number; delivered: number;
}

const DATA: Notif[] = [
  { id: '1', title: 'تحديث شروط الاستخدام', body: 'تم تحديث سياسة الخصوصية والشروط — يرجى المراجعة.', target: 'جميع الشركات', channel: 'email', status: 'sent', sentAt: '2026-03-20', recipients: 47, opened: 38, delivered: 47 },
  { id: '2', title: 'عرض رمضان — خصم 30%', body: 'استخدم كود RAMADAN30 للحصول على خصم 30% على أي باقة.', target: 'Basic فقط', channel: 'sms', status: 'sent', sentAt: '2026-03-15', recipients: 12, opened: 9, delivered: 12 },
  { id: '3', title: 'تذكير بتجديد الاشتراك', body: 'اشتراكك ينتهي خلال 3 أيام — جدّد الآن للاستمرار.', target: 'منتهي قريباً', channel: 'whatsapp', status: 'scheduled', sentAt: '2026-03-28', recipients: 3, opened: 0, delivered: 0 },
  { id: '4', title: 'إطلاق ميزة واتساب بزنس', body: 'الآن يمكنك ربط واتساب بزنس من الإعدادات — مجاناً لباقة Enterprise.', target: 'Enterprise', channel: 'push', status: 'sent', sentAt: '2026-03-10', recipients: 7, opened: 7, delivered: 7 },
  { id: '5', title: 'صيانة مجدولة — 2 أبريل', body: 'ستتم صيانة الخوادم يوم 2 أبريل من 2-4 صباحاً. قد يتأثر الأداء.', target: 'جميع الشركات', channel: 'email', status: 'draft', sentAt: null, recipients: 0, opened: 0, delivered: 0 },
  { id: '6', title: 'ميزة جديدة: التسعير الذكي', body: 'أصبح التسعير الديناميكي متاحاً لباقة Pro و Enterprise.', target: 'Pro + Enterprise', channel: 'push', status: 'sent', sentAt: '2026-03-05', recipients: 35, opened: 28, delivered: 34 },
];

const ST_CFG: Record<NStatus, { label: string; badge: string; icon: typeof CheckCheck }> = {
  sent:      { label: 'مُرسل', badge: 'nx-badge--green', icon: CheckCheck },
  scheduled: { label: 'مجدول', badge: 'nx-badge--amber', icon: Clock },
  draft:     { label: 'مسودة', badge: 'nx-badge--violet', icon: AlertTriangle },
};

const CH_CFG: Record<NChannel, { label: string; icon: typeof Mail; color: string }> = {
  email:    { label: 'بريد',   icon: Mail,       color: '#60A5FA' },
  sms:      { label: 'SMS',    icon: Smartphone, color: '#34D399' },
  push:     { label: 'Push',   icon: Bell,       color: '#A78BFA' },
  whatsapp: { label: 'واتساب', icon: Send,       color: '#4ADE80' },
};

export default function NotificationsPage(): ReactElement {
  const [search, setSearch] = useState('');
  const [statusF, setStatusF] = useState<NStatus | ''>('');
  const [preview, setPreview] = useState<Notif | null>(null);

  const filtered = DATA.filter(n => {
    if (search && !n.title.includes(search)) return false;
    if (statusF && n.status !== statusF) return false;
    return true;
  });

  const totalSent = DATA.filter(n => n.status === 'sent').reduce((s, n) => s + n.recipients, 0);
  const totalOpened = DATA.filter(n => n.status === 'sent').reduce((s, n) => s + n.opened, 0);
  const totalDelivered = DATA.filter(n => n.status === 'sent').reduce((s, n) => s + n.delivered, 0);
  const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;

  return (
    <div className="nx-space-y">
      <PageTitle title="الإشعارات الجماعية" desc="إرسال إشعارات وتنبيهات لجميع الشركات أو مجموعة محددة"
        icon={<Bell size={20} style={{ color: '#A78BFA' }} strokeWidth={1.5} />}
      >
        <button className="nx-btn nx-btn--primary">
          <Plus size={16} /> إشعار جديد
        </button>
      </PageTitle>

      {/* Stats */}
      <div className="nx-stats-grid">
        {[
          { label: 'إجمالي المُرسل', value: totalSent, icon: Send, color: '#34D399' },
          { label: 'تم التوصيل', value: totalDelivered, icon: CheckCheck, color: '#60A5FA' },
          { label: 'تم الفتح', value: totalOpened, icon: Eye, color: '#A78BFA' },
          { label: 'معدل الفتح', value: `${openRate}%`, icon: BarChart3, color: '#C9A84C' },
        ].map(k => {
          const Icon = k.icon;
          return (
            <Glass key={k.label} hover>
              <div className="nx-stat">
                <div className="nx-stat-icon" style={{ background: `${k.color}10` }}>
                  <Icon size={18} style={{ color: k.color, opacity: 0.8 }} strokeWidth={1.5} />
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

      {/* Filters */}
      <Glass>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 14 }}>
          <div className="nx-input-icon" style={{ flex: 1, minWidth: 200 }}>
            <Search size={16} />
            <input className="nx-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بعنوان الإشعار..." />
          </div>
          <select className="nx-select" value={statusF} onChange={e => setStatusF(e.target.value as NStatus | '')}>
            <option value="">جميع الحالات</option>
            <option value="sent">مُرسل</option>
            <option value="scheduled">مجدول</option>
            <option value="draft">مسودة</option>
          </select>
          {(search || statusF) && (
            <button className="nx-btn" onClick={() => { setSearch(''); setStatusF(''); }}>
              <X size={14} /> مسح
            </button>
          )}
        </div>
      </Glass>

      {/* Table + Preview */}
      <div className="nx-grid-2" style={{ gridTemplateColumns: '1fr 360px' }}>
        <Glass>
          <div className="nx-table-mobile-wrap"><table className="nx-table">
            <thead>
              <tr>
                <th>العنوان</th>
                <th>القناة</th>
                <th>المستهدفون</th>
                <th>المستلمين</th>
                <th>الفتح</th>
                <th>التاريخ</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((n) => {
                const st = ST_CFG[n.status];
                const ch = CH_CFG[n.channel];
                const ChI = ch.icon;
                const selected = preview?.id === n.id;
                return (
                  <tr key={n.id} onClick={() => setPreview(n)} style={{ cursor: 'pointer', background: selected ? 'var(--gold-subtle)' : undefined }}>
                    <td className="nx-td-primary">{n.title}</td>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: ch.color }}>
                        <ChI size={12} />{ch.label}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>{n.target}</td>
                    <td style={TN}>{n.recipients || '—'}</td>
                    <td style={TN}>
                      {n.recipients > 0
                        ? <span style={{ fontSize: 12, fontWeight: 700, color: '#A78BFA' }}>{Math.round((n.opened / n.recipients) * 100)}%</span>
                        : <span style={{ color: 'var(--ghost)' }}>—</span>
                      }
                    </td>
                    <td style={TN}>{n.sentAt ? new Date(n.sentAt).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' }) : '—'}</td>
                    <td><span className={`nx-badge ${st.badge}`}><st.icon size={11} />{st.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </Glass>

        {/* Preview */}
        <Glass>
          <div style={{ padding: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Eye size={16} style={{ color: 'var(--ghost)' }} />معاينة الإشعار
            </h3>
            {preview ? (
              <div className="nx-space-y">
                <div style={{ padding: 16, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--slate)' }}>{preview.title}</p>
                  <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--muted)', marginTop: 8 }}>{preview.body}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                  {[
                    ['المستهدفون', preview.target],
                    ['القناة', CH_CFG[preview.channel].label],
                    ['المستلمين', preview.recipients],
                    ['تم التوصيل', preview.delivered],
                    ['تم الفتح', preview.opened],
                  ].map(([k, v]) => (
                    <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--ghost)' }}>{k}</span>
                      <span style={{ fontWeight: 700, color: 'var(--muted)', ...TN }}>{v}</span>
                    </div>
                  ))}
                </div>
                {preview.recipients > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
                      <span style={{ color: 'var(--ghost)' }}>معدل الفتح</span>
                      <span style={{ fontWeight: 700, color: 'var(--gold)' }}>{Math.round((preview.opened / preview.recipients) * 100)}%</span>
                    </div>
                    <div className="nx-progress">
                      <div className="nx-progress-fill" style={{ width: `${(preview.opened / preview.recipients) * 100}%`, background: 'var(--gold)' }} />
                    </div>
                  </div>
                )}
                {preview.status === 'draft' && (
                  <button className="nx-btn nx-btn--primary" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}>
                    <Send size={14} /> إرسال الآن
                  </button>
                )}
              </div>
            ) : (
              <div className="nx-empty" style={{ padding: '30px 0' }}>
                <div className="nx-empty-icon"><Megaphone size={20} /></div>
                <p className="nx-empty-desc">اختر إشعاراً لعرض تفاصيله</p>
              </div>
            )}
          </div>
        </Glass>
      </div>
    </div>
  );
}
