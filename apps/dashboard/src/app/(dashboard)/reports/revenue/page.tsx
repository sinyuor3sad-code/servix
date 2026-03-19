'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  DollarSign,
  FileText,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  PageHeader,
  StatCard,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Input,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Skeleton,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

interface RevenueReportData {
  totalRevenue: number;
  totalInvoices: number;
  averageTicket: number;
  dailyRevenue: { date: string; revenue: number }[];
  serviceBreakdown: {
    serviceName: string;
    count: number;
    revenue: number;
  }[];
}

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

const placeholderData: RevenueReportData = {
  totalRevenue: 24500,
  totalInvoices: 87,
  averageTicket: 281.6,
  dailyRevenue: [
    { date: '03/01', revenue: 3200 },
    { date: '03/02', revenue: 2800 },
    { date: '03/03', revenue: 1500 },
    { date: '03/04', revenue: 4100 },
    { date: '03/05', revenue: 3600 },
    { date: '03/06', revenue: 5200 },
    { date: '03/07', revenue: 4100 },
  ],
  serviceBreakdown: [
    { serviceName: 'قص شعر', count: 32, revenue: 6400 },
    { serviceName: 'صبغة شعر', count: 18, revenue: 7200 },
    { serviceName: 'مانيكير', count: 25, revenue: 3750 },
    { serviceName: 'باديكير', count: 20, revenue: 4000 },
    { serviceName: 'تنظيف بشرة', count: 12, revenue: 3150 },
  ],
};

export default function RevenueReportPage(): React.ReactElement {
  const { accessToken } = useAuth();
  const defaults = useMemo(getDefaultDates, []);
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);

  const { data, isLoading } = useQuery<RevenueReportData>({
    queryKey: ['reports', 'revenue', dateFrom, dateTo],
    queryFn: () =>
      api.get<RevenueReportData>(
        `/reports/revenue?from=${dateFrom}&to=${dateTo}`,
        accessToken!,
      ),
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000,
  });

  const report = data ?? placeholderData;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader title="تقرير الإيرادات" description="تحليل الإيرادات والمبيعات" />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Input
          type="date"
          label="من تاريخ"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
        <Input
          type="date"
          label="إلى تاريخ"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px] rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              icon={DollarSign}
              label="إجمالي الإيرادات"
              value={formatCurrency(report.totalRevenue)}
            />
            <StatCard
              icon={FileText}
              label="عدد الفواتير"
              value={report.totalInvoices}
            />
            <StatCard
              icon={TrendingUp}
              label="متوسط الفاتورة"
              value={formatCurrency(report.averageTicket)}
            />
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>الإيرادات اليومية</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.dailyRevenue} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="date"
                      stroke="var(--muted-foreground)"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val: number) => `${val}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--background)',
                        border: '1px solid var(--border)',
                        borderRadius: '0.5rem',
                      }}
                      formatter={(val: number) => [formatCurrency(val), 'الإيرادات']}
                    />
                    <Bar
                      dataKey="revenue"
                      fill="var(--brand-primary)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>التفاصيل حسب الخدمة</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الخدمة</TableHead>
                      <TableHead>عدد المرات</TableHead>
                      <TableHead>الإيرادات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.serviceBreakdown.map((row) => (
                      <TableRow key={row.serviceName}>
                        <TableCell className="font-medium">{row.serviceName}</TableCell>
                        <TableCell>{row.count}</TableCell>
                        <TableCell>{formatCurrency(row.revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
