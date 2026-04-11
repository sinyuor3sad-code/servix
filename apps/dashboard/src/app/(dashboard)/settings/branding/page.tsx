'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, Upload, Palette, Paintbrush } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Spinner } from '@/components/ui';
import { ThemeSelector } from '@/components/theme-selector';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { applyColorVariables } from '@/themes/colors';
import type { TenantTheme } from '@/types';

interface BrandingData { theme: TenantTheme; primaryColor: string; mode: 'light' | 'dark' | 'auto'; logoUrl: string | null; }

export default function BrandingPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<BrandingData>({
    queryKey: ['settings', 'branding'],
    queryFn: () => api.get<BrandingData>('/salon/branding', accessToken!),
    enabled: !!accessToken,
  });

  const [selectedTheme, setSelectedTheme] = useState<TenantTheme>(data?.theme ?? 'velvet');
  const [primaryColor, setPrimaryColor] = useState(data?.primaryColor ?? '#a855f7');
  const [mode, setMode] = useState<'light' | 'dark'>((data?.mode === 'dark' ? 'dark' : 'light'));

  useEffect(() => { if (data) { setSelectedTheme(data.theme ?? 'velvet'); setPrimaryColor(data.primaryColor ?? '#a855f7'); setMode(data.mode === 'dark' ? 'dark' : 'light'); } }, [data]);
  useEffect(() => { if (primaryColor && /^#[0-9a-fA-F]{6}$/.test(primaryColor)) applyColorVariables(document.documentElement, primaryColor); }, [primaryColor]);

  const hasChanges = data?.theme !== selectedTheme || data?.primaryColor !== primaryColor || (data?.mode ?? 'light') !== mode;

  const mut = useMutation({
    mutationFn: () => api.put('/salon/branding', { theme: selectedTheme, primaryColor, mode }, accessToken!),
    onSuccess: () => { toast.success('✅ تم حفظ المظهر'); qc.invalidateQueries({ queryKey: ['settings', 'branding'] }); },
    onError: () => toast.error('خطأ في الحفظ'),
  });

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/settings')} className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--muted)] transition"><ArrowRight className="h-4 w-4" /></button>
        <div>
          <h1 className="text-xl font-black">الشعار والثيم</h1>
          <p className="text-xs text-[var(--muted-foreground)]">تخصيص مظهر لوحة التحكم</p>
        </div>
      </div>

      {/* Theme Selector */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-5 py-3 bg-gradient-to-l from-fuchsia-500 to-pink-600 text-white flex items-center gap-2">
          <Palette className="h-4 w-4 opacity-70" /><span className="text-xs font-bold">ثيم لوحة التحكم</span>
        </div>
        <div className="p-5">
          <ThemeSelector selected={selectedTheme} mode={mode} onThemeChange={setSelectedTheme} onModeChange={setMode} />
        </div>
      </div>

      {/* Primary Color */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-5 py-3 bg-gradient-to-l from-violet-500 to-purple-600 text-white flex items-center gap-2">
          <Paintbrush className="h-4 w-4 opacity-70" /><span className="text-xs font-bold">اللون الرئيسي</span>
        </div>
        <div className="p-5">
          <p className="text-xs text-[var(--muted-foreground)] mb-3">يُطبّق على الأزرار والروابط والعناصر المميزة</p>
          <div className="flex items-center gap-4 flex-wrap">
            <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
              className="h-14 w-14 cursor-pointer rounded-2xl border-2 border-[var(--border)]" />
            <input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} dir="ltr" placeholder="#a855f7"
              className="px-4 py-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] font-mono text-sm w-32 text-center focus:border-[var(--brand-primary)] outline-none" />
            <div className="flex gap-1.5">
              {['--primary-300', '--primary-500', '--primary-700'].map(v => (
                <div key={v} className="h-10 w-10 rounded-xl border border-[var(--border)]" style={{ background: `var(${v})` }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Logo */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-5 py-3 bg-gradient-to-l from-sky-500 to-blue-600 text-white flex items-center gap-2">
          <Upload className="h-4 w-4 opacity-70" /><span className="text-xs font-bold">الشعار</span>
        </div>
        <div className="p-5">
          {data?.logoUrl && (
            <div className="mb-3 flex justify-center">
              <img src={data.logoUrl} alt="شعار الصالون" className="h-20 w-20 object-contain rounded-xl border border-[var(--border)]" />
            </div>
          )}
          <label className="flex h-28 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--muted)]/30 transition-colors hover:border-[var(--brand-primary)] cursor-pointer">
            <Upload className="mb-2 h-6 w-6 text-[var(--muted-foreground)] opacity-30" />
            <p className="text-xs font-bold text-[var(--muted-foreground)]">{data?.logoUrl ? 'تغيير الشعار' : 'اضغطي لرفع الشعار'}</p>
            <p className="text-[10px] text-[var(--muted-foreground)] mt-1">PNG, JPG بحد أقصى 2MB</p>
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 2 * 1024 * 1024) { toast.error('الملف أكبر من 2MB'); return; }
              const formData = new FormData();
              formData.append('file', file);
              try {
                const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
                const res = await fetch(`${API_BASE}/salon/logo`, {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${accessToken}` },
                  body: formData,
                });
                if (!res.ok) throw new Error('فشل');
                const data = await res.json();
                toast.success(data.data?.message || '✅ تم رفع الشعار');
                qc.invalidateQueries({ queryKey: ['branding'] });
              } catch { toast.error('فشل رفع الشعار'); }
            }} />
          </label>
        </div>
      </div>

      <Button onClick={() => mut.mutate()} disabled={mut.isPending || !hasChanges} className="w-full py-3">
        {mut.isPending ? 'جارٍ الحفظ...' : hasChanges ? '💾 حفظ التغييرات' : '✅ محفوظ'}
      </Button>
    </div>
  );
}
