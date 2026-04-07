'use client';

import { useState, useCallback, useEffect, type FormEvent } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Lock, ArrowRight, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { Button, Input, Card, CardContent } from '@/components/ui';
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

  // Verify token on mount
  useEffect(() => {
    if (!token) {
      setTokenValid(false);
      setTokenError('رابط إعادة التعيين غير صالح — لا يوجد رمز');
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await api.post<{ valid: boolean }>('/auth/verify-reset-token', { token });
        if (res.valid) {
          setTokenValid(true);
        } else {
          setTokenValid(false);
          setTokenError('رابط إعادة التعيين منتهي الصلاحية أو مُستخدم مسبقاً');
        }
      } catch {
        setTokenValid(false);
        setTokenError('رابط إعادة التعيين غير صالح أو منتهي الصلاحية');
      }
    };

    verifyToken();
  }, [token]);

  const validate = useCallback((): boolean => {
    const newErrors: { password?: string; confirm?: string } = {};

    if (password.length < 8) {
      newErrors.password = 'كلمة المرور يجب أن تكون 8 أحرف على الأقل';
    }
    if (password !== confirmPassword) {
      newErrors.confirm = 'كلمتا المرور غير متطابقتين';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [password, confirmPassword]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      setLoading(true);
      try {
        await api.post('/auth/reset-password', {
          token,
          newPassword: password,
        });
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

  // Token invalid state
  if (tokenValid === false) {
    return (
      <Card>
        <CardContent className="p-6 pt-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <AlertCircle className="h-6 w-6 text-red-500" />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-[var(--foreground)]">
            رابط غير صالح
          </h2>
          <p className="mb-6 text-sm text-[var(--muted-foreground)]">
            {tokenError}
          </p>
          <Link href="/forgot-password">
            <Button variant="outline" className="w-full">
              طلب رابط جديد
            </Button>
          </Link>
          <p className="mt-4 text-center text-sm text-[var(--muted-foreground)]">
            <Link
              href="/login"
              className="font-medium text-[var(--brand-primary)] hover:underline"
            >
              العودة لتسجيل الدخول
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  // Loading token validation
  if (tokenValid === null) {
    return (
      <Card>
        <CardContent className="p-6 pt-6 text-center">
          <div className="mx-auto mb-4 flex h-8 w-8 animate-spin rounded-full border-4 border-[var(--brand-primary)] border-t-transparent" />
          <p className="text-sm text-[var(--muted-foreground)]">
            جاري التحقق من الرابط...
          </p>
        </CardContent>
      </Card>
    );
  }

  // Success state
  if (success) {
    return (
      <Card>
        <CardContent className="p-6 pt-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--success-light)]">
            <CheckCircle2 className="h-6 w-6 text-[var(--success)]" />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-[var(--foreground)]">
            تم التغيير بنجاح
          </h2>
          <p className="mb-6 text-sm text-[var(--muted-foreground)]">
            تم إعادة تعيين كلمة المرور. سيتم توجيهك لتسجيل الدخول خلال 3 ثوان...
          </p>
          <Link href="/login">
            <Button className="w-full">
              <ArrowRight className="h-4 w-4" />
              تسجيل الدخول الآن
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  // Form state
  return (
    <Card>
      <CardContent className="p-6 pt-6">
        <h2 className="mb-2 text-center text-lg font-semibold text-[var(--foreground)]">
          إعادة تعيين كلمة المرور
        </h2>
        <p className="mb-6 text-center text-sm text-[var(--muted-foreground)]">
          أدخل كلمة مرورك الجديدة
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Input
              label="كلمة المرور الجديدة"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors((prev) => ({ ...prev, password: undefined }));
              }}
              error={errors.password}
              autoComplete="new-password"
              dir="ltr"
              className="text-start"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute left-3 top-[38px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <Input
            label="تأكيد كلمة المرور"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setErrors((prev) => ({ ...prev, confirm: undefined }));
            }}
            error={errors.confirm}
            autoComplete="new-password"
            dir="ltr"
            className="text-start"
          />

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                جاري الحفظ...
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Lock className="h-4 w-4" />
                تعيين كلمة المرور الجديدة
              </span>
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
          تذكرت كلمة المرور؟{' '}
          <Link
            href="/login"
            className="font-medium text-[var(--brand-primary)] hover:underline"
          >
            تسجيل الدخول
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
