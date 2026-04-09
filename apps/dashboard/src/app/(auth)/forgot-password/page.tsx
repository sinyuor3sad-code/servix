'use client';

import { useState, useCallback, type FormEvent, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Mail, CheckCircle2, ArrowRight } from 'lucide-react';
import { api, ApiError } from '@/lib/api';

const LANDING_URL = 'https://servi-x.com';

export default function ForgotPasswordPage(): React.ReactElement {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [show, setShow] = useState(false);

  useEffect(() => { requestAnimationFrame(() => setShow(true)); }, []);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError('البريد الإلكتروني مطلوب'); return; }
    setError(''); setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSubmitted(true); toast.success('تم إرسال رابط الاستعادة بنجاح');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'حدث خطأ غير متوقع');
    } finally { setLoading(false); }
  }, [email]);

  if (submitted) {
    return (
      <div className="auth-card px-8 py-10 sm:px-11 sm:py-12 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.12)' }}>
          <CheckCircle2 className="h-8 w-8" style={{ color: '#4ade80' }} />
        </div>
        <h2 className="auth-title mb-3">تم الإرسال بنجاح</h2>
        <p className="mb-8 text-[15px] leading-relaxed" style={{ color: '#B0AAA2' }}>
          إذا كان البريد الإلكتروني مسجلاً لدينا، ستصلك رسالة تحتوي على رابط لاستعادة كلمة المرور.
        </p>
        <Link href="/login" className="auth-btn-outline">العودة لتسجيل الدخول</Link>
      </div>
    );
  }

  return (
    <div style={{
      opacity: show ? 1 : 0, transform: show ? 'translateY(0)' : 'translateY(14px)',
      transition: 'all 0.65s cubic-bezier(0.22, 1, 0.36, 1)',
    }}>
      <div className="auth-card px-8 py-10 sm:px-11 sm:py-12">
        <div className="mb-9 text-center">
          <h2 className="auth-title">استعادة كلمة المرور</h2>
          <p className="mt-2.5 text-[15px]" style={{ color: '#807A72' }}>
            أدخلي بريدك الإلكتروني وسنرسل لك رابطاً لاستعادة كلمة المرور
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="auth-label">البريد الإلكتروني</label>
            <div className="relative">
              <input type="email" placeholder="email@example.com" value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                autoComplete="email" dir="ltr" className="auth-input pe-12 text-start" />
              <div className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-4">
                <Mail className="h-[18px] w-[18px]" style={{ color: '#5A5650' }} />
              </div>
            </div>
            {error && <p className="auth-error">{error}</p>}
          </div>
          <button type="submit" disabled={loading} className="auth-btn">
            {loading ? <><span className="auth-spinner" /> جاري الإرسال...</>
             : <><Mail className="h-[18px] w-[18px]" /> إرسال رابط الاستعادة</>}
          </button>
        </form>
        <div className="auth-divider my-8" />
        <p className="text-center text-[15px]" style={{ color: '#807A72' }}>
          تذكرت كلمة المرور؟{' '}
          <Link href="/login" className="auth-link font-bold">تسجيل الدخول</Link>
        </p>
      </div>
      <div className="mt-8 text-center">
        <a href={LANDING_URL} className="group inline-flex items-center gap-2 text-sm font-medium" style={{ color: '#5A5650' }}>
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
          العودة للصفحة الرئيسية
        </a>
      </div>
    </div>
  );
}
