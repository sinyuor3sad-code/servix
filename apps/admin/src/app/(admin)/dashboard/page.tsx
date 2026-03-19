'use client';

import { type ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { adminService, type AdminStats } from '@/services/admin.service';

function DashboardSkeleton(): ReactElement {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[120px]" />
        ))}
      </div>
      <Skeleton className="h-[350px]" />
      <Skeleton className="h-[300px]" />
    </div>
  );
}

const statusMap: Record<string, { label: string; variant: 'success' | 'destructive' | 'warning' }> = {
  active: { label: 'نشط', variant: 'success' },
  suspended: { label: 'معلّق', variant: 'destructive' },
  pending: { label: 'قيد المراجعة', variant: 'warning' },
};

export default function AdminDashboardPage(): ReactElement {
  const { data: stats, isLoading } = useQuery<AdminStats>({
    queryKey: ['admin-stats'],
    queryFn: () => adminService.getStats(),
  });

  if (isLoading || !stats) {
    return (
      <>
        <PageHeader title="لوحة التحكم" description="نظرة عامة على المنصة" />
        <DashboardSkeleton />
      </>
    );
  }

  return (
    <>
      <PageHeader title="لوحة التحكم" description="نظرة عامة على المنصة" />

      <div className="space-y-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            icon={Building2}
            label="إجمالي الصالونات"
            value={stats.totalTenants}
            iconColor="bg-blue-50 text-blue-600"
          />
          <StatCard
            icon={CheckCircle2}
            label="الصالونات النشطة"
            value={stats.activeTenants}
            iconColor="bg-emerald-50 text-emerald-600"
          />
          <StatCard
            icon={Clock}
            label="المعلقة"
            value={stats.pendingTenants}
            iconColor="bg-amber-50 text-amber-600"
          />
          <StatCard
            icon={CreditCard}
            label="إجمالي الاشتراكات"
            value={stats.totalSubscriptions}
            iconColor="bg-purple-50 text-purple-600"
          />
          <StatCard
            icon={DollarSign}
            label="إيرادات هذا الشهر"
            value={`${stats.monthlyRevenue.toLocaleString('ar-SA')} ر.س`}
            iconColor="bg-green-50 text-green-600"
          />
          <StatCard
            icon={TrendingUp}
            label="صالونات جديدة هذا الشهر"
            value={stats.newTenantsThisMonth}
            iconColor="bg-sky-50 text-sky-600"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>توزيع الباقات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.planDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="plan" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      fontFamily: 'var(--font-cairo), sans-serif',
                    }}
                  />
                  <Bar dataKey="count" fill="var(--brand-primary)" radius={[4, 4, 0, 0]} name="عدد الصالونات" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>أحدث الصالونات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-[var(--border)] overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الصالون</TableHead>
                    <TableHead>البريد</TableHead>
                    <TableHead>المدينة</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>تاريخ التسجيل</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.recentTenants.map((tenant) => {
                    const status = statusMap[tenant.status] || statusMap.pending;
                    return (
                      <TableRow key={tenant.id}>
                        <TableCell className="font-medium">{tenant.nameAr}</TableCell>
                        <TableCell dir="ltr" className="text-start">{tenant.email}</TableCell>
                        <TableCell>{tenant.city}</TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(tenant.createdAt).toLocaleDateString('ar-SA')}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
