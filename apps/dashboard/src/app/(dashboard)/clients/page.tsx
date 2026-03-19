'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Plus, Eye } from 'lucide-react';
import {
  PageHeader,
  DataTable,
  Button,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import { dashboardService } from '@/services/dashboard.service';
import { useAuth } from '@/hooks/useAuth';
import type { Client } from '@/types';

export default function ClientsPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['clients', page, search],
    queryFn: () =>
      dashboardService.getClients({ page, limit: 10, search }, accessToken!),
    enabled: !!accessToken,
  });

  const columns: Column<Client>[] = [
    {
      key: 'fullName',
      header: 'الاسم',
      render: (row) => (
        <button
          onClick={() => router.push(`/clients/${row.id}`)}
          className="font-medium text-[var(--brand-primary)] hover:underline"
        >
          {row.fullName}
        </button>
      ),
    },
    {
      key: 'phone',
      header: 'الجوال',
    },
    {
      key: 'totalVisits',
      header: 'عدد الزيارات',
    },
    {
      key: 'totalSpent',
      header: 'إجمالي الإنفاق',
      render: (row) => `${row.totalSpent.toLocaleString('ar-SA')} ر.س`,
    },
    {
      key: 'lastVisitAt',
      header: 'آخر زيارة',
      render: (row) =>
        row.lastVisitAt
          ? new Intl.DateTimeFormat('ar-SA', { dateStyle: 'medium' }).format(
              new Date(row.lastVisitAt),
            )
          : '—',
    },
    {
      key: 'actions',
      header: 'الإجراءات',
      render: (row) => (
        <Link href={`/clients/${row.id}`}>
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
        title="العملاء"
        actions={
          <Link href="/clients/new">
            <Button>
              <Plus className="h-4 w-4" />
              عميل جديد
            </Button>
          </Link>
        }
      />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        keyExtractor={(row) => row.id}
        searchable
        searchPlaceholder="بحث بالاسم أو الجوال..."
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        loading={isLoading}
        emptyTitle="لا يوجد عملاء"
        emptyDescription="لم يتم العثور على عملاء مطابقين"
        page={page}
        totalPages={data?.totalPages ?? 1}
        onPageChange={setPage}
      />
    </div>
  );
}
