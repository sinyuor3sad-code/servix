'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PageHeader,
  DataTable,
  Badge,
  Button,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import { dashboardService } from '@/services/dashboard.service';
import { useAuth } from '@/hooks/useAuth';
import type { Appointment, AppointmentStatus } from '@/types';

const STATUS_CONFIG: Record<
  AppointmentStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' }
> = {
  pending: { label: 'بانتظار التأكيد', variant: 'warning' },
  confirmed: { label: 'مؤكد', variant: 'default' },
  in_progress: { label: 'جارٍ', variant: 'secondary' },
  completed: { label: 'مكتمل', variant: 'success' },
  cancelled: { label: 'ملغي', variant: 'destructive' },
  no_show: { label: 'لم يحضر', variant: 'destructive' },
};

type FilterTab = 'all' | 'today' | 'upcoming';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'today', label: 'اليوم' },
  { key: 'upcoming', label: 'القادمة' },
];

export default function AppointmentsPage() {
  const { accessToken } = useAuth();
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['appointments', activeTab, page, search],
    queryFn: () =>
      dashboardService.getAppointments(
        {
          page,
          limit: 10,
          search,
          status: activeTab === 'all' ? undefined : activeTab,
        },
        accessToken!,
      ),
    enabled: !!accessToken,
  });

  const columns: Column<Appointment>[] = [
    {
      key: 'client',
      header: 'العميل',
      render: (row) => row.client?.fullName ?? '—',
    },
    {
      key: 'employee',
      header: 'الموظفة',
      render: (row) => row.employee?.fullName ?? '—',
    },
    {
      key: 'date',
      header: 'التاريخ',
      render: (row) =>
        new Intl.DateTimeFormat('ar-SA', { dateStyle: 'medium' }).format(
          new Date(row.date),
        ),
    },
    {
      key: 'startTime',
      header: 'الوقت',
    },
    {
      key: 'services',
      header: 'الخدمات',
      render: (row) =>
        row.appointmentServices
          ?.map((s) => s.service?.nameAr)
          .filter(Boolean)
          .join('، ') || '—',
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
      key: 'actions',
      header: 'الإجراءات',
      render: (row) => (
        <Link href={`/appointments/${row.id}`}>
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
        title="المواعيد"
        actions={
          <Link href="/appointments/new">
            <Button>
              <Plus className="h-4 w-4" />
              حجز جديد
            </Button>
          </Link>
        }
      />

      <div className="mb-6 flex gap-1 rounded-lg bg-[var(--muted)] p-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              setPage(1);
            }}
            className={cn(
              'rounded-md px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab.key
                ? 'bg-[var(--background)] text-[var(--foreground)] shadow-sm'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        keyExtractor={(row) => row.id}
        searchable
        searchPlaceholder="بحث في المواعيد..."
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        loading={isLoading}
        emptyTitle="لا توجد مواعيد"
        emptyDescription="لم يتم العثور على مواعيد مطابقة"
        page={page}
        totalPages={data?.totalPages ?? 1}
        onPageChange={setPage}
      />
    </div>
  );
}
