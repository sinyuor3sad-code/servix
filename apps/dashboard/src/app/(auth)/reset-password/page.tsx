'use client';

import { useState, useCallback, useEffect, type FormEvent } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Lock, ArrowLeft, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { api, ApiError } from '@/lib/api';

export default function ResetPasswordPage(): React.ReactElement {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [tokenError, setTokenError] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!token) {
      setTokenValid(false);
      setTokenError('رابط إعادة التعيين غير صالح — لا يوجد رمز');
      return;
    }
    const verifyToken = async () => {
      try {
        const res = await api.post<{ valid: boolean }>('/auth/verify-reset-token', { token });
        setTokenValid(res.valid ? true : false);
        if (!res.valid) setTokenError('رابط إعادة التعيين منتهي الصلاحية أو مُستخدم مسبقاً');
      } catch {
        setTokenValid(false);
        setTokenError('رابط إعادة التعيين غير صالح أو منتهي الصلاحية');
      }
    };
    verifyToken();
  }, [token]);

  const validate = useCallback((): boolean => {
    const newErrors: { password?: string; confirm?: string } = {};
    if (password.length < 8) newErrors.password = 'كلمة المرور يجب أن تكون 8 أحرف على الأقل';
    if (password !== confirmPassword) newErrors.confirm = 'كلمتا المرور غير متطابقتين';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [password, confirmPassword]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!validate()) return;
      setLoading(true);
      try {
        await api.post('/auth/reset-password', { token, newPassword: password });
        setSuccess(true);
        toast.success('تم إعادة تعيين كلمة المرور بنجاح');
        setTimeout(() => router.push('/login'), 3000);
      } catch (err) {
        if (err instanceof ApiError) {
          toast.error(err.message);
          if (err.message.includes('منتهي') || err.message.includes('مُستخدم')) {
            setTokenValid(false);
            setTokenError(err.message);
          }
        } else {
          toast.error('حدث خطأ غير متوقع');
        }
      } finally {
        setLoading(false);
      }
    },
    [token, password, validate, router],
  );

  // Token invalid
  if (tokenValid === false) {
    return (
      <div className="auth-card-luxury p-8 sm:p-10 text-center">
        <div
          className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}
        >
          <AlertCircle className="h-7 w-7" style={{ color: '#f87171' }} />
        </div>
        <h2 className="auth-title mb-3">رابط غير صالح</h2>
        <p className="mb-8 text-sm" style={{ color: '#B0AAA2' }}>{tokenError}</p>
        <Link
          href="/forgot-password"
          className="inline-flex items-center justify-center gap-2 w-full rounded-xl py-3 text-sm font-medium transition-all"
          style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: '#B0AAA2' }}
        >
          طلب رابط جديد
        </Link>
        <p className="mt-5 text-sm" style={{ color: '#807A72' }}>
          <Link href="/login" className="auth-link font-medium">العودة لتسجيل الدخول</Link>
        </p>
      </div>
    );
  }

  // Loading
  if (tokenValid === null) {
    return (
      <div className="auth-card-luxury p-8 sm:p-10 text-center">
        <div
          className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"
          style={{ borderColor: 'rgba(212,184,150,0.3)', borderTopColor: 'transparent' }}
        />
        <p className="text-sm" style={{ color: '#B0AAA2' }}>جاري التحقق من الرابط...</p>
      </div>
    );
  }

  // Success
  if (success) {
    return (
      <div className="auth-card-luxury p-8 sm:p-10 text-center">
        <div
          className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}
        >
          <CheckCircle2 className="h-7 w-7" style={{ color: '#4ade80' }} />
        </div>
        <h2 className="auth-title mb-3">تم التغيير بنجاح</h2>
        <p className="mb-8 text-sm" style={{ color: '#B0AAA2' }}>
          تم إعادة تعيين كلمة المرور. سيتم توجيهك لتسجيل الدخول خلال 3 ثوان...
        </p>
        <Link
          href="/login"
          className="auth-btn-gold flex w-full items-center justify-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" style={{ transform: 'scaleX(-1)' }} />
          تسجيل الدخول الآن
        </Link>
      </div>
    );
  }

  // Form
  return (
    <div
      className="transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(16px)',
      }}
    >
      <div className="auth-card-luxury p-8 sm:p-10">
        <h2 className="auth-title mb-2 text-center">إعادة تعيين كلمة المرور</h2>
        <p className="mb-8 text-center text-sm" style={{ color: '#807A72' }}>
          أدخل كلمة مرورك الجديدة
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Password */}
          <div className="space-y-2">
            <label className="auth-label block text-sm">كلمة المرور الجديدة</label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3.5">
                <Lock className="h-4 w-4" style={{ color: '#807A72' }} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined })); }}
                autoComplete="new-password"
                dir="ltr"
                className="auth-input w-full pe-10 ps-10 text-start"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 start-0 flex items-center ps-3.5"
                style={{ color: '#807A72' }}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="auth-error text-xs">{errors.password}</p>}
          </div>

          {/* Confirm */}
          <div className="space-y-2">
            <label className="auth-label block text-sm">تأكيد كلمة المرور</label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3.5">
                <Lock className="h-4 w-4" style={{ color: '#807A72' }} />
              </div>
              <input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setErrors((p) => ({ ...p, confirm: undefined })); }}
                autoComplete="new-password"
                dir="ltr"
                className="auth-input w-full pe-10 text-start"
              />
            </div>
            {errors.confirm && <p className="auth-error text-xs">{errors.confirm}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="auth-btn-gold flex w-full items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
                  style={{ borderColor: '#080808', borderTopColor: 'transparent' }} />
                جاري الحفظ...
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" />
                تعيين كلمة المرور الجديدة
              </>
            )}
          </button>
        </form>

        <div className="auth-divider my-7" />

        <p className="text-center text-sm" style={{ color: '#807A72' }}>
          تذكرت كلمة المرور؟{' '}
          <Link href="/login" className="auth-link font-medium">تسجيل الدخول</Link>
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
