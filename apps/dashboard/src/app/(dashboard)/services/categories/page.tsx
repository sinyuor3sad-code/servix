'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Check, X, ArrowRight, Tag, AlertTriangle } from 'lucide-react';
import { PageHeader, Button, Input, Spinner } from '@/components/ui';
import { dashboardService } from '@/services/dashboard.service';
import { useAuth } from '@/hooks/useAuth';
import type { ServiceCategory } from '@/types';
import { cn } from '@/lib/utils';

const COLORS = [
  { bg: 'bg-purple-50', dot: 'bg-purple-500', text: 'text-purple-700' },
  { bg: 'bg-pink-50', dot: 'bg-pink-500', text: 'text-pink-700' },
  { bg: 'bg-amber-50', dot: 'bg-amber-500', text: 'text-amber-700' },
  { bg: 'bg-emerald-50', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  { bg: 'bg-sky-50', dot: 'bg-sky-500', text: 'text-sky-700' },
  { bg: 'bg-rose-50', dot: 'bg-rose-500', text: 'text-rose-700' },
];

export default function CategoriesPage() {
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();

  const [showAdd, setShowAdd] = useState(false);
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editAr, setEditAr] = useState('');
  const [editEn, setEditEn] = useState('');
  const [delId, setDelId] = useState<string | null>(null);

  const { data: cats, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => dashboardService.getCategories(accessToken!),
    enabled: !!accessToken,
  });

  const { data: svcsData } = useQuery({
    queryKey: ['services', 'all'],
    queryFn: () => dashboardService.getServices({ limit: 100 }, accessToken!),
    enabled: !!accessToken,
  });

  const createMut = useMutation({
    mutationFn: () => dashboardService.createCategory({ nameAr, nameEn: nameEn || null }, accessToken!),
    onSuccess: () => { toast.success('✅ تم الإضافة'); qc.invalidateQueries({ queryKey: ['categories'] }); setNameAr(''); setNameEn(''); setShowAdd(false); },
    onError: () => toast.error('خطأ'),
  });

  const updateMut = useMutation({
    mutationFn: (id: string) => dashboardService.updateCategory(id, { nameAr: editAr, nameEn: editEn || null }, accessToken!),
    onSuccess: () => { toast.success('✅ تم التحديث'); qc.invalidateQueries({ queryKey: ['categories'] }); setEditId(null); },
    onError: () => toast.error('خطأ'),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => dashboardService.deleteCategory(id, accessToken!),
    onSuccess: () => { toast.success('تم الحذف'); qc.invalidateQueries({ queryKey: ['categories'] }); setDelId(null); },
    onError: () => toast.error('لا يمكن حذف قسم يحتوي خدمات'),
  });

  const svcCount = (id: string) => svcsData?.items.filter(s => s.categoryId === id).length || 0;

  if (isLoading) return <div className="flex min-h-[50vh] items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">الأقسام</h1>
          <p className="text-xs text-[var(--muted-foreground)]">نظّمي خدمات الصالون في أقسام</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push('/services')}><ArrowRight className="h-3.5 w-3.5" /> الخدمات</Button>
          <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-3.5 w-3.5" /> قسم جديد</Button>
        </div>
      </div>

      {/* Add New */}
      {showAdd && (
        <div className="rounded-2xl border-2 border-dashed border-[var(--brand-primary)] bg-[var(--brand-primary)]/5 p-4 space-y-3">
          <span className="text-xs font-bold text-[var(--brand-primary)]">قسم جديد</span>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input placeholder="الاسم بالعربية *" value={nameAr} onChange={e => setNameAr(e.target.value)} />
            <Input placeholder="English name (optional)" value={nameEn} onChange={e => setNameEn(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => createMut.mutate()} disabled={!nameAr.trim() || createMut.isPending}>
              <Check className="h-3 w-3" /> حفظ
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowAdd(false); setNameAr(''); setNameEn(''); }}>إلغاء</Button>
          </div>
        </div>
      )}

      {/* Categories */}
      {cats && cats.length > 0 ? (
        <div className="space-y-2">
          {cats.map((c: ServiceCategory, i: number) => {
            const clr = COLORS[i % COLORS.length];
            const cnt = svcCount(c.id);

            return (
              <div key={c.id} className={cn('relative rounded-2xl border overflow-hidden transition-all', delId === c.id ? 'border-red-300' : 'border-[var(--border)]')}>
                {/* Delete overlay */}
                {delId === c.id && (
                  <div className="absolute inset-0 rounded-2xl bg-white/95 backdrop-blur-sm z-10 flex items-center justify-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <span className="text-sm font-bold">حذف "{c.nameAr}"؟</span>
                    <button onClick={() => delMut.mutate(c.id)} className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-bold">حذف</button>
                    <button onClick={() => setDelId(null)} className="px-3 py-1.5 rounded-lg border text-xs font-bold">إلغاء</button>
                  </div>
                )}

                {editId === c.id ? (
                  <div className={cn('p-4 space-y-3', clr.bg)}>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input value={editAr} onChange={e => setEditAr(e.target.value)} placeholder="الاسم بالعربية" />
                      <Input value={editEn} onChange={e => setEditEn(e.target.value)} placeholder="English name" />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => updateMut.mutate(c.id)} disabled={!editAr.trim()}><Check className="h-3 w-3" /> حفظ</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditId(null)}>إلغاء</Button>
                    </div>
                  </div>
                ) : (
                  <div className={cn('flex items-center gap-3 p-4', clr.bg)}>
                    <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', clr.dot)}>
                      <Tag className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={cn('text-sm font-bold', clr.text)}>{c.nameAr}</h3>
                      <p className="text-[11px] text-[var(--muted-foreground)]">{c.nameEn ? `${c.nameEn} · ` : ''}{cnt} خدمة</p>
                    </div>
                    <div className="flex gap-0.5">
                      <button onClick={() => { setEditId(c.id); setEditAr(c.nameAr); setEditEn(c.nameEn ?? ''); }}
                        className="p-2 rounded-lg hover:bg-white/60 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setDelId(c.id)}
                        className="p-2 rounded-lg hover:bg-red-100 text-[var(--muted-foreground)] hover:text-red-500 transition"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 rounded-2xl border border-dashed border-[var(--border)]">
          <Tag className="h-10 w-10 mx-auto text-[var(--muted-foreground)] mb-3 opacity-30" />
          <p className="font-medium">لا توجد أقسام بعد</p>
          <Button className="mt-3" size="sm" onClick={() => setShowAdd(true)}><Plus className="h-3 w-3" /> إضافة قسم</Button>
        </div>
      )}
    </div>
  );
}
