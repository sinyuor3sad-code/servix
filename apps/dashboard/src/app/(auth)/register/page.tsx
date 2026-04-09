'use client';

import { useState, useCallback, type FormEvent, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserPlus, User, Mail, Phone, Lock, Store, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
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

const FIELDS: {
  key: keyof FormFields;
  label: string;
  type: string;
  placeholder: string;
  icon: typeof User;
  autoComplete: string;
  dir?: 'ltr';
  required?: boolean;
}[] = [
  { key: 'fullName',    label: 'الاسم الكامل',                    type: 'text',     placeholder: 'مثال: فاطمة أحمد',  icon: User,  autoComplete: 'name' },
  { key: 'email',       label: 'البريد الإلكتروني',                type: 'email',    placeholder: 'email@example.com', icon: Mail,  autoComplete: 'email', dir: 'ltr' },
  { key: 'phone',       label: 'رقم الجوال',                      type: 'tel',      placeholder: '05XXXXXXXX',        icon: Phone, autoComplete: 'tel',   dir: 'ltr' },
  { key: 'password',    label: 'كلمة المرور',                     type: 'password', placeholder: '••••••••',           icon: Lock,  autoComplete: 'new-password', dir: 'ltr' },
  { key: 'salonNameAr', label: 'اسم الصالون (عربي)',              type: 'text',     placeholder: 'مثال: صالون الأناقة', icon: Store, autoComplete: 'organization', required: true },
  { key: 'salonNameEn', label: 'اسم الصالون (إنجليزي) — اختياري', type: 'text',     placeholder: 'e.g. Elegance Salon', icon: Store, autoComplete: 'organization', dir: 'ltr' },
];

export default function RegisterPage(): React.ReactElement {
  const router = useRouter();
  const { register } = useAuth();

  const [form, setForm] = useState<FormFields>(initialForm);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

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
        toast.success('تم إنشاء الحساب — أدخل رمز التحقق المرسل لإيميلك');
        router.push(`/verify-email?email=${encodeURIComponent(form.email.trim())}`);
      } catch (error) {
        if (error instanceof ApiError) {
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
    <div
      className="transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(16px)',
      }}
    >
      {/* ── Auth card ── */}
      <div className="auth-card-luxury p-8 sm:p-10">
        <h2 className="auth-title mb-2 text-center">إنشاء حساب جديد</h2>
        <p className="mb-8 text-center text-sm" style={{ color: '#807A72' }}>
          ابدئي تجربتك المجانية ١٤ يوم — بلا بطاقة ائتمان
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {FIELDS.map((field) => {
            const Icon = field.icon;
            return (
              <div key={field.key} className="space-y-2">
                <label className="auth-label block text-sm">{field.label}</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3.5">
                    <Icon className="h-4 w-4" style={{ color: '#807A72' }} />
                  </div>
                  <input
                    type={field.type}
                    placeholder={field.placeholder}
                    value={form[field.key]}
                    onChange={(e) => updateField(field.key, e.target.value)}
                    autoComplete={field.autoComplete}
                    dir={field.dir}
                    className={`auth-input w-full pe-10 ${field.dir === 'ltr' ? 'text-start' : ''}`}
                  />
                </div>
                {errors[field.key] && (
                  <p className="auth-error text-xs">{errors[field.key]}</p>
                )}
              </div>
            );
          })}

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="auth-btn-gold flex w-full items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
                    style={{ borderColor: '#080808', borderTopColor: 'transparent' }}
                  />
                  جاري إنشاء الحساب...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  إنشاء حساب
                </>
              )}
            </button>
          </div>
        </form>

        {/* Divider */}
        <div className="auth-divider my-7" />

        {/* Login link */}
        <p className="text-center text-sm" style={{ color: '#807A72' }}>
          لديك حساب بالفعل؟{' '}
          <Link href="/login" className="auth-link font-medium">
            تسجيل الدخول
          </Link>
        </p>
      </div>

      {/* Back to landing */}
      <div className="mt-6 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm transition-colors duration-200"
          style={{ color: '#807A72' }}
        >
          <ArrowLeft className="h-3.5 w-3.5" style={{ transform: 'scaleX(-1)' }} />
          العودة للصفحة الرئيسية
        </Link>
      </div>
    </div>
  );
}
