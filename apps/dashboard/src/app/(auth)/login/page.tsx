'use client';

import { useState, useCallback, type FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { LogIn, Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuth, getLandingRoute } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';
import type { UserRole } from '@/stores/auth.store';

const LANDING_URL = 'https://servi-x.com';

export default function LoginPage(): React.ReactElement {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [show, setShow] = useState(false);

  useEffect(() => { requestAnimationFrame(() => setShow(true)); }, []);

  const validate = useCallback((): boolean => {
    const e: { email?: string; password?: string } = {};
    if (!email.trim()) e.email = 'البريد الإلكتروني أو رقم الجوال مطلوب';
    if (!password) e.password = 'كلمة المرور مطلوبة';
    else if (password.length < 6) e.password = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [email, password]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!validate()) return;
      setLoading(true);
      try {
        const result = await login({ emailOrPhone: email.trim(), password });
        const tu = result.tenants[0];
        const role = (tu?.role?.name ?? 'staff') as UserRole;
        toast.success('تم تسجيل الدخول بنجاح');
        router.push(getLandingRoute(role, tu?.isOwner ?? false));
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.details?.length) error.details.forEach((d) => toast.error(d));
          else toast.error(error.message);
        } else toast.error('حدث خطأ غير متوقع');
      } finally {
        setLoading(false);
      }
    },
    [email, password, login, router, validate],
  );

  return (
    <div style={{
      opacity: show ? 1 : 0,
      transform: show ? 'translateY(0)' : 'translateY(14px)',
      transition: 'all 0.65s cubic-bezier(0.22, 1, 0.36, 1)',
    }}>
      <div className="auth-card px-8 py-10 sm:px-11 sm:py-12">
        {/* Header */}
        <div className="mb-9 text-center">
          <h2 className="auth-title">تسجيل الدخول</h2>
          <p className="mt-2.5 text-[15px]" style={{ color: '#807A72' }}>
            سجّلي دخولك لإدارة صالونك
          </p>
        </div>

        {/* Dev-hints */}
        {typeof window !== 'undefined' && window.location.hostname === 'localhost' && (
          <div className="mb-7 space-y-2">
            {[
              { label: '🧪 مالك صالون — تعبئة تلقائية', email: 'servix@dev.local', color: '#D4B896', bg: 'rgba(200,169,126,0.04)', border: 'rgba(200,169,126,0.12)' },
              { label: '🧪 كاشير — تعبئة تلقائية', email: 'cashier@dev.local', color: '#4ade80', bg: 'rgba(74,222,128,0.03)', border: 'rgba(74,222,128,0.1)' },
            ].map(h => (
              <button key={h.email} type="button"
                onClick={() => { setEmail(h.email); setPassword('adsf1324'); }}
                className="w-full rounded-xl px-4 py-2.5 text-[13px] font-medium transition-all duration-200"
                style={{ background: h.bg, border: `1px dashed ${h.border}`, color: h.color }}
              >{h.label}</button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
          <div>
            <label className="auth-label">البريد الإلكتروني أو رقم الجوال</label>
            <div className="relative">
              <input type="text" placeholder="email@example.com" value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined })); }}
                autoComplete="email" dir="ltr" className="auth-input pe-12 text-start" />
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
              <input type="password" placeholder="••••••••" value={password}
                onChange={(e) => { setPassword(e.target.value); setErrors(p => ({ ...p, password: undefined })); }}
                autoComplete="current-password" dir="ltr" className="auth-input pe-12 text-start" />
              <div className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-4">
                <Lock className="h-[18px] w-[18px]" style={{ color: '#5A5650' }} />
              </div>
            </div>
            {errors.password && <p className="auth-error">{errors.password}</p>}
          </div>

          {/* Forgot */}
          <div className="flex justify-end">
            <Link href="/forgot-password" className="auth-link text-sm font-semibold">
              نسيت كلمة المرور؟
            </Link>
          </div>

          {/* Submit */}
          <button type="submit" disabled={loading} className="auth-btn">
            {loading ? <><span className="auth-spinner" /> جاري الدخول...</>
             : <><LogIn className="h-[18px] w-[18px]" /> تسجيل الدخول</>}
          </button>
        </form>

        <div className="auth-divider my-8" />

        <p className="text-center text-[15px]" style={{ color: '#807A72' }}>
          ليس لديك حساب؟{' '}
          <Link href="/register" className="auth-link font-bold">إنشاء حساب جديد</Link>
        </p>
      </div>

      {/* External landing link — correct URL */}
      <div className="mt-8 text-center">
        <a href={LANDING_URL}
          className="group inline-flex items-center gap-2 text-sm font-medium transition-colors duration-200"
          style={{ color: '#5A5650' }}>
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
          العودة للصفحة الرئيسية
        </a>
      </div>
    </div>
  );
}
