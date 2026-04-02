'use client';

import { useState, useCallback, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { LogIn } from 'lucide-react';
import { useAuth, getLandingRoute } from '@/hooks/useAuth';
import { Button, Input, Card, CardContent } from '@/components/ui';
import { ApiError } from '@/lib/api';
import type { UserRole } from '@/stores/auth.store';

export default function LoginPage(): React.ReactElement {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

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
          toast.error(error.message);
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
    <Card>
      <CardContent className="p-6 pt-6">
        <h2 className="mb-6 text-center text-lg font-semibold text-[var(--foreground)]">
          تسجيل الدخول
        </h2>

        {/* Dev-mode quick login hints */}
        {typeof window !== 'undefined' && window.location.hostname === 'localhost' && (
          <div className="mb-4 space-y-1.5">
            <button
              type="button"
              onClick={() => { setEmail('servix@dev.local'); setPassword('adsf1324'); }}
              className="w-full rounded-lg border border-dashed border-[var(--brand-primary)]/30 bg-[var(--primary-50)] px-3 py-2 text-[12px] text-[var(--brand-primary)] transition-colors hover:bg-[var(--primary-100)]"
            >
              🧪 مالك صالون — تعبئة تلقائية
            </button>
            <button
              type="button"
              onClick={() => { setEmail('cashier@dev.local'); setPassword('adsf1324'); }}
              className="w-full rounded-lg border border-dashed border-emerald-500/30 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-600 transition-colors hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
            >
              🧪 كاشير — تعبئة تلقائية (يوجّه إلى /pos)
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="البريد الإلكتروني أو رقم الجوال"
            type="text"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            autoComplete="email"
            dir="ltr"
            className="text-start"
          />

          <Input
            label="كلمة المرور"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            autoComplete="current-password"
            dir="ltr"
            className="text-start"
          />

          <div className="flex items-center justify-end">
            <Link
              href="/forgot-password"
              className="text-sm text-[var(--brand-primary)] hover:underline"
            >
              نسيت كلمة المرور؟
            </Link>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                جاري الدخول...
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <LogIn className="h-4 w-4" />
                تسجيل الدخول
              </span>
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
          ليس لديك حساب؟{' '}
          <Link
            href="/register"
            className="font-medium text-[var(--brand-primary)] hover:underline"
          >
            إنشاء حساب جديد
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
