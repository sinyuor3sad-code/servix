'use client';

import { useState, type ReactElement, type CSSProperties } from 'react';
import {
  Bell, Send, CheckCheck, Clock, AlertTriangle, Plus, Search,
  Eye, Mail, Smartphone, X, Megaphone, BarChart3, Loader2,
  Save, Users, Zap, MessageSquare, Hash, FileText,
} from 'lucide-react';
import { Glass, PageTitle } from '@/components/ui/glass';

const EN: CSSProperties = {
  fontFeatureSettings: '"tnum" 1', fontVariantNumeric: 'tabular-nums',
  fontFamily: '"Inter","Outfit",system-ui,sans-serif', direction: 'ltr' as const, unicodeBidi: 'embed' as const,
};

type NStatus = 'sent' | 'scheduled' | 'draft';
type NChannel = 'sms' | 'email' | 'push' | 'whatsapp';

interface Notif {
  id: string; title: string; body: string; target: string;
  channel: NChannel; status: NStatus; sentAt: string | null;
  recipients: number; opened: number; delivered: number;
}

// Note: Notifications are client-side only until backend notification system is built
const INITIAL_DATA: Notif[] = [];

const ST_CFG: Record<NStatus, { label: string; badge: string; icon: typeof CheckCheck }> = {
  sent:      { label: 'مُرسل', badge: 'nx-badge--green', icon: CheckCheck },
  scheduled: { label: 'مجدول', badge: 'nx-badge--amber', icon: Clock },
  draft:     { label: 'مسودة', badge: 'nx-badge--violet', icon: AlertTriangle },
};

const CH_CFG: Record<NChannel, { label: string; labelEn: string; icon: typeof Mail; color: string }> = {
  email:    { label: 'بريد إلكتروني', labelEn: 'Email',    icon: Mail,         color: '#60A5FA' },
  sms:      { label: 'رسالة SMS',     labelEn: 'SMS',      icon: Smartphone,   color: '#34D399' },
  push:     { label: 'إشعار فوري',    labelEn: 'Push',     icon: Bell,         color: '#A78BFA' },
  whatsapp: { label: 'واتساب',        labelEn: 'WhatsApp', icon: MessageSquare, color: '#4ADE80' },
};

const TARGETS = [
  { value: 'all',         label: 'جميع الشركات',         desc: 'إرسال لكل المشتركين' },
  { value: 'basic',       label: 'باقة أساسي',           desc: 'فقط مشتركي Basic' },
  { value: 'pro',         label: 'باقة احترافي',         desc: 'فقط مشتركي Pro' },
  { value: 'enterprise',  label: 'باقة مؤسسات',          desc: 'فقط مشتركي Enterprise' },
  { value: 'expiring',    label: 'اشتراك منتهي قريباً', desc: 'ينتهي خلال 7 أيام' },
  { value: 'trial',       label: 'فترة تجريبية',        desc: 'صالونات في فترة التجربة' },
];

/* ═══════════════════════════════════════════════════ */
/*  CREATE NOTIFICATION MODAL — Premium Design        */
/* ═══════════════════════════════════════════════════ */

