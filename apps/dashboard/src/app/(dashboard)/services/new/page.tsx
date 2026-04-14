'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, Sparkles, Clock, Tag, Upload, ImageIcon, X, Loader2 } from 'lucide-react';
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
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

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

  /* ── Image Upload ── */
  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('يجب أن يكون الملف صورة');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('حجم الصورة أكبر من 2MB');
      return;
    }

    setUploading(true);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/uploads/image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      if (!res.ok) throw new Error('فشل');
      const d = await res.json();
      const url = d.data?.url || d.url;
      setImageUrl(url);
      toast.success('✅ تم رفع الصورة');
    } catch {
      toast.error('فشل رفع الصورة');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageUpload(file);
  };

  /* ── Submit ── */
  const mut = useMutation({
    mutationFn: (d: F) => dashboardService.createService({ ...d, imageUrl: imageUrl || undefined } as any, accessToken!),
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

        {/* 4. Service Image */}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded-lg bg-[var(--brand-primary)] text-white flex items-center justify-center text-[10px] font-black">4</span>
            <span className="text-xs font-bold">صورة الخدمة</span>
            <span className="text-[10px] text-[var(--muted-foreground)]">(اختياري — تظهر في المنيو)</span>
          </div>

          {imageUrl ? (
            /* Preview */
            <div className="relative inline-block">
              <img
                src={imageUrl}
                alt="صورة الخدمة"
                className="w-28 h-28 rounded-2xl object-cover border-2 border-[var(--border)] shadow-sm"
              />
              <button
                type="button"
                onClick={() => setImageUrl(null)}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md hover:bg-red-600 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            /* Upload area */
            <label
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={cn(
                'flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed cursor-pointer transition-all',
                dragOver
                  ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5'
                  : 'border-[var(--border)] hover:border-[var(--brand-primary)]/40',
                uploading && 'pointer-events-none opacity-60',
              )}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-[var(--brand-primary)]" />
                  <span className="text-xs text-[var(--muted-foreground)]">جاري الرفع...</span>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-xl bg-[var(--brand-primary)]/10 flex items-center justify-center">
                    <ImageIcon className="h-6 w-6 text-[var(--brand-primary)]" />
                  </div>
                  <span className="text-xs font-bold">اسحبي الصورة هنا أو اضغطي للرفع</span>
                  <span className="text-[10px] text-[var(--muted-foreground)]">PNG, JPG, WEBP — حد أقصى 2MB</span>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleImageUpload(f);
                }}
              />
            </label>
          )}
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
