'use client';

import { useState, useCallback, type FormEvent, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';

export default function ForgotPasswordPage(): React.ReactElement {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!email.trim()) {
        setError('البريد الإلكتروني مطلوب');
        return;
      }
      setError('');
      setLoading(true);

      try {
        await api.post('/auth/forgot-password', { email: email.trim() });
        setSubmitted(true);
        toast.success('تم إرسال رابط الاستعادة بنجاح');
      } catch (err) {
        if (err instanceof ApiError) {
          toast.error(err.message);
        } else {
          toast.error('حدث خطأ غير متوقع');
        }
      } finally {
        setLoading(false);
      }
    },
    [email],
  );

  if (submitted) {
    return (
      <div
        className="transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ opacity: 1, transform: 'translateY(0)' }}
      >
        <div className="auth-card-luxury p-8 sm:p-10 text-center">
          <div
            className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}
          >
            <CheckCircle2 className="h-7 w-7" style={{ color: '#4ade80' }} />
          </div>
          <h2 className="auth-title mb-3">تم الإرسال بنجاح</h2>
          <p className="mb-8 text-sm" style={{ color: '#B0AAA2' }}>
            إذا كان البريد الإلكتروني مسجلاً لدينا، ستصلك رسالة تحتوي على رابط لاستعادة كلمة المرور.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 w-full rounded-xl py-3 text-sm font-medium transition-all"
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#B0AAA2',
            }}
          >
            <ArrowLeft className="h-4 w-4" style={{ transform: 'scaleX(-1)' }} />
            العودة لتسجيل الدخول
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(16px)',
      }}
    >
      <div className="auth-card-luxury p-8 sm:p-10">
        <h2 className="auth-title mb-2 text-center">استعادة كلمة المرور</h2>
        <p className="mb-8 text-center text-sm" style={{ color: '#807A72' }}>
          أدخل بريدك الإلكتروني وسنرسل لك رابطاً لاستعادة كلمة المرور
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="auth-label block text-sm">البريد الإلكتروني</label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3.5">
                <Mail className="h-4 w-4" style={{ color: '#807A72' }} />
              </div>
              <input
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                autoComplete="email"
                dir="ltr"
                className="auth-input w-full pe-10 text-start"
              />
            </div>
            {error && <p className="auth-error text-xs">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="auth-btn-gold flex w-full items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
                  style={{ borderColor: '#080808', borderTopColor: 'transparent' }}
                />
                جاري الإرسال...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4" />
                إرسال رابط الاستعادة
              </>
            )}
          </button>
        </form>

        <div className="auth-divider my-7" />

        <p className="text-center text-sm" style={{ color: '#807A72' }}>
          تذكرت كلمة المرور؟{' '}
          <Link href="/login" className="auth-link font-medium">
            تسجيل الدخول
          </Link>
        </p>
      </div>

      <div className="mt-6 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm transition-colors duration-200"
          style={{ color: '#807A72' }}
        >
          <ArrowLeft className="h-3.5 w-3.5" style={{ transform: 'scaleX(-1)' }} />
          العودة للصفحة الرئيسية
        </Link>
      </div>
    </div>
  );
}