function CreateNotifModal({ onClose, onCreated }: { onClose: () => void; onCreated: (n: Notif) => void }) {
  const [step, setStep] = useState(1); // 1: compose, 2: target, 3: preview
  const [form, setForm] = useState({
    title: '',
    body: '',
    target: 'all',
    channel: 'email' as NChannel,
    saveAsDraft: false,
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const targetInfo = TARGETS.find(t => t.value === form.target) || TARGETS[0];
  const channelInfo = CH_CFG[form.channel];
  const ChIcon = channelInfo.icon;

  const canProceed = step === 1
    ? form.title.trim().length > 0 && form.body.trim().length > 0
    : true;

  const handleSend = () => {
    setSending(true);
    setTimeout(() => {
      const newNotif: Notif = {
        id: `${Date.now()}`,
        title: form.title,
        body: form.body,
        target: targetInfo.label,
        channel: form.channel,
        status: form.saveAsDraft ? 'draft' : 'sent',
        sentAt: form.saveAsDraft ? null : new Date().toISOString().slice(0, 10),
        recipients: form.saveAsDraft ? 0 : 0,
        opened: 0,
        delivered: 0,
      };
      setSending(false);
      setSent(true);
      setTimeout(() => onCreated(newNotif), 800);
    }, 1500);
  };

  const stepIndicator = (
    <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 24 }}>
      {[1, 2, 3].map(s => (
        <div key={s} style={{
          width: s === step ? 28 : 8, height: 4, borderRadius: 2,
          background: s <= step ? '#A78BFA' : 'var(--border)',
          transition: 'all 0.3s',
        }} />
      ))}
    </div>
  );

  return (
    <div className="nx-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ backdropFilter: 'blur(8px)' }}>
      <div className="nx-modal" style={{
        maxWidth: 560, borderRadius: 20, overflow: 'hidden',
        border: '1px solid #A78BFA20',
        boxShadow: '0 25px 80px rgba(0,0,0,0.5), 0 0 60px #A78BFA08',
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 28px',
          background: 'linear-gradient(135deg, #A78BFA15, #A78BFA08)',
          borderBottom: '1px solid #A78BFA15',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#A78BFA18', border: '1px solid #A78BFA25',
            }}>
              <Megaphone size={20} style={{ color: '#A78BFA' }} strokeWidth={1.6} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--slate)', margin: 0 }}>
                {step === 1 ? 'كتابة الإشعار' : step === 2 ? 'اختيار المستهدفين' : 'معاينة وإرسال'}
              </h3>
              <p style={{ fontSize: 11, color: 'var(--ghost)', margin: 0 }}>
                الخطوة {step} من 3
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

        {/* Body */}
        <div style={{ padding: '24px 28px', minHeight: 300, display: 'flex', flexDirection: 'column' }}>
          {stepIndicator}

          {/* Step 1: Compose */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ghost)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  عنوان الإشعار *
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: '#A78BFA12',
                  }}>
                    <FileText size={13} style={{ color: '#A78BFA', opacity: 0.7 }} />
                  </div>
                  <input className="nx-input"
                    placeholder="مثال: تحديث جديد في المنصة"
                    value={form.title}
                    onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))}
                    style={{ paddingRight: 48, height: 46, borderRadius: 12, fontSize: 14, fontWeight: 600 }}
                  />
                </div>
                {form.title.length > 0 && (
                  <span style={{ fontSize: 10, color: 'var(--ghost)', ...EN }}>{form.title.length}/100</span>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ghost)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  نص الإشعار *
                </label>
                <textarea className="nx-input"
                  placeholder="اكتب محتوى الإشعار الذي سيصل للمشتركين..."
                  value={form.body}
                  onChange={(e) => setForm(p => ({ ...p, body: e.target.value }))}
                  style={{
                    flex: 1, minHeight: 120, resize: 'vertical', borderRadius: 12,
                    fontSize: 13, fontWeight: 500, padding: '14px 16px', lineHeight: 1.8,
                  }}
                />
                {form.body.length > 0 && (
                  <span style={{ fontSize: 10, color: 'var(--ghost)', ...EN }}>{form.body.length}/500</span>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Target & Channel */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, flex: 1 }}>
              {/* Target Selection */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#A78BFA', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Users size={13} /> المستهدفون
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {TARGETS.map(t => (
                    <button key={t.value} onClick={() => setForm(p => ({ ...p, target: t.value }))} style={{
                      padding: '12px 14px', borderRadius: 12, border: `1px solid ${form.target === t.value ? '#A78BFA40' : 'var(--border)'}`,
                      background: form.target === t.value ? '#A78BFA10' : 'var(--surface)',
                      cursor: 'pointer', textAlign: 'right', transition: 'all 0.2s',
                    }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: form.target === t.value ? '#A78BFA' : 'var(--muted)', margin: 0 }}>
                        {t.label}
                      </p>
                      <p style={{ fontSize: 10, color: 'var(--ghost)', margin: '4px 0 0' }}>{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Channel Selection */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#A78BFA', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Zap size={13} /> قناة الإرسال
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {(Object.entries(CH_CFG) as [NChannel, typeof CH_CFG['email']][]).map(([key, ch]) => {
                    const Icon = ch.icon;
                    const selected = form.channel === key;
                    return (
                      <button key={key} onClick={() => setForm(p => ({ ...p, channel: key }))} style={{
                        padding: '14px', borderRadius: 12, border: `1px solid ${selected ? ch.color + '40' : 'var(--border)'}`,
                        background: selected ? ch.color + '10' : 'var(--surface)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.2s',
                      }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: 10,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: selected ? ch.color + '18' : 'transparent',
                        }}>
                          <Icon size={16} style={{ color: selected ? ch.color : 'var(--ghost)' }} />
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: selected ? ch.color : 'var(--muted)', margin: 0 }}>{ch.label}</p>
                          <p style={{ fontSize: 10, color: 'var(--ghost)', margin: 0, ...EN }}>{ch.labelEn}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Draft Toggle */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 18px', borderRadius: 14,
                background: form.saveAsDraft ? '#A78BFA08' : 'var(--surface)',
                border: `1px solid ${form.saveAsDraft ? '#A78BFA20' : 'var(--border)'}`,
              }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate)', margin: 0 }}>حفظ كمسودة</p>
                  <p style={{ fontSize: 11, color: 'var(--ghost)', margin: 0 }}>حفظ بدون إرسال — يمكنك الإرسال لاحقاً</p>
                </div>
                <button onClick={() => setForm(p => ({ ...p, saveAsDraft: !p.saveAsDraft }))} style={{
                  width: 48, height: 26, borderRadius: 13, border: 'none',
                  background: form.saveAsDraft ? '#A78BFA' : '#64748B',
                  position: 'relative', cursor: 'pointer', transition: 'background 0.3s',
                }}>
                  <span style={{
                    position: 'absolute', top: 3,
                    ...(form.saveAsDraft ? { left: 3 } : { right: 3 }),
                    width: 20, height: 20, borderRadius: '50%',
                    background: '#fff', transition: 'all 0.3s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }} />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>
              {sent ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 16, padding: '40px 0' }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: 20, background: '#34D39912', border: '1px solid #34D39925',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <CheckCheck size={28} style={{ color: '#34D399' }} />
                  </div>
                  <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--slate)' }}>
                    {form.saveAsDraft ? 'تم حفظ المسودة!' : 'تم الإرسال بنجاح!'}
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--ghost)' }}>
                    {form.saveAsDraft ? 'يمكنك إرسالها لاحقاً من قائمة الإشعارات' : 'سيصل الإشعار للمستهدفين قريباً'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Preview Card */}
                  <div style={{
                    padding: 20, borderRadius: 16, background: 'var(--surface)',
                    border: '1px solid var(--border)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, background: channelInfo.color + '15',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <ChIcon size={15} style={{ color: channelInfo.color }} />
                      </div>
                      <div>
                        <p style={{ fontSize: 10, color: 'var(--ghost)', margin: 0, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>معاينة الإشعار</p>
                        <p style={{ fontSize: 10, color: channelInfo.color, margin: 0, fontWeight: 600 }}>{channelInfo.label}</p>
                      </div>
                    </div>
                    <h4 style={{ fontSize: 16, fontWeight: 800, color: 'var(--slate)', margin: '0 0 8px' }}>{form.title}</h4>
                    <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--muted)', margin: 0 }}>{form.body}</p>
                  </div>

                  {/* Details */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <p style={{ fontSize: 10, color: 'var(--ghost)', margin: '0 0 4px', fontWeight: 700 }}>المستهدفون</p>
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate)', margin: 0 }}>{targetInfo.label}</p>
                    </div>
                    <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <p style={{ fontSize: 10, color: 'var(--ghost)', margin: '0 0 4px', fontWeight: 700 }}>النوع</p>
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate)', margin: 0 }}>
                        {form.saveAsDraft ? '📝 مسودة' : '🚀 إرسال فوري'}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!sent && (
          <div style={{
            padding: '18px 28px', borderTop: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--surface)',
          }}>
            <button onClick={() => step > 1 ? setStep(step - 1) : onClose()} style={{
              padding: '10px 20px', borderRadius: 12, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--muted)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              {step === 1 ? 'إلغاء' : '← رجوع'}
            </button>

            {step < 3 ? (
              <button onClick={() => setStep(step + 1)} disabled={!canProceed} style={{
                padding: '10px 24px', borderRadius: 12, border: 'none',
                background: canProceed ? 'linear-gradient(135deg, #A78BFA, #A78BFACC)' : '#64748B40',
                color: '#fff', fontSize: 13, fontWeight: 700, cursor: canProceed ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: canProceed ? '0 4px 15px #A78BFA30' : 'none',
              }}>
                التالي →
              </button>
            ) : (
              <button onClick={handleSend} disabled={sending} style={{
                padding: '10px 28px', borderRadius: 12, border: 'none',
                background: form.saveAsDraft
                  ? 'linear-gradient(135deg, #A78BFA, #A78BFACC)'
                  : 'linear-gradient(135deg, #34D399, #34D399CC)',
                color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: `0 4px 15px ${form.saveAsDraft ? '#A78BFA30' : '#34D39930'}`,
                opacity: sending ? 0.7 : 1,
              }}>
                {sending ? <Loader2 size={14} className="nx-spin" />
                  : form.saveAsDraft ? <Save size={14} /> : <Send size={14} />}
                {sending ? 'جاري...' : form.saveAsDraft ? 'حفظ المسودة' : 'إرسال الآن'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════ */
/*  NOTIFICATIONS PAGE — Main                         */
/* ═══════════════════════════════════════════════════ */

export default function NotificationsPage(): ReactElement {
  const [notifications, setNotifications] = useState<Notif[]>(INITIAL_DATA);
  const [search, setSearch] = useState('');
  const [statusF, setStatusF] = useState<NStatus | ''>('');
  const [preview, setPreview] = useState<Notif | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const filtered = notifications.filter(n => {
    if (search && !n.title.includes(search)) return false;
    if (statusF && n.status !== statusF) return false;
    return true;
  });

  const totalSent = notifications.filter(n => n.status === 'sent').reduce((s, n) => s + n.recipients, 0);
  const totalOpened = notifications.filter(n => n.status === 'sent').reduce((s, n) => s + n.opened, 0);
  const totalDelivered = notifications.filter(n => n.status === 'sent').reduce((s, n) => s + n.delivered, 0);
  const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;

  const handleCreated = (n: Notif) => {
    setNotifications(prev => [n, ...prev]);
    setShowCreate(false);
    setPreview(n);
  };

  return (
    <div className="nx-space-y">
      <PageTitle title="الإشعارات الجماعية" desc="إرسال إشعارات وتنبيهات لجميع الشركات أو مجموعة محددة"
        icon={<Bell size={20} style={{ color: '#A78BFA' }} strokeWidth={1.5} />}
      >
        <button className="nx-btn nx-btn--primary" onClick={() => setShowCreate(true)}>
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
                  <div className="nx-stat-value" style={EN}>{k.value}</div>
                </div>
              </div>
            </Glass>
          );
        })}
      </div>

      {/* Content */}
      {notifications.length === 0 ? (
        <Glass>
          <div className="nx-empty" style={{ padding: '60px 20px' }}>
            <div className="nx-empty-icon"><Megaphone size={24} /></div>
            <p className="nx-empty-title">لا توجد إشعارات</p>
            <p className="nx-empty-desc">اضغط "إشعار جديد" لإرسال أول إشعار للمشتركين</p>
            <button className="nx-btn nx-btn--primary" onClick={() => setShowCreate(true)} style={{ marginTop: 16 }}>
              <Plus size={14} /> إنشاء إشعار
            </button>
          </div>
        </Glass>
      ) : (
        <>
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
                            <ChI size={12} />{ch.labelEn}
                          </span>
                        </td>
                        <td style={{ fontSize: 12 }}>{n.target}</td>
                        <td><span className={`nx-badge ${st.badge}`}><st.icon size={11} />{st.label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            </Glass>

            {/* Preview Panel */}
            <Glass>
              <div style={{ padding: 24 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Eye size={16} style={{ color: 'var(--ghost)' }} />معاينة
                </h3>
                {preview ? (
                  <div className="nx-space-y">
                    <div style={{ padding: 16, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--slate)' }}>{preview.title}</p>
                      <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--muted)', marginTop: 8 }}>{preview.body}</p>
                    </div>
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
        </>
      )}

      {/* Create Modal */}
      {showCreate && (
        <CreateNotifModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
