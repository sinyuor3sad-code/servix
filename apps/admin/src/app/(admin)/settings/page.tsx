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
  { key: 'general',    label: 'عام',            icon: Globe },
  { key: 'security',   label: 'الأمان',         icon: Shield },
  { key: 'billing',    label: 'الفوترة',        icon: Database },
  { key: 'gateways',   label: 'البوابات',       icon: Mail },
  { key: 'appearance', label: 'المظهر',         icon: Palette },
  { key: 'advanced',   label: 'متقدم',          icon: Wrench },
];

function Field({ label, value, type = 'text', dir }: { label: string; value: string; type?: 'text' | 'select' | 'password' | 'toggle'; dir?: string }) {
  const [show, setShow] = useState(false);
  const [on, setOn] = useState(value === 'true');

  if (type === 'toggle') {
    return (
      <div className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.015] px-4 py-3">
        <span className="text-[13px] font-semibold text-white/60">{label}</span>
        <button onClick={() => setOn(!on)} className={`relative flex h-6 w-11 items-center rounded-full border transition-all duration-300 ${on ? 'border-emerald-500/25 bg-emerald-500/15' : 'border-white/[0.08] bg-white/[0.03]'}`}>
          <span className={`absolute h-4 w-4 rounded-full transition-all duration-300 ${on ? 'left-[3px] bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]' : 'left-[calc(100%-19px)] bg-white/25'}`} />
        </button>
      </div>
    );
  }

  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-semibold text-white/30">{label}</label>
      {type === 'select' ? (
        <select className="h-10 w-full appearance-none rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 text-[13px] text-white/70 outline-none focus:border-amber-500/25 hover:border-white/[0.14]">
          <option>{value}</option>
        </select>
      ) : type === 'password' ? (
        <div className="relative">
          <input type={show ? 'text' : 'password'} defaultValue={value} dir={dir}
            className="h-10 w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 pr-10 text-[13px] font-mono text-white/50 outline-none focus:border-amber-500/25" />
          <button onClick={() => setShow(!show)} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50">
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      ) : (
        <input defaultValue={value} dir={dir}
          className="h-10 w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 text-[13px] text-white/70 outline-none focus:border-amber-500/25 hover:border-white/[0.14]" />
      )}
    </div>
  );
}

