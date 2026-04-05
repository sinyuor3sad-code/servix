'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, Package, Plus, Trash2, Check, Sparkles } from 'lucide-react';
import { Button, Input, Spinner } from '@/components/ui';
import { dashboardService } from '@/services/dashboard.service';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import type { Service } from '@/types';

export default function NewPackagePage() {
  const router = useRouter();
  const { accessToken } = useAuth();

  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [packagePrice, setPackagePrice] = useState('');

  const { data: svcsData, isLoading } = useQuery({
    queryKey: ['services', 'all'],
    queryFn: () => dashboardService.getServices({ limit: 100 }, accessToken!),
    enabled: !!accessToken,
  });

  const { data: cats } = useQuery({
    queryKey: ['categories'],
    queryFn: () => dashboardService.getCategories(accessToken!),
    enabled: !!accessToken,
  });

  const allSvcs = svcsData?.items?.filter(s => s.isActive) ?? [];

  const originalPrice = useMemo(() =>
    selectedIds.reduce((sum, id) => sum + (Number(allSvcs.find(s => s.id === id)?.price) || 0), 0),
    [selectedIds, allSvcs]
  );

  const pkgPrice = Number(packagePrice) || 0;
  const savings = originalPrice - pkgPrice;
  const discountPct = originalPrice > 0 ? Math.round((savings / originalPrice) * 100) : 0;

  const toggleService = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const getCatName = (id: string) => cats?.find(c => c.id === id)?.nameAr || '';

  const handleSave = async () => {
    if (!nameAr.trim()) return toast.error('أدخلي اسم الباقة');
    if (selectedIds.length < 2) return toast.error('اختاري خدمتين على الأقل');
    if (pkgPrice <= 0) return toast.error('أدخلي سعر الباقة');

    try {
      const { api } = await import('@/lib/api');
      await api.post('/packages', {
        nameAr,
        nameEn: nameEn || undefined,
        serviceIds: selectedIds,
        packagePrice: pkgPrice,
      }, accessToken!);
      toast.success('✅ تم إنشاء الباقة');
      router.push('/services');
    } catch {
      // Fallback to localStorage
      const packages = JSON.parse(localStorage.getItem('servix_packages') || '[]');
      packages.push({ id: Math.random().toString(36).slice(2), nameAr, nameEn, serviceIds: selectedIds, originalPrice, packagePrice: pkgPrice, createdAt: new Date().toISOString() });
      localStorage.setItem('servix_packages', JSON.stringify(packages));
      toast.success('✅ تم إنشاء الباقة (محلياً)');
      router.push('/services');
    }
  };

  if (isLoading) return <div className="flex min-h-[50vh] items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">إنشاء باقة</h1>
          <p className="text-xs text-[var(--muted-foreground)]">اجمعي عدة خدمات بسعر مخفض</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push('/services')}><ArrowRight className="h-3.5 w-3.5" /> رجوع</Button>
      </div>

      {/* 1. Name */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-[var(--brand-primary)] text-white flex items-center justify-center text-[10px] font-black">1</span>
          <span className="text-xs font-bold">اسم الباقة</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="مثال: باقة العروس *" value={nameAr} onChange={e => setNameAr(e.target.value)} />
          <Input placeholder="e.g. Bridal Package" value={nameEn} onChange={e => setNameEn(e.target.value)} />
        </div>
      </section>

      {/* 2. Select Services */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-6 h-6 rounded-lg bg-[var(--brand-primary)] text-white flex items-center justify-center text-[10px] font-black">2</span>
          <span className="text-xs font-bold">اختاري الخدمات</span>
          {selectedIds.length > 0 && <span className="text-[10px] text-[var(--brand-primary)] font-bold">({selectedIds.length} خدمة)</span>}
        </div>

        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {allSvcs.map(svc => {
            const selected = selectedIds.includes(svc.id);
            return (
              <button
                key={svc.id}
                type="button"
                onClick={() => toggleService(svc.id)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-xl border-2 text-right transition-all',
                  selected ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5' : 'border-[var(--border)] hover:border-[var(--brand-primary)]/30',
                )}
              >
                <div className={cn('w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all',
                  selected ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]' : 'border-[var(--border)]')}>
                  {selected && <Check className="h-3 w-3 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold truncate">{svc.nameAr}</div>
                  <div className="text-[10px] text-[var(--muted-foreground)]">{getCatName(svc.categoryId)} · {svc.duration} min</div>
                </div>
                <div className="text-xs font-bold tabular-nums" dir="ltr">{Number(svc.price).toFixed(0)} SAR</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. Pricing */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-[var(--brand-primary)] text-white flex items-center justify-center text-[10px] font-black">3</span>
          <span className="text-xs font-bold">التسعير</span>
        </div>

        {/* Original price */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--muted)]/50">
          <span className="text-xs text-[var(--muted-foreground)]">مجموع الخدمات المختارة</span>
          <span className="text-sm font-bold tabular-nums" dir="ltr">{originalPrice.toFixed(0)} SAR</span>
        </div>

        {/* Package price */}
        <div>
          <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5 block">سعر الباقة *</label>
          <input
            type="number"
            dir="ltr"
            inputMode="decimal"
            placeholder="0"
            value={packagePrice}
            onChange={e => setPackagePrice(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--background)] text-lg font-bold text-center focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        {/* Savings Preview */}
        {pkgPrice > 0 && originalPrice > 0 && (
          <div className={cn(
            'p-3 rounded-xl border',
            savings > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200',
          )}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">{savings > 0 ? '💰 التوفير' : '⚠️ أغلى من المجموع'}</span>
              <div className="text-left">
                <span className={cn('text-sm font-black tabular-nums', savings > 0 ? 'text-emerald-600' : 'text-red-600')} dir="ltr">
                  {Math.abs(savings).toFixed(0)} SAR
                </span>
                {savings > 0 && <span className="text-[10px] text-emerald-600 ml-1">({discountPct}% خصم)</span>}
              </div>
            </div>
            <div className="flex items-center gap-3 mt-2 text-[10px]">
              <span className="text-[var(--muted-foreground)]">قبل: <span className="line-through">{originalPrice.toFixed(0)}</span></span>
              <span className="font-bold">→ بعد: {pkgPrice.toFixed(0)} SAR</span>
            </div>
          </div>
        )}
      </section>

      {/* Submit */}
      <div className="flex gap-3">
        <Button onClick={handleSave} className="flex-1 py-3" disabled={selectedIds.length < 2 || !nameAr.trim() || pkgPrice <= 0}>
          <Package className="h-4 w-4" /> إنشاء الباقة
        </Button>
        <Button variant="outline" onClick={() => router.push('/services')}>إلغاء</Button>
      </div>
    </div>
  );
}
