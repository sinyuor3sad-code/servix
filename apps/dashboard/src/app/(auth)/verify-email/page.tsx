'use client';

import { useState, useCallback, useEffect, useRef, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ShieldCheck, RotateCw } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { authService } from '@/services/auth.service';
import { ApiError } from '@/lib/api';

const OTP_LENGTH = 6;
const COOLDOWN_SECONDS = 60;

export default function VerifyEmailPage(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(COOLDOWN_SECONDS);
  const [show, setShow] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const { login: storeLogin, setUserRole, setCurrentTenant } = useAuthStore();

  useEffect(() => { requestAnimationFrame(() => setShow(true)); }, []);
  useEffect(() => { inputRefs.current[0]?.focus(); }, []);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((p) => p - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleChange = useCallback(
    (index: number, value: string) => {
      const digit = value.replace(/\D/g, '').slice(-1);
      const newOtp = [...otp];
      newOtp[index] = digit;
      setOtp(newOtp);
      if (digit && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
      if (digit && index === OTP_LENGTH - 1 && newOtp.every((d) => d)) handleSubmitCode(newOtp.join(''));
    },
    [otp], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent) => {
      if (e.key === 'Backspace' && !otp[index] && index > 0) inputRefs.current[index - 1]?.focus();
    },
    [otp],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
      if (!pasted.length) return;
      const newOtp = [...otp];
      for (let i = 0; i < pasted.length; i++) newOtp[i] = pasted[i];
      setOtp(newOtp);
      inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
      if (pasted.length === OTP_LENGTH) handleSubmitCode(pasted);
    },
    [otp], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleSubmitCode = async (code: string) => {
    if (!email) { toast.error('البريد الإلكتروني مفقود'); return; }
    setLoading(true);
    try {
      const result = await authService.verifyOtp(email, code);
      storeLogin(result.user, result.tokens.accessToken, result.tokens.refreshToken);
      if (result.tenants?.length > 0) {
        const tu = result.tenants[0];
        setUserRole((tu.role?.name || 'owner') as 'owner' | 'manager' | 'cashier' | 'staff', tu.isOwner);
        setCurrentTenant(tu.tenant);
      }
      toast.success('تم التحقق بنجاح — أهلاً بك!');
      router.push('/');
    } catch (error) {
      setOtp(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
      toast.error(error instanceof ApiError ? error.message : 'رمز التحقق غير صحيح');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    try {
      const result = await authService.resendOtp(email);
      toast.success(result.message);
      setCooldown(COOLDOWN_SECONDS);
    } catch (error) {
      toast.error(error instanceof ApiError ? (error as ApiError).message : 'فشل إعادة الإرسال');
    }
  };

  if (!email) {
    return (
      <div className="auth-card p-8 sm:p-10 text-center">
        <p style={{ color: '#B0AAA2' }}>رابط غير صالح</p>
        <Link href="/register" className="auth-link mt-4 inline-block font-medium">العودة للتسجيل</Link>
      </div>
    );
  }

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
          <div
            className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ background: 'rgba(212,184,150,0.06)', border: '1px solid rgba(212,184,150,0.12)' }}
          >
            <ShieldCheck className="h-8 w-8" style={{ color: '#D4B896' }} />
          </div>
          <h2 className="auth-title">تأكيد البريد الإلكتروني</h2>
          <p className="mt-3 text-sm" style={{ color: '#B0AAA2' }}>
            أدخلي رمز التحقق المكون من 6 أرقام المرسل إلى
          </p>
          <p className="mt-1.5 text-sm font-semibold" style={{ color: '#F0EDE8' }} dir="ltr">
            {email}
          </p>
        </div>

        <form onSubmit={(e: FormEvent) => { e.preventDefault(); const c = otp.join(''); if (c.length === OTP_LENGTH) handleSubmitCode(c); }}>
          {/* OTP Inputs */}
          <div className="mb-8 flex justify-center gap-3" dir="ltr" onPaste={handlePaste}>
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                disabled={loading}
                autoComplete="one-time-code"
                className="h-14 w-12 rounded-xl text-center text-2xl font-bold outline-none transition-all duration-200"
                style={{
                  background: digit ? 'rgba(212,184,150,0.06)' : 'rgba(255,255,255,0.03)',
                  border: digit ? '2px solid rgba(212,184,150,0.4)' : '2px solid rgba(255,255,255,0.07)',
                  color: '#F0EDE8',
                  boxShadow: digit ? '0 0 16px rgba(212,184,150,0.06)' : 'none',
                }}
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={loading || otp.some((d) => !d)}
            className="auth-btn"
          >
            {loading ? (
              <><span className="auth-spinner" /> جاري التحقق...</>
            ) : (
              <><ShieldCheck className="h-[18px] w-[18px]" /> تأكيد</>
            )}
          </button>
        </form>

        {/* Resend */}
        <div className="mt-6 text-center">
          {cooldown > 0 ? (
            <p className="text-sm" style={{ color: '#807A72' }}>
              إعادة الإرسال بعد{' '}
              <span className="font-mono font-bold" style={{ color: '#D4B896' }}>{cooldown}</span>{' '}ثانية
            </p>
          ) : (
            <button onClick={handleResend} className="auth-link inline-flex items-center gap-1.5 text-sm font-semibold">
              <RotateCw className="h-3.5 w-3.5" />
              إعادة إرسال الرمز
            </button>
          )}
        </div>

        <div className="auth-divider my-6" />

        <p className="text-center text-sm" style={{ color: '#807A72' }}>
          بريد خاطئ؟{' '}
          <Link href="/register" className="auth-link font-semibold">العودة للتسجيل</Link>
        </p>
      </div>
    </div>
  );
}
