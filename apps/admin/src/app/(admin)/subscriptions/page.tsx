'use client';

import { useState, type ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { adminService, type Subscription } from '@/services/admin.service';

const statusMap: Record<string, { label: string; variant: 'success' | 'destructive' | 'warning' | 'info' }> = {
  active: { label: 'نشط', variant: 'success' },
  expired: { label: 'منتهي', variant: 'destructive' },
  cancelled: { label: 'ملغي', variant: 'destructive' },
  trial: { label: 'تجريبي', variant: 'info' },
};

export default function SubscriptionsPage(): ReactElement {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('perPage', '20');
  if (search) params.set('search', search);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-subscriptions', page, search],
    queryFn: () => adminService.getSubscriptions(params.toString()),
  });

  const columns: Column<Subscription>[] = [
    {
      key: 'tenantName',
      header: 'الصالون',
      render: (row) => <span className="font-medium">{row.tenantName}</span>,
    },
    {
      key: 'planName',
      header: 'الباقة',
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (row) => {
        const status = statusMap[row.status] || statusMap.active;
        return <Badge variant={status.variant}>{status.label}</Badge>;
      },
    },
    {
      key: 'billingCycle',
      header: 'الدورة',
      render: (row) => (row.billingCycle === 'monthly' ? 'شهري' : 'سنوي'),
    },
    {
      key: 'price',
      header: 'السعر',
      render: (row) => `${row.price.toLocaleString('ar-SA')} ر.س`,
    },
    {
      key: 'startDate',
      header: 'تاريخ البدء',
      render: (row) => new Date(row.startDate).toLocaleDateString('ar-SA'),
    },
    {
      key: 'endDate',
      header: 'تاريخ الانتهاء',
      render: (row) => new Date(row.endDate).toLocaleDateString('ar-SA'),
    },
  ];

  return (
    <>
      <PageHeader
        title="الاشتراكات"
        description="إدارة اشتراكات الصالونات"
      />

      <DataTable<Subscription>
        columns={columns}
        data={data?.items ?? []}
        keyExtractor={(row) => row.id}
        searchable
        searchPlaceholder="بحث بالصالون..."
        onSearch={setSearch}
        loading={isLoading}
        emptyTitle="لا توجد اشتراكات"
        page={page}
        totalPages={data?.meta.totalPages ?? 1}
        onPageChange={setPage}
      />
    </>
  );
}
