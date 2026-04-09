'use client';

import { useState, useCallback, type FormEvent, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserPlus, User, Mail, Phone, Lock, Store } from 'lucide-react';
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

type FieldDef = {
  key: keyof FormFields;
  label: string;
  type: string;
  placeholder: string;
  icon: typeof User;
  autoComplete: string;
  dir?: 'ltr';
};

const FIELDS: FieldDef[] = [
  { key: 'fullName',    label: 'الاسم الكامل',                    type: 'text',     placeholder: 'مثال: فاطمة أحمد',   icon: User,  autoComplete: 'name' },
  { key: 'email',       label: 'البريد الإلكتروني',                type: 'email',    placeholder: 'email@example.com',  icon: Mail,  autoComplete: 'email', dir: 'ltr' },
  { key: 'phone',       label: 'رقم الجوال',                      type: 'tel',      placeholder: '05XXXXXXXX',         icon: Phone, autoComplete: 'tel',   dir: 'ltr' },
  { key: 'password',    label: 'كلمة المرور',                     type: 'password', placeholder: '••••••••',            icon: Lock,  autoComplete: 'new-password', dir: 'ltr' },
  { key: 'salonNameAr', label: 'اسم الصالون (عربي)',              type: 'text',     placeholder: 'مثال: صالون الأناقة',  icon: Store, autoComplete: 'organization' },
  { key: 'salonNameEn', label: 'اسم الصالون (إنجليزي) — اختياري', type: 'text',     placeholder: 'e.g. Elegance Salon', icon: Store, autoComplete: 'organization', dir: 'ltr' },
];

export default function RegisterPage(): React.ReactElement {
  const router = useRouter();
  const { register } = useAuth();

  const [form, setForm] = useState<FormFields>(initialForm);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [show, setShow] = useState(false);

  useEffect(() => { requestAnimationFrame(() => setShow(true)); }, []);

  const updateField = useCallback(
    (field: keyof FormFields, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    },
    [],
  );

  const validate = useCallback((): boolean => {
    const e: FormErrors = {};
    if (!form.fullName.trim()) e.fullName = 'الاسم الكامل مطلوب';
    if (!form.email.trim()) e.email = 'البريد الإلكتروني مطلوب';
    if (!form.phone.trim()) e.phone = 'رقم الجوال مطلوب';
    if (!form.password) e.password = 'كلمة المرور مطلوبة';
    else if (form.password.length < 8) e.password = 'كلمة المرور يجب أن تكون 8 أحرف على الأقل';
    if (!form.salonNameAr.trim()) e.salonNameAr = 'اسم الصالون بالعربي مطلوب';
    setErrors(e);
    return Object.keys(e).length === 0;
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
          if (error.details?.length) error.details.forEach((d) => toast.error(d));
          else toast.error(error.message);
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
      style={{
        opacity: show ? 1 : 0,
        transform: show ? 'translateY(0)' : 'translateY(12px)',
        transition: 'all 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      <div className="auth-card p-7 sm:p-9">
        {/* Header */}
        <div className="mb-7 text-center">
          <h2 className="auth-title">إنشاء حساب جديد</h2>
          <p className="mt-2 text-sm" style={{ color: '#807A72' }}>
            ابدئي تجربتك المجانية ١٤ يوم — بلا بطاقة ائتمان
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {FIELDS.map((field) => {
            const Icon = field.icon;
            return (
              <div key={field.key}>
                <label className="auth-label">{field.label}</label>
                <div className="relative">
                  <input
                    type={field.type}
                    placeholder={field.placeholder}
                    value={form[field.key]}
                    onChange={(e) => updateField(field.key, e.target.value)}
                    autoComplete={field.autoComplete}
                    dir={field.dir}
                    className={`auth-input pe-11 ${field.dir === 'ltr' ? 'text-start' : ''}`}
                  />
                  <div className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-4">
                    <Icon className="h-[18px] w-[18px]" style={{ color: '#5A5650' }} />
                  </div>
                </div>
                {errors[field.key] && <p className="auth-error">{errors[field.key]}</p>}
              </div>
            );
          })}

          {/* Submit */}
          <div className="pt-1">
            <button type="submit" disabled={loading} className="auth-btn">
              {loading ? (
                <>
                  <span className="auth-spinner" />
                  جاري إنشاء الحساب...
                </>
              ) : (
                <>
                  <UserPlus className="h-[18px] w-[18px]" />
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
          <Link href="/login" className="auth-link font-semibold">
            تسجيل الدخول
          </Link>
        </p>
      </div>

      {/* Back link */}
      <div className="mt-6 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm transition-colors duration-200"
          style={{ color: '#5A5650' }}
        >
          <span style={{ transform: 'scaleX(-1)', display: 'inline-block' }}>←</span>
          العودة للصفحة الرئيسية
        </Link>
      </div>
    </div>
  );
}
