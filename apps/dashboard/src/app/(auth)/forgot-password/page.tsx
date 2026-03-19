'use client';

import { useState, useCallback, type FormEvent } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Mail, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button, Input, Card, CardContent } from '@/components/ui';
import { api, ApiError } from '@/lib/api';

export default function ForgotPasswordPage(): React.ReactElement {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!email.trim()) {
        setError('البريد الإلكتروني مطلوب');
        return;
      }
      setError('');
      setLoading(true);

      try {
        await api.post('/auth/forgot-password', { email: email.trim() });
        setSubmitted(true);
        toast.success('تم إرسال رابط الاستعادة بنجاح');
      } catch (err) {
        if (err instanceof ApiError) {
          toast.error(err.message);
        } else {
          toast.error('حدث خطأ غير متوقع');
        }
      } finally {
        setLoading(false);
      }
    },
    [email],
  );

  if (submitted) {
    return (
      <Card>
        <CardContent className="p-6 pt-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--success-light)]">
            <CheckCircle2 className="h-6 w-6 text-[var(--success)]" />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-[var(--foreground)]">
            تم الإرسال بنجاح
          </h2>
          <p className="mb-6 text-sm text-[var(--muted-foreground)]">
            إذا كان البريد الإلكتروني مسجلاً لدينا، ستصلك رسالة تحتوي على رابط
            لاستعادة كلمة المرور.
          </p>
          <Link href="/login">
            <Button variant="outline" className="w-full">
              <ArrowRight className="h-4 w-4" />
              العودة لتسجيل الدخول
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6 pt-6">
        <h2 className="mb-2 text-center text-lg font-semibold text-[var(--foreground)]">
          استعادة كلمة المرور
        </h2>
        <p className="mb-6 text-center text-sm text-[var(--muted-foreground)]">
          أدخل بريدك الإلكتروني وسنرسل لك رابطاً لاستعادة كلمة المرور
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="البريد الإلكتروني"
            type="email"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError('');
            }}
            error={error}
            autoComplete="email"
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
                جاري الإرسال...
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Mail className="h-4 w-4" />
                إرسال رابط الاستعادة
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
