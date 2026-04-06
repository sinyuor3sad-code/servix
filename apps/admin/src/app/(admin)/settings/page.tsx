'use client';

import { useState, useEffect, useCallback, type ReactElement } from 'react';
import {
  Settings, Globe, Mail, Shield, Database, Palette, Wrench,
  Save, Key, Gauge, Construction, Server, Eye, EyeOff,
  CheckCircle, AlertTriangle, Loader2,
} from 'lucide-react';
import { Glass, PageTitle } from '@/components/ui/glass';
import { adminService } from '@/services/admin.service';

type Tab = 'general' | 'security' | 'billing' | 'gateways' | 'appearance' | 'advanced';

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'general', label: 'عام', icon: Globe },
  { key: 'security', label: 'الأمان', icon: Shield },
  { key: 'billing', label: 'الفوترة', icon: Database },
  { key: 'gateways', label: 'البوابات', icon: Mail },
  { key: 'appearance', label: 'المظهر', icon: Palette },
  { key: 'advanced', label: 'متقدم', icon: Wrench },
];

// Default settings keys and their initial values
const DEFAULTS: Record<string, string> = {
  platform_name: 'SERVIX',
  platform_url: 'https://app.servi-x.com',
  default_lang: 'العربية',
  version: 'v3.0.0',
  environment: 'Production',
  timezone: 'Asia/Riyadh',
  session_duration: '30',
  max_login_attempts: '5',
  lockout_duration: '15',
  two_factor_enabled: 'false',
  force_password_change: 'false',
  api_key: '',
  webhook_secret: '',
  payment_gateway: 'Moyasar',
  vat_rate: '15',
  currency: 'SAR',
  moyasar_api_key: '',
  moyasar_secret: '',
  smtp_host: 'smtp.servi-x.com',
  smtp_port: '587',
  smtp_from: 'noreply@servi-x.com',
  smtp_username: 'noreply@servi-x.com',
  smtp_password: '',
  sms_provider: 'Unifonic',
  sms_app_id: '',
  sms_sender_id: 'SERVIX',
  theme: 'Obsidian Nexus (Dark)',
  primary_color: '#eab308',
  secondary_color: '#a78bfa',
  show_footer_logo: 'true',
  compact_mode: 'false',
  rate_limit_rpm: '100',
  rate_limit_login: '5 / 15 دقيقة',
  lockout_time: '15 دقيقة',
  maintenance_mode: 'false',
  maintenance_message: 'المنصة تحت الصيانة — نعود قريباً',
  backup_frequency: 'يومياً 3:00 صباحاً',
  last_backup: '',
  backup_retention: '30 يوم',
  auto_backup: 'true',
};

function Field({ label, settingKey, settings, onChange, type = 'text', dir }: {
  label: string; settingKey: string; settings: Record<string, string>;
  onChange: (key: string, value: string) => void;
  type?: 'text' | 'select' | 'password' | 'toggle'; dir?: string;
}) {
  const [show, setShow] = useState(false);
  const value = settings[settingKey] ?? DEFAULTS[settingKey] ?? '';

  if (type === 'toggle') {
    const on = value === 'true';
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>{label}</span>
        <button onClick={() => onChange(settingKey, on ? 'false' : 'true')} className={`nx-toggle ${on ? 'nx-toggle--on' : ''}`}>
          <span className="nx-toggle-knob" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--ghost)' }}>{label}</label>
      {type === 'select' ? (
        <select className="nx-select" style={{ width: '100%' }} value={value} onChange={e => onChange(settingKey, e.target.value)}>
          <option>{value}</option>
        </select>
      ) : type === 'password' ? (
        <div style={{ position: 'relative' }}>
          <input type={show ? 'text' : 'password'} value={value} onChange={e => onChange(settingKey, e.target.value)} dir={dir}
            className="nx-input" style={{ width: '100%', paddingRight: dir === 'ltr' ? 14 : 38, fontFamily: 'monospace' }} />
          <button onClick={() => setShow(!show)} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--ghost)', cursor: 'pointer' }}>
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      ) : (
        <input value={value} onChange={e => onChange(settingKey, e.target.value)} dir={dir} className="nx-input" style={{ width: '100%' }} />
      )}
    </div>
  );
}

