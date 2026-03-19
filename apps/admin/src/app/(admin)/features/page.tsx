'use client';

import { type ReactElement } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { adminService, type Feature } from '@/services/admin.service';
import { ApiError } from '@/lib/api';

function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}): ReactElement {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-[var(--brand-primary)]' : 'bg-[var(--muted)]'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ${
          checked ? '-translate-x-5 rtl:translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export default function FeaturesPage(): ReactElement {
  const queryClient = useQueryClient();

  const { data: features, isLoading } = useQuery({
    queryKey: ['admin-features'],
    queryFn: () => adminService.getFeatures(),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminService.updateFeature(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-features'] });
      toast.success('تم تحديث الميزة بنجاح');
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('حدث خطأ أثناء تحديث الميزة');
      }
    },
  });

  return (
    <>
      <PageHeader
        title="الميزات"
        description="إدارة ميزات المنصة"
      />

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الميزة</TableHead>
                    <TableHead>الرمز</TableHead>
                    <TableHead>الوصف</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>تفعيل/تعطيل</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(features ?? []).map((feature) => (
                    <TableRow key={feature.id}>
                      <TableCell className="font-medium">{feature.nameAr}</TableCell>
                      <TableCell>
                        <code className="rounded bg-[var(--muted)] px-1.5 py-0.5 text-xs" dir="ltr">
                          {feature.code}
                        </code>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-[var(--muted-foreground)]">
                        {feature.description}
                      </TableCell>
                      <TableCell>
                        <Badge variant={feature.isActive ? 'success' : 'secondary'}>
                          {feature.isActive ? 'مفعّلة' : 'معطّلة'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <ToggleSwitch
                          checked={feature.isActive}
                          onChange={(checked) =>
                            toggleMutation.mutate({ id: feature.id, isActive: checked })
                          }
                          disabled={toggleMutation.isPending}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
