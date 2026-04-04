'use client';

import { useState, useCallback, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button, Input, Card, CardContent } from '@/components/ui';
import { ApiError } from '@/lib/api';

interface FormFields {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  salonNameAr: string;
  salonNameEn: string;
}

type FormErrors = Partial<Record<keyof FormFields, string>>;

const initialForm: FormFields = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  salonNameAr: '',
  salonNameEn: '',
};

export default function RegisterPage(): React.ReactElement {
  const router = useRouter();
  const { register } = useAuth();

  const [form, setForm] = useState<FormFields>(initialForm);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const updateField = useCallback(
    (field: keyof FormFields, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    },
    [],
  );

  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    if (!form.fullName.trim()) newErrors.fullName = 'الاسم الكامل مطلوب';
    if (!form.email.trim()) newErrors.email = 'البريد الإلكتروني مطلوب';
    if (!form.phone.trim()) newErrors.phone = 'رقم الجوال مطلوب';
    if (!form.password) newErrors.password = 'كلمة المرور مطلوبة';
    else if (form.password.length < 8) newErrors.password = 'كلمة المرور يجب أن تكون 8 أحرف على الأقل';
    if (!form.salonNameAr.trim()) newErrors.salonNameAr = 'اسم الصالون بالعربي مطلوب';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      setLoading(true);
      try {
        await register({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          password: form.password,
          salonNameAr: form.salonNameAr.trim(),
          salonNameEn: form.salonNameEn.trim(),
        });
        toast.success('تم إنشاء الحساب بنجاح');
        router.push('/onboarding');
      } catch (error) {
        if (error instanceof ApiError) {
          // Show validation details if available
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
    [form, register, router, validate],
  );

  return (
    <Card>
      <CardContent className="p-6 pt-6">
        <h2 className="mb-6 text-center text-lg font-semibold text-[var(--foreground)]">
          إنشاء حساب جديد
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="الاسم الكامل"
            placeholder="مثال: فاطمة أحمد"
            value={form.fullName}
            onChange={(e) => updateField('fullName', e.target.value)}
            error={errors.fullName}
            autoComplete="name"
          />

          <Input
            label="البريد الإلكتروني"
            type="email"
            placeholder="email@example.com"
            value={form.email}
            onChange={(e) => updateField('email', e.target.value)}
            error={errors.email}
            autoComplete="email"
            dir="ltr"
            className="text-start"
          />

          <Input
            label="رقم الجوال"
            type="tel"
            placeholder="05XXXXXXXX"
            value={form.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            error={errors.phone}
            autoComplete="tel"
            dir="ltr"
            className="text-start"
          />

          <Input
            label="كلمة المرور"
            type="password"
            placeholder="••••••••"
            value={form.password}
            onChange={(e) => updateField('password', e.target.value)}
            error={errors.password}
            autoComplete="new-password"
            dir="ltr"
            className="text-start"
          />

          <Input
            label="اسم الصالون (عربي)"
            placeholder="مثال: صالون الأناقة"
            value={form.salonNameAr}
            onChange={(e) => updateField('salonNameAr', e.target.value)}
            error={errors.salonNameAr}
          />

          <Input
            label="اسم الصالون (إنجليزي) — اختياري"
            placeholder="e.g. Elegance Salon"
            value={form.salonNameEn}
            onChange={(e) => updateField('salonNameEn', e.target.value)}
            error={errors.salonNameEn}
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
                جاري إنشاء الحساب...
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                إنشاء حساب
              </span>
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
          لديك حساب بالفعل؟{' '}
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
