'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Clock, Pencil, Trash2, Tag, Sparkles, Package, X, Check, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PageHeader, Button, Badge, Spinner, Input } from '@/components/ui';
import { dashboardService } from '@/services/dashboard.service';
import { useAuth } from '@/hooks/useAuth';
import type { Service, ServiceCategory } from '@/types';

const CAT_COLORS = [
  'from-purple-500 to-violet-600',
  'from-pink-500 to-rose-600',
  'from-amber-500 to-orange-600',
  'from-emerald-500 to-teal-600',
  'from-sky-500 to-blue-600',
  'from-red-500 to-pink-600',
];

export default function ServicesPage() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<string>('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editDiscount, setEditDiscount] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: categories, isLoading: catsLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => dashboardService.getCategories(accessToken!),
    enabled: !!accessToken,
  });

  const { data: servicesData, isLoading: svcsLoading } = useQuery({
    queryKey: ['services', 'all'],
    queryFn: () => dashboardService.getServices({ limit: 100 }, accessToken!),
    enabled: !!accessToken,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Service> }) =>
      dashboardService.updateService(id, data, accessToken!),
    onSuccess: () => {
      toast.success('✅ تم تحديث الخدمة');
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setEditId(null);
    },
    onError: () => toast.error('خطأ في تحديث الخدمة'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => dashboardService.deleteService(id, accessToken!),
    onSuccess: () => {
      toast.success('تم حذف الخدمة');
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setDeleteConfirmId(null);
    },
    onError: () => toast.error('خطأ في حذف الخدمة'),
  });

  const allServices = servicesData?.items ?? [];
  const filtered = allServices.filter(s => {
    if (filterCat && s.categoryId !== filterCat) return false;
    if (search && !s.nameAr.includes(search) && !(s.nameEn?.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  if (catsLoading || svcsLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Spinner size="lg" /></div>;
  }

  const getCatName = (id: string) => categories?.find(c => c.id === id)?.nameAr || '';
  const getCatColor = (id: string) => {
    const idx = categories?.findIndex(c => c.id === id) ?? 0;
    return CAT_COLORS[idx % CAT_COLORS.length];
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="الخدمات والباقات"
        description={`${allServices.length} خدمة · ${categories?.length || 0} تصنيف`}
        actions={
          <div className="flex gap-2">
            <Link href="/services/categories">
              <Button variant="outline" size="sm">
                <Tag className="h-3.5 w-3.5" />
                التصنيفات
              </Button>
            </Link>
            <Link href="/services/new">
              <Button size="sm">
                <Plus className="h-3.5 w-3.5" />
                خدمة جديدة
              </Button>
            </Link>
          </div>
        }
      />

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
          <input
            type="text"
            placeholder="🔍 بحث عن خدمة..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] text-sm focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 outline-none transition-all"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          <button
            onClick={() => setFilterCat('')}
            className={cn(
              'px-3 py-2 rounded-lg text-xs font-medium border transition-all whitespace-nowrap',
              !filterCat ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]' : 'border-[var(--border)] hover:border-[var(--brand-primary)]/50',
            )}
          >
            الكل ({allServices.length})
          </button>
          {categories?.map((c, i) => {
            const count = allServices.filter(s => s.categoryId === c.id).length;
            return (
              <button
                key={c.id}
                onClick={() => setFilterCat(filterCat === c.id ? '' : c.id)}
                className={cn(
                  'px-3 py-2 rounded-lg text-xs font-medium border transition-all whitespace-nowrap',
                  filterCat === c.id ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]' : 'border-[var(--border)] hover:border-[var(--brand-primary)]/50',
                )}
              >
                {c.nameAr} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Services Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Sparkles className="h-10 w-10 mx-auto text-[var(--muted-foreground)] mb-3" />
          <p className="text-[var(--muted-foreground)]">لا توجد خدمات</p>
          <Link href="/services/new">
            <Button className="mt-3" size="sm"><Plus className="h-3 w-3" /> إضافة خدمة</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(service => {
            const isEditing = editId === service.id;
            const isDeleting = deleteConfirmId === service.id;
            const catColor = getCatColor(service.categoryId);
            const hasDiscount = (service as any).discountPrice && (service as any).discountPrice < service.price;

            return (
              <div
                key={service.id}
                className={cn(
                  'group relative rounded-2xl border bg-[var(--card)] overflow-hidden transition-all duration-200',
                  isDeleting ? 'border-red-300 shadow-lg shadow-red-100' : 'border-[var(--border)] hover:shadow-md hover:border-[var(--brand-primary)]/30',
                )}
              >
                {/* Delete Confirmation */}
                {isDeleting && (
                  <div className="absolute inset-0 rounded-2xl bg-white/95 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-3">
                    <AlertTriangle className="h-7 w-7 text-red-500" />
                    <p className="text-sm font-semibold">حذف {service.nameAr}؟</p>
                    <div className="flex gap-2">
                      <button onClick={() => deleteMutation.mutate(service.id)} className="px-4 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition">🗑️ حذف</button>
                      <button onClick={() => setDeleteConfirmId(null)} className="px-4 py-1.5 rounded-lg border text-xs font-medium hover:bg-slate-50 transition">إلغاء</button>
                    </div>
                  </div>
                )}

                {/* Category Ribbon */}
                <div className={cn('h-1.5 bg-gradient-to-l', catColor)} />

                <div className="p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-[var(--foreground)] truncate">{service.nameAr}</h3>
                      {service.nameEn && (
                        <p className="text-[11px] text-[var(--muted-foreground)]">{service.nameEn}</p>
                      )}
                    </div>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setEditId(service.id);
                          setEditPrice(String(service.price));
                          setEditDiscount('');
                        }}
                        className="p-1.5 rounded-lg hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(service.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-[var(--muted-foreground)] hover:text-red-500 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Info Chips */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--muted)] text-[10px] text-[var(--muted-foreground)]">
                      <Clock className="h-3 w-3" />
                      {service.duration} دقيقة
                    </span>
                    <span className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px]',
                      `bg-gradient-to-l ${catColor} text-white`,
                    )}>
                      {getCatName(service.categoryId)}
                    </span>
                    <Badge variant={service.isActive ? 'success' : 'secondary'} className="text-[10px]">
                      {service.isActive ? 'نشطة' : 'معطلة'}
                    </Badge>
                  </div>

                  {/* Price Section */}
                  {isEditing ? (
                    <div className="space-y-2 p-3 rounded-xl bg-[var(--muted)]/50 border border-[var(--border)]">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-medium text-[var(--muted-foreground)] mb-1 block">السعر (ر.س)</label>
                          <input
                            type="number"
                            value={editPrice}
                            onChange={e => setEditPrice(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-white text-sm text-center focus:border-[var(--brand-primary)] outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-medium text-[var(--muted-foreground)] mb-1 block">خصم % (اختياري)</label>
                          <input
                            type="number"
                            value={editDiscount}
                            onChange={e => setEditDiscount(e.target.value)}
                            placeholder="0"
                            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-white text-sm text-center focus:border-amber-500 outline-none"
                          />
                        </div>
                      </div>
                      {editDiscount && Number(editDiscount) > 0 && (
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-amber-50 border border-amber-200">
                          <Tag className="h-3 w-3 text-amber-600" />
                          <span className="text-[10px] text-amber-700">
                            السعر بعد الخصم: <strong>{(Number(editPrice) * (1 - Number(editDiscount) / 100)).toFixed(0)} ر.س</strong>
                          </span>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const priceVal = Number(editPrice);
                            if (priceVal <= 0) return toast.error('السعر يجب أن يكون أكبر من 0');
                            updateMutation.mutate({ id: service.id, data: { price: priceVal } });
                          }}
                          disabled={updateMutation.isPending}
                          className="flex-1 py-2 rounded-lg bg-[var(--brand-primary)] text-white text-xs font-medium hover:opacity-90 transition disabled:opacity-50"
                        >
                          <Check className="h-3 w-3 inline mr-1" /> حفظ
                        </button>
                        <button
                          onClick={() => setEditId(null)}
                          className="px-3 py-2 rounded-lg border border-[var(--border)] text-xs font-medium hover:bg-[var(--muted)] transition"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-end justify-between">
                      <div>
                        {hasDiscount && (
                          <span className="text-xs text-[var(--muted-foreground)] line-through mr-1">
                            {service.price}
                          </span>
                        )}
                        <span className="text-lg font-black text-[var(--brand-primary)]">
                          {hasDiscount ? (service as any).discountPrice : service.price}
                        </span>
                        <span className="text-xs text-[var(--muted-foreground)] mr-0.5">ر.س</span>
                      </div>
                      <button
                        onClick={() => {
                          setEditId(service.id);
                          setEditPrice(String(service.price));
                          setEditDiscount('');
                        }}
                        className="text-[10px] text-[var(--brand-primary)] font-medium hover:underline"
                      >
                        تعديل السعر
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
