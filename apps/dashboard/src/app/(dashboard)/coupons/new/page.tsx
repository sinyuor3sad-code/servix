'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, Percent, DollarSign, Ticket, CalendarDays, Hash, Repeat, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

/* ── Today string (YYYY-MM-DD) for min-date restriction ── */
const today = () => new Date().toISOString().split('T')[0];

const schema = z.object({
  code: z.string().min(3, 'الكود 3 أحرف على الأقل').max(20).regex(/^[A-Z0-9_-]+$/i, 'أحرف إنجليزية وأرقام فقط'),
  type: z.enum(['percentage', 'fixed'], { required_error: 'اختاري النوع' }),
  value: z.coerce.number().min(1, 'القيمة مطلوبة'),
  minOrder: z.coerce.number().min(0).optional(),
  usageLimit: z.coerce.number().min(1, 'مرة واحدة على الأقل'),
  validFrom: z.string().min(1, 'تاريخ البدء مطلوب'),
  validUntil: z.string().min(1, 'تاريخ الانتهاء مطلوب'),
}).refine(d => d.validFrom >= today(), {
  message: 'لا يمكن اختيار تاريخ في الماضي',
  path: ['validFrom'],
}).refine(d => d.validUntil >= d.validFrom, {
  message: 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء',
  path: ['validUntil'],
});

type FormData = z.infer<typeof schema>;

