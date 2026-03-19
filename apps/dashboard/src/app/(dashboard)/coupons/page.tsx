'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, Percent, DollarSign } from 'lucide-react';
import {
  PageHeader,
  DataTable,
  Button,
  Badge,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import type { PaginatedResponse } from '@/types';

interface Coupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed_amount';
  value: number;
  minOrderAmount: number;
  maxUses: number;
  currentUses: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

type CouponStatus = 'active' | 'expired' | 'disabled';

function getCouponStatus(coupon: Coupon): CouponStatus {
  if (!coupon.isActive) return 'disabled';
  if (new Date(coupon.endDate) < new Date()) return 'expired';
  return 'active';
}

const statusConfig: Record<CouponStatus, { label: string; variant: 'success' | 'destructive' | 'secondary' }> = {
  active: { label: 'نشط', variant: 'success' },
  expired: { label: 'منتهي', variant: 'destructive' },
  disabled: { label: 'معطّل', variant: 'secondary' },
};

export default function CouponsPage(): React.ReactElement {
  const { accessToken } = useAuth();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['coupons', page],
    queryFn: () =>
      api.get<PaginatedResponse<Coupon>>(`/coupons?page=${page}&limit=10`, accessToken!),
    enabled: !!accessToken,
  });

  const columns: Column<Coupon>[] = [
    {
      key: 'code',
      header: 'الكود',
      render: (row) => (
        <span className="font-mono font-medium text-[var(--brand-primary)]">{row.code}</span>
      ),
    },
    {
      key: 'type',
      header: 'النوع',
      render: (row) => (
        <Badge variant="secondary">
          {row.type === 'percentage' ? (
            <span className="inline-flex items-center gap-1">
              <Percent className="h-3 w-3" /> نسبة
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <DollarSign className="h-3 w-3" /> مبلغ ثابت
            </span>
          )}
        </Badge>
      ),
    },
    {
      key: 'value',
      header: 'القيمة',
      render: (row) =>
        row.type === 'percentage'
          ? `${row.value}%`
          : `${row.value.toLocaleString('ar-SA')} ر.س`,
    },
    {
      key: 'currentUses',
      header: 'الاستخدامات',
      render: (row) => `${row.currentUses} / ${row.maxUses}`,
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (row) => {
        const status = getCouponStatus(row);
        const config = statusConfig[status];
        return <Badge variant={config.variant}>{config.label}</Badge>;
      },
    },
    {
      key: 'endDate',
      header: 'تاريخ الانتهاء',
      render: (row) =>
        new Intl.DateTimeFormat('ar-SA', { dateStyle: 'medium' }).format(new Date(row.endDate)),
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="الكوبونات"
        actions={
          <Link href="/coupons/new">
            <Button>
              <Plus className="h-4 w-4" />
              إضافة كوبون
            </Button>
          </Link>
        }
      />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        keyExtractor={(row) => row.id}
        loading={isLoading}
        emptyTitle="لا توجد كوبونات"
        emptyDescription="لم يتم إنشاء أي كوبونات بعد"
        page={page}
        totalPages={data?.totalPages ?? 1}
        onPageChange={setPage}
      />
    </div>
  );
}
