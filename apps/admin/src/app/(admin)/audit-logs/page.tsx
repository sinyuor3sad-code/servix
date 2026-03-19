'use client';

import { useState, type ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { adminService, type AuditLog } from '@/services/admin.service';

const actionMap: Record<string, { label: string; variant: 'default' | 'success' | 'destructive' | 'warning' | 'info' }> = {
  create: { label: 'إنشاء', variant: 'success' },
  update: { label: 'تعديل', variant: 'info' },
  delete: { label: 'حذف', variant: 'destructive' },
  login: { label: 'دخول', variant: 'default' },
  logout: { label: 'خروج', variant: 'warning' },
};

const entityTypeOptions = [
  { value: '', label: 'جميع الأنواع' },
  { value: 'tenant', label: 'صالون' },
  { value: 'subscription', label: 'اشتراك' },
  { value: 'plan', label: 'باقة' },
  { value: 'feature', label: 'ميزة' },
  { value: 'user', label: 'مستخدم' },
  { value: 'invoice', label: 'فاتورة' },
];

const actionOptions = [
  { value: '', label: 'جميع العمليات' },
  { value: 'create', label: 'إنشاء' },
  { value: 'update', label: 'تعديل' },
  { value: 'delete', label: 'حذف' },
  { value: 'login', label: 'دخول' },
  { value: 'logout', label: 'خروج' },
];

export default function AuditLogsPage(): ReactElement {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('perPage', '20');
  if (search) params.set('search', search);
  if (entityType) params.set('entityType', entityType);
  if (action) params.set('action', action);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-audit-logs', page, search, entityType, action],
    queryFn: () => adminService.getAuditLogs(params.toString()),
  });

  const columns: Column<AuditLog>[] = [
    {
      key: 'userName',
      header: 'المستخدم',
      render: (row) => <span className="font-medium">{row.userName}</span>,
    },
    {
      key: 'action',
      header: 'العملية',
      render: (row) => {
        const act = actionMap[row.action] || { label: row.action, variant: 'secondary' as const };
        return <Badge variant={act.variant}>{act.label}</Badge>;
      },
    },
    {
      key: 'entityType',
      header: 'النوع',
      render: (row) => {
        const typeLabel = entityTypeOptions.find((e) => e.value === row.entityType)?.label || row.entityType;
        return <span>{typeLabel}</span>;
      },
    },
    {
      key: 'entityId',
      header: 'الكيان',
      render: (row) => (
        <code className="rounded bg-[var(--muted)] px-1.5 py-0.5 text-xs" dir="ltr">
          {row.entityId.slice(0, 8)}...
        </code>
      ),
    },
    {
      key: 'details',
      header: 'التفاصيل',
      render: (row) => (
        <span className="max-w-xs truncate text-[var(--muted-foreground)] text-xs">
          {row.details || '—'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'التاريخ',
      render: (row) => new Date(row.createdAt).toLocaleString('ar-SA'),
    },
  ];

  return (
    <>
      <PageHeader
        title="سجل العمليات"
        description="جميع العمليات التي تمت على المنصة"
      />

      <DataTable<AuditLog>
        columns={columns}
        data={data?.items ?? []}
        keyExtractor={(row) => row.id}
        searchable
        searchPlaceholder="بحث بالمستخدم..."
        onSearch={setSearch}
        loading={isLoading}
        emptyTitle="لا توجد عمليات"
        page={page}
        totalPages={data?.meta.totalPages ?? 1}
        onPageChange={setPage}
        actions={
          <div className="flex items-center gap-2">
            <select
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value);
                setPage(1);
              }}
              className="h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            >
              {entityTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(1);
              }}
              className="h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            >
              {actionOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        }
      />
    </>
  );
}
