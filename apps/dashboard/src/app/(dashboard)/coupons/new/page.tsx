'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, Percent, DollarSign, Ticket } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

const schema = z.object({
  code: z.string().min(3, 'الكود 3 أحرف على الأقل').max(20).regex(/^[A-Z0-9_-]+$/i, 'أحرف إنجليزية وأرقام فقط'),
  type: z.enum(['percentage', 'fixed_amount'], { required_error: 'اختاري النوع' }),
  value: z.coerce.number().min(1, 'القيمة مطلوبة'),
  minOrderAmount: z.coerce.number().min(0).optional(),
  maxUses: z.coerce.number().min(1, 'مرة واحدة على الأقل'),
  startDate: z.string().min(1, 'تاريخ البدء مطلوب'),
  endDate: z.string().min(1, 'تاريخ الانتهاء مطلوب'),
});
type FormData = z.infer<typeof schema>;

export default function NewCouponPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const qc = useQueryClient();

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { code: '', type: 'percentage', value: 0, minOrderAmount: 0, maxUses: 100, startDate: new Date().toISOString().split('T')[0], endDate: '' },
  });

  const selectedType = watch('type');

  const mut = useMutation({
    mutationFn: (data: FormData) => api.post('/coupons', data, accessToken!),
    onSuccess: () => { toast.success('🎟️ تم إنشاء الكوبون'); qc.invalidateQueries({ queryKey: ['coupons'] }); router.push('/coupons'); },
    onError: () => toast.error('خطأ في إنشاء الكوبون'),
  });

  const inputClass = "w-full px-4 py-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] text-sm focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 outline-none transition-all";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/coupons')} className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--muted)] transition">
          <ArrowRight className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-black">كوبون جديد</h1>
          <p className="text-xs text-[var(--muted-foreground)]">إنشاء كوبون خصم جديد</p>
        </div>
      </div>

      {/* Preview Card */}
      <div className={cn('rounded-2xl p-6 text-white text-center relative overflow-hidden',
        selectedType === 'percentage' ? 'bg-gradient-to-l from-fuchsia-500 to-pink-600' : 'bg-gradient-to-l from-violet-500 to-purple-600')}>
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_80%,rgba(255,255,255,0.1),transparent)]" />
        <div className="relative z-10">
          <Ticket className="h-8 w-8 mx-auto mb-2 opacity-60" />
          <div className="text-4xl font-black tabular-nums" dir="ltr">
            {watch('value') || 0}{selectedType === 'percentage' ? '%' : ' SAR'}
          </div>
          <div className="font-mono text-lg font-bold mt-2 tracking-widest opacity-80">
            {watch('code') || 'CODE'}
          </div>
          <div className="border-t border-dashed border-white/20 mt-4 pt-3 text-[11px] opacity-60">
            معاينة الكوبون
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(d => mut.mutate(d))} className="space-y-5">
        {/* Code */}
        <div>
          <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5 block">كود الكوبون</label>
          <input {...register('code')} dir="ltr" placeholder="SUMMER2026" style={{ textTransform: 'uppercase' }}
            className={cn(inputClass, 'font-mono text-lg font-bold tracking-wider text-center')} />
          {errors.code && <p className="text-red-500 text-[10px] mt-1">{errors.code.message}</p>}
        </div>

        {/* Type Selection - Visual */}
        <div>
          <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-2 block">نوع الخصم</label>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setValue('type', 'percentage')}
              className={cn('flex items-center gap-3 p-4 rounded-2xl border-2 transition-all',
                selectedType === 'percentage' ? 'bg-gradient-to-l from-fuchsia-500 to-pink-600 text-white border-transparent' : 'border-[var(--border)] hover:border-fuchsia-300')}>
              <Percent className="h-6 w-6" />
              <div className="text-right">
                <p className="text-sm font-bold">نسبة مئوية</p>
                <p className="text-[10px] opacity-70">مثال: 20% خصم</p>
              </div>
            </button>
            <button type="button" onClick={() => setValue('type', 'fixed_amount')}
              className={cn('flex items-center gap-3 p-4 rounded-2xl border-2 transition-all',
                selectedType === 'fixed_amount' ? 'bg-gradient-to-l from-violet-500 to-purple-600 text-white border-transparent' : 'border-[var(--border)] hover:border-violet-300')}>
              <DollarSign className="h-6 w-6" />
              <div className="text-right">
                <p className="text-sm font-bold">مبلغ ثابت</p>
                <p className="text-[10px] opacity-70">مثال: 50 SAR</p>
              </div>
            </button>
          </div>
        </div>

        {/* Value + Min Order */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5 block">
              القيمة {selectedType === 'percentage' ? '(%)' : '(SAR)'}
            </label>
            <input {...register('value')} type="number" inputMode="decimal" dir="ltr" placeholder="0"
              className={cn(inputClass, 'text-2xl font-black text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none')} />
            {errors.value && <p className="text-red-500 text-[10px] mt-1">{errors.value.message}</p>}
          </div>
          <div>
            <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5 block">الحد الأدنى للطلب (SAR)</label>
            <input {...register('minOrderAmount')} type="number" inputMode="decimal" dir="ltr" placeholder="0"
              className={cn(inputClass, 'text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none')} />
          </div>
        </div>

        {/* Max Uses */}
        <div>
          <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5 block">الحد الأقصى للاستخدام</label>
          <input {...register('maxUses')} type="number" inputMode="numeric" dir="ltr" placeholder="100"
            className={cn(inputClass, 'text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none')} />
          {errors.maxUses && <p className="text-red-500 text-[10px] mt-1">{errors.maxUses.message}</p>}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5 block">تاريخ البدء</label>
            <input {...register('startDate')} type="date" dir="ltr" className={inputClass} />
            {errors.startDate && <p className="text-red-500 text-[10px] mt-1">{errors.startDate.message}</p>}
          </div>
          <div>
            <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5 block">تاريخ الانتهاء</label>
            <input {...register('endDate')} type="date" dir="ltr" className={inputClass} />
            {errors.endDate && <p className="text-red-500 text-[10px] mt-1">{errors.endDate.message}</p>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={mut.isPending} className="flex-1 py-3">
            {mut.isPending ? 'جارٍ الإنشاء...' : '🎟️ إنشاء الكوبون'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push('/coupons')}>إلغاء</Button>
        </div>
      </form>
    </div>
  );
}