/* ── Format date to Arabic display ── */
function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export default function NewCouponPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const qc = useQueryClient();

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: '', type: 'percentage', value: 0,
      minOrder: 0, usageLimit: 100,
      validFrom: today(), validUntil: '',
    },
  });

  const selectedType = watch('type');
  const watchedStartDate = watch('validFrom');

  const mut = useMutation({
    mutationFn: (data: FormData) => api.post('/coupons', data, accessToken!),
    onSuccess: () => {
      toast.success('تم إنشاء الكوبون بنجاح');
      qc.invalidateQueries({ queryKey: ['coupons'] });
      router.push('/coupons');
    },
    onError: () => toast.error('خطأ في إنشاء الكوبون'),
  });

  const inputClass = cn(
    'w-full px-4 py-3 rounded-2xl border border-[var(--border)]',
    'bg-[var(--card)] text-sm text-[var(--foreground)]',
    'focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20',
    'outline-none transition-all placeholder:text-[var(--muted-foreground)]/50',
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/coupons')} className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--muted)] transition">
          <ArrowRight className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-black text-[var(--foreground)]">كوبون جديد</h1>
          <p className="text-xs text-[var(--muted-foreground)]">إنشاء كوبون خصم جديد</p>
        </div>
      </div>

      {/* Preview Card — clean dark style */}
      <div className="rounded-2xl bg-slate-900 p-6 text-white text-center relative overflow-hidden border border-slate-700/50">
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        <div className="relative z-10">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-3">
            <Ticket className="h-5 w-5 text-white/60" />
          </div>
          <div className="text-4xl font-black tabular-nums" dir="ltr">
            {watch('value') || 0}{selectedType === 'percentage' ? '%' : ' SAR'}
          </div>
          <div className="font-mono text-lg font-bold mt-2 tracking-widest text-white/70">
            {watch('code') || 'CODE'}
          </div>
          {watchedStartDate && (
            <div className="text-[10px] text-white/30 mt-3" dir="ltr">
              {formatDate(watchedStartDate)} {watch('validUntil') ? `→ ${formatDate(watch('validUntil'))}` : ''}
            </div>
          )}
          <div className="border-t border-dashed border-white/10 mt-4 pt-2 text-[10px] text-white/25 uppercase tracking-widest">
            معاينة الكوبون
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(d => mut.mutate(d))} className="space-y-5">
        {/* Code */}
        <div>
          <label className="flex items-center gap-2 text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5">
            <Hash className="h-3 w-3" /> كود الكوبون
          </label>
          <input {...register('code')} dir="ltr" placeholder="SUMMER2026" style={{ textTransform: 'uppercase' }}
            className={cn(inputClass, 'font-mono text-lg font-bold tracking-wider text-center')} />
          {errors.code && <p className="text-red-500 text-[10px] mt-1">{errors.code.message}</p>}
        </div>

        {/* Type Selection — bordered, not gradient */}
        <div>
          <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-2 block">نوع الخصم</label>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setValue('type', 'percentage')}
              className={cn('flex items-center gap-3 p-4 rounded-2xl border-2 transition-all',
                selectedType === 'percentage'
                  ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5'
                  : 'border-[var(--border)] hover:border-[var(--brand-primary)]/30')}>
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center',
                selectedType === 'percentage' ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]' : 'bg-[var(--muted)] text-[var(--muted-foreground)]')}>
                <Percent className="h-5 w-5" />
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-[var(--foreground)]">نسبة مئوية</p>
                <p className="text-[10px] text-[var(--muted-foreground)]">مثال: 20% خصم</p>
              </div>
            </button>
            <button type="button" onClick={() => setValue('type', 'fixed')}
              className={cn('flex items-center gap-3 p-4 rounded-2xl border-2 transition-all',
                selectedType === 'fixed'
                  ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5'
                  : 'border-[var(--border)] hover:border-[var(--brand-primary)]/30')}>
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center',
                selectedType === 'fixed' ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]' : 'bg-[var(--muted)] text-[var(--muted-foreground)]')}>
                <DollarSign className="h-5 w-5" />
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-[var(--foreground)]">مبلغ ثابت</p>
                <p className="text-[10px] text-[var(--muted-foreground)]">مثال: 50 ر.س</p>
              </div>
            </button>
          </div>
        </div>

        {/* Value + Min Order */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-2 text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5">
              {selectedType === 'percentage' ? <Percent className="h-3 w-3" /> : <DollarSign className="h-3 w-3" />}
              القيمة {selectedType === 'percentage' ? '(%)' : '(ر.س)'}
            </label>
            <input {...register('value')} type="number" inputMode="decimal" dir="ltr" placeholder="0"
              className={cn(inputClass, 'text-2xl font-black text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none')} />
            {errors.value && <p className="text-red-500 text-[10px] mt-1">{errors.value.message}</p>}
          </div>
          <div>
            <label className="flex items-center gap-2 text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5">
              <ShoppingBag className="h-3 w-3" /> الحد الأدنى للطلب (ر.س)
            </label>
            <input {...register('minOrder')} type="number" inputMode="decimal" dir="ltr" placeholder="0"
              className={cn(inputClass, 'text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none')} />
          </div>
        </div>

        {/* Max Uses */}
        <div>
          <label className="flex items-center gap-2 text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5">
            <Repeat className="h-3 w-3" /> الحد الأقصى للاستخدام
          </label>
          <input {...register('usageLimit')} type="number" inputMode="numeric" dir="ltr" placeholder="100"
            className={cn(inputClass, 'text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none')} />
          {errors.usageLimit && <p className="text-red-500 text-[10px] mt-1">{errors.usageLimit.message}</p>}
        </div>

        {/* Dates — with min restriction (no past dates) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-2 text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5">
              <CalendarDays className="h-3 w-3" /> تاريخ البدء
            </label>
            <input {...register('validFrom')} type="date" dir="ltr" min={today()}
              className={cn(inputClass, 'text-right')} />
            {errors.validFrom && <p className="text-red-500 text-[10px] mt-1">{errors.validFrom.message}</p>}
          </div>
          <div>
            <label className="flex items-center gap-2 text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5">
              <CalendarDays className="h-3 w-3" /> تاريخ الانتهاء
            </label>
            <input {...register('validUntil')} type="date" dir="ltr" min={watchedStartDate || today()}
              className={cn(inputClass, 'text-right')} />
            {errors.validUntil && <p className="text-red-500 text-[10px] mt-1">{errors.validUntil.message}</p>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={mut.isPending} className="flex-1 py-3">
            {mut.isPending ? 'جارٍ الإنشاء...' : 'إنشاء الكوبون'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push('/coupons')}>إلغاء</Button>
        </div>
      </form>
    </div>
  );
}
