'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Skeleton,
} from '@/components/ui';
import { ThemeSelector } from '@/components/theme-selector';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { applyColorVariables } from '@/themes/colors';
import type { TenantTheme } from '@/types';

interface BrandingData {
  theme: TenantTheme;
  primaryColor: string;
  mode: 'light' | 'dark' | 'auto';
  logoUrl: string | null;
}

export default function BrandingPage(): React.ReactElement {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<BrandingData>({
    queryKey: ['settings', 'branding'],
    queryFn: () => api.get<BrandingData>('/settings/branding', accessToken!),
    enabled: !!accessToken,
  });

  const [selectedTheme, setSelectedTheme] = useState<TenantTheme>(data?.theme ?? 'velvet');
  const [primaryColor, setPrimaryColor] = useState(data?.primaryColor ?? '#a855f7');
  const [mode, setMode] = useState<'light' | 'dark'>(
    (data?.mode === 'dark' ? 'dark' : 'light'),
  );

  // Sync state when data loads
  useEffect(() => {
    if (data) {
      setSelectedTheme(data.theme ?? 'velvet');
      setPrimaryColor(data.primaryColor ?? '#a855f7');
      setMode(data.mode === 'dark' ? 'dark' : 'light');
    }
  }, [data]);

  // Live-apply primary color shades when user changes the color picker
  useEffect(() => {
    if (primaryColor && /^#[0-9a-fA-F]{6}$/.test(primaryColor)) {
      applyColorVariables(document.documentElement, primaryColor);
    }
  }, [primaryColor]);

  const hasChanges =
    data?.theme !== selectedTheme ||
    data?.primaryColor !== primaryColor ||
    (data?.mode ?? 'light') !== mode;

  const mutation = useMutation({
    mutationFn: () =>
      api.put(
        '/settings/branding',
        { theme: selectedTheme, primaryColor, mode },
        accessToken!,
      ),
    onSuccess: () => {
      toast.success('تم حفظ إعدادات المظهر');
      queryClient.invalidateQueries({ queryKey: ['settings', 'branding'] });
    },
    onError: () => {
      toast.error('حدث خطأ أثناء حفظ الإعدادات');
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader title="الشعار والثيم" description="تخصيص مظهر لوحة التحكم وصفحة الحجز" />

      <div className="mx-auto max-w-4xl space-y-8">
        {/* Theme + Mode Selector */}
        <Card>
          <CardHeader>
            <CardTitle>ثيم لوحة التحكم</CardTitle>
          </CardHeader>
          <CardContent>
            <ThemeSelector
              selected={selectedTheme}
              mode={mode}
              onThemeChange={setSelectedTheme}
              onModeChange={setMode}
            />
          </CardContent>
        </Card>

        {/* Primary Color */}
        <Card>
          <CardHeader>
            <CardTitle>اللون الرئيسي</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-[var(--muted-foreground)]">
              يُطبّق على الأزرار والروابط والعناصر المميزة في لوحة التحكم وصفحة الحجز
            </p>
            <div className="flex items-center gap-4">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-12 w-12 cursor-pointer rounded-lg border border-[var(--border)]"
              />
              <Input
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#a855f7"
                className="max-w-xs font-mono"
              />
              {/* Live preview swatch */}
              <div className="flex gap-1">
                {['--primary-300', '--primary-500', '--primary-700'].map((v) => (
                  <div
                    key={v}
                    className="h-8 w-8 rounded"
                    style={{ background: `var(${v})` }}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logo Upload */}
        <Card>
          <CardHeader>
            <CardTitle>الشعار</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-40 flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--muted)] transition-colors hover:border-[var(--brand-primary)]">
              <Upload className="mb-2 h-8 w-8 text-[var(--muted-foreground)]" />
              <p className="text-sm font-medium text-[var(--muted-foreground)]">
                اسحب الشعار هنا أو اضغط للرفع
              </p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                PNG, JPG بحد أقصى 2MB
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Save */}
        <div className="flex items-center gap-3">
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !hasChanges}
          >
            {mutation.isPending ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
          </Button>
          {hasChanges && (
            <span className="text-sm text-[var(--muted-foreground)]">
              لديك تغييرات غير محفوظة
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
