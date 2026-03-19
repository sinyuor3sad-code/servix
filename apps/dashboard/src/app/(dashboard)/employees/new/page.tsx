'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageHeader, Button, Input, Select } from '@/components/ui';
import { dashboardService } from '@/services/dashboard.service';
import { useAuth } from '@/hooks/useAuth';

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
  role: z.enum(['stylist', 'manager', 'receptionist', 'cashier'], {
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
    formState: { errors },
  } = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      email: '',
      role: 'stylist',
      commissionType: 'percentage',
      commissionValue: 0,
    },
  });

  const commissionType = watch('commissionType');

  const mutation = useMutation({
    mutationFn: (data: EmployeeFormData) =>
      dashboardService.createEmployee(data, accessToken!),
    onSuccess: () => {
      toast.success('تم إضافة الموظفة بنجاح');
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
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader title="إضافة موظفة" description="إضافة موظفة جديدة للفريق" />

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mx-auto max-w-2xl space-y-6"
      >
        <Input
          label="الاسم الكامل"
          placeholder="أدخل اسم الموظفة"
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
            label="البريد الإلكتروني"
            placeholder="example@email.com"
            error={errors.email?.message}
            {...register('email')}
          />
        </div>

        <Select
          label="الدور"
          options={[
            { value: 'stylist', label: 'مصففة' },
            { value: 'manager', label: 'مديرة' },
            { value: 'receptionist', label: 'موظفة استقبال' },
            { value: 'cashier', label: 'كاشيرة' },
          ]}
          error={errors.role?.message}
          {...register('role')}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="نوع العمولة"
            options={[
              { value: 'percentage', label: 'نسبة مئوية' },
              { value: 'fixed', label: 'مبلغ ثابت' },
              { value: 'none', label: 'بدون عمولة' },
            ]}
            error={errors.commissionType?.message}
            {...register('commissionType')}
          />
          {commissionType !== 'none' && (
            <Input
              type="number"
              label={commissionType === 'percentage' ? 'النسبة (%)' : 'المبلغ (ر.س)'}
              placeholder="0"
              error={errors.commissionValue?.message}
              {...register('commissionValue')}
            />
          )}
        </div>

        <div className="flex items-center gap-3 pt-4">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'جارٍ الإضافة...' : 'إضافة الموظفة'}
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