function Section({ icon: Icon, title, desc, children }: { icon: React.ElementType; title: string; desc: string; children: React.ReactNode }) {
  return (
    <Glass hover>
      <div className="p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.03]">
            <Icon size={18} className="text-amber-400/60" strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-white/80">{title}</h3>
            <p className="text-[12px] text-white/25">{desc}</p>
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
    <div className="space-y-5">
      <PageTitle title="الإعدادات" desc="إعدادات المنصة العامة والأمان والبوابات">
        <button onClick={save} className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-5 py-2.5 text-[13px] font-bold text-black shadow-lg shadow-amber-500/20 transition-all hover:shadow-xl active:scale-[0.97]">
          {saved ? <><CheckCircle size={15} /> تم الحفظ</> : <><Save size={15} /> حفظ التغييرات</>}
        </button>
      </PageTitle>

      {/* Tabs */}
      <Glass>
        <div className="flex gap-1 overflow-x-auto p-2">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold whitespace-nowrap transition-all duration-300 ${
                tab === key
                  ? 'bg-gradient-to-r from-amber-500/15 to-amber-600/5 text-amber-400 border border-amber-500/20'
                  : 'text-white/35 hover:bg-white/[0.03] hover:text-white/55'
              }`}>
              <Icon size={15} strokeWidth={tab === key ? 2 : 1.5} />{label}
            </button>
          ))}
        </div>
      </Glass>

      {/* Content */}
      <div className="space-y-4">
        {tab === 'general' && (
          <>
            <Section icon={Globe} title="إعدادات المنصة" desc="الاسم والرابط واللغة">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="اسم المنصة" value="SERVIX" />
                <Field label="رابط المنصة" value="https://app.servi-x.com" dir="ltr" />
                <Field label="اللغة الافتراضية" value="العربية" type="select" />
              </div>
            </Section>
            <Section icon={Server} title="معلومات النظام" desc="إصدار المنصة والبيئة">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="مدة الجلسة (دقيقة)" value="30" />
                <Field label="محاولات الدخول القصوى" value="5" />
                <Field label="مدة الحظر (دقيقة)" value="15" />
              </div>
              <div className="mt-4 space-y-2">
                <Field label="التوثيق الثنائي (2FA)" value="true" type="toggle" />
                <Field label="إجبار تغيير كلمة المرور كل 90 يوم" value="false" type="toggle" />
              </div>
            </Section>
            <Section icon={Key} title="API Keys" desc="مفاتيح الوصول للتكاملات">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Platform API Key" value="sk_live_xxxx...xxxx" type="password" dir="ltr" />
                <Field label="Webhook Secret" value="whsec_xxxx...xxxx" type="password" dir="ltr" />
              </div>
            </Section>
          </>
        )}

        {tab === 'billing' && (
          <Section icon={Database} title="إعدادات الفوترة" desc="بوابات الدفع والضرائب">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="بوابة الدفع" value="Moyasar" type="select" />
              <Field label="نسبة الضريبة (VAT)" value="15%" />
              <Field label="العملة" value="SAR" type="select" />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Moyasar API Key" value="pk_live_xxxx...xxxx" type="password" dir="ltr" />
              <Field label="Moyasar Secret" value="sk_live_xxxx...xxxx" type="password" dir="ltr" />
            </div>
          </Section>
        )}

        {tab === 'gateways' && (
          <>
            <Section icon={Mail} title="البريد الإلكتروني (SMTP)" desc="خادم البريد لإرسال الإشعارات">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="SMTP Host" value="smtp.servi-x.com" dir="ltr" />
                <Field label="المنفذ" value="587" />
                <Field label="البريد المرسل" value="noreply@servi-x.com" dir="ltr" />
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="SMTP Username" value="noreply@servi-x.com" dir="ltr" />
                <Field label="SMTP Password" value="smtp_password_xxx" type="password" dir="ltr" />
              </div>
            </Section>
            <Section icon={Mail} title="SMS Gateway" desc="بوابة الرسائل النصية">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="المزود" value="Unifonic" type="select" />
                <Field label="App ID" value="unifonic_xxx" type="password" dir="ltr" />
                <Field label="Sender ID" value="SERVIX" />
              </div>
            </Section>
          </>
        )}

        {tab === 'appearance' && (
          <Section icon={Palette} title="المظهر" desc="تخصيص مظهر لوحة الإدارة">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="الثيم" value="Obsidian Nexus (Dark)" type="select" />
              <Field label="اللون الرئيسي" value="#eab308" />
              <Field label="اللون الثانوي" value="#a78bfa" />
            </div>
            <div className="mt-4 space-y-2">
              <Field label="عرض شعار SERVIX في الأسفل" value="true" type="toggle" />
              <Field label="Compact Mode" value="false" type="toggle" />
            </div>
          </Section>
        )}

        {tab === 'advanced' && (
          <>
            <Section icon={Gauge} title="Rate Limiting" desc="حماية API من الاستخدام المفرط">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="حد الطلبات (requests/min)" value="100" />
                <Field label="حد تسجيل الدخول" value="5 / 15 دقيقة" />
                <Field label="مدة الحظر" value="15 دقيقة" />
              </div>
            </Section>
            <Section icon={Construction} title="وضع الصيانة" desc="إيقاف المنصة مؤقتاً للصيانة">
              <div className="space-y-3">
                <Field label="تفعيل وضع الصيانة" value="false" type="toggle" />
                <Field label="رسالة الصيانة" value="المنصة تحت الصيانة — نعود قريباً" />
                <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] px-4 py-3">
                  <p className="flex items-center gap-2 text-[12px] font-semibold text-amber-400">
                    <AlertTriangle size={14} /> تنبيه: تفعيل وضع الصيانة سيمنع جميع الصالونات من الوصول
                  </p>
                </div>
              </div>
            </Section>
            <Section icon={Database} title="النسخ الاحتياطي" desc="جدولة وإدارة النسخ الاحتياطية">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="التكرار" value="يومياً 3:00 صباحاً" type="select" />
                <Field label="آخر نسخة ناجحة" value="26 مارس 2026 — 03:00" />
                <Field label="مدة الاحتفاظ" value="30 يوم" type="select" />
              </div>
              <div className="mt-3">
                <Field label="النسخ الاحتياطي التلقائي" value="true" type="toggle" />
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
