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
import type { Employee, EmployeeRole } from '@/types';

const ROLE_LABELS: Record<EmployeeRole, string> = {
  stylist: 'مصففة',
  manager: 'مديرة',
  receptionist: 'موظفة استقبال',
  cashier: 'كاشيرة',
};

const ROLE_VARIANTS: Record<EmployeeRole, 'default' | 'secondary' | 'outline' | 'success'> = {
  stylist: 'default',
  manager: 'success',
  receptionist: 'secondary',
  cashier: 'outline',
};

export default function EmployeesPage() {
  const { accessToken } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['employees', page, search],
    queryFn: () =>
      dashboardService.getEmployees({ page, limit: 10, search }, accessToken!),
    enabled: !!accessToken,
  });

  const columns: Column<Employee>[] = [
    {
      key: 'fullName',
      header: 'الاسم',
      render: (row) => (
        <span className="font-medium text-[var(--foreground)]">{row.fullName}</span>
      ),
    },
    {
      key: 'role',
      header: 'الدور',
      render: (row) => (
        <Badge variant={ROLE_VARIANTS[row.role]}>{ROLE_LABELS[row.role]}</Badge>
      ),
    },
    {
      key: 'commission',
      header: 'العمولة',
      render: (row) => {
        if (row.commissionType === 'none') return '—';
        return row.commissionType === 'percentage'
          ? `${row.commissionValue}%`
          : `${row.commissionValue} ر.س`;
      },
    },
    {
      key: 'isActive',
      header: 'الحالة',
      render: (row) => (
        <Badge variant={row.isActive ? 'success' : 'secondary'}>
          {row.isActive ? 'نشطة' : 'غير نشطة'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'الإجراءات',
      render: (row) => (
        <Link href={`/employees/${row.id}`}>
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
        title="الموظفات"
        actions={
          <Link href="/employees/new">
            <Button>
              <Plus className="h-4 w-4" />
              إضافة موظفة
            </Button>
          </Link>
        }
      />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        keyExtractor={(row) => row.id}
        searchable
        searchPlaceholder="بحث بالاسم..."
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        loading={isLoading}
        emptyTitle="لا توجد موظفات"
        emptyDescription="لم يتم العثور على موظفات مطابقات"
        page={page}
        totalPages={data?.totalPages ?? 1}
        onPageChange={setPage}
      />
    </div>
  );
}
