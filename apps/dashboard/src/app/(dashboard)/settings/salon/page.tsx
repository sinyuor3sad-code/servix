'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, Building2, Phone, Mail, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Spinner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

const schema = z.object({
  salonNameAr: z.string().min(2, 'الاسم بالعربية مطلوب'),
  salonNameEn: z.string().optional(),
  phone: z.string().min(10, 'الرقم 10 أرقام على الأقل').regex(/^[0-9+]+$/, 'رقم غير صالح'),
  email: z.string().email('بريد غير صالح').or(z.literal('')).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  description: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface SalonInfo { salonNameAr?: string; salonNameEn?: string; nameAr?: string; nameEn?: string; phone: string; email?: string; address?: string; city?: string; description?: string; }

const inputClass = "w-full px-4 py-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] text-sm focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 outline-none transition-all";

export default function SalonSettingsPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const qc = useQueryClient();

  const { data: info, isLoading } = useQuery<SalonInfo>({
    queryKey: ['settings', 'salon'],
    queryFn: () => api.get<SalonInfo>('/salon', accessToken!),
    enabled: !!accessToken,
  });

  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (info) reset({
      salonNameAr: info.salonNameAr ?? info.nameAr ?? '', salonNameEn: info.salonNameEn ?? info.nameEn ?? '',
      phone: info.phone ?? '', email: info.email ?? '', address: info.address ?? '', city: info.city ?? '', description: info.description ?? '',
    });
  }, [info, reset]);

  const mut = useMutation({
    mutationFn: (d: FormData) => api.put('/salon', { nameAr: d.salonNameAr, nameEn: d.salonNameEn || undefined, phone: d.phone, email: d.email || undefined, address: d.address || undefined, city: d.city || undefined, description: d.description || undefined }, accessToken!),
    onSuccess: () => { toast.success('✅ تم حفظ البيانات'); qc.invalidateQueries({ queryKey: ['settings', 'salon'] }); },
    onError: () => toast.error('خطأ في الحفظ'),
  });

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/settings')} className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--muted)] transition"><ArrowRight className="h-4 w-4" /></button>
        <div>
          <h1 className="text-xl font-black">بيانات الصالون</h1>
          <p className="text-xs text-[var(--muted-foreground)]">معلومات الصالون الأساسية</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(d => mut.mutate(d))} className="space-y-5">
        {/* Section: Name */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <div className="px-5 py-3 bg-gradient-to-l from-sky-500 to-blue-600 text-white flex items-center gap-2">
            <Building2 className="h-4 w-4 opacity-70" /><span className="text-xs font-bold">اسم الصالون</span>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5 block">بالعربية *</label>
              <input {...register('salonNameAr')} placeholder="صالون الأناقة" className={inputClass} />
              {errors.salonNameAr && <p className="text-red-500 text-[10px] mt-1">{errors.salonNameAr.message}</p>}
            </div>
            <div>
              <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5 block">بالإنجليزية</label>
              <input {...register('salonNameEn')} dir="ltr" placeholder="Elegance Salon" className={inputClass} />
            </div>
          </div>
        </div>

        {/* Section: Contact */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <div className="px-5 py-3 bg-gradient-to-l from-emerald-500 to-teal-600 text-white flex items-center gap-2">
            <Phone className="h-4 w-4 opacity-70" /><span className="text-xs font-bold">التواصل</span>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5 block">رقم الجوال *</label>
              <input {...register('phone')} dir="ltr" placeholder="05XXXXXXXX" className={inputClass} />
              {errors.phone && <p className="text-red-500 text-[10px] mt-1">{errors.phone.message}</p>}
            </div>
            <div>
              <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5 block">البريد الإلكتروني</label>
              <input {...register('email')} dir="ltr" type="email" placeholder="info@salon.com" className={inputClass} />
              {errors.email && <p className="text-red-500 text-[10px] mt-1">{errors.email.message}</p>}
            </div>
          </div>
        </div>

        {/* Section: Location */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <div className="px-5 py-3 bg-gradient-to-l from-amber-500 to-orange-600 text-white flex items-center gap-2">
            <MapPin className="h-4 w-4 opacity-70" /><span className="text-xs font-bold">الموقع</span>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5 block">العنوان</label>
              <input {...register('address')} placeholder="حي النخيل" className={inputClass} />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5 block">المدينة</label>
              <input {...register('city')} placeholder="الرياض" className={inputClass} />
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5 block">وصف الصالون</label>
          <textarea {...register('description')} rows={3} placeholder="وصف مختصر عن الصالون..."
            className={cn(inputClass, 'resize-none')} />
        </div>

        <Button type="submit" disabled={mut.isPending || !isDirty} className="w-full py-3">
          {mut.isPending ? 'جارٍ الحفظ...' : '💾 حفظ التغييرات'}
        </Button>
      </form>
    </div>
  );
}
