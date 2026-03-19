'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  DollarSign,
  Calendar,
  Users,
  UserCog,
  TrendingUp,
  ArrowLeft,
} from 'lucide-react';
import { PageHeader, Card, CardContent, Skeleton } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { dashboardService } from '@/services/dashboard.service';
import type { DashboardStats } from '@/types';

interface ReportCard {
  title: string;
  description: string;
  href: string;
  icon: typeof DollarSign;
  statKey: keyof Pick<DashboardStats, 'monthlyRevenue' | 'monthlyAppointments' | 'totalClients' | 'totalEmployees'>;
  format: (value: number) => string;
}

function formatCurrency(value: number): string {
  return `${value.toLocaleString('ar-SA')} ر.س`;
}

const reportCards: ReportCard[] = [
  {
    title: 'الإيرادات',
    description: 'تقارير الإيرادات والمبيعات',
    href: '/reports/revenue',
    icon: DollarSign,
    statKey: 'monthlyRevenue',
    format: formatCurrency,
  },
  {
    title: 'المواعيد',
    description: 'تقارير المواعيد والحجوزات',
    href: '/reports/appointments',
    icon: Calendar,
    statKey: 'monthlyAppointments',
    format: (v) => `${v} موعد`,
  },
  {
    title: 'العملاء',
    description: 'تقارير العملاء والزيارات',
    href: '/reports/clients',
    icon: Users,
    statKey: 'totalClients',
    format: (v) => `${v} عميل`,
  },
  {
    title: 'الموظفات',
    description: 'تقارير أداء الموظفات',
    href: '/reports/employees',
    icon: UserCog,
    statKey: 'totalEmployees',
    format: (v) => `${v} موظفة`,
  },
];

function ReportCardSkeleton(): React.ReactElement {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-[160px] rounded-xl" />
      ))}
    </div>
  );
}

export default function ReportsPage(): React.ReactElement {
  const { accessToken } = useAuth();

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => dashboardService.getStats(accessToken!),
    enabled: !!accessToken,
    staleTime: 2 * 60 * 1000,
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="التقارير"
        description="عرض وتحليل بيانات الصالون"
      />

      {isLoading ? (
        <ReportCardSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {reportCards.map((card) => {
            const Icon = card.icon;
            const statValue = stats?.[card.statKey] ?? 0;

            return (
              <Link key={card.href} href={card.href}>
                <Card className="group cursor-pointer transition-all hover:shadow-md hover:border-[var(--brand-primary)]">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="rounded-xl bg-[var(--primary-50)] p-3">
                        <Icon className="h-6 w-6 text-[var(--brand-primary)]" />
                      </div>
                      <ArrowLeft className="h-5 w-5 text-[var(--muted-foreground)] transition-transform group-hover:-translate-x-1" />
                    </div>
                    <div className="mt-4 space-y-1">
                      <h3 className="text-lg font-semibold text-[var(--foreground)]">
                        {card.title}
                      </h3>
                      <p className="text-sm text-[var(--muted-foreground)]">
                        {card.description}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                      <span className="text-xl font-bold text-[var(--foreground)]">
                        {card.format(statValue)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
