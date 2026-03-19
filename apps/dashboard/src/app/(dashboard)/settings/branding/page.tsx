'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Sun, Moon, Upload } from 'lucide-react';
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
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { themeConfigs } from '@/themes/theme-config';
import type { TenantTheme } from '@/types';

interface BrandingData {
  theme: TenantTheme;
  primaryColor: string;
  mode: 'light' | 'dark' | 'auto';
  logoUrl: string | null;
}

const themeKeys = Object.keys(themeConfigs) as TenantTheme[];

export default function BrandingPage(): React.ReactElement {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<BrandingData>({
    queryKey: ['settings', 'branding'],
    queryFn: () => api.get<BrandingData>('/settings/branding', accessToken!),
    enabled: !!accessToken,
  });

  const [selectedTheme, setSelectedTheme] = useState<TenantTheme>(data?.theme ?? 'elegance');
  const [primaryColor, setPrimaryColor] = useState(data?.primaryColor ?? '#8b5cf6');
  const [mode, setMode] = useState<'light' | 'dark'>(
    (data?.mode === 'dark' ? 'dark' : 'light'),
  );

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
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader title="الشعار والثيم" description="تخصيص مظهر لوحة التحكم" />

      <div className="mx-auto max-w-4xl space-y-8">
        {/* Theme Selector */}
        <Card>
          <CardHeader>
            <CardTitle>اختيار الثيم</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {themeKeys.map((key) => {
                const config = themeConfigs[key];
                const isSelected = selectedTheme === key;

                return (
                  <button
                    key={key}
                    onClick={() => setSelectedTheme(key)}
                    className={`relative flex flex-col items-start gap-1 rounded-xl border-2 p-4 text-start transition-all ${
                      isSelected
                        ? 'border-[var(--brand-primary)] bg-[var(--primary-50)]'
                        : 'border-[var(--border)] hover:border-[var(--muted-foreground)]'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute end-2 top-2 rounded-full bg-[var(--brand-primary)] p-1">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                    <span className="text-sm font-semibold text-[var(--foreground)]">
                      {config.nameAr}
                    </span>
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {config.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Primary Color */}
        <Card>
          <CardHeader>
            <CardTitle>اللون الرئيسي</CardTitle>
          </CardHeader>
          <CardContent>
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
                placeholder="#8b5cf6"
                className="max-w-xs font-mono"
              />
            </div>
          </CardContent>
        </Card>

        {/* Dark/Light Mode */}
        <Card>
          <CardHeader>
            <CardTitle>الوضع</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <button
                onClick={() => setMode('light')}
                className={`flex items-center gap-2 rounded-xl border-2 px-6 py-3 transition-all ${
                  mode === 'light'
                    ? 'border-[var(--brand-primary)] bg-[var(--primary-50)]'
                    : 'border-[var(--border)]'
                }`}
              >
                <Sun className="h-5 w-5" />
                <span className="font-medium">فاتح</span>
              </button>
              <button
                onClick={() => setMode('dark')}
                className={`flex items-center gap-2 rounded-xl border-2 px-6 py-3 transition-all ${
                  mode === 'dark'
                    ? 'border-[var(--brand-primary)] bg-[var(--primary-50)]'
                    : 'border-[var(--border)]'
                }`}
              >
                <Moon className="h-5 w-5" />
                <span className="font-medium">داكن</span>
              </button>
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
        </div>
      </div>
    </div>
  );
}
