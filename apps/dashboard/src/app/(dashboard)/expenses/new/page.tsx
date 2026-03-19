'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageHeader, Button, Input, Select, Textarea } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

const expenseSchema = z.object({
  description: z.string().min(3, 'الوصف يجب أن يكون 3 أحرف على الأقل'),
  category: z.enum(['rent', 'utilities', 'supplies', 'salary', 'maintenance', 'other'], {
    required_error: 'يرجى اختيار التصنيف',
  }),
  amount: z.coerce.number().min(0.01, 'المبلغ يجب أن يكون أكبر من صفر'),
  date: z.string().min(1, 'التاريخ مطلوب'),
  notes: z.string().optional(),
});

type ExpenseFormData = z.infer<typeof expenseSchema>;

export default function NewExpensePage(): React.ReactElement {
  const router = useRouter();
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      description: '',
      category: 'other',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      notes: '',
    },
  });

  const mutation = useMutation({
    mutationFn: (data: ExpenseFormData) =>
      api.post('/expenses', data, accessToken!),
    onSuccess: () => {
      toast.success('تم إضافة المصروف بنجاح');
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      router.push('/expenses');
    },
    onError: () => {
      toast.error('حدث خطأ أثناء إضافة المصروف');
    },
  });

  function onSubmit(data: ExpenseFormData): void {
    mutation.mutate(data);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader title="مصروف جديد" description="تسجيل مصروف جديد" />

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mx-auto max-w-2xl space-y-6"
      >
        <Input
          label="الوصف"
          placeholder="وصف المصروف"
          error={errors.description?.message}
          {...register('description')}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="التصنيف"
            options={[
              { value: 'rent', label: 'إيجار' },
              { value: 'utilities', label: 'مرافق' },
              { value: 'supplies', label: 'مستلزمات' },
              { value: 'salary', label: 'رواتب' },
              { value: 'maintenance', label: 'صيانة' },
              { value: 'other', label: 'أخرى' },
            ]}
            error={errors.category?.message}
            {...register('category')}
          />
          <Input
            type="number"
            label="المبلغ (ر.س)"
            placeholder="0.00"
            step="0.01"
            error={errors.amount?.message}
            {...register('amount')}
          />
        </div>

        <Input
          type="date"
          label="التاريخ"
          error={errors.date?.message}
          {...register('date')}
        />

        <Textarea
          label="ملاحظات"
          placeholder="ملاحظات إضافية (اختياري)"
          error={errors.notes?.message}
          {...register('notes')}
        />

        <div className="flex items-center gap-3 pt-4">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'جارٍ الإضافة...' : 'إضافة المصروف'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/expenses')}
          >
            إلغاء
          </Button>
        </div>
      </form>
    </div>
  );
}
