'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageHeader, Button, Input, Select, Textarea } from '@/components/ui';
import { dashboardService } from '@/services/dashboard.service';
import { useAuth } from '@/hooks/useAuth';

const serviceSchema = z.object({
  nameAr: z.string().min(2, 'اسم الخدمة بالعربية مطلوب'),
  nameEn: z.string().optional(),
  categoryId: z.string().min(1, 'يرجى اختيار التصنيف'),
  price: z.coerce.number().min(1, 'السعر يجب أن يكون أكبر من 0'),
  duration: z.coerce.number().min(5, 'المدة يجب أن تكون 5 دقائق على الأقل'),
  descriptionAr: z.string().optional(),
});

type ServiceFormData = z.infer<typeof serviceSchema>;

export default function NewServicePage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      nameAr: '',
      nameEn: '',
      categoryId: '',
      price: 0,
      duration: 30,
      descriptionAr: '',
    },
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => dashboardService.getCategories(accessToken!),
    enabled: !!accessToken,
  });

  const mutation = useMutation({
    mutationFn: (data: ServiceFormData) =>
      dashboardService.createService(data, accessToken!),
    onSuccess: () => {
      toast.success('تم إضافة الخدمة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['services'] });
      router.push('/services');
    },
    onError: () => {
      toast.error('حدث خطأ أثناء إضافة الخدمة');
    },
  });

  function onSubmit(data: ServiceFormData) {
    mutation.mutate(data);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader title="إضافة خدمة" description="إضافة خدمة جديدة للصالون" />

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mx-auto max-w-2xl space-y-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="الاسم بالعربية"
            placeholder="مثال: قص شعر"
            error={errors.nameAr?.message}
            {...register('nameAr')}
          />
          <Input
            label="الاسم بالإنجليزية (اختياري)"
            placeholder="e.g. Haircut"
            error={errors.nameEn?.message}
            {...register('nameEn')}
          />
        </div>

        <Select
          label="التصنيف"
          placeholder="اختر التصنيف"
          options={
            categories?.map((c) => ({
              value: c.id,
              label: c.nameAr,
            })) ?? []
          }
          error={errors.categoryId?.message}
          {...register('categoryId')}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="number"
            label="السعر (ر.س)"
            placeholder="0"
            error={errors.price?.message}
            {...register('price')}
          />
          <Input
            type="number"
            label="المدة (دقيقة)"
            placeholder="30"
            error={errors.duration?.message}
            {...register('duration')}
          />
        </div>

        <Textarea
          label="الوصف (اختياري)"
          placeholder="وصف مختصر للخدمة"
          error={errors.descriptionAr?.message}
          {...register('descriptionAr')}
        />

        <div className="flex items-center gap-3 pt-4">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'جارٍ الإضافة...' : 'إضافة الخدمة'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/services')}
          >
            إلغاء
          </Button>
        </div>
      </form>
    </div>
  );
}
