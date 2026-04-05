'use client';

import { useState, type ReactElement } from 'react';
import {
  Settings, Globe, Mail, Shield, Database, Palette, Wrench,
  Save, Key, Gauge, Construction, Server, Eye, EyeOff,
  CheckCircle, AlertTriangle,
} from 'lucide-react';
import { Glass, PageTitle } from '@/components/ui/glass';

type Tab = 'general' | 'security' | 'billing' | 'gateways' | 'appearance' | 'advanced';

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'general', label: 'عام', icon: Globe },
  { key: 'security', label: 'الأمان', icon: Shield },
  { key: 'billing', label: 'الفوترة', icon: Database },
  { key: 'gateways', label: 'البوابات', icon: Mail },
  { key: 'appearance', label: 'المظهر', icon: Palette },
  { key: 'advanced', label: 'متقدم', icon: Wrench },
];

function Field({ label, value, type = 'text', dir }: { label: string; value: string; type?: 'text' | 'select' | 'password' | 'toggle'; dir?: string }) {
  const [show, setShow] = useState(false);
  const [on, setOn] = useState(value === 'true');

  if (type === 'toggle') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>{label}</span>
        <button onClick={() => setOn(!on)} className={`nx-toggle ${on ? 'nx-toggle--on' : ''}`}>
          <span className="nx-toggle-knob" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--ghost)' }}>{label}</label>
      {type === 'select' ? (
        <select className="nx-select" style={{ width: '100%' }}>
          <option>{value}</option>
        </select>
      ) : type === 'password' ? (
        <div style={{ position: 'relative' }}>
          <input type={show ? 'text' : 'password'} defaultValue={value} dir={dir}
            className="nx-input" style={{ width: '100%', paddingRight: dir === 'ltr' ? 14 : 38, fontFamily: 'monospace' }} />
          <button onClick={() => setShow(!show)} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--ghost)', cursor: 'pointer' }}>
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      ) : (
        <input defaultValue={value} dir={dir} className="nx-input" style={{ width: '100%' }} />
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
  const [saved, setSaved] = useState(false);

  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <div className="nx-space-y">
      <PageTitle title="الإعدادات" desc="إعدادات المنصة العامة والأمان والبوابات"
        icon={<Settings size={20} style={{ color: 'var(--gold)' }} strokeWidth={1.5} />}
      >
        <button className="nx-btn nx-btn--primary" onClick={save}>
          {saved ? <><CheckCircle size={15} /> تم الحفظ</> : <><Save size={15} /> حفظ التغييرات</>}
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
                <Field label="اسم المنصة" value="SERVIX" />
                <Field label="رابط المنصة" value="https://app.servi-x.com" dir="ltr" />
                <Field label="اللغة الافتراضية" value="العربية" type="select" />
              </div>
            </Section>
            <Section icon={Server} title="معلومات النظام" desc="إصدار المنصة والبيئة">
              <div className="nx-grid-3">
                <Field label="الإصدار" value="v3.0.0" />
                <Field label="البيئة" value="Production" type="select" />
                <Field label="المنطقة الزمنية" value="Asia/Riyadh" type="select" />
              </div>
            </Section>
          </>
        )}

        {tab === 'security' && (
          <>
            <Section icon={Shield} title="الحماية" desc="إعدادات الأمان والتوثيق">
              <div className="nx-grid-3">
                <Field label="مدة الجلسة (دقيقة)" value="30" />
                <Field label="محاولات الدخول القصوى" value="5" />
                <Field label="مدة الحظر (دقيقة)" value="15" />
              </div>
              <div className="nx-space-y" style={{ marginTop: 16 }}>
                <Field label="التوثيق الثنائي (2FA)" value="true" type="toggle" />
                <Field label="إجبار تغيير كلمة المرور كل 90 يوم" value="false" type="toggle" />
              </div>
            </Section>
            <Section icon={Key} title="API Keys" desc="مفاتيح الوصول للتكاملات">
              <div className="nx-grid-2">
                <Field label="Platform API Key" value="sk_live_xxxx...xxxx" type="password" dir="ltr" />
                <Field label="Webhook Secret" value="whsec_xxxx...xxxx" type="password" dir="ltr" />
              </div>
            </Section>
          </>
        )}

        {tab === 'billing' && (
          <Section icon={Database} title="إعدادات الفوترة" desc="بوابات الدفع والضرائب">
            <div className="nx-grid-3">
              <Field label="بوابة الدفع" value="Moyasar" type="select" />
              <Field label="نسبة الضريبة (VAT)" value="15%" />
              <Field label="العملة" value="SAR" type="select" />
            </div>
            <div className="nx-grid-2" style={{ marginTop: 16 }}>
              <Field label="Moyasar API Key" value="pk_live_xxxx...xxxx" type="password" dir="ltr" />
              <Field label="Moyasar Secret" value="sk_live_xxxx...xxxx" type="password" dir="ltr" />
            </div>
          </Section>
        )}

        {tab === 'gateways' && (
          <>
            <Section icon={Mail} title="البريد الإلكتروني (SMTP)" desc="خادم البريد لإرسال الإشعارات">
              <div className="nx-grid-3">
                <Field label="SMTP Host" value="smtp.servi-x.com" dir="ltr" />
                <Field label="المنفذ" value="587" />
                <Field label="البريد المرسل" value="noreply@servi-x.com" dir="ltr" />
              </div>
              <div className="nx-grid-2" style={{ marginTop: 16 }}>
                <Field label="SMTP Username" value="noreply@servi-x.com" dir="ltr" />
                <Field label="SMTP Password" value="smtp_password_xxx" type="password" dir="ltr" />
              </div>
            </Section>
            <Section icon={Mail} title="SMS Gateway" desc="بوابة الرسائل النصية">
              <div className="nx-grid-3">
                <Field label="المزود" value="Unifonic" type="select" />
                <Field label="App ID" value="unifonic_xxx" type="password" dir="ltr" />
                <Field label="Sender ID" value="SERVIX" />
              </div>
            </Section>
          </>
        )}

        {tab === 'appearance' && (
          <Section icon={Palette} title="المظهر" desc="تخصيص مظهر لوحة الإدارة">
            <div className="nx-grid-3">
              <Field label="الثيم" value="Obsidian Nexus (Dark)" type="select" />
              <Field label="اللون الرئيسي" value="#eab308" />
              <Field label="اللون الثانوي" value="#a78bfa" />
            </div>
            <div className="nx-space-y" style={{ marginTop: 16 }}>
              <Field label="عرض شعار SERVIX في الأسفل" value="true" type="toggle" />
              <Field label="Compact Mode" value="false" type="toggle" />
            </div>
          </Section>
        )}

        {tab === 'advanced' && (
          <>
            <Section icon={Gauge} title="Rate Limiting" desc="حماية API من الاستخدام المفرط">
              <div className="nx-grid-3">
                <Field label="حد الطلبات (requests/min)" value="100" />
                <Field label="حد تسجيل الدخول" value="5 / 15 دقيقة" />
                <Field label="مدة الحظر" value="15 دقيقة" />
              </div>
            </Section>
            <Section icon={Construction} title="وضع الصيانة" desc="إيقاف المنصة مؤقتاً للصيانة">
              <div className="nx-space-y">
                <Field label="تفعيل وضع الصيانة" value="false" type="toggle" />
                <Field label="رسالة الصيانة" value="المنصة تحت الصيانة — نعود قريباً" />
                <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.12)' }}>
                  <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--gold)' }}>
                    <AlertTriangle size={14} /> تنبيه: تفعيل وضع الصيانة سيمنع جميع الصالونات من الوصول
                  </p>
                </div>
              </div>
            </Section>
            <Section icon={Database} title="النسخ الاحتياطي" desc="جدولة وإدارة النسخ الاحتياطية">
              <div className="nx-grid-3">
                <Field label="التكرار" value="يومياً 3:00 صباحاً" type="select" />
                <Field label="آخر نسخة ناجحة" value="26 مارس 2026 — 03:00" />
                <Field label="مدة الاحتفاظ" value="30 يوم" type="select" />
              </div>
              <div style={{ marginTop: 12 }}>
                <Field label="النسخ الاحتياطي التلقائي" value="true" type="toggle" />
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
