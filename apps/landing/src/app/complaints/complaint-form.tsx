'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Loader2, Send, Copy, AlertCircle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

interface FormState {
  name: string;
  phone: string;
  email: string;
  complaintType: string;
  orderOrInvoiceNumber: string;
  message: string;
}

const INITIAL: FormState = {
  name: '',
  phone: '',
  email: '',
  complaintType: '',
  orderOrInvoiceNumber: '',
  message: '',
};

interface SuccessResult {
  referenceNumber: string;
  responseTime: string;
  resolutionTime: string;
  createdAt: string;
}

export default function ComplaintForm() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [types, setTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessResult | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/compliance/complaint-types`, { signal: AbortSignal.timeout(5000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const data = json?.data ?? json;
        if (Array.isArray(data?.types) && data.types.length) {
          setTypes(data.types);
          setForm((p) => ({ ...p, complaintType: data.types[0] }));
        }
      })
      .catch(() => { /* fallback rendered below */ });
  }, []);

  const update = (k: keyof FormState, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) return setError('الاسم مطلوب');
    if (!form.phone.trim()) return setError('رقم الجوال مطلوب');
    if (!form.complaintType.trim()) return setError('اختر/ي نوع الشكوى');
    if (form.message.trim().length < 10) return setError('الرجاء كتابة وصف مكون من 10 أحرف على الأقل');

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/compliance/complaints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || undefined,
          complaintType: form.complaintType,
          orderOrInvoiceNumber: form.orderOrInvoiceNumber.trim() || undefined,
          message: form.message.trim(),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const code = json?.error?.code;
        if (res.status === 429 || code === 'RATE_LIMIT_EXCEEDED') {
          throw new Error('تم تجاوز عدد المحاولات المسموح. حاول/ي مرة أخرى بعد قليل.');
        }
        throw new Error(json?.error?.message || json?.message || 'تعذر إرسال الشكوى. حاول/ي لاحقاً.');
      }
      const data = (json?.data ?? json) as SuccessResult;
      setSuccess(data);
      setForm(INITIAL);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div
        className="mt-10 rounded-2xl border border-emerald-500/20 p-8 text-center"
        style={{ background: 'rgba(16,185,129,0.05)' }}
      >
        <CheckCircle2 className="mx-auto h-12 w-12" style={{ color: '#10b981' }} />
        <h2 className="mt-4 text-2xl font-black text-white">تم تسجيل شكواك</h2>
        <p className="mt-2 text-sm text-white/60">احتفظ/ي بالرقم المرجعي للمتابعة</p>

        <div className="mt-6 inline-flex items-center gap-3 rounded-xl border border-white/10 px-5 py-4"
          style={{ background: 'rgba(0,0,0,0.4)' }}>
          <span className="text-sm text-white/50">رقم الشكوى</span>
          <span dir="ltr" className="text-lg font-mono font-bold text-emerald-300">
            {success.referenceNumber}
          </span>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(success.referenceNumber).catch(() => {})}
            className="rounded-lg p-1.5 text-white/40 hover:bg-white/5 hover:text-white"
            aria-label="نسخ الرقم"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 text-start">
          {success.responseTime && (
            <div className="rounded-xl border border-white/[0.07] p-4">
              <p className="text-xs text-white/40">وقت الرد المتوقع</p>
              <p className="mt-1 text-sm font-bold text-white/85">{success.responseTime}</p>
            </div>
          )}
          {success.resolutionTime && (
            <div className="rounded-xl border border-white/[0.07] p-4">
              <p className="text-xs text-white/40">وقت المعالجة المتوقع</p>
              <p className="mt-1 text-sm font-bold text-white/85">{success.resolutionTime}</p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setSuccess(null)}
          className="mt-8 inline-flex items-center gap-2 rounded-xl border border-white/10 px-5 py-2.5 text-sm font-bold text-white/70 hover:bg-white/5"
        >
          تقديم شكوى أخرى
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-10 space-y-5">
      <FieldRow>
        <Field label="الاسم الكامل" required>
          <input
            value={form.name} onChange={(e) => update('name', e.target.value)}
            className={inputClass} placeholder="مثال: فاطمة أحمد" autoComplete="name"
          />
        </Field>
        <Field label="رقم الجوال" required>
          <input
            value={form.phone} onChange={(e) => update('phone', e.target.value)}
            className={inputClass} placeholder="05XXXXXXXX" inputMode="tel" dir="ltr" autoComplete="tel"
          />
        </Field>
      </FieldRow>

      <FieldRow>
        <Field label="البريد الإلكتروني (اختياري)">
          <input
            type="email" value={form.email} onChange={(e) => update('email', e.target.value)}
            className={inputClass} placeholder="email@example.com" dir="ltr" autoComplete="email"
          />
        </Field>
        <Field label="رقم الطلب أو الفاتورة (اختياري)">
          <input
            value={form.orderOrInvoiceNumber} onChange={(e) => update('orderOrInvoiceNumber', e.target.value)}
            className={inputClass} placeholder="مثال: INV-2026-0042" dir="ltr"
          />
        </Field>
      </FieldRow>

      <Field label="نوع الشكوى" required>
        <select
          value={form.complaintType}
          onChange={(e) => update('complaintType', e.target.value)}
          className={inputClass}
        >
          <option value="" disabled>اختر/ي نوع الشكوى</option>
          {(types.length ? types : DEFAULT_TYPES).map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </Field>

      <Field label="وصف المشكلة" required>
        <textarea
          value={form.message} onChange={(e) => update('message', e.target.value)}
          rows={6}
          className={inputClass}
          placeholder="اشرح/ي المشكلة بأكبر قدر من التفاصيل لتساعدنا في معالجتها بسرعة."
          maxLength={4000}
        />
        <p className="mt-1 text-[11px] text-white/30">
          {form.message.length}/4000
        </p>
      </Field>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold text-white transition-all disabled:opacity-60"
        style={{ background: 'linear-gradient(135deg, #a855f7, #6366f1)' }}
      >
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> جاري الإرسال...</>
          : <><Send className="h-4 w-4" /> إرسال الشكوى</>}
      </button>
    </form>
  );
}

const inputClass =
  'w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-white/25 outline-none focus:border-violet-400/40 focus:bg-white/[0.06]';

const DEFAULT_TYPES = [
  'مشكلة في الفوترة أو الدفع',
  'مشكلة في الاشتراك',
  'مشكلة فنية',
  'استفسار عام',
  'شكوى بخصوص الخدمة',
  'طلب استرداد',
  'أخرى',
];

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 inline-block text-xs font-bold text-white/50">
        {label}{required && <span className="text-rose-400"> *</span>}
      </span>
      {children}
    </label>
  );
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-5 sm:grid-cols-2">{children}</div>;
}
