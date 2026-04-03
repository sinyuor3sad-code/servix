'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageHeader, Button, Input, Select, Textarea } from '@/components/ui';
import { dashboardService } from '@/services/dashboard.service';
import { useAuth } from '@/hooks/useAuth';

const clientSchema = z.object({
  fullName: z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل'),
  phone: z
    .string()
    .min(10, 'رقم الجوال يجب أن يكون 10 أرقام على الأقل')
    .regex(/^[0-9+]+$/, 'رقم جوال غير صالح'),
  email: z
    .string()
    .email('البريد الإلكتروني غير صالح')
    .or(z.literal(''))
    .optional(),
  gender: z.enum(['female', 'male'], {
    required_error: 'يرجى اختيار الجنس',
  }),
  notes: z.string().optional(),
});

type ClientFormData = z.infer<typeof clientSchema>;

export default function NewClientPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      email: '',
      gender: 'female',
      notes: '',
    },
  });

  const mutation = useMutation({
    mutationFn: (data: ClientFormData) =>
      dashboardService.createClient(data, accessToken!),
    onSuccess: () => {
      toast.success('تم إضافة العميل بنجاح');
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      router.push('/clients');
    },
    onError: () => {
      toast.error('حدث خطأ أثناء إضافة العميل');
    },
  });

  function onSubmit(data: ClientFormData) {
    mutation.mutate(data);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader title="عميل جديد" description="إضافة عميل جديد إلى القائمة" />

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mx-auto max-w-2xl space-y-6"
      >
        <Input
          label="الاسم الكامل"
          placeholder="أدخل اسم العميل"
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

        <input type="hidden" value="female" {...register('gender')} />

        <Textarea
          label="ملاحظات"
          placeholder="ملاحظات حول العميل (اختياري)"
          error={errors.notes?.message}
          {...register('notes')}
        />

        <div className="flex items-center gap-3 pt-4">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'جارٍ الإضافة...' : 'إضافة العميل'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/clients')}
          >
            إلغاء
          </Button>
        </div>
      </form>
    </div>
  );
}
