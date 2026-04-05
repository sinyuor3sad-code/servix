'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, Sparkles, Clock, Tag, FileText } from 'lucide-react';
import { PageHeader, Button, Input, Textarea } from '@/components/ui';
import { dashboardService } from '@/services/dashboard.service';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const serviceSchema = z.object({
  nameAr: z.string().min(2, 'اسم الخدمة بالعربية مطلوب'),
  nameEn: z.string().optional(),
  categoryId: z.string().min(1, 'يرجى اختيار التصنيف'),
  price: z.coerce.number().min(1, 'السعر يجب أن يكون أكبر من 0'),
  duration: z.coerce.number().min(5, 'المدة يجب أن تكون 5 دقائق على الأقل'),
  descriptionAr: z.string().optional(),
});

type ServiceFormData = z.infer<typeof serviceSchema>;

const DURATIONS = [15, 30, 45, 60, 90, 120, 180];

export default function NewServicePage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: { nameAr: '', nameEn: '', categoryId: '', price: 0, duration: 30, descriptionAr: '' },
  });

  const watchDuration = watch('duration');
  const watchCat = watch('categoryId');
  const watchPrice = watch('price');

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => dashboardService.getCategories(accessToken!),
    enabled: !!accessToken,
  });

  const mutation = useMutation({
    mutationFn: (data: ServiceFormData) => dashboardService.createService(data, accessToken!),
    onSuccess: () => {
      toast.success('✅ تم إضافة الخدمة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['services'] });
      router.push('/services');
    },
    onError: () => toast.error('حدث خطأ أثناء إضافة الخدمة'),
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="إضافة خدمة جديدة"
        description="أضيفي خدمة جديدة لقائمة خدمات الصالون"
        actions={
          <Button variant="outline" size="sm" onClick={() => router.push('/services')}>
            <ArrowRight className="h-3.5 w-3.5" />
            الخدمات
          </Button>
        }
      />

      <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-5">

        {/* Section 1: Basic Info */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-[var(--brand-primary)] text-white flex items-center justify-center text-xs font-bold">1</div>
            <h3 className="text-sm font-bold">معلومات الخدمة</h3>
          </div>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="الاسم بالعربية *" placeholder="مثال: قص شعر" error={errors.nameAr?.message} {...register('nameAr')} />
              <Input label="الاسم بالإنجليزية" placeholder="e.g. Haircut" error={errors.nameEn?.message} {...register('nameEn')} />
            </div>
            <Textarea label="الوصف (اختياري)" placeholder="وصف مختصر للخدمة يظهر للعملاء..." error={errors.descriptionAr?.message} {...register('descriptionAr')} />
          </div>
        </div>

        {/* Section 2: Category */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-[var(--brand-primary)] text-white flex items-center justify-center text-xs font-bold">2</div>
            <h3 className="text-sm font-bold">التصنيف</h3>
          </div>
          {errors.categoryId && <p className="text-xs text-red-500 mb-2">{errors.categoryId.message}</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {categories?.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setValue('categoryId', c.id)}
                className={cn(
                  'p-3 rounded-xl border-2 text-center transition-all',
                  watchCat === c.id
                    ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5 shadow-sm'
                    : 'border-[var(--border)] hover:border-[var(--brand-primary)]/40',
                )}
              >
                <Tag className={cn('h-5 w-5 mx-auto mb-1.5', watchCat === c.id ? 'text-[var(--brand-primary)]' : 'text-[var(--muted-foreground)]')} />
                <div className="text-xs font-bold">{c.nameAr}</div>
                {c.nameEn && <div className="text-[10px] text-[var(--muted-foreground)]">{c.nameEn}</div>}
              </button>
            ))}
          </div>
        </div>

        {/* Section 3: Price & Duration */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-[var(--brand-primary)] text-white flex items-center justify-center text-xs font-bold">3</div>
            <h3 className="text-sm font-bold">السعر والمدة</h3>
          </div>

          {/* Price */}
          <div className="mb-4">
            <label className="text-xs font-medium text-[var(--muted-foreground)] mb-2 block">السعر (ر.س) *</label>
            <div className="relative">
              <input
                type="number"
                {...register('price')}
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--background)] text-lg font-bold text-center focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 outline-none transition-all"
                placeholder="0"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[var(--muted-foreground)]">ر.س</span>
            </div>
            {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price.message}</p>}
            {watchPrice > 0 && (
              <p className="text-[11px] text-emerald-600 mt-1">
                شامل الضريبة: {(watchPrice * 1.15).toFixed(0)} ر.س
              </p>
            )}
          </div>

          {/* Duration */}
          <div>
            <label className="text-xs font-medium text-[var(--muted-foreground)] mb-2 block">المدة *</label>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setValue('duration', d)}
                  className={cn(
                    'px-4 py-2.5 rounded-xl border-2 text-xs font-bold transition-all',
                    watchDuration === d
                      ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white shadow-md'
                      : 'border-[var(--border)] hover:border-[var(--brand-primary)]/40',
                  )}
                >
                  <Clock className="h-3 w-3 inline mr-1" />
                  {d >= 60 ? `${d / 60} ساعة${d > 60 ? ` ${d % 60 > 0 ? `و ${d % 60} د` : ''}` : ''}` : `${d} دقيقة`}
                </button>
              ))}
            </div>
            {errors.duration && <p className="text-xs text-red-500 mt-1">{errors.duration.message}</p>}
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={mutation.isPending} className="flex-1 py-3">
            {mutation.isPending ? (
              <span>جارٍ الإضافة...</span>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                إضافة الخدمة
              </>
            )}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push('/services')}>
            إلغاء
          </Button>
        </div>
      </form>
    </div>
  );
}
