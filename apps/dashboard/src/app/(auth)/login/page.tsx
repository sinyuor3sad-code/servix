'use client';

import { useState, useCallback, type FormEvent, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { LogIn, Mail, Lock } from 'lucide-react';
import { useAuth, getLandingRoute } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';
import type { UserRole } from '@/stores/auth.store';

export default function LoginPage(): React.ReactElement {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [show, setShow] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setShow(true));
  }, []);

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
        const tenantUser = result.tenants[0];
        const role = (tenantUser?.role?.name ?? 'staff') as UserRole;
        const isOwner = tenantUser?.isOwner ?? false;
        toast.success('تم تسجيل الدخول بنجاح');
        router.push(getLandingRoute(role, isOwner));
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.details?.length) error.details.forEach((d) => toast.error(d));
          else toast.error(error.message);
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
      style={{
        opacity: show ? 1 : 0,
        transform: show ? 'translateY(0)' : 'translateY(12px)',
        transition: 'all 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      <div className="auth-card p-8 sm:p-10">
        {/* Header */}
        <div className="mb-8 text-center">
          <h2 className="auth-title">تسجيل الدخول</h2>
          <p className="mt-2 text-sm" style={{ color: '#807A72' }}>
            سجّلي دخولك لإدارة صالونك
          </p>
        </div>

        {/* Dev-mode quick login (localhost only) */}
        {typeof window !== 'undefined' && window.location.hostname === 'localhost' && (
          <div className="mb-6 space-y-2">
            <button
              type="button"
              onClick={() => { setEmail('servix@dev.local'); setPassword('adsf1324'); }}
              className="w-full rounded-xl px-4 py-2.5 text-[13px] font-medium transition-all duration-200"
              style={{
                background: 'rgba(200,169,126,0.05)',
                border: '1px dashed rgba(200,169,126,0.18)',
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
                background: 'rgba(74,222,128,0.03)',
                border: '1px dashed rgba(74,222,128,0.12)',
                color: '#4ade80',
              }}
            >
              🧪 كاشير — تعبئة تلقائية
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
          <div>
            <label className="auth-label">البريد الإلكتروني أو رقم الجوال</label>
            <div className="relative">
              <input
                type="text"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })); }}
                autoComplete="email"
                dir="ltr"
                className="auth-input pe-11 text-start"
              />
              <div className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-4">
                <Mail className="h-[18px] w-[18px]" style={{ color: '#5A5650' }} />
              </div>
            </div>
            {errors.email && <p className="auth-error">{errors.email}</p>}
          </div>

          {/* Password */}
          <div>
            <label className="auth-label">كلمة المرور</label>
            <div className="relative">
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined })); }}
                autoComplete="current-password"
                dir="ltr"
                className="auth-input pe-11 text-start"
              />
              <div className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-4">
                <Lock className="h-[18px] w-[18px]" style={{ color: '#5A5650' }} />
              </div>
            </div>
            {errors.password && <p className="auth-error">{errors.password}</p>}
          </div>

          {/* Forgot password */}
          <div className="flex justify-end">
            <Link href="/forgot-password" className="auth-link text-sm font-medium">
              نسيت كلمة المرور؟
            </Link>
          </div>

          {/* Submit */}
          <button type="submit" disabled={loading} className="auth-btn">
            {loading ? (
              <>
                <span className="auth-spinner" />
                جاري الدخول...
              </>
            ) : (
              <>
                <LogIn className="h-[18px] w-[18px]" />
                تسجيل الدخول
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="auth-divider my-8" />

        {/* Register link */}
        <p className="text-center text-sm" style={{ color: '#807A72' }}>
          ليس لديك حساب؟{' '}
          <Link href="/register" className="auth-link font-semibold">
            إنشاء حساب جديد
          </Link>
        </p>
      </div>

      {/* Back to main site */}
      <div className="mt-8 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm transition-colors duration-200"
          style={{ color: '#5A5650' }}
        >
          <span style={{ transform: 'scaleX(-1)', display: 'inline-block' }}>←</span>
          العودة للصفحة الرئيسية
        </Link>
      </div>
    </div>
  );
}
