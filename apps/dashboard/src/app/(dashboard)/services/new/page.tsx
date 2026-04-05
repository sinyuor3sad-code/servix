'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, Sparkles, Clock, Tag } from 'lucide-react';
import { Button, Input, Textarea } from '@/components/ui';
import { dashboardService } from '@/services/dashboard.service';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const schema = z.object({
  nameAr: z.string().min(2, 'الاسم مطلوب'),
  nameEn: z.string().optional(),
  categoryId: z.string().min(1, 'اختاري القسم'),
  price: z.coerce.number().min(1, 'السعر مطلوب'),
  duration: z.coerce.number().min(5, 'المدة مطلوبة'),
  descriptionAr: z.string().optional(),
});

type F = z.infer<typeof schema>;
const DURS = [15, 30, 45, 60, 90, 120, 180];

function fmtDur(d: number) {
  if (d < 60) return `${d} دقيقة`;
  const h = Math.floor(d / 60);
  const m = d % 60;
  return m > 0 ? `${h} ساعة و ${m} د` : `${h} ساعة`;
}

export default function NewServicePage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const qc = useQueryClient();

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<F>({
    resolver: zodResolver(schema),
    defaultValues: { nameAr: '', nameEn: '', categoryId: '', price: 0, duration: 30, descriptionAr: '' },
  });

  const dur = watch('duration');
  const cat = watch('categoryId');
  const price = watch('price');

  const { data: cats } = useQuery({
    queryKey: ['categories'],
    queryFn: () => dashboardService.getCategories(accessToken!),
    enabled: !!accessToken,
  });

  const mut = useMutation({
    mutationFn: (d: F) => dashboardService.createService(d, accessToken!),
    onSuccess: () => { toast.success('✅ تم إضافة الخدمة'); qc.invalidateQueries({ queryKey: ['services'] }); router.push('/services'); },
    onError: () => toast.error('حدث خطأ'),
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">إضافة خدمة</h1>
          <p className="text-xs text-[var(--muted-foreground)]">أضيفي خدمة جديدة للصالون</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push('/services')}><ArrowRight className="h-3.5 w-3.5" /> رجوع</Button>
      </div>

      <form onSubmit={handleSubmit(d => mut.mutate(d))} className="space-y-4">
        {/* 1. Info */}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-6 h-6 rounded-lg bg-[var(--brand-primary)] text-white flex items-center justify-center text-[10px] font-black">1</span>
            <span className="text-xs font-bold">معلومات الخدمة</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="الاسم بالعربية *" placeholder="مثال: قص شعر" error={errors.nameAr?.message} {...register('nameAr')} />
            <Input label="الاسم بالإنجليزية" placeholder="e.g. Haircut" {...register('nameEn')} />
          </div>
          <Textarea label="الوصف (اختياري)" placeholder="وصف يظهر للعملاء..." {...register('descriptionAr')} />
        </section>

        {/* 2. Category */}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded-lg bg-[var(--brand-primary)] text-white flex items-center justify-center text-[10px] font-black">2</span>
            <span className="text-xs font-bold">القسم</span>
          </div>
          {errors.categoryId && <p className="text-xs text-red-500 mb-2">{errors.categoryId.message}</p>}
          <div className="flex flex-wrap gap-2">
            {cats?.map(c => (
              <button key={c.id} type="button" onClick={() => setValue('categoryId', c.id)}
                className={cn('px-4 py-2.5 rounded-xl border-2 text-xs font-bold transition-all',
                  cat === c.id ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]' : 'border-[var(--border)] hover:border-[var(--brand-primary)]/40')}>
                <Tag className="h-3 w-3 inline mr-1" />{c.nameAr}
              </button>
            ))}
          </div>
        </section>

        {/* 3. Price + Duration */}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-6 h-6 rounded-lg bg-[var(--brand-primary)] text-white flex items-center justify-center text-[10px] font-black">3</span>
            <span className="text-xs font-bold">السعر والمدة</span>
          </div>

          {/* Price */}
          <div>
            <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5 block">السعر *</label>
            <div className="relative">
              <input type="number" dir="ltr" inputMode="decimal" {...register('price')} placeholder="0"
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--background)] text-lg font-bold text-center focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[var(--muted-foreground)] font-medium">SAR</span>
            </div>
            {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price.message}</p>}
            {price > 0 && <p className="text-[10px] text-emerald-600 mt-1">شامل الضريبة: {(price * 1.15).toFixed(0)} SAR</p>}
          </div>

          {/* Duration */}
          <div>
            <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5 block">المدة *</label>
            <div className="flex flex-wrap gap-2">
              {DURS.map(d => (
                <button key={d} type="button" onClick={() => setValue('duration', d)}
                  className={cn('px-3 py-2 rounded-xl border-2 text-[11px] font-bold transition-all',
                    dur === d ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white' : 'border-[var(--border)] hover:border-[var(--brand-primary)]/40')}>
                  <Clock className="h-3 w-3 inline mr-0.5" /> {fmtDur(d)}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Submit */}
        <div className="flex gap-3">
          <Button type="submit" disabled={mut.isPending} className="flex-1 py-3">
            {mut.isPending ? 'جارٍ...' : <><Sparkles className="h-4 w-4" /> إضافة الخدمة</>}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push('/services')}>إلغاء</Button>
        </div>
      </form>
    </div>
  );
}
