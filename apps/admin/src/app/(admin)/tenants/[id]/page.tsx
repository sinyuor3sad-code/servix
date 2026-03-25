'use client';

import { type ReactElement } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, Building2, CreditCard, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { adminService, type TenantDetail } from '@/services/admin.service';
import { ApiError } from '@/lib/api';

const statusMap: Record<string, { label: string; variant: 'success' | 'destructive' | 'warning' }> = {
  active: { label: 'نشط', variant: 'success' },
  suspended: { label: 'معلّق', variant: 'destructive' },
  pending: { label: 'قيد المراجعة', variant: 'warning' },
};

const subscriptionStatusMap: Record<string, { label: string; variant: 'success' | 'destructive' | 'warning' | 'info' }> = {
  active: { label: 'نشط', variant: 'success' },
  expired: { label: 'منتهي', variant: 'destructive' },
  cancelled: { label: 'ملغي', variant: 'destructive' },
  trial: { label: 'تجريبي', variant: 'info' },
};

function TenantDetailSkeleton(): ReactElement {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[200px]" />
      <Skeleton className="h-[150px]" />
      <Skeleton className="h-[200px]" />
    </div>
  );
}

export default function TenantDetailPage(): ReactElement {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const tenantId = params.id as string;

  const { data: tenant, isLoading } = useQuery<TenantDetail>({
    queryKey: ['admin-tenant', tenantId],
    queryFn: () => adminService.getTenantById(tenantId),
    enabled: !!tenantId,
  });

  const statusMutation = useMutation({
    mutationFn: ({ status }: { status: string }) =>
      adminService.updateTenantStatus(tenantId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tenant', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['admin-tenants'] });
      toast.success('تم تحديث حالة الصالون بنجاح');
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('حدث خطأ أثناء تحديث الحالة');
      }
    },
  });

  if (isLoading || !tenant) {
    return (
      <>
        <PageHeader title="تفاصيل الصالون" />
        <TenantDetailSkeleton />
      </>
    );
  }

  const status = statusMap[tenant.status] || statusMap.pending;

  return (
    <>
      <PageHeader
        title={tenant.nameAr}
        description={tenant.email}
        actions={
          <Button variant="outline" onClick={() => router.push('/tenants')}>
            <ArrowRight className="h-4 w-4" />
            العودة للقائمة
          </Button>
        }
      />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-[var(--brand-primary)]" />
              <CardTitle>معلومات الصالون</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-sm text-[var(--muted-foreground)]">الاسم بالعربي</p>
                <p className="mt-1 font-medium">{tenant.nameAr}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--muted-foreground)]">الاسم بالإنجليزي</p>
                <p className="mt-1 font-medium" dir="ltr">{tenant.nameEn}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--muted-foreground)]">الرابط</p>
                <p className="mt-1 font-medium" dir="ltr">{tenant.slug}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--muted-foreground)]">البريد الإلكتروني</p>
                <p className="mt-1 font-medium" dir="ltr">{tenant.email}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--muted-foreground)]">الهاتف</p>
                <p className="mt-1 font-medium" dir="ltr">{tenant.phone}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--muted-foreground)]">المدينة</p>
                <p className="mt-1 font-medium">{tenant.city}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--muted-foreground)]">الحالة</p>
                <div className="mt-1">
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
              </div>
              <div>
                <p className="text-sm text-[var(--muted-foreground)]">تاريخ التسجيل</p>
                <p className="mt-1 font-medium">
                  {new Date(tenant.createdAt).toLocaleDateString('ar-SA')}
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              {tenant.status !== 'active' && (
                <Button
                  onClick={() => statusMutation.mutate({ status: 'active' })}
                  disabled={statusMutation.isPending}
                >
                  تفعيل الصالون
                </Button>
              )}
              {tenant.status !== 'suspended' && (
                <Button
                  variant="destructive"
                  onClick={() => statusMutation.mutate({ status: 'suspended' })}
                  disabled={statusMutation.isPending}
                >
                  تعليق الصالون
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {tenant.subscription && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-[var(--brand-primary)]" />
                <CardTitle>الاشتراك</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-sm text-[var(--muted-foreground)]">الباقة</p>
                  <p className="mt-1 font-medium">{tenant.subscription.planName}</p>
                </div>
                <div>
                  <p className="text-sm text-[var(--muted-foreground)]">الحالة</p>
                  <div className="mt-1">
                    <Badge variant={subscriptionStatusMap[tenant.subscription.status]?.variant || 'secondary'}>
                      {subscriptionStatusMap[tenant.subscription.status]?.label || tenant.subscription.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-[var(--muted-foreground)]">تاريخ البدء</p>
                  <p className="mt-1 font-medium">
                    {new Date(tenant.subscription.startDate).toLocaleDateString('ar-SA')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-[var(--muted-foreground)]">تاريخ الانتهاء</p>
                  <p className="mt-1 font-medium">
                    {new Date(tenant.subscription.endDate).toLocaleDateString('ar-SA')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-[var(--brand-primary)]" />
              <CardTitle>المستخدمون ({tenant.users.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {tenant.users.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
                لا يوجد مستخدمون
              </p>
            ) : (
              <div className="rounded-lg border border-[var(--border)] overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الاسم</TableHead>
                      <TableHead>البريد</TableHead>
                      <TableHead>الدور</TableHead>
                      <TableHead>تاريخ الإنشاء</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tenant.users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.fullName}</TableCell>
                        <TableCell dir="ltr" className="text-start">{user.email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{user.role}</Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(user.createdAt).toLocaleDateString('ar-SA')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
