'use client';

import { useState, type FormEvent, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/auth.store';
import { adminService } from '@/services/admin.service';
import { ApiError } from '@/lib/api';

export default function AdminLoginPage(): ReactElement {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const router = useRouter();

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!email || !password) {
      toast.error('يرجى إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }

    setLoading(true);
    try {
      const result = await adminService.login(email, password);
      login(result.user, result.accessToken, result.refreshToken);
      toast.success('تم تسجيل الدخول بنجاح');
      router.push('/dashboard');
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('حدث خطأ أثناء تسجيل الدخول');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--primary-800)] bg-[var(--primary-900)]/60 p-8 shadow-2xl backdrop-blur-sm">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--brand-primary)] text-white text-2xl font-bold shadow-lg">
          S
        </div>
        <h1 className="text-2xl font-bold text-white">SERVIX Admin</h1>
        <p className="mt-1 text-sm text-[var(--primary-300)]">
          لوحة إدارة المنصة
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-medium text-[var(--primary-200)]">
            البريد الإلكتروني
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@servix.sa"
            className="flex h-11 w-full rounded-lg border border-[var(--primary-700)] bg-[var(--primary-800)]/50 px-3 py-2 text-sm text-white placeholder:text-[var(--primary-400)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
            dir="ltr"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-sm font-medium text-[var(--primary-200)]">
            كلمة المرور
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="flex h-11 w-full rounded-lg border border-[var(--primary-700)] bg-[var(--primary-800)]/50 px-3 py-2 text-sm text-white placeholder:text-[var(--primary-400)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
            dir="ltr"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-11 text-base"
        >
          {loading ? 'جارٍ الدخول...' : 'دخول لوحة الإدارة'}
        </Button>
      </form>
    </div>
  );
}
