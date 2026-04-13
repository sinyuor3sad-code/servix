'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, Percent, DollarSign, Ticket, CalendarDays, Hash, Repeat, ShoppingBag, Infinity, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { useState } from 'react';

/* ── Now as datetime-local string ── */
const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
};
const todayDate = () => new Date().toISOString().split('T')[0];

const schema = z.object({
  code: z.string().min(3, 'الكود 3 أحرف على الأقل').max(20).regex(/^[A-Z0-9_-]+$/i, 'أحرف إنجليزية وأرقام فقط'),
  type: z.enum(['percentage', 'fixed'], { required_error: 'اختاري النوع' }),
  value: z.coerce.number().min(1, 'القيمة مطلوبة'),
  minOrder: z.coerce.number().min(0).optional(),
  isOpen: z.boolean().optional(),
  usageLimit: z.coerce.number().min(1).optional().or(z.literal('')),
  validFrom: z.string().min(1, 'تاريخ البدء مطلوب'),
  validUntil: z.string().optional(),
  autoDelete: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

/* ── Format datetime to English display ── */
function formatDT(dtStr: string): string {
  if (!dtStr) return '';
  const d = new Date(dtStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

/* ── Arabic numerals → English numerals converter ── */
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
function toEnglishDigits(str: string): string {
  let result = str;
  for (let i = 0; i < 10; i++) {
    result = result.replace(new RegExp(ARABIC_DIGITS[i], 'g'), String(i));
    result = result.replace(new RegExp(PERSIAN_DIGITS[i], 'g'), String(i));
  }
  return result.replace(/[^0-9.]/g, '');
}

function handleNumericInput(e: React.FormEvent<HTMLInputElement>) {
  const input = e.currentTarget;
  const pos = input.selectionStart ?? 0;
  input.value = toEnglishDigits(input.value);
  input.setSelectionRange(pos, pos);
}

export default function NewCouponPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: '', type: 'percentage',
      validFrom: nowLocal(), validUntil: '',
      isOpen: false, autoDelete: false,
    },
  });

  const selectedType = watch('type');
  const watchedStartDate = watch('validFrom');
  const autoDelete = watch('autoDelete');

  const mut = useMutation({
    mutationFn: (data: FormData) => {
      const payload: Record<string, unknown> = {
        code: data.code,
        type: data.type,
        value: data.value,
        minOrder: data.minOrder,
        validFrom: new Date(data.validFrom).toISOString(),
        autoDelete: data.autoDelete ?? false,
      };
      if (!isOpen && data.validUntil) {
        payload.validUntil = new Date(data.validUntil).toISOString();
      }
      if (!isOpen && data.usageLimit && Number(data.usageLimit) > 0) {
        payload.usageLimit = Number(data.usageLimit);
      }
      return api.post('/coupons', payload, accessToken!);
    },
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

      {/* Preview Card */}
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
          <div className="flex items-center justify-center gap-3 mt-3 text-[10px]">
            {watchedStartDate && (
              <span className="text-white/30" dir="ltr">
                {formatDT(watchedStartDate)}
              </span>
            )}
            {isOpen ? (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/20">∞ مفتوح</span>
            ) : watch('validUntil') ? (
              <span className="text-white/30" dir="ltr">→ {formatDT(watch('validUntil')!)}</span>
            ) : null}
          </div>
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

        {/* Type Selection */}
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
            <input {...register('value')} type="text" inputMode="decimal" dir="ltr" placeholder="10"
              onInput={handleNumericInput}
              className={cn(inputClass, 'text-2xl font-black text-center')} />
            {errors.value && <p className="text-red-500 text-[10px] mt-1">{errors.value.message}</p>}
          </div>
          <div>
            <label className="flex items-center gap-2 text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5">
              <ShoppingBag className="h-3 w-3" /> الحد الأدنى للطلب (ر.س)
            </label>
            <input {...register('minOrder')} type="text" inputMode="decimal" dir="ltr" placeholder="0"
              onInput={handleNumericInput}
              className={cn(inputClass, 'text-center')} />
          </div>
        </div>

        {/* ═══ Open Mode Toggle ═══ */}
        <div className="rounded-2xl border-2 border-[var(--border)] p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Infinity className="h-4 w-4 text-[var(--brand-primary)]" />
              <div>
                <p className="text-sm font-bold text-[var(--foreground)]">كوبون مفتوح</p>
                <p className="text-[10px] text-[var(--muted-foreground)]">بدون حد استخدام أو تاريخ انتهاء</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsOpen(!isOpen);
                setValue('isOpen', !isOpen);
                if (!isOpen) {
                  setValue('validUntil', '');
                  setValue('usageLimit', '' as unknown as undefined);
                }
              }}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors duration-200',
                isOpen ? 'bg-[var(--brand-primary)]' : 'bg-[var(--muted)]'
              )}
            >
              <span className={cn(
                'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200',
                isOpen && 'translate-x-5'
              )} />
            </button>
          </div>

          {!isOpen && (
            <>
              {/* Max Uses */}
              <div>
                <label className="flex items-center gap-2 text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5">
                  <Repeat className="h-3 w-3" /> الحد الأقصى للاستخدام
                </label>
                <input {...register('usageLimit')} type="text" inputMode="numeric" dir="ltr" placeholder="100"
                  onInput={handleNumericInput}
                  className={cn(inputClass, 'text-center')} />
                {errors.usageLimit && <p className="text-red-500 text-[10px] mt-1">{errors.usageLimit.message}</p>}
              </div>

              {/* Dates — datetime-local with time picker */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-2 text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5">
                    <CalendarDays className="h-3 w-3" /> تاريخ ووقت البدء
                  </label>
                  <input {...register('validFrom')} type="datetime-local" dir="ltr" min={todayDate() + 'T00:00'}
                    className={cn(inputClass, 'text-right')} />
                  {errors.validFrom && <p className="text-red-500 text-[10px] mt-1">{errors.validFrom.message}</p>}
                </div>
                <div>
                  <label className="flex items-center gap-2 text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5">
                    <CalendarDays className="h-3 w-3" /> تاريخ ووقت الانتهاء
                  </label>
                  <input {...register('validUntil')} type="datetime-local" dir="ltr"
                    min={watchedStartDate || todayDate() + 'T00:00'}
                    className={cn(inputClass, 'text-right')} />
                  {errors.validUntil && <p className="text-red-500 text-[10px] mt-1">{errors.validUntil.message}</p>}
                </div>
              </div>

              {/* Auto-Delete Toggle */}
              <div className="flex items-center justify-between rounded-xl bg-[var(--muted)]/50 p-3">
                <div className="flex items-center gap-2">
                  <Trash2 className="h-3.5 w-3.5 text-red-400" />
                  <div>
                    <p className="text-[11px] font-bold text-[var(--foreground)]">حذف تلقائي</p>
                    <p className="text-[9px] text-[var(--muted-foreground)]">يُحذف بعد 24 ساعة من الانتهاء أو نفاد الاستخدام</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setValue('autoDelete', !autoDelete)}
                  className={cn(
                    'relative w-11 h-6 rounded-full transition-colors duration-200',
                    autoDelete ? 'bg-red-500' : 'bg-[var(--muted)]'
                  )}
                >
                  <span className={cn(
                    'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200',
                    autoDelete && 'translate-x-5'
                  )} />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Start date for Open mode */}
        {isOpen && (
          <div>
            <label className="flex items-center gap-2 text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5">
              <CalendarDays className="h-3 w-3" /> تاريخ ووقت البدء
            </label>
            <input {...register('validFrom')} type="datetime-local" dir="ltr" min={todayDate() + 'T00:00'}
              className={cn(inputClass, 'text-right')} />
            {errors.validFrom && <p className="text-red-500 text-[10px] mt-1">{errors.validFrom.message}</p>}
          </div>
        )}

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
