'use client';

import { useState, type ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { adminService, type PlatformInvoice } from '@/services/admin.service';

const statusMap: Record<string, { label: string; variant: 'success' | 'destructive' | 'warning' | 'secondary' }> = {
  paid: { label: 'مدفوعة', variant: 'success' },
  pending: { label: 'معلقة', variant: 'warning' },
  overdue: { label: 'متأخرة', variant: 'destructive' },
  cancelled: { label: 'ملغاة', variant: 'secondary' },
};

export default function InvoicesPage(): ReactElement {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('perPage', '20');
  if (search) params.set('search', search);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-invoices', page, search],
    queryFn: () => adminService.getInvoices(params.toString()),
  });

  const columns: Column<PlatformInvoice>[] = [
    {
      key: 'invoiceNumber',
      header: 'رقم الفاتورة',
      render: (row) => (
        <span className="font-medium font-mono" dir="ltr">{row.invoiceNumber}</span>
      ),
    },
    {
      key: 'tenantName',
      header: 'الصالون',
    },
    {
      key: 'amount',
      header: 'المبلغ',
      render: (row) => `${row.amount.toLocaleString('ar-SA')} ر.س`,
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (row) => {
        const status = statusMap[row.status] || statusMap.pending;
        return <Badge variant={status.variant}>{status.label}</Badge>;
      },
    },
    {
      key: 'dueDate',
      header: 'تاريخ الاستحقاق',
      render: (row) => new Date(row.dueDate).toLocaleDateString('ar-SA'),
    },
    {
      key: 'paidAt',
      header: 'تاريخ الدفع',
      render: (row) =>
        row.paidAt ? new Date(row.paidAt).toLocaleDateString('ar-SA') : '—',
    },
  ];

  return (
    <>
      <PageHeader
        title="الفواتير"
        description="فواتير اشتراكات المنصة"
      />

      <DataTable<PlatformInvoice>
        columns={columns}
        data={data?.items ?? []}
        keyExtractor={(row) => row.id}
        searchable
        searchPlaceholder="بحث برقم الفاتورة أو الصالون..."
        onSearch={setSearch}
        loading={isLoading}
        emptyTitle="لا توجد فواتير"
        page={page}
        totalPages={data?.meta.totalPages ?? 1}
        onPageChange={setPage}
      />
    </>
  );
}
