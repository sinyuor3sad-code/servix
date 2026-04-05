'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Clock, Pencil, Trash2, Tag, Sparkles, Package, Check, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PageHeader, Button, Badge, Spinner } from '@/components/ui';
import { dashboardService } from '@/services/dashboard.service';
import { useAuth } from '@/hooks/useAuth';
import type { Service, ServiceCategory } from '@/types';

export default function ServicesPage() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<string>('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [tab, setTab] = useState<'services' | 'packages'>('services');

  const { data: categories, isLoading: cL } = useQuery({
    queryKey: ['categories'],
    queryFn: () => dashboardService.getCategories(accessToken!),
    enabled: !!accessToken,
  });

  const { data: servicesData, isLoading: sL } = useQuery({
    queryKey: ['services', 'all'],
    queryFn: () => dashboardService.getServices({ limit: 100 }, accessToken!),
    enabled: !!accessToken,
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Service> }) =>
      dashboardService.updateService(id, data, accessToken!),
    onSuccess: () => { toast.success('✅ تم التحديث'); queryClient.invalidateQueries({ queryKey: ['services'] }); setEditId(null); },
    onError: () => toast.error('خطأ'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => dashboardService.deleteService(id, accessToken!),
    onSuccess: () => { toast.success('تم الحذف'); queryClient.invalidateQueries({ queryKey: ['services'] }); setDeleteId(null); },
    onError: () => toast.error('خطأ في الحذف'),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      dashboardService.updateService(id, { isActive } as any, accessToken!),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['services'] }); },
  });

  const allSvcs = servicesData?.items ?? [];
  const filtered = allSvcs.filter(s => {
    if (filterCat && s.categoryId !== filterCat) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!s.nameAr.includes(search) && !(s.nameEn?.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const getCatName = (id: string) => categories?.find(c => c.id === id)?.nameAr || '';

  if (cL || sL) return <div className="flex min-h-[50vh] items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">الخدمات والباقات</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">{allSvcs.length} خدمة · {categories?.length || 0} قسم</p>
        </div>
        <div className="flex gap-2">
          <Link href="/services/categories">
            <Button variant="outline" size="sm"><Tag className="h-3.5 w-3.5" /> الأقسام</Button>
          </Link>
          <Link href="/services/new">
            <Button size="sm"><Plus className="h-3.5 w-3.5" /> خدمة جديدة</Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-[var(--muted)]/50 w-fit">
        {[
          { key: 'services' as const, label: 'الخدمات', icon: '✂️', count: allSvcs.length },
          { key: 'packages' as const, label: 'الباقات', icon: '📦', count: 0 },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-2 rounded-lg text-xs font-bold transition-all',
              tab === t.key ? 'bg-white shadow-sm text-[var(--foreground)]' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
            )}
          >
            {t.icon} {t.label} {t.count > 0 && <span className="ml-1 opacity-50">({t.count})</span>}
          </button>
        ))}
      </div>

      {tab === 'services' ? (
        <>
          {/* Search + Category Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)] opacity-40" />
              <input
                type="text"
                dir="rtl"
                inputMode="text"
                placeholder="بحث عن خدمة..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] text-sm focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 outline-none transition-all"
              />
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              <button onClick={() => setFilterCat('')} className={cn('px-3 py-2 rounded-lg text-[11px] font-bold border transition-all whitespace-nowrap', !filterCat ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]' : 'border-[var(--border)] hover:border-[var(--brand-primary)]/40')}>
                الكل ({allSvcs.length})
              </button>
              {categories?.map(c => {
                const cnt = allSvcs.filter(s => s.categoryId === c.id).length;
                return (
                  <button key={c.id} onClick={() => setFilterCat(filterCat === c.id ? '' : c.id)}
                    className={cn('px-3 py-2 rounded-lg text-[11px] font-bold border transition-all whitespace-nowrap', filterCat === c.id ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]' : 'border-[var(--border)] hover:border-[var(--brand-primary)]/40')}>
                    {c.nameAr} ({cnt})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Services */}
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <Sparkles className="h-10 w-10 mx-auto text-[var(--muted-foreground)] mb-3 opacity-30" />
              <p className="font-medium text-[var(--foreground)]">لا توجد خدمات</p>
              <Link href="/services/new"><Button className="mt-3" size="sm"><Plus className="h-3 w-3" /> إضافة خدمة</Button></Link>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(svc => {
                const isEditing = editId === svc.id;
                const isDeleting = deleteId === svc.id;

                return (
                  <div key={svc.id} className={cn(
                    'group relative rounded-2xl border bg-[var(--card)] transition-all',
                    isDeleting ? 'border-red-300' : 'border-[var(--border)] hover:shadow-sm',
                    !svc.isActive && 'opacity-50',
                  )}>
                    {/* Delete overlay */}
                    {isDeleting && (
                      <div className="absolute inset-0 rounded-2xl bg-white/95 backdrop-blur-sm z-10 flex items-center justify-center gap-3">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                        <span className="text-sm font-bold">حذف "{svc.nameAr}"؟</span>
                        <button onClick={() => deleteMut.mutate(svc.id)} className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition">حذف</button>
                        <button onClick={() => setDeleteId(null)} className="px-3 py-1.5 rounded-lg border text-xs font-bold hover:bg-slate-50 transition">إلغاء</button>
                      </div>
                    )}

                    <div className="flex items-center gap-4 p-4">
                      {/* Service Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-[var(--foreground)] truncate">{svc.nameAr}</h3>
                          {svc.nameEn && <span className="text-[11px] text-[var(--muted-foreground)] hidden sm:inline">{svc.nameEn}</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] text-[10px] font-bold">
                            {getCatName(svc.categoryId)}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--muted-foreground)]">
                            <Clock className="h-3 w-3" /> {svc.duration} min
                          </span>
                        </div>
                      </div>

                      {/* Price */}
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            dir="ltr"
                            inputMode="decimal"
                            value={editPrice}
                            onChange={e => setEditPrice(e.target.value)}
                            className="w-20 px-2 py-1.5 rounded-lg border border-[var(--brand-primary)] bg-white text-sm text-center font-bold focus:outline-none"
                            autoFocus
                          />
                          <span className="text-[10px] text-[var(--muted-foreground)]">SAR</span>
                          <button onClick={() => { updateMut.mutate({ id: svc.id, data: { price: Number(editPrice) } }); }} className="p-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition"><Check className="h-3.5 w-3.5" /></button>
                          <button onClick={() => setEditId(null)} className="p-1.5 rounded-lg border hover:bg-slate-50 transition"><span className="text-xs">✕</span></button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditId(svc.id); setEditPrice(String(svc.price)); }}
                          className="text-left group/price"
                        >
                          <div className="text-lg font-black text-[var(--brand-primary)] tabular-nums" dir="ltr">{Number(svc.price).toFixed(0)}</div>
                          <div className="text-[10px] text-[var(--muted-foreground)] group-hover/price:text-[var(--brand-primary)] transition">SAR · تعديل</div>
                        </button>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => toggleMut.mutate({ id: svc.id, isActive: !svc.isActive })}
                          className="p-1.5 rounded-lg hover:bg-[var(--muted)] text-[var(--muted-foreground)] transition"
                          title={svc.isActive ? 'تعطيل' : 'تفعيل'}
                        >
                          {svc.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                        <button onClick={() => setDeleteId(svc.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-[var(--muted-foreground)] hover:text-red-500 transition">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* ── PACKAGES TAB ── */
        <PackagesTab allSvcs={allSvcs} />
      )}
    </div>
  );
}

/* ── Packages Tab ── */
interface Pkg { id: string; nameAr: string; nameEn?: string; serviceIds: string[]; originalPrice: number; packagePrice: number; }

function PackagesTab({ allSvcs }: { allSvcs: Service[] }) {
  const [pkgs, setPkgs] = useState<Pkg[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem('servix_packages') || '[]'); } catch { return []; }
  });

  const delPkg = (id: string) => {
    const next = pkgs.filter(p => p.id !== id);
    setPkgs(next);
    localStorage.setItem('servix_packages', JSON.stringify(next));
    toast.success('تم حذف الباقة');
  };

  if (pkgs.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary)]/60 flex items-center justify-center mb-4">
          <Package className="h-8 w-8 text-white" />
        </div>
        <h3 className="font-bold">الباقات</h3>
        <p className="text-sm text-[var(--muted-foreground)] mt-1 max-w-sm mx-auto">
          أنشئي باقات تجمع عدة خدمات بسعر مخفض
        </p>
        <Link href="/services/packages/new">
          <Button className="mt-4" size="sm"><Plus className="h-3.5 w-3.5" /> إنشاء باقة</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Link href="/services/packages/new">
          <Button size="sm"><Plus className="h-3 w-3" /> باقة جديدة</Button>
        </Link>
      </div>
      {pkgs.map(pkg => {
        const savings = pkg.originalPrice - pkg.packagePrice;
        const pct = pkg.originalPrice > 0 ? Math.round((savings / pkg.originalPrice) * 100) : 0;
        const svcNames = pkg.serviceIds.map(id => allSvcs.find(s => s.id === id)?.nameAr || '—').join(' + ');

        return (
          <div key={pkg.id} className="group rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 hover:shadow-sm transition-all">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-[var(--brand-primary)]" />
                  <h3 className="text-sm font-bold">{pkg.nameAr}</h3>
                  {savings > 0 && <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-bold">وفّري {pct}%</span>}
                </div>
                <p className="text-[11px] text-[var(--muted-foreground)] mt-1 truncate">{svcNames}</p>
              </div>
              <div className="text-left">
                <span className="text-[11px] text-[var(--muted-foreground)] line-through" dir="ltr">{pkg.originalPrice} SAR</span>
                <div className="text-lg font-black text-[var(--brand-primary)] tabular-nums" dir="ltr">{pkg.packagePrice} SAR</div>
              </div>
              <button onClick={() => delPkg(pkg.id)} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-[var(--muted-foreground)] hover:text-red-500 transition">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
