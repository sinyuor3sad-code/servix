'use client';

import { useState, useCallback, type FormEvent, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { LogIn, Mail, Lock, ArrowLeft } from 'lucide-react';
import { useAuth, getLandingRoute } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';
import type { UserRole } from '@/stores/auth.store';

export default function LoginPage(): React.ReactElement {
  const router = useRouter();
  const { login } = useAuth();
  const formRef = useRef<HTMLFormElement>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const validate = useCallback((): boolean => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email.trim()) newErrors.email = 'البريد الإلكتروني أو رقم الجوال مطلوب';
    if (!password) newErrors.password = 'كلمة المرور مطلوبة';
    else if (password.length < 6) newErrors.password = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [email, password]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      setLoading(true);
      try {
        const result = await login({ emailOrPhone: email.trim(), password });

        // Determine role-based landing page
        const tenantUser = result.tenants[0];
        const role = (tenantUser?.role?.name ?? 'staff') as UserRole;
        const isOwner = tenantUser?.isOwner ?? false;
        const landingRoute = getLandingRoute(role, isOwner);

        toast.success('تم تسجيل الدخول بنجاح');
        router.push(landingRoute);
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.details && error.details.length > 0) {
            error.details.forEach((detail) => toast.error(detail));
          } else {
            toast.error(error.message);
          }
        } else {
          toast.error('حدث خطأ غير متوقع');
        }
      } finally {
        setLoading(false);
      }
    },
    [email, password, login, router, validate],
  );

  return (
    <div
      className="transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(16px)',
      }}
    >
      {/* ── Auth card ── */}
      <div className="auth-card-luxury p-8 sm:p-10">
        <h2 className="auth-title mb-8 text-center">تسجيل الدخول</h2>

        {/* Dev-mode quick login hints */}
        {typeof window !== 'undefined' && window.location.hostname === 'localhost' && (
          <div className="mb-6 space-y-2">
            <button
              type="button"
              onClick={() => { setEmail('servix@dev.local'); setPassword('adsf1324'); }}
              className="w-full rounded-xl px-4 py-2.5 text-[13px] font-medium transition-all duration-200"
              style={{
                background: 'rgba(200,169,126,0.06)',
                border: '1px dashed rgba(200,169,126,0.2)',
                color: '#D4B896',
              }}
            >
              🧪 مالك صالون — تعبئة تلقائية
            </button>
            <button
              type="button"
              onClick={() => { setEmail('cashier@dev.local'); setPassword('adsf1324'); }}
              className="w-full rounded-xl px-4 py-2.5 text-[13px] font-medium transition-all duration-200"
              style={{
                background: 'rgba(74,222,128,0.04)',
                border: '1px dashed rgba(74,222,128,0.15)',
                color: '#4ade80',
              }}
            >
              🧪 كاشير — تعبئة تلقائية (يوجّه إلى /pos)
            </button>
          </div>
        )}

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
          <div className="space-y-2">
            <label className="auth-label block text-sm">البريد الإلكتروني أو رقم الجوال</label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3.5">
                <Mail className="h-4 w-4" style={{ color: '#807A72' }} />
              </div>
              <input
                type="text"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                dir="ltr"
                className="auth-input w-full pe-10 text-start"
              />
            </div>
            {errors.email && <p className="auth-error text-xs">{errors.email}</p>}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label className="auth-label block text-sm">كلمة المرور</label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3.5">
                <Lock className="h-4 w-4" style={{ color: '#807A72' }} />
              </div>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                dir="ltr"
                className="auth-input w-full pe-10 text-start"
              />
            </div>
            {errors.password && <p className="auth-error text-xs">{errors.password}</p>}
          </div>

          {/* Forgot password */}
          <div className="flex items-center justify-end">
            <Link href="/forgot-password" className="auth-link text-sm">
              نسيت كلمة المرور؟
            </Link>
          </div>

          {/* Submit */}
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
                جاري الدخول...
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                تسجيل الدخول
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="auth-divider my-7" />

        {/* Register link */}
        <p className="text-center text-sm" style={{ color: '#807A72' }}>
          ليس لديك حساب؟{' '}
          <Link href="/register" className="auth-link font-medium">
            إنشاء حساب جديد
          </Link>
        </p>
      </div>

      {/* Back to landing */}
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
