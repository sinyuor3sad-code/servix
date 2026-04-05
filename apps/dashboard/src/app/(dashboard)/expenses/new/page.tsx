'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, Home, Zap, ShoppingBag, Users, Wrench, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

const schema = z.object({
  description: z.string().min(3, 'الوصف يجب أن يكون 3 أحرف على الأقل'),
  category: z.enum(['rent', 'utilities', 'supplies', 'salary', 'maintenance', 'other'], { required_error: 'اختاري التصنيف' }),
  amount: z.coerce.number().min(0.01, 'المبلغ مطلوب'),
  date: z.string().min(1, 'التاريخ مطلوب'),
  notes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const CATEGORIES = [
  { value: 'rent', label: 'إيجار', icon: Home, gradient: 'from-orange-500 to-amber-600' },
  { value: 'utilities', label: 'مرافق', icon: Zap, gradient: 'from-amber-500 to-yellow-600' },
  { value: 'supplies', label: 'مستلزمات', icon: ShoppingBag, gradient: 'from-sky-500 to-blue-600' },
  { value: 'salary', label: 'رواتب', icon: Users, gradient: 'from-violet-500 to-purple-600' },
  { value: 'maintenance', label: 'صيانة', icon: Wrench, gradient: 'from-emerald-500 to-teal-600' },
  { value: 'other', label: 'أخرى', icon: MoreHorizontal, gradient: 'from-slate-500 to-gray-600' },
] as const;

export default function NewExpensePage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const qc = useQueryClient();

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { description: '', category: 'other', amount: 0, date: new Date().toISOString().split('T')[0], notes: '' },
  });

  const selectedCat = watch('category');

  const mut = useMutation({
    mutationFn: (data: FormData) => api.post('/expenses', data, accessToken!),
    onSuccess: () => { toast.success('✅ تم إضافة المصروف'); qc.invalidateQueries({ queryKey: ['expenses'] }); router.push('/expenses'); },
    onError: () => toast.error('خطأ في إضافة المصروف'),
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/expenses')} className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--muted)] transition">
          <ArrowRight className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-black">مصروف جديد</h1>
          <p className="text-xs text-[var(--muted-foreground)]">تسجيل مصروف جديد</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(d => mut.mutate(d))} className="space-y-5">
        {/* Category Selection - Visual Grid */}
        <div>
          <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-2 block">التصنيف</label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              return (
                <button key={cat.value} type="button" onClick={() => setValue('category', cat.value as any)}
                  className={cn('flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all text-center',
                    selectedCat === cat.value
                      ? `bg-gradient-to-br ${cat.gradient} text-white border-transparent shadow-lg`
                      : 'border-[var(--border)] hover:border-[var(--foreground)]/20')}>
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] font-bold">{cat.label}</span>
                </button>
              );
            })}
          </div>
          {errors.category && <p className="text-red-500 text-[10px] mt-1">{errors.category.message}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5 block">الوصف</label>
          <input {...register('description')} placeholder="مثال: إيجار المحل لشهر أبريل" dir="rtl"
            className="w-full px-4 py-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] text-sm focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 outline-none" />
          {errors.description && <p className="text-red-500 text-[10px] mt-1">{errors.description.message}</p>}
        </div>

        {/* Amount + Date Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5 block">المبلغ (SAR)</label>
            <input {...register('amount')} type="number" inputMode="decimal" dir="ltr" placeholder="0.00" step="0.01"
              className="w-full px-4 py-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] text-lg font-bold text-center focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
            {errors.amount && <p className="text-red-500 text-[10px] mt-1">{errors.amount.message}</p>}
          </div>
          <div>
            <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5 block">التاريخ</label>
            <input {...register('date')} type="date" dir="ltr"
              className="w-full px-4 py-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] text-sm focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 outline-none" />
            {errors.date && <p className="text-red-500 text-[10px] mt-1">{errors.date.message}</p>}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5 block">ملاحظات <span className="opacity-50">(اختياري)</span></label>
          <textarea {...register('notes')} rows={3} placeholder="ملاحظات إضافية..." dir="rtl"
            className="w-full px-4 py-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] text-sm focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 outline-none resize-none" />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={mut.isPending} className="flex-1 py-3">
            {mut.isPending ? 'جارٍ الإضافة...' : '✅ إضافة المصروف'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push('/expenses')}>
            إلغاء
          </Button>
        </div>
      </form>
    </div>
  );
}
