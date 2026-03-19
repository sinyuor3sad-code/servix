'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageHeader, Button, Input, Textarea, Skeleton } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

const salonSchema = z.object({
  salonNameAr: z.string().min(2, 'اسم الصالون بالعربية مطلوب'),
  salonNameEn: z.string().optional(),
  phone: z
    .string()
    .min(10, 'رقم الجوال يجب أن يكون 10 أرقام على الأقل')
    .regex(/^[0-9+]+$/, 'رقم جوال غير صالح'),
  email: z.string().email('البريد الإلكتروني غير صالح').or(z.literal('')).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  description: z.string().optional(),
});

type SalonFormData = z.infer<typeof salonSchema>;

interface SalonInfo {
  salonNameAr?: string;
  salonNameEn?: string;
  nameAr?: string;
  nameEn?: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  description?: string;
}

export default function SalonSettingsPage(): React.ReactElement {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  const { data: salonInfo, isLoading } = useQuery<SalonInfo>({
    queryKey: ['settings', 'salon'],
    queryFn: () => api.get<SalonInfo>('/salon', accessToken!),
    enabled: !!accessToken,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<SalonFormData>({
    resolver: zodResolver(salonSchema),
  });

  useEffect(() => {
    if (salonInfo) {
      reset({
        salonNameAr: salonInfo.salonNameAr ?? salonInfo.nameAr ?? '',
        salonNameEn: salonInfo.salonNameEn ?? salonInfo.nameEn ?? '',
        phone: salonInfo.phone ?? '',
        email: salonInfo.email ?? '',
        address: salonInfo.address ?? '',
        city: salonInfo.city ?? '',
        description: salonInfo.description ?? '',
      });
    }
  }, [salonInfo, reset]);

  const mutation = useMutation({
    mutationFn: (data: SalonFormData) =>
      api.put('/salon', {
        nameAr: data.salonNameAr,
        nameEn: data.salonNameEn || undefined,
        phone: data.phone,
        email: data.email || undefined,
        address: data.address || undefined,
        city: data.city || undefined,
        description: data.description || undefined,
      }, accessToken!),
    onSuccess: () => {
      toast.success('تم حفظ بيانات الصالون بنجاح');
      queryClient.invalidateQueries({ queryKey: ['settings', 'salon'] });
    },
    onError: () => {
      toast.error('حدث خطأ أثناء حفظ البيانات');
    },
  });

  function onSubmit(data: SalonFormData): void {
    mutation.mutate(data);
  }

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <Skeleton className="h-10 w-64" />
        <div className="mx-auto max-w-2xl space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader title="بيانات الصالون" description="معلومات الصالون الأساسية" />

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mx-auto max-w-2xl space-y-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="اسم الصالون (عربي)"
            placeholder="صالون الأناقة"
            error={errors.salonNameAr?.message}
            {...register('salonNameAr')}
          />
          <Input
            label="اسم الصالون (إنجليزي)"
            placeholder="Elegance Salon"
            error={errors.salonNameEn?.message}
            {...register('salonNameEn')}
          />
        </div>

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
            placeholder="info@salon.com"
            error={errors.email?.message}
            {...register('email')}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="العنوان"
            placeholder="حي النخيل، الرياض"
            error={errors.address?.message}
            {...register('address')}
          />
          <Input
            label="المدينة"
            placeholder="الرياض"
            error={errors.city?.message}
            {...register('city')}
          />
        </div>

        <Textarea
          label="وصف الصالون"
          placeholder="وصف مختصر عن الصالون"
          error={errors.description?.message}
          {...register('description')}
        />

        <div className="flex items-center gap-3 pt-4">
          <Button type="submit" disabled={mutation.isPending || !isDirty}>
            {mutation.isPending ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
          </Button>
        </div>
      </form>
    </div>
  );
}
