'use client';

import { useState, type ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Eye } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { adminService, type Tenant } from '@/services/admin.service';

const statusMap: Record<string, { label: string; variant: 'success' | 'destructive' | 'warning' }> = {
  active: { label: 'نشط', variant: 'success' },
  suspended: { label: 'معلّق', variant: 'destructive' },
  pending: { label: 'قيد المراجعة', variant: 'warning' },
};

const statusOptions = [
  { value: '', label: 'جميع الحالات' },
  { value: 'active', label: 'نشط' },
  { value: 'suspended', label: 'معلّق' },
  { value: 'pending', label: 'قيد المراجعة' },
];

export default function TenantsPage(): ReactElement {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('perPage', '20');
  if (search) params.set('search', search);
  if (statusFilter) params.set('status', statusFilter);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-tenants', page, search, statusFilter],
    queryFn: () => adminService.getTenants(params.toString()),
  });

  const columns: Column<Tenant>[] = [
    {
      key: 'nameAr',
      header: 'الصالون',
      render: (row) => (
        <span className="font-medium">{row.nameAr}</span>
      ),
    },
    {
      key: 'email',
      header: 'البريد',
      render: (row) => (
        <span dir="ltr" className="text-start">{row.email}</span>
      ),
    },
    {
      key: 'city',
      header: 'المدينة',
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
      key: 'createdAt',
      header: 'تاريخ التسجيل',
      render: (row) => new Date(row.createdAt).toLocaleDateString('ar-SA'),
    },
    {
      key: 'actions',
      header: 'الإجراءات',
      render: (row) => (
        <Link href={`/admin/tenants/${row.id}`}>
          <Button variant="ghost" size="sm">
            <Eye className="h-4 w-4" />
            عرض
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="الصالونات"
        description="إدارة جميع الصالونات المسجلة في المنصة"
      />

      <DataTable<Tenant>
        columns={columns}
        data={data?.items ?? []}
        keyExtractor={(row) => row.id}
        searchable
        searchPlaceholder="بحث بالاسم أو البريد..."
        onSearch={setSearch}
        loading={isLoading}
        emptyTitle="لا توجد صالونات"
        emptyDescription="لم يتم تسجيل أي صالون بعد"
        page={page}
        totalPages={data?.meta.totalPages ?? 1}
        onPageChange={setPage}
        actions={
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        }
      />
    </>
  );
}
