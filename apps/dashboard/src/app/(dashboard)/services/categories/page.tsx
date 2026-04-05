'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Check, X, ArrowRight, Tag, AlertTriangle, GripVertical } from 'lucide-react';
import { PageHeader, Button, Input, Spinner } from '@/components/ui';
import { dashboardService } from '@/services/dashboard.service';
import { useAuth } from '@/hooks/useAuth';
import type { ServiceCategory } from '@/types';
import { cn } from '@/lib/utils';

const CAT_COLORS = [
  { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', dot: 'bg-purple-500' },
  { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700', dot: 'bg-pink-500' },
  { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700', dot: 'bg-sky-500' },
  { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', dot: 'bg-rose-500' },
];

export default function CategoriesPage() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [showAdd, setShowAdd] = useState(false);
  const [newNameAr, setNewNameAr] = useState('');
  const [newNameEn, setNewNameEn] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNameAr, setEditNameAr] = useState('');
  const [editNameEn, setEditNameEn] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => dashboardService.getCategories(accessToken!),
    enabled: !!accessToken,
  });

  const { data: servicesData } = useQuery({
    queryKey: ['services', 'all'],
    queryFn: () => dashboardService.getServices({ limit: 100 }, accessToken!),
    enabled: !!accessToken,
  });

  const createMutation = useMutation({
    mutationFn: () => dashboardService.createCategory({ nameAr: newNameAr, nameEn: newNameEn || null }, accessToken!),
    onSuccess: () => {
      toast.success('✅ تم إضافة التصنيف');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setNewNameAr(''); setNewNameEn(''); setShowAdd(false);
    },
    onError: () => toast.error('خطأ في إضافة التصنيف'),
  });

  const updateMutation = useMutation({
    mutationFn: (id: string) => dashboardService.updateCategory(id, { nameAr: editNameAr, nameEn: editNameEn || null }, accessToken!),
    onSuccess: () => {
      toast.success('✅ تم التحديث');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setEditingId(null);
    },
    onError: () => toast.error('خطأ في تحديث التصنيف'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => dashboardService.deleteCategory(id, accessToken!),
    onSuccess: () => {
      toast.success('تم حذف التصنيف');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setDeleteConfirmId(null);
    },
    onError: () => toast.error('لا يمكن حذف تصنيف يحتوي على خدمات'),
  });

  const getServiceCount = (catId: string) => servicesData?.items.filter(s => s.categoryId === catId).length || 0;

  if (isLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Spinner size="lg" /></div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="تصنيفات الخدمات"
        description="نظّمي خدمات الصالون في تصنيفات"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push('/services')}>
              <ArrowRight className="h-3.5 w-3.5" />
              الخدمات
            </Button>
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="h-3.5 w-3.5" />
              تصنيف جديد
            </Button>
          </div>
        }
      />

      {/* Add New */}
      {showAdd && (
        <div className="rounded-2xl border-2 border-dashed border-[var(--brand-primary)] bg-[var(--brand-primary)]/5 p-5 space-y-3">
          <h4 className="text-sm font-bold text-[var(--brand-primary)]">تصنيف جديد</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="الاسم بالعربية *" value={newNameAr} onChange={e => setNewNameAr(e.target.value)} />
            <Input placeholder="الاسم بالإنجليزية (اختياري)" value={newNameEn} onChange={e => setNewNameEn(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => createMutation.mutate()} disabled={!newNameAr.trim() || createMutation.isPending}>
              <Check className="h-3.5 w-3.5" /> حفظ
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowAdd(false); setNewNameAr(''); setNewNameEn(''); }}>
              إلغاء
            </Button>
          </div>
        </div>
      )}

      {/* Categories List */}
      {categories && categories.length > 0 ? (
        <div className="space-y-3">
          {categories.map((cat: ServiceCategory, i: number) => {
            const color = CAT_COLORS[i % CAT_COLORS.length];
            const count = getServiceCount(cat.id);
            const isEditing = editingId === cat.id;
            const isDeleting = deleteConfirmId === cat.id;

            return (
              <div
                key={cat.id}
                className={cn(
                  'relative rounded-2xl border overflow-hidden transition-all',
                  isDeleting ? 'border-red-300' : 'border-[var(--border)]',
                )}
              >
                {/* Delete Confirmation */}
                {isDeleting && (
                  <div className="absolute inset-0 rounded-2xl bg-white/95 backdrop-blur-sm z-10 flex items-center justify-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <span className="text-sm font-semibold">حذف "{cat.nameAr}"؟</span>
                    <button onClick={() => deleteMutation.mutate(cat.id)} className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition">حذف</button>
                    <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-slate-50 transition">إلغاء</button>
                  </div>
                )}

                {isEditing ? (
                  <div className={cn('p-4 space-y-3', color.bg)}>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input value={editNameAr} onChange={e => setEditNameAr(e.target.value)} placeholder="الاسم بالعربية" />
                      <Input value={editNameEn} onChange={e => setEditNameEn(e.target.value)} placeholder="الاسم بالإنجليزية" />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => updateMutation.mutate(cat.id)} disabled={!editNameAr.trim()}>
                        <Check className="h-3.5 w-3.5" /> حفظ
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>إلغاء</Button>
                    </div>
                  </div>
                ) : (
                  <div className={cn('flex items-center gap-4 p-4', color.bg)}>
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', color.dot)}>
                      <Tag className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={cn('text-sm font-bold', color.text)}>{cat.nameAr}</h3>
                      <div className="flex items-center gap-2">
                        {cat.nameEn && <span className="text-[11px] text-[var(--muted-foreground)]">{cat.nameEn}</span>}
                        <span className="text-[11px] text-[var(--muted-foreground)]">· {count} خدمة</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setEditingId(cat.id); setEditNameAr(cat.nameAr); setEditNameEn(cat.nameEn ?? ''); }}
                        className="p-2 rounded-lg hover:bg-white/70 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(cat.id)}
                        className="p-2 rounded-lg hover:bg-red-100 text-[var(--muted-foreground)] hover:text-red-500 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 rounded-2xl border border-dashed border-[var(--border)]">
          <Tag className="h-10 w-10 mx-auto text-[var(--muted-foreground)] mb-3" />
          <p className="text-[var(--muted-foreground)]">لا توجد تصنيفات بعد</p>
          <Button className="mt-3" size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-3 w-3" /> إضافة أول تصنيف
          </Button>
        </div>
      )}
    </div>
  );
}
