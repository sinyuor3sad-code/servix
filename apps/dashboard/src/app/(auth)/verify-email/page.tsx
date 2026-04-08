'use client';

import { useState, useCallback, useEffect, useRef, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ShieldCheck, RotateCw } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { authService } from '@/services/auth.service';
import { Button, Card, CardContent } from '@/components/ui';
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
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const { login: storeLogin, setUserRole, setCurrentTenant } = useAuthStore();

  // Auto-focus first input
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((p) => p - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Handle individual digit input
  const handleChange = useCallback(
    (index: number, value: string) => {
      // Only allow digits
      const digit = value.replace(/\D/g, '').slice(-1);
      const newOtp = [...otp];
      newOtp[index] = digit;
      setOtp(newOtp);

      // Auto-advance to next input
      if (digit && index < OTP_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }

      // Auto-submit when all digits filled
      if (digit && index === OTP_LENGTH - 1 && newOtp.every((d) => d)) {
        handleSubmitCode(newOtp.join(''));
      }
    },
    [otp], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Handle backspace
  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent) => {
      if (e.key === 'Backspace' && !otp[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    },
    [otp],
  );

  // Handle paste
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
      if (pasted.length === 0) return;
      const newOtp = [...otp];
      for (let i = 0; i < pasted.length; i++) {
        newOtp[i] = pasted[i];
      }
      setOtp(newOtp);
      // Focus last filled or next empty
      const focusIndex = Math.min(pasted.length, OTP_LENGTH - 1);
      inputRefs.current[focusIndex]?.focus();

      if (pasted.length === OTP_LENGTH) {
        handleSubmitCode(pasted);
      }
    },
    [otp], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleSubmitCode = async (code: string) => {
    if (!email) {
      toast.error('البريد الإلكتروني مفقود');
      return;
    }

    setLoading(true);
    try {
      const result = await authService.verifyOtp(email, code);

      // Now login with the tokens
      storeLogin(result.user, result.tokens.accessToken, result.tokens.refreshToken);

      if (result.tenants?.length > 0) {
        const tu = result.tenants[0];
        const roleName = tu.role?.name || 'owner';
        setUserRole(roleName as 'owner' | 'manager' | 'cashier' | 'staff', tu.isOwner);
        setCurrentTenant(tu.tenant);
      }

      toast.success('تم التحقق بنجاح — أهلاً بك!');
      router.push('/');
    } catch (error) {
      // Clear OTP on error
      setOtp(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();

      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('رمز التحقق غير صحيح');
      }
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
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('فشل إعادة الإرسال');
      }
    }
  };

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length === OTP_LENGTH) {
      handleSubmitCode(code);
    }
  };

  if (!email) {
    return (
      <Card>
        <CardContent className="p-6 pt-6 text-center">
          <p className="text-[var(--muted-foreground)]">رابط غير صالح</p>
          <Link href="/register" className="mt-4 inline-block text-[var(--brand-primary)] hover:underline">
            العودة للتسجيل
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6 pt-6">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--brand-primary)]/10">
            <ShieldCheck className="h-8 w-8 text-[var(--brand-primary)]" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            تأكيد البريد الإلكتروني
          </h2>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            أدخل رمز التحقق المكون من 6 أرقام المرسل إلى
          </p>
          <p className="mt-1 font-medium text-[var(--foreground)]" dir="ltr">
            {email}
          </p>
        </div>

        <form onSubmit={handleFormSubmit}>
          {/* OTP Input Boxes */}
          <div className="mb-6 flex justify-center gap-2" dir="ltr" onPaste={handlePaste}>
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className={`
                  h-14 w-12 rounded-lg border-2 text-center text-2xl font-bold
                  transition-all duration-200 outline-none
                  ${digit
                    ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5 text-[var(--foreground)]'
                    : 'border-[var(--border)] bg-[var(--input)] text-[var(--foreground)]'
                  }
                  focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20
                `}
                disabled={loading}
                autoComplete="one-time-code"
              />
            ))}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading || otp.some((d) => !d)}
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                جاري التحقق...
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                تأكيد
              </span>
            )}
          </Button>
        </form>

        {/* Resend */}
        <div className="mt-4 text-center">
          {cooldown > 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              إعادة الإرسال بعد <span className="font-mono font-bold text-[var(--foreground)]">{cooldown}</span> ثانية
            </p>
          ) : (
            <button
              onClick={handleResend}
              className="inline-flex items-center gap-1 text-sm font-medium text-[var(--brand-primary)] hover:underline"
            >
              <RotateCw className="h-3.5 w-3.5" />
              إعادة إرسال الرمز
            </button>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
          بريد خاطئ؟{' '}
          <Link
            href="/register"
            className="font-medium text-[var(--brand-primary)] hover:underline"
          >
            العودة للتسجيل
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
