'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Clock, Pencil, Trash2, Tag, Sparkles, Package, Check, X, Eye, EyeOff, MoreVertical } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button, Spinner } from '@/components/ui';
import { dashboardService } from '@/services/dashboard.service';
import { useAuth } from '@/hooks/useAuth';
import type { Service, ServiceCategory } from '@/types';

/* ═══════════════ Design Tokens ═══════════════ */
const GRADIENTS = [
  { ribbon: 'from-violet-500 to-purple-600', badge: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
  { ribbon: 'from-rose-400 to-pink-600', badge: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500' },
  { ribbon: 'from-amber-400 to-orange-500', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  { ribbon: 'from-emerald-400 to-teal-600', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  { ribbon: 'from-sky-400 to-blue-600', badge: 'bg-sky-100 text-sky-700', dot: 'bg-sky-500' },
  { ribbon: 'from-fuchsia-400 to-pink-600', badge: 'bg-fuchsia-100 text-fuchsia-700', dot: 'bg-fuchsia-500' },
];

function fmtDur(d: number) {
  if (d < 60) return `${d} دقيقة`;
  const h = Math.floor(d / 60);
  const m = d % 60;
  return m > 0 ? `${h}:${String(m).padStart(2, '0')} ساعة` : `${h} ساعة`;
}

/* ═══════════════ Main Page ═══════════════ */
export default function ServicesPage() {
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [tab, setTab] = useState<'services' | 'packages'>('services');

  const { data: cats, isLoading: cL } = useQuery({
    queryKey: ['categories'],
    queryFn: () => dashboardService.getCategories(accessToken!),
    enabled: !!accessToken,
  });

  const { data: svcsData, isLoading: sL } = useQuery({
    queryKey: ['services', 'all'],
    queryFn: () => dashboardService.getServices({ limit: 100 }, accessToken!),
    enabled: !!accessToken,
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      dashboardService.updateService(id, data, accessToken!),
    onSuccess: () => { toast.success('✅ تم التحديث'); qc.invalidateQueries({ queryKey: ['services'] }); setEditId(null); },
    onError: () => toast.error('خطأ في التحديث'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => dashboardService.deleteService(id, accessToken!),
    onSuccess: (res: any) => {
      if (res?.deleted) {
        toast.success('🗑️ تم حذف الخدمة نهائياً');
      } else {
        toast.info(res?.message || 'تم تعطيل الخدمة');
      }
      qc.invalidateQueries({ queryKey: ['services'] });
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e?.message || 'خطأ في حذف الخدمة'),
  });

  const allSvcs = svcsData?.items ?? [];
  const filtered = allSvcs.filter(s => {
    if (filterCat && s.categoryId !== filterCat) return false;
    if (search) { const q = search.toLowerCase(); return s.nameAr.includes(search) || (s.nameEn?.toLowerCase().includes(q)); }
    return true;
  });

  const catOf = (id: string) => cats?.find(c => c.id === id);
  const gradOf = (id: string) => { const i = cats?.findIndex(c => c.id === id) ?? -1; return GRADIENTS[i < 0 ? 0 : i % GRADIENTS.length]; };

  if (cL || sL) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-[var(--foreground)]">الخدمات والباقات</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">{allSvcs.length} خدمة في {cats?.length || 0} قسم</p>
        </div>
        <div className="flex gap-2">
          <Link href="/services/categories">
            <Button variant="outline" size="sm" className="gap-1.5"><Tag className="h-3.5 w-3.5" /> الأقسام</Button>
          </Link>
          <Link href="/services/new">
            <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> خدمة جديدة</Button>
          </Link>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 p-1 rounded-2xl bg-[var(--muted)]/40 w-full sm:w-fit border border-[var(--border)] overflow-x-auto no-scrollbar">
        {(['services', 'packages'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-5 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0',
              tab === t ? 'bg-[var(--card)] shadow-md text-[var(--foreground)]' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]')}>
            {t === 'services' ? '✂️ الخدمات' : '📦 الباقات'}
          </button>
        ))}
      </div>

      {tab === 'services' ? (
        <>
          {/* ── Search + Filters ── */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)] opacity-40" />
              <input type="text" dir="rtl" placeholder="بحث عن خدمة..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pr-10 pl-4 py-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] text-sm focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 outline-none transition-all shadow-sm" />
            </div>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
              <button onClick={() => setFilterCat('')}
                className={cn('px-4 py-2.5 rounded-xl text-[11px] font-bold border-2 transition-all whitespace-nowrap',
                  !filterCat ? 'bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]' : 'border-[var(--border)] hover:border-[var(--foreground)]/30')}>
                الكل ({allSvcs.length})
              </button>
              {cats?.map((c, i) => {
                const cnt = allSvcs.filter(s => s.categoryId === c.id).length;
                const g = GRADIENTS[i % GRADIENTS.length];
                return (
                  <button key={c.id} onClick={() => setFilterCat(filterCat === c.id ? '' : c.id)}
                    className={cn('flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[11px] font-bold border-2 transition-all whitespace-nowrap',
                      filterCat === c.id ? `bg-gradient-to-l ${g.ribbon} text-white border-transparent` : 'border-[var(--border)] hover:border-[var(--foreground)]/30')}>
                    <span className={cn('w-2 h-2 rounded-full', g.dot)} /> {c.nameAr} ({cnt})
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Service Cards Grid ── */}
          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-3xl bg-[var(--muted)] flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-10 w-10 text-[var(--muted-foreground)] opacity-30" />
              </div>
              <p className="font-bold text-lg">لا توجد خدمات</p>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">أضيفي خدمة جديدة للبدء</p>
              <Link href="/services/new"><Button className="mt-4"><Plus className="h-4 w-4" /> إضافة خدمة</Button></Link>
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map(svc => {
                const g = gradOf(svc.categoryId);
                const catName = catOf(svc.categoryId)?.nameAr || '';
                const isEditing = editId === svc.id;

                return (
                  <div key={svc.id} className={cn(
                    'relative rounded-2xl bg-[var(--card)] border border-[var(--border)] overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5',
                    !svc.isActive && 'ring-2 ring-dashed ring-[var(--muted-foreground)]/20',
                  )}>
                    {/* Delete Modal */}
                    {deleteId === svc.id && (
                      <div className="absolute inset-0 z-20 bg-white/95 dark:bg-black/90 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center gap-3 p-6">
                        <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center"><Trash2 className="h-6 w-6 text-red-500" /></div>
                        <p className="text-sm font-bold text-center">حذف "{svc.nameAr}"؟</p>
                        <p className="text-[11px] text-[var(--muted-foreground)] text-center">لا يمكن التراجع عن هذا الإجراء</p>
                        <div className="flex gap-2 w-full">
                          <button onClick={() => deleteMut.mutate(svc.id)} disabled={deleteMut.isPending}
                            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition disabled:opacity-50">
                            {deleteMut.isPending ? '...' : '🗑️ نعم، احذف'}
                          </button>
                          <button onClick={() => setDeleteId(null)}
                            className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-xs font-bold hover:bg-[var(--muted)] transition">
                            إلغاء
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Gradient Header */}
                    <div className={cn('relative h-20 bg-gradient-to-l', g.ribbon, !svc.isActive && 'opacity-30')}>
                      <div className="absolute inset-0 bg-black/10" />
                      {/* status */}
                      <div className="absolute top-3 right-3">
                        <span className={cn('px-2 py-0.5 rounded-md text-[9px] font-bold backdrop-blur-sm',
                          svc.isActive ? 'bg-white/90 text-emerald-700' : 'bg-black/30 text-white')}>
                          {svc.isActive ? '● نشطة' : '○ معطلة'}
                        </span>
                      </div>
                      {/* menu */}
                      <div className="absolute top-3 left-3">
                        <button onClick={() => setMenuId(menuId === svc.id ? null : svc.id)}
                          className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/40 transition">
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                        {menuId === svc.id && (
                          <div className="absolute left-0 top-9 z-30 w-36 rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-xl p-1.5 space-y-0.5">
                            <button onClick={() => { updateMut.mutate({ id: svc.id, data: { isActive: !svc.isActive } }); setMenuId(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-medium text-[var(--foreground)] hover:bg-[var(--muted)] transition">
                              {svc.isActive ? <><EyeOff className="h-3.5 w-3.5" /> تعطيل</> : <><Eye className="h-3.5 w-3.5" /> تفعيل</>}
                            </button>
                            <button onClick={() => { setEditId(svc.id); setEditPrice(String(svc.price)); setMenuId(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-medium text-[var(--foreground)] hover:bg-[var(--muted)] transition">
                              <Pencil className="h-3.5 w-3.5" /> تعديل السعر
                            </button>
                            <div className="h-px bg-[var(--border)] my-0.5" />
                            <button onClick={() => { setDeleteId(svc.id); setMenuId(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-medium text-red-500 hover:bg-red-50 transition">
                              <Trash2 className="h-3.5 w-3.5" /> حذف
                            </button>
                          </div>
                        )}
                      </div>
                      {/* Price */}
                      <div className="absolute bottom-3 left-3 text-white">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-xl px-2 py-1">
                            <input type="number" dir="ltr" inputMode="decimal" value={editPrice} onChange={e => setEditPrice(e.target.value)} autoFocus
                              className="w-16 bg-transparent text-white text-sm font-bold text-center outline-none placeholder-white/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                            <button onClick={() => updateMut.mutate({ id: svc.id, data: { price: Number(editPrice) } })}
                              className="w-6 h-6 rounded-lg bg-white/30 flex items-center justify-center hover:bg-white/50 transition"><Check className="h-3 w-3" /></button>
                            <button onClick={() => setEditId(null)}
                              className="w-6 h-6 rounded-lg bg-white/30 flex items-center justify-center hover:bg-white/50 transition"><X className="h-3 w-3" /></button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditId(svc.id); setEditPrice(String(svc.price)); }}
                            className="group flex items-baseline gap-1 hover:scale-105 transition-transform">
                            <span className="text-2xl font-black drop-shadow-md tabular-nums" dir="ltr">{Number(svc.price).toFixed(0)}</span>
                            <span className="text-[10px] font-bold opacity-80">SAR</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Content */}
                    <div className={cn('p-4', !svc.isActive && 'opacity-40')}>
                      <h3 className="text-sm font-bold text-[var(--foreground)] mb-0.5">{svc.nameAr}</h3>
                      {svc.nameEn && <p className="text-[11px] text-[var(--muted-foreground)] mb-2">{svc.nameEn}</p>}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold', g.badge)}>
                          <span className={cn('w-1.5 h-1.5 rounded-full', g.dot)} /> {catName}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--muted)] text-[10px] font-medium text-[var(--muted-foreground)]">
                          <Clock className="h-3 w-3" /> {fmtDur(svc.duration)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <PackagesTab allSvcs={allSvcs} />
      )}
    </div>
  );
}

/* ═══════════════ Packages Tab ═══════════════ */
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
      <div className="text-center py-20">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary)]/50 flex items-center justify-center mx-auto mb-4">
          <Package className="h-10 w-10 text-white" />
        </div>
        <h3 className="font-bold text-lg">الباقات</h3>
        <p className="text-sm text-[var(--muted-foreground)] mt-1 max-w-sm mx-auto">اجمعي عدة خدمات بسعر مخفض للعملاء</p>
        <Link href="/services/packages/new"><Button className="mt-4"><Plus className="h-4 w-4" /> إنشاء باقة</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link href="/services/packages/new"><Button size="sm"><Plus className="h-3.5 w-3.5" /> باقة جديدة</Button></Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {pkgs.map(pkg => {
          const savings = pkg.originalPrice - pkg.packagePrice;
          const pct = pkg.originalPrice > 0 ? Math.round((savings / pkg.originalPrice) * 100) : 0;
          const names = pkg.serviceIds.map(id => allSvcs.find(s => s.id === id)?.nameAr || '—');

          return (
            <div key={pkg.id} className="group rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden hover:shadow-lg transition-all">
              <div className="h-2 bg-gradient-to-l from-emerald-400 to-teal-600" />
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="h-4 w-4 text-[var(--brand-primary)]" />
                      <h3 className="text-sm font-bold">{pkg.nameAr}</h3>
                      {savings > 0 && (
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                          وفّري {pct}%
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {names.map((n, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-md bg-[var(--muted)] text-[10px] text-[var(--muted-foreground)]">{n}</span>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => delPkg(pkg.id)} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-[var(--muted-foreground)] hover:text-red-500 transition">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[var(--muted-foreground)] text-xs line-through tabular-nums" dir="ltr">{pkg.originalPrice} SAR</span>
                  <span className="text-xl font-black text-[var(--brand-primary)] tabular-nums" dir="ltr">{pkg.packagePrice} SAR</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
