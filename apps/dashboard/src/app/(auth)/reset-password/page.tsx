'use client';

import { useState, useCallback, useEffect, type FormEvent } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Lock, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { api, ApiError } from '@/lib/api';

export default function ResetPasswordPage(): React.ReactElement {
  const token = useSearchParams().get('token') || '';
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [tokenError, setTokenError] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [show, setShow] = useState(false);

  useEffect(() => { requestAnimationFrame(() => setShow(true)); }, []);
  useEffect(() => {
    if (!token) { setTokenValid(false); setTokenError('رابط إعادة التعيين غير صالح — لا يوجد رمز'); return; }
    (async () => {
      try {
        const r = await api.post<{ valid: boolean }>('/auth/verify-reset-token', { token });
        if (r.valid) setTokenValid(true);
        else { setTokenValid(false); setTokenError('رابط إعادة التعيين منتهي الصلاحية أو مُستخدم مسبقاً'); }
      } catch { setTokenValid(false); setTokenError('رابط إعادة التعيين غير صالح أو منتهي الصلاحية'); }
    })();
  }, [token]);

  const validate = useCallback((): boolean => {
    const e: { password?: string; confirm?: string } = {};
    if (password.length < 8) e.password = 'كلمة المرور يجب أن تكون 8 أحرف على الأقل';
    if (password !== confirmPassword) e.confirm = 'كلمتا المرور غير متطابقتين';
    setErrors(e); return Object.keys(e).length === 0;
  }, [password, confirmPassword]);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      setSuccess(true); toast.success('تم إعادة تعيين كلمة المرور بنجاح');
      setTimeout(() => router.push('/login'), 3000);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
        if (err.message.includes('منتهي') || err.message.includes('مُستخدم')) { setTokenValid(false); setTokenError(err.message); }
      } else toast.error('حدث خطأ غير متوقع');
    } finally { setLoading(false); }
  }, [token, password, validate, router]);

  if (tokenValid === false) return (
    <div className="auth-card px-8 py-10 sm:px-11 sm:py-12 text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.12)' }}>
        <AlertCircle className="h-8 w-8" style={{ color: '#f87171' }} />
      </div>
      <h2 className="auth-title mb-3">رابط غير صالح</h2>
      <p className="mb-8 text-[15px]" style={{ color: '#B0AAA2' }}>{tokenError}</p>
      <Link href="/forgot-password" className="auth-btn-outline">طلب رابط جديد</Link>
      <p className="mt-5 text-[15px]" style={{ color: '#807A72' }}>
        <Link href="/login" className="auth-link font-bold">العودة لتسجيل الدخول</Link>
      </p>
    </div>
  );

  if (tokenValid === null) return (
    <div className="auth-card px-8 py-10 sm:px-11 sm:py-12 text-center">
      <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-[3px] border-t-transparent"
        style={{ borderColor: 'rgba(212,184,150,0.25)', borderTopColor: 'transparent' }} />
      <p className="text-[15px]" style={{ color: '#B0AAA2' }}>جاري التحقق من الرابط...</p>
    </div>
  );

  if (success) return (
    <div className="auth-card px-8 py-10 sm:px-11 sm:py-12 text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.12)' }}>
        <CheckCircle2 className="h-8 w-8" style={{ color: '#4ade80' }} />
      </div>
      <h2 className="auth-title mb-3">تم التغيير بنجاح</h2>
      <p className="mb-8 text-[15px]" style={{ color: '#B0AAA2' }}>سيتم توجيهك لتسجيل الدخول...</p>
      <Link href="/login" className="auth-btn">تسجيل الدخول الآن</Link>
    </div>
  );

  return (
    <div style={{
      opacity: show ? 1 : 0, transform: show ? 'translateY(0)' : 'translateY(14px)',
      transition: 'all 0.65s cubic-bezier(0.22, 1, 0.36, 1)',
    }}>
      <div className="auth-card px-8 py-10 sm:px-11 sm:py-12">
        <div className="mb-9 text-center">
          <h2 className="auth-title">إعادة تعيين كلمة المرور</h2>
          <p className="mt-2.5 text-[15px]" style={{ color: '#807A72' }}>أدخلي كلمة مرورك الجديدة</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="auth-label">كلمة المرور الجديدة</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} placeholder="••••••••" value={password}
                onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: undefined })); }}
                autoComplete="new-password" dir="ltr" className="auth-input pe-12 ps-12 text-start" />
              <div className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-4">
                <Lock className="h-[18px] w-[18px]" style={{ color: '#5A5650' }} />
              </div>
              <button type="button" onClick={() => setShowPw(!showPw)} tabIndex={-1}
                className="absolute inset-y-0 start-0 flex items-center ps-4" style={{ color: '#5A5650' }}>
                {showPw ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
              </button>
            </div>
            {errors.password && <p className="auth-error">{errors.password}</p>}
          </div>
          <div>
            <label className="auth-label">تأكيد كلمة المرور</label>
            <div className="relative">
              <input type="password" placeholder="••••••••" value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setErrors(p => ({ ...p, confirm: undefined })); }}
                autoComplete="new-password" dir="ltr" className="auth-input pe-12 text-start" />
              <div className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-4">
                <Lock className="h-[18px] w-[18px]" style={{ color: '#5A5650' }} />
              </div>
            </div>
            {errors.confirm && <p className="auth-error">{errors.confirm}</p>}
          </div>
          <button type="submit" disabled={loading} className="auth-btn">
            {loading ? <><span className="auth-spinner" /> جاري الحفظ...</>
             : <><Lock className="h-[18px] w-[18px]" /> تعيين كلمة المرور الجديدة</>}
          </button>
        </form>
        <div className="auth-divider my-8" />
        <p className="text-center text-[15px]" style={{ color: '#807A72' }}>
          تذكرت كلمة المرور؟ <Link href="/login" className="auth-link font-bold">تسجيل الدخول</Link>
        </p>
      </div>
    </div>
  );
}
