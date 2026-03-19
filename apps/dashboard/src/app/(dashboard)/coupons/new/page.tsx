'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageHeader, Button, Input, Select } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

const couponSchema = z.object({
  code: z
    .string()
    .min(3, 'الكود يجب أن يكون 3 أحرف على الأقل')
    .max(20, 'الكود يجب أن لا يتجاوز 20 حرف')
    .regex(/^[A-Z0-9_-]+$/i, 'الكود يجب أن يحتوي على أحرف إنجليزية وأرقام فقط'),
  type: z.enum(['percentage', 'fixed_amount'], {
    required_error: 'يرجى اختيار النوع',
  }),
  value: z.coerce.number().min(1, 'القيمة يجب أن تكون أكبر من صفر'),
  minOrderAmount: z.coerce.number().min(0, 'الحد الأدنى يجب أن يكون صفر أو أكثر').optional(),
  maxUses: z.coerce.number().min(1, 'عدد الاستخدامات يجب أن يكون 1 على الأقل'),
  startDate: z.string().min(1, 'تاريخ البدء مطلوب'),
  endDate: z.string().min(1, 'تاريخ الانتهاء مطلوب'),
});

type CouponFormData = z.infer<typeof couponSchema>;

export default function NewCouponPage(): React.ReactElement {
  const router = useRouter();
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CouponFormData>({
    resolver: zodResolver(couponSchema),
    defaultValues: {
      code: '',
      type: 'percentage',
      value: 0,
      minOrderAmount: 0,
      maxUses: 100,
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
    },
  });

  const mutation = useMutation({
    mutationFn: (data: CouponFormData) =>
      api.post('/coupons', data, accessToken!),
    onSuccess: () => {
      toast.success('تم إنشاء الكوبون بنجاح');
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
      router.push('/coupons');
    },
    onError: () => {
      toast.error('حدث خطأ أثناء إنشاء الكوبون');
    },
  });

  function onSubmit(data: CouponFormData): void {
    mutation.mutate(data);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader title="كوبون جديد" description="إنشاء كوبون خصم جديد" />

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mx-auto max-w-2xl space-y-6"
      >
        <Input
          label="كود الكوبون"
          placeholder="مثال: SUMMER2026"
          error={errors.code?.message}
          {...register('code')}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="النوع"
            options={[
              { value: 'percentage', label: 'نسبة مئوية' },
              { value: 'fixed_amount', label: 'مبلغ ثابت' },
            ]}
            error={errors.type?.message}
            {...register('type')}
          />
          <Input
            type="number"
            label="القيمة"
            placeholder="0"
            error={errors.value?.message}
            {...register('value')}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="number"
            label="الحد الأدنى للطلب (ر.س)"
            placeholder="0"
            error={errors.minOrderAmount?.message}
            {...register('minOrderAmount')}
          />
          <Input
            type="number"
            label="الحد الأقصى للاستخدام"
            placeholder="100"
            error={errors.maxUses?.message}
            {...register('maxUses')}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="date"
            label="تاريخ البدء"
            error={errors.startDate?.message}
            {...register('startDate')}
          />
          <Input
            type="date"
            label="تاريخ الانتهاء"
            error={errors.endDate?.message}
            {...register('endDate')}
          />
        </div>

        <div className="flex items-center gap-3 pt-4">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'جارٍ الإنشاء...' : 'إنشاء الكوبون'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/coupons')}
          >
            إلغاء
          </Button>
        </div>
      </form>
    </div>
  );
}
