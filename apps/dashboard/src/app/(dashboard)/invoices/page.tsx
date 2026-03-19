'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, Eye } from 'lucide-react';
import {
  PageHeader,
  DataTable,
  Badge,
  Button,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import { dashboardService } from '@/services/dashboard.service';
import { useAuth } from '@/hooks/useAuth';
import type { Invoice, InvoiceStatus } from '@/types';

const STATUS_CONFIG: Record<
  InvoiceStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'outline' }
> = {
  draft: { label: 'مسودة', variant: 'secondary' },
  paid: { label: 'مدفوعة', variant: 'success' },
  partially_paid: { label: 'مدفوعة جزئياً', variant: 'warning' },
  void: { label: 'ملغية', variant: 'destructive' },
  refunded: { label: 'مستردة', variant: 'outline' },
};

export default function InvoicesPage() {
  const { accessToken } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', page, search],
    queryFn: () =>
      dashboardService.getInvoices({ page, limit: 10, search }, accessToken!),
    enabled: !!accessToken,
  });

  const columns: Column<Invoice>[] = [
    {
      key: 'invoiceNumber',
      header: 'رقم الفاتورة',
      render: (row) => (
        <span className="font-mono text-sm font-medium text-[var(--foreground)]">
          {row.invoiceNumber}
        </span>
      ),
    },
    {
      key: 'client',
      header: 'العميل',
      render: (row) => row.client?.fullName ?? '—',
    },
    {
      key: 'total',
      header: 'المبلغ',
      render: (row) => `${row.total.toLocaleString('ar-SA')} ر.س`,
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (row) => {
        const config = STATUS_CONFIG[row.status];
        return <Badge variant={config.variant}>{config.label}</Badge>;
      },
    },
    {
      key: 'createdAt',
      header: 'التاريخ',
      render: (row) =>
        new Intl.DateTimeFormat('ar-SA', { dateStyle: 'medium' }).format(
          new Date(row.createdAt),
        ),
    },
    {
      key: 'actions',
      header: 'الإجراءات',
      render: (row) => (
        <Link href={`/invoices/${row.id}`}>
          <Button variant="ghost" size="sm">
            <Eye className="h-4 w-4" />
            عرض
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="الفواتير"
        actions={
          <Link href="/invoices/new">
            <Button>
              <Plus className="h-4 w-4" />
              فاتورة جديدة
            </Button>
          </Link>
        }
      />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        keyExtractor={(row) => row.id}
        searchable
        searchPlaceholder="بحث برقم الفاتورة أو اسم العميل..."
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        loading={isLoading}
        emptyTitle="لا توجد فواتير"
        emptyDescription="لم يتم العثور على فواتير مطابقة"
        page={page}
        totalPages={data?.totalPages ?? 1}
        onPageChange={setPage}
      />
    </div>
  );
}
