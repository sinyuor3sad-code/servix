'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, DollarSign } from 'lucide-react';
import {
  PageHeader,
  DataTable,
  Button,
  StatCard,
  Badge,
  Input,
  Select,
  Skeleton,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import type { PaginatedResponse } from '@/types';

interface Expense {
  id: string;
  description: string;
  category: string;
  amount: number;
  date: string;
  notes: string | null;
  createdAt: string;
}

const categoryLabels: Record<string, string> = {
  rent: 'إيجار',
  utilities: 'مرافق',
  supplies: 'مستلزمات',
  salary: 'رواتب',
  maintenance: 'صيانة',
  other: 'أخرى',
};

function formatCurrency(value: number): string {
  return `${value.toLocaleString('ar-SA')} ر.س`;
}

function getDefaultDates(): { from: string; to: string } {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    from: firstDay.toISOString().split('T')[0],
    to: now.toISOString().split('T')[0],
  };
}

export default function ExpensesPage(): React.ReactElement {
  const { accessToken } = useAuth();
  const defaults = useMemo(getDefaultDates, []);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: '10',
    ...(category && { category }),
    ...(dateFrom && { from: dateFrom }),
    ...(dateTo && { to: dateTo }),
  }).toString();

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', page, category, dateFrom, dateTo],
    queryFn: () =>
      api.get<PaginatedResponse<Expense>>(`/expenses?${queryParams}`, accessToken!),
    enabled: !!accessToken,
  });

  const totalExpenses = useMemo(
    () => (data?.items ?? []).reduce((sum, e) => sum + e.amount, 0),
    [data],
  );

  const columns: Column<Expense>[] = [
    {
      key: 'description',
      header: 'الوصف',
      render: (row) => <span className="font-medium">{row.description}</span>,
    },
    {
      key: 'category',
      header: 'التصنيف',
      render: (row) => (
        <Badge variant="secondary">{categoryLabels[row.category] ?? row.category}</Badge>
      ),
    },
    {
      key: 'amount',
      header: 'المبلغ',
      render: (row) => (
        <span className="font-medium text-red-600">{formatCurrency(row.amount)}</span>
      ),
    },
    {
      key: 'date',
      header: 'التاريخ',
      render: (row) =>
        new Intl.DateTimeFormat('ar-SA', { dateStyle: 'medium' }).format(new Date(row.date)),
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="المصروفات"
        actions={
          <Link href="/expenses/new">
            <Button>
              <Plus className="h-4 w-4" />
              إضافة مصروف
            </Button>
          </Link>
        }
      />

      {isLoading ? (
        <Skeleton className="mb-6 h-[120px] w-64 rounded-xl" />
      ) : (
        <div className="mb-6">
          <StatCard
            icon={DollarSign}
            label="إجمالي المصروفات"
            value={formatCurrency(totalExpenses)}
            className="max-w-xs"
          />
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Select
          label="التصنيف"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          options={[
            { value: '', label: 'الكل' },
            { value: 'rent', label: 'إيجار' },
            { value: 'utilities', label: 'مرافق' },
            { value: 'supplies', label: 'مستلزمات' },
            { value: 'salary', label: 'رواتب' },
            { value: 'maintenance', label: 'صيانة' },
            { value: 'other', label: 'أخرى' },
          ]}
        />
        <Input
          type="date"
          label="من تاريخ"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
        />
        <Input
          type="date"
          label="إلى تاريخ"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        keyExtractor={(row) => row.id}
        loading={isLoading}
        emptyTitle="لا توجد مصروفات"
        emptyDescription="لم يتم تسجيل أي مصروفات في هذه الفترة"
        page={page}
        totalPages={data?.totalPages ?? 1}
        onPageChange={setPage}
      />
    </div>
  );
}
