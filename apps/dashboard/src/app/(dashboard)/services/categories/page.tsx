'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import {
  PageHeader,
  Button,
  Input,
  Spinner,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui';
import { dashboardService } from '@/services/dashboard.service';
import { useAuth } from '@/hooks/useAuth';
import type { ServiceCategory } from '@/types';

export default function CategoriesPage() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  const [newNameAr, setNewNameAr] = useState('');
  const [newNameEn, setNewNameEn] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNameAr, setEditNameAr] = useState('');
  const [editNameEn, setEditNameEn] = useState('');

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => dashboardService.getCategories(accessToken!),
    enabled: !!accessToken,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      dashboardService.createCategory(
        { nameAr: newNameAr, nameEn: newNameEn || null },
        accessToken!,
      ),
    onSuccess: () => {
      toast.success('تم إضافة التصنيف');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setNewNameAr('');
      setNewNameEn('');
      setShowAdd(false);
    },
    onError: () => toast.error('حدث خطأ أثناء إضافة التصنيف'),
  });

  const updateMutation = useMutation({
    mutationFn: (id: string) =>
      dashboardService.updateCategory(
        id,
        { nameAr: editNameAr, nameEn: editNameEn || null },
        accessToken!,
      ),
    onSuccess: () => {
      toast.success('تم تحديث التصنيف');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setEditingId(null);
    },
    onError: () => toast.error('حدث خطأ أثناء تحديث التصنيف'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      dashboardService.deleteCategory(id, accessToken!),
    onSuccess: () => {
      toast.success('تم حذف التصنيف');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: () => toast.error('حدث خطأ أثناء حذف التصنيف'),
  });

  function startEdit(category: ServiceCategory) {
    setEditingId(category.id);
    setEditNameAr(category.nameAr);
    setEditNameEn(category.nameEn ?? '');
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="تصنيفات الخدمات"
        description="إدارة تصنيفات الخدمات المقدمة"
        actions={
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" />
            إضافة تصنيف
          </Button>
        }
      />

      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>التصنيفات</CardTitle>
        </CardHeader>
        <CardContent>
          {showAdd && (
            <div className="mb-4 flex flex-col gap-2 rounded-lg border border-dashed border-[var(--brand-primary)] bg-[var(--brand-primary)]/5 p-4">
              <Input
                placeholder="اسم التصنيف بالعربية"
                value={newNameAr}
                onChange={(e) => setNewNameAr(e.target.value)}
              />
              <Input
                placeholder="الاسم بالإنجليزية (اختياري)"
                value={newNameEn}
                onChange={(e) => setNewNameEn(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => createMutation.mutate()}
                  disabled={!newNameAr.trim() || createMutation.isPending}
                >
                  <Check className="h-4 w-4" />
                  حفظ
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowAdd(false);
                    setNewNameAr('');
                    setNewNameEn('');
                  }}
                >
                  <X className="h-4 w-4" />
                  إلغاء
                </Button>
              </div>
            </div>
          )}

          {categories && categories.length > 0 ? (
            <div className="divide-y divide-[var(--border)]">
              {categories.map((category: ServiceCategory) => (
                <div key={category.id} className="py-3 first:pt-0 last:pb-0">
                  {editingId === category.id ? (
                    <div className="flex flex-col gap-2">
                      <Input
                        value={editNameAr}
                        onChange={(e) => setEditNameAr(e.target.value)}
                        placeholder="اسم التصنيف بالعربية"
                      />
                      <Input
                        value={editNameEn}
                        onChange={(e) => setEditNameEn(e.target.value)}
                        placeholder="الاسم بالإنجليزية (اختياري)"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => updateMutation.mutate(category.id)}
                          disabled={!editNameAr.trim() || updateMutation.isPending}
                        >
                          <Check className="h-4 w-4" />
                          حفظ
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="h-4 w-4" />
                          إلغاء
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-[var(--foreground)]">
                          {category.nameAr}
                        </p>
                        {category.nameEn && (
                          <p className="text-xs text-[var(--muted-foreground)]">
                            {category.nameEn}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEdit(category)}
                          aria-label="تعديل"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(category.id)}
                          disabled={deleteMutation.isPending}
                          aria-label="حذف"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
              لا توجد تصنيفات بعد. أضف تصنيفاً جديداً للبدء.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
