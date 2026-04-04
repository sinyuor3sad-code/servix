'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, UserPlus } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { dashboardService } from '@/services/dashboard.service';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

/* ───────── Roles Config ───────── */
const ROLES = [
  { value: 'stylist', label: 'مصففة', icon: '✂️', desc: 'قص وتصفيف وصبغ' },
  { value: 'makeup', label: 'مكياج', icon: '💄', desc: 'مكياج سهرات وعرائس' },
  { value: 'nails', label: 'أظافر', icon: '💅', desc: 'مانيكير وبديكير' },
  { value: 'skincare', label: 'عناية بالبشرة', icon: '🧴', desc: 'تنظيف وعناية' },
  { value: 'cashier', label: 'كاشيرة', icon: '💵', desc: 'استقبال ومحاسبة' },
] as const;

const COMMISSION_OPTIONS = [
  { value: 'none', label: 'بدون عمولة', desc: 'راتب ثابت فقط' },
  { value: 'percentage', label: 'نسبة مئوية', desc: 'نسبة من كل خدمة' },
  { value: 'fixed', label: 'مبلغ ثابت', desc: 'مبلغ ثابت لكل خدمة' },
] as const;

const employeeSchema = z.object({
  fullName: z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل'),
  phone: z
    .string()
    .min(10, 'رقم الجوال يجب أن يكون 10 أرقام على الأقل')
    .regex(/^[0-9+]+$/, 'رقم جوال غير صالح')
    .or(z.literal(''))
    .optional(),
  email: z
    .string()
    .email('البريد الإلكتروني غير صالح')
    .or(z.literal(''))
    .optional(),
  role: z.enum(['stylist', 'cashier', 'makeup', 'nails', 'skincare'], {
    required_error: 'يرجى اختيار الدور',
  }),
  commissionType: z.enum(['percentage', 'fixed', 'none'], {
    required_error: 'يرجى اختيار نوع العمولة',
  }),
  commissionValue: z.coerce.number().min(0, 'قيمة العمولة يجب أن تكون 0 أو أكثر'),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;

export default function NewEmployeePage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      email: '',
      role: 'stylist',
      commissionType: 'none',
      commissionValue: 0,
    },
  });

  const selectedRole = watch('role');
  const commissionType = watch('commissionType');

  const mutation = useMutation({
    mutationFn: (data: EmployeeFormData) =>
      dashboardService.createEmployee(data, accessToken!),
    onSuccess: () => {
      toast.success('تم إضافة الموظفة بنجاح ✅');
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      router.push('/employees');
    },
    onError: () => {
      toast.error('حدث خطأ أثناء إضافة الموظفة');
    },
  });

  function onSubmit(data: EmployeeFormData) {
    mutation.mutate(data);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push('/employees')}
          className="flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors mb-4"
        >
          <ArrowRight className="h-4 w-4" />
          العودة للموظفات
        </button>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary)]/60 flex items-center justify-center">
            <UserPlus className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--foreground)]">إضافة موظفة</h1>
            <p className="text-sm text-[var(--muted-foreground)]">أضيفي عضوة جديدة للفريق</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* ── Section 1: Basic Info ── */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[var(--brand-primary)] text-white text-xs flex items-center justify-center">1</span>
            المعلومات الأساسية
          </h2>
          <Input
            label="الاسم الكامل"
            placeholder="مثال: سارة أحمد"
            error={errors.fullName?.message}
            {...register('fullName')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="رقم الجوال"
              placeholder="05XXXXXXXX"
              error={errors.phone?.message}
              {...register('phone')}
            />
            <Input
              type="email"
              label="البريد الإلكتروني (اختياري)"
              placeholder="sara@example.com"
              error={errors.email?.message}
              {...register('email')}
            />
          </div>
        </div>

        {/* ── Section 2: Role Selection ── */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[var(--brand-primary)] text-white text-xs flex items-center justify-center">2</span>
            الدور الوظيفي
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {ROLES.map((role) => (
              <button
                key={role.value}
                type="button"
                onClick={() => setValue('role', role.value)}
                className={cn(
                  'p-3 rounded-xl border-2 text-center transition-all duration-200',
                  selectedRole === role.value
                    ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5 shadow-md scale-[1.02]'
                    : 'border-[var(--border)] hover:border-[var(--brand-primary)]/40',
                )}
              >
                <div className="text-2xl mb-1">{role.icon}</div>
                <div className="text-sm font-semibold text-[var(--foreground)]">{role.label}</div>
                <div className="text-[10px] text-[var(--muted-foreground)] mt-0.5">{role.desc}</div>
              </button>
            ))}
          </div>
          {errors.role && (
            <p className="text-xs text-red-500">{errors.role.message}</p>
          )}
        </div>

        {/* ── Section 3: Commission ── */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[var(--brand-primary)] text-white text-xs flex items-center justify-center">3</span>
            العمولة
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {COMMISSION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setValue('commissionType', opt.value);
                  if (opt.value === 'none') setValue('commissionValue', 0);
                }}
                className={cn(
                  'p-3 rounded-xl border-2 text-center transition-all',
                  commissionType === opt.value
                    ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5'
                    : 'border-[var(--border)] hover:border-[var(--brand-primary)]/40',
                )}
              >
                <div className="text-xs font-semibold text-[var(--foreground)]">{opt.label}</div>
                <div className="text-[10px] text-[var(--muted-foreground)] mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>

          {commissionType !== 'none' && (
            <div className="pt-2">
              <Input
                type="number"
                label={commissionType === 'percentage' ? 'النسبة (%)' : 'المبلغ (ر.س)'}
                placeholder={commissionType === 'percentage' ? 'مثال: 10' : 'مثال: 50'}
                error={errors.commissionValue?.message}
                {...register('commissionValue')}
              />
            </div>
          )}
        </div>

        {/* ── Submit ── */}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={mutation.isPending} className="flex-1 py-3">
            {mutation.isPending ? 'جارٍ الإضافة...' : '✅ إضافة الموظفة'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/employees')}
          >
            إلغاء
          </Button>
        </div>
      </form>
    </div>
  );
}
