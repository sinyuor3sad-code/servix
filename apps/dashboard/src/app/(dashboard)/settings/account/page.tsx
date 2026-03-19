'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, Trash2, AlertTriangle } from 'lucide-react';
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

const deleteSchema = z.object({
  salonNameConfirm: z.string().min(2, 'أدخلي اسم الصالون للتأكيد'),
  password: z.string().min(6, 'كلمة المرور مطلوبة'),
});

type DeleteFormData = z.infer<typeof deleteSchema>;

export default function AccountSettingsPage(): React.ReactElement {
  const { accessToken } = useAuth();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DeleteFormData>({
    resolver: zodResolver(deleteSchema),
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/account/export`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!res.ok) throw new Error('فشل التصدير');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `servix-export-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast.success('تم تحميل بيانات الصالون');
    },
    onError: () => {
      toast.error('حدث خطأ أثناء التصدير');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (data: DeleteFormData) =>
      api.post<{ message: string; deletionAt: string }>(
        '/account/delete',
        data,
        accessToken!,
      ),
    onSuccess: (data) => {
      toast.success(data.message);
      setDeleteDialogOpen(false);
      reset();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'حدث خطأ');
    },
  });

  const cancelDeleteMutation = useMutation({
    mutationFn: () =>
      api.post<{ message: string }>('/account/delete/cancel', {}, accessToken!),
    onSuccess: (data) => {
      toast.success(data.message);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'حدث خطأ');
    },
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="الحساب"
        description="تصدير البيانات وحذف الحساب"
      />

      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              تصدير البيانات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[var(--muted-foreground)]">
              حمّلي كل بيانات الصالون كملف ZIP يحتوي على: العملاء، المواعيد، الفواتير، الخدمات، الموظفات، والإعدادات.
            </p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending}
            >
              {exportMutation.isPending ? 'جارٍ التصدير...' : 'تحميل ZIP'}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-[var(--danger)]/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[var(--danger)]">
              <Trash2 className="h-5 w-5" />
              حذف الحساب
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[var(--muted-foreground)]">
              حذف الحساب نهائياً سيُزيل كل بياناتك خلال 7 أيام. يمكنك إلغاء الطلب خلال هذه الفترة.
            </p>
            <Button
              className="mt-4"
              variant="destructive"
              onClick={() => setDeleteDialogOpen(true)}
            >
              حذف الحساب
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[var(--danger)]">
              <AlertTriangle className="h-5 w-5" />
              تأكيد حذف الحساب
            </DialogTitle>
            <DialogDescription>
              هذا الإجراء نهائي. سيتم حذف كل بيانات الصالون خلال 7 أيام. أدخلي اسم الصالون وكلمة المرور للتأكيد.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleSubmit((d) => deleteMutation.mutate(d))}
            className="space-y-4"
          >
            <Input
              label="اسم الصالون للتأكيد"
              placeholder="أدخلي اسم الصالون كما هو مسجل"
              error={errors.salonNameConfirm?.message}
              {...register('salonNameConfirm')}
            />
            <Input
              type="password"
              label="كلمة المرور"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'جارٍ...' : 'تأكيد الحذف'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