function Section({ icon: Icon, title, desc, children }: { icon: React.ElementType; title: string; desc: string; children: React.ReactNode }) {
  return (
    <Glass hover>
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div className="nx-stat-icon" style={{ width: 40, height: 40, background: 'rgba(201,168,76,0.06)' }}>
            <Icon size={18} style={{ color: 'var(--gold)', opacity: 0.7 }} strokeWidth={1.5} />
          </div>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--slate)' }}>{title}</h3>
            <p style={{ fontSize: 12, color: 'var(--ghost)' }}>{desc}</p>
          </div>
        </div>
        {children}
      </div>
    </Glass>
  );
}

export default function SettingsPage(): ReactElement {
  const [tab, setTab] = useState<Tab>('general');
  const [settings, setSettings] = useState<Record<string, string>>({ ...DEFAULTS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    adminService.getSettings()
      .then(data => {
        setSettings(prev => ({ ...prev, ...(data || {}) }));
      })
      .catch(() => { /* use defaults */ })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = useCallback((key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setDirty(true);
    setSaved(false);
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await adminService.updateSettings(settings);
      setSaved(true);
      setDirty(false);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      alert('فشل حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="nx-space-y">
        <PageTitle title="الإعدادات" desc="جاري تحميل الإعدادات..." />
        <Glass>
          <div style={{ padding: 60, textAlign: 'center' }}>
            <Loader2 size={28} className="mx-auto animate-spin" style={{ color: 'var(--gold)' }} />
          </div>
        </Glass>
      </div>
    );
  }

  return (
    <div className="nx-space-y">
      <PageTitle title="الإعدادات" desc="إعدادات المنصة العامة والأمان والبوابات"
        icon={<Settings size={20} style={{ color: 'var(--gold)' }} strokeWidth={1.5} />}
      >
        <button className="nx-btn nx-btn--primary" onClick={save} disabled={saving || (!dirty && !saved)}>
          {saving ? <><Loader2 size={15} className="animate-spin" /> جاري الحفظ...</>
            : saved ? <><CheckCircle size={15} /> تم الحفظ</>
            : <><Save size={15} /> حفظ التغييرات</>}
        </button>
      </PageTitle>

      {/* Tabs */}
      <Glass>
        <div style={{ display: 'flex', gap: 4, padding: 8, overflowX: 'auto' }}>
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={key === tab ? 'nx-btn nx-btn--primary' : 'nx-btn'}
              style={{ whiteSpace: 'nowrap', fontSize: 13 }}
            >
              <Icon size={15} strokeWidth={key === tab ? 2 : 1.5} />{label}
            </button>
          ))}
        </div>
      </Glass>

      {/* Content */}
      <div className="nx-space-y">
        {tab === 'general' && (
          <>
            <Section icon={Globe} title="إعدادات المنصة" desc="الاسم والرابط واللغة">
              <div className="nx-grid-3">
                <Field label="اسم المنصة" settingKey="platform_name" settings={settings} onChange={handleChange} />
                <Field label="رابط المنصة" settingKey="platform_url" settings={settings} onChange={handleChange} dir="ltr" />
                <Field label="اللغة الافتراضية" settingKey="default_lang" settings={settings} onChange={handleChange} type="select" />
              </div>
            </Section>
            <Section icon={Server} title="معلومات النظام" desc="إصدار المنصة والبيئة">
              <div className="nx-grid-3">
                <Field label="الإصدار" settingKey="version" settings={settings} onChange={handleChange} />
                <Field label="البيئة" settingKey="environment" settings={settings} onChange={handleChange} type="select" />
                <Field label="المنطقة الزمنية" settingKey="timezone" settings={settings} onChange={handleChange} type="select" />
              </div>
            </Section>
          </>
        )}

        {tab === 'security' && (
          <>
            <Section icon={Shield} title="الحماية" desc="إعدادات الأمان والتوثيق">
              <div className="nx-grid-3">
                <Field label="مدة الجلسة (دقيقة)" settingKey="session_duration" settings={settings} onChange={handleChange} />
                <Field label="محاولات الدخول القصوى" settingKey="max_login_attempts" settings={settings} onChange={handleChange} />
                <Field label="مدة الحظر (دقيقة)" settingKey="lockout_duration" settings={settings} onChange={handleChange} />
              </div>
              <div className="nx-space-y" style={{ marginTop: 16 }}>
                <div style={{ position: 'relative', opacity: 0.5 }}>
                  <Field label="التوثيق الثنائي (2FA)" settingKey="two_factor_enabled" settings={{ two_factor_enabled: 'false' }} onChange={() => {}} type="toggle" />
                  <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 10, fontWeight: 700, color: 'var(--gold)', background: 'rgba(201,168,76,0.12)', padding: '2px 8px', borderRadius: 6 }}>قريباً</span>
                </div>
                <div style={{ position: 'relative', opacity: 0.5 }}>
                  <Field label="إجبار تغيير كلمة المرور كل 90 يوم" settingKey="force_password_change" settings={{ force_password_change: 'false' }} onChange={() => {}} type="toggle" />
                  <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 10, fontWeight: 700, color: 'var(--gold)', background: 'rgba(201,168,76,0.12)', padding: '2px 8px', borderRadius: 6 }}>قريباً</span>
                </div>
              </div>
            </Section>
            <Section icon={Key} title="API Keys" desc="مفاتيح الوصول للتكاملات">
              <div className="nx-grid-2">
                <Field label="Platform API Key" settingKey="api_key" settings={settings} onChange={handleChange} type="password" dir="ltr" />
                <Field label="Webhook Secret" settingKey="webhook_secret" settings={settings} onChange={handleChange} type="password" dir="ltr" />
              </div>
            </Section>
          </>
        )}

        {tab === 'billing' && (
          <Section icon={Database} title="إعدادات الفوترة" desc="بوابات الدفع والضرائب">
            <div className="nx-grid-3">
              <Field label="بوابة الدفع" settingKey="payment_gateway" settings={settings} onChange={handleChange} type="select" />
              <Field label="نسبة الضريبة (VAT) %" settingKey="vat_rate" settings={settings} onChange={handleChange} />
              <Field label="العملة" settingKey="currency" settings={settings} onChange={handleChange} type="select" />
            </div>
            <div className="nx-grid-2" style={{ marginTop: 16 }}>
              <Field label="Moyasar API Key" settingKey="moyasar_api_key" settings={settings} onChange={handleChange} type="password" dir="ltr" />
              <Field label="Moyasar Secret" settingKey="moyasar_secret" settings={settings} onChange={handleChange} type="password" dir="ltr" />
            </div>
          </Section>
        )}

        {tab === 'gateways' && (
          <>
            <Section icon={Mail} title="البريد الإلكتروني (SMTP)" desc="خادم البريد لإرسال الإشعارات">
              <div className="nx-grid-3">
                <Field label="SMTP Host" settingKey="smtp_host" settings={settings} onChange={handleChange} dir="ltr" />
                <Field label="المنفذ" settingKey="smtp_port" settings={settings} onChange={handleChange} />
                <Field label="البريد المرسل" settingKey="smtp_from" settings={settings} onChange={handleChange} dir="ltr" />
              </div>
              <div className="nx-grid-2" style={{ marginTop: 16 }}>
                <Field label="SMTP Username" settingKey="smtp_username" settings={settings} onChange={handleChange} dir="ltr" />
                <Field label="SMTP Password" settingKey="smtp_password" settings={settings} onChange={handleChange} type="password" dir="ltr" />
              </div>
            </Section>
            <Section icon={Mail} title="SMS Gateway" desc="بوابة الرسائل النصية">
              <div className="nx-grid-3">
                <Field label="المزود" settingKey="sms_provider" settings={settings} onChange={handleChange} type="select" />
                <Field label="App ID" settingKey="sms_app_id" settings={settings} onChange={handleChange} type="password" dir="ltr" />
                <Field label="Sender ID" settingKey="sms_sender_id" settings={settings} onChange={handleChange} />
              </div>
            </Section>
          </>
        )}

        {tab === 'appearance' && (
          <Section icon={Palette} title="المظهر" desc="تخصيص مظهر لوحة الإدارة">
            <div className="nx-grid-3">
              <Field label="الثيم" settingKey="theme" settings={settings} onChange={handleChange} type="select" />
              <Field label="اللون الرئيسي" settingKey="primary_color" settings={settings} onChange={handleChange} />
              <Field label="اللون الثانوي" settingKey="secondary_color" settings={settings} onChange={handleChange} />
            </div>
            <div className="nx-space-y" style={{ marginTop: 16 }}>
              <Field label="عرض شعار SERVIX في الأسفل" settingKey="show_footer_logo" settings={settings} onChange={handleChange} type="toggle" />
              <Field label="Compact Mode" settingKey="compact_mode" settings={settings} onChange={handleChange} type="toggle" />
            </div>
          </Section>
        )}

        {tab === 'advanced' && (
          <>
            <Section icon={Gauge} title="Rate Limiting" desc="حماية API من الاستخدام المفرط">
              <div className="nx-grid-3">
                <Field label="حد الطلبات (requests/min)" settingKey="rate_limit_rpm" settings={settings} onChange={handleChange} />
                <Field label="حد تسجيل الدخول" settingKey="rate_limit_login" settings={settings} onChange={handleChange} />
                <Field label="مدة الحظر" settingKey="lockout_time" settings={settings} onChange={handleChange} />
              </div>
            </Section>
            <Section icon={Construction} title="وضع الصيانة" desc="إيقاف المنصة مؤقتاً للصيانة">
              <div className="nx-space-y">
                <Field label="تفعيل وضع الصيانة" settingKey="maintenance_mode" settings={settings} onChange={handleChange} type="toggle" />
                <Field label="رسالة الصيانة" settingKey="maintenance_message" settings={settings} onChange={handleChange} />
                <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.12)' }}>
                  <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--gold)' }}>
                    <AlertTriangle size={14} /> تنبيه: تفعيل وضع الصيانة سيمنع جميع الصالونات من الوصول
                  </p>
                </div>
              </div>
            </Section>
            <Section icon={Database} title="النسخ الاحتياطي" desc="جدولة وإدارة النسخ الاحتياطية">
              <div style={{ opacity: 0.5, pointerEvents: 'none', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 8, left: 8, fontSize: 10, fontWeight: 700, color: 'var(--gold)', background: 'rgba(201,168,76,0.12)', padding: '2px 8px', borderRadius: 6, zIndex: 2 }}>قريباً — يتطلب إصلاح حاوية النسخ الاحتياطي</div>
                <div className="nx-grid-3">
                  <Field label="التكرار" settingKey="backup_frequency" settings={settings} onChange={() => {}} type="select" />
                  <Field label="آخر نسخة ناجحة" settingKey="last_backup" settings={settings} onChange={() => {}} />
                  <Field label="مدة الاحتفاظ" settingKey="backup_retention" settings={settings} onChange={() => {}} type="select" />
                </div>
                <div style={{ marginTop: 12 }}>
                  <Field label="النسخ الاحتياطي التلقائي" settingKey="auto_backup" settings={settings} onChange={() => {}} type="toggle" />
                </div>
              </div>
            </Section>
          </>
        )}
      </div>

      {/* Dirty indicator */}
      {dirty && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          padding: '10px 24px', borderRadius: 14,
          background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.25)',
          backdropFilter: 'blur(12px)', zIndex: 50,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold)' }}>لديك تغييرات غير محفوظة</span>
          <button onClick={save} disabled={saving}
            style={{
              padding: '6px 16px', borderRadius: 10, border: 'none',
              background: 'var(--gold)', color: '#000', fontSize: 12, fontWeight: 700,
              cursor: 'pointer',
            }}>
            {saving ? 'جاري...' : 'حفظ'}
          </button>
        </div>
      )}
    </div>
  );
}
