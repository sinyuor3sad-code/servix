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
const COOLDOWN = 60;

export default function VerifyEmailPage(): React.ReactElement {
  const router = useRouter();
  const email = useSearchParams().get('email') || '';
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(COOLDOWN);
  const [show, setShow] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const { login: storeLogin, setUserRole, setCurrentTenant } = useAuthStore();

  useEffect(() => { requestAnimationFrame(() => setShow(true)); }, []);
  useEffect(() => { refs.current[0]?.focus(); }, []);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown(p => p - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleChange = useCallback((i: number, v: string) => {
    const d = v.replace(/\D/g, '').slice(-1);
    const n = [...otp]; n[i] = d; setOtp(n);
    if (d && i < OTP_LENGTH - 1) refs.current[i + 1]?.focus();
    if (d && i === OTP_LENGTH - 1 && n.every(x => x)) submitCode(n.join(''));
  }, [otp]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleKeyDown = useCallback((i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) refs.current[i - 1]?.focus();
  }, [otp]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!p.length) return;
    const n = [...otp]; for (let i = 0; i < p.length; i++) n[i] = p[i];
    setOtp(n); refs.current[Math.min(p.length, OTP_LENGTH - 1)]?.focus();
    if (p.length === OTP_LENGTH) submitCode(p);
  }, [otp]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitCode = async (code: string) => {
    if (!email) { toast.error('البريد الإلكتروني مفقود'); return; }
    setLoading(true);
    try {
      const r = await authService.verifyOtp(email, code);
      storeLogin(r.user, r.tokens.accessToken, r.tokens.refreshToken);
      if (r.tenants?.length > 0) {
        const tu = r.tenants[0];
        setUserRole((tu.role?.name || 'owner') as 'owner'|'manager'|'cashier'|'staff', tu.isOwner);
        setCurrentTenant(tu.tenant);
      }
      toast.success('تم التحقق بنجاح — أهلاً بك!');
      router.push('/');
    } catch (err) {
      setOtp(Array(OTP_LENGTH).fill('')); refs.current[0]?.focus();
      toast.error(err instanceof ApiError ? err.message : 'رمز التحقق غير صحيح');
    } finally { setLoading(false); }
  };

  const resend = async () => {
    if (cooldown > 0) return;
    try { const r = await authService.resendOtp(email); toast.success(r.message); setCooldown(COOLDOWN); }
    catch (err) { toast.error(err instanceof ApiError ? (err as ApiError).message : 'فشل إعادة الإرسال'); }
  };

  if (!email) return (
    <div className="auth-card px-8 py-10 sm:px-11 sm:py-12 text-center">
      <p style={{ color: '#B0AAA2' }}>رابط غير صالح</p>
      <Link href="/register" className="auth-link mt-4 inline-block font-bold">العودة للتسجيل</Link>
    </div>
  );

  return (
    <div style={{
      opacity: show ? 1 : 0, transform: show ? 'translateY(0)' : 'translateY(14px)',
      transition: 'all 0.65s cubic-bezier(0.22, 1, 0.36, 1)',
    }}>
      <div className="auth-card px-8 py-10 sm:px-11 sm:py-12">
        <div className="mb-9 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ background: 'rgba(212,184,150,0.06)', border: '1px solid rgba(212,184,150,0.1)' }}>
            <ShieldCheck className="h-8 w-8" style={{ color: '#D4B896' }} />
          </div>
          <h2 className="auth-title">تأكيد البريد الإلكتروني</h2>
          <p className="mt-3 text-[15px]" style={{ color: '#9A948C' }}>
            أدخلي رمز التحقق المكون من 6 أرقام المرسل إلى
          </p>
          <p className="mt-1.5 text-[15px] font-bold" style={{ color: '#F0EDE8' }} dir="ltr">{email}</p>
        </div>

        <form onSubmit={(e: FormEvent) => { e.preventDefault(); const c = otp.join(''); if (c.length === OTP_LENGTH) submitCode(c); }}>
          <div className="mb-9 flex justify-center gap-3" dir="ltr" onPaste={handlePaste}>
            {otp.map((d, i) => (
              <input key={i} ref={el => { refs.current[i] = el; }}
                type="text" inputMode="numeric" maxLength={1} value={d}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                disabled={loading} autoComplete="one-time-code"
                className="h-[3.5rem] w-[3rem] rounded-xl text-center text-2xl font-bold outline-none transition-all duration-200"
                style={{
                  background: d ? 'rgba(212,184,150,0.06)' : 'rgba(255,255,255,0.025)',
                  border: d ? '2px solid rgba(212,184,150,0.4)' : '2px solid rgba(255,255,255,0.06)',
                  color: '#F0EDE8',
                  boxShadow: d ? '0 0 20px rgba(212,184,150,0.06)' : 'none',
                }} />
            ))}
          </div>
          <button type="submit" disabled={loading || otp.some(x => !x)} className="auth-btn">
            {loading ? <><span className="auth-spinner" /> جاري التحقق...</>
             : <><ShieldCheck className="h-[18px] w-[18px]" /> تأكيد</>}
          </button>
        </form>

        <div className="mt-7 text-center">
          {cooldown > 0 ? (
            <p className="text-[15px]" style={{ color: '#807A72' }}>
              إعادة الإرسال بعد <span className="font-mono font-bold" style={{ color: '#D4B896' }}>{cooldown}</span> ثانية
            </p>
          ) : (
            <button onClick={resend} className="auth-link inline-flex items-center gap-1.5 text-sm font-bold">
              <RotateCw className="h-3.5 w-3.5" /> إعادة إرسال الرمز
            </button>
          )}
        </div>

        <div className="auth-divider my-7" />
        <p className="text-center text-[15px]" style={{ color: '#807A72' }}>
          بريد خاطئ؟ <Link href="/register" className="auth-link font-bold">العودة للتسجيل</Link>
        </p>
      </div>
    </div>
  );
}
