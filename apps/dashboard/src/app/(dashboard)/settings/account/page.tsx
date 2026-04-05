'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, Download, Trash2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

const deleteSchema = z.object({
  salonNameConfirm: z.string().min(2, 'أدخلي اسم الصالون للتأكيد'),
  password: z.string().min(6, 'كلمة المرور مطلوبة'),
});
type DeleteForm = z.infer<typeof deleteSchema>;

const inputClass = "w-full px-4 py-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] text-sm focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 outline-none";

export default function AccountSettingsPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<DeleteForm>({ resolver: zodResolver(deleteSchema) });

  const exportMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/account/export`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) throw new Error('فشل');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `servix-export-${Date.now()}.zip`; a.click(); URL.revokeObjectURL(url);
    },
    onSuccess: () => toast.success('✅ تم التحميل'),
    onError: () => toast.error('فشل التصدير'),
  });

  const delMut = useMutation({
    mutationFn: (d: DeleteForm) => api.post<{ message: string }>('/account/delete', d, accessToken!),
    onSuccess: (d) => { toast.success(d.message); setDeleteOpen(false); reset(); },
    onError: (e: Error) => toast.error(e.message || 'خطأ'),
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/settings')} className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--muted)] transition"><ArrowRight className="h-4 w-4" /></button>
        <div>
          <h1 className="text-xl font-black">الحساب</h1>
          <p className="text-xs text-[var(--muted-foreground)]">تصدير البيانات وإدارة الحساب</p>
        </div>
      </div>

      {/* Export */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-5 py-3 bg-gradient-to-l from-sky-500 to-blue-600 text-white flex items-center gap-2">
          <Download className="h-4 w-4 opacity-70" /><span className="text-xs font-bold">تصدير البيانات</span>
        </div>
        <div className="p-5">
          <p className="text-xs text-[var(--muted-foreground)] mb-4">حمّلي كل بيانات الصالون كملف ZIP: العملاء، المواعيد، الفواتير، الخدمات، الموظفات، والإعدادات.</p>
          <Button variant="outline" onClick={() => exportMut.mutate()} disabled={exportMut.isPending} className="gap-2">
            <Download className="h-4 w-4" />
            {exportMut.isPending ? 'جارٍ التصدير...' : '📦 تحميل ZIP'}
          </Button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-2xl border-2 border-red-200 bg-red-50/50 overflow-hidden">
        <div className="px-5 py-3 bg-gradient-to-l from-red-500 to-rose-600 text-white flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 opacity-70" /><span className="text-xs font-bold">المنطقة الخطرة</span>
        </div>
        <div className="p-5">
          <p className="text-xs text-red-600 mb-4">حذف الحساب نهائياً سيُزيل كل بياناتك خلال 7 أيام. يمكنك إلغاء الطلب خلال هذه الفترة.</p>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)} className="gap-2">
            <Trash2 className="h-4 w-4" />حذف الحساب
          </Button>
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600"><AlertTriangle className="h-5 w-5" /> تأكيد حذف الحساب</DialogTitle>
            <DialogDescription>هذا الإجراء نهائي. سيتم حذف كل بيانات الصالون خلال 7 أيام.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(d => delMut.mutate(d))} className="space-y-4">
            <div>
              <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5 block">اسم الصالون للتأكيد</label>
              <input {...register('salonNameConfirm')} placeholder="أدخلي اسم الصالون" className={inputClass} />
              {errors.salonNameConfirm && <p className="text-red-500 text-[10px] mt-1">{errors.salonNameConfirm.message}</p>}
            </div>
            <div>
              <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5 block">كلمة المرور</label>
              <input {...register('password')} type="password" placeholder="••••••••" className={inputClass} />
              {errors.password && <p className="text-red-500 text-[10px] mt-1">{errors.password.message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>إلغاء</Button>
              <Button type="submit" variant="destructive" disabled={delMut.isPending}>
                {delMut.isPending ? 'جارٍ...' : '🗑️ تأكيد الحذف'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
