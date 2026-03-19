'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import {
  PageHeader,
  StatCard,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Input,
  Skeleton,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

interface AppointmentsReportData {
  total: number;
  completed: number;
  cancelled: number;
  noShow: number;
  completedRate: number;
  cancelledRate: number;
  noShowRate: number;
  statusDistribution: { name: string; value: number; color: string }[];
  dailyTrend: { date: string; count: number }[];
}

function getDefaultDates(): { from: string; to: string } {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    from: firstDay.toISOString().split('T')[0],
    to: now.toISOString().split('T')[0],
  };
}

const PIE_COLORS = ['#10b981', '#ef4444', '#f59e0b', '#6366f1', '#8b5cf6'];

const placeholderData: AppointmentsReportData = {
  total: 156,
  completed: 120,
  cancelled: 22,
  noShow: 14,
  completedRate: 76.9,
  cancelledRate: 14.1,
  noShowRate: 9.0,
  statusDistribution: [
    { name: 'مكتمل', value: 120, color: '#10b981' },
    { name: 'ملغي', value: 22, color: '#ef4444' },
    { name: 'لم يحضر', value: 14, color: '#f59e0b' },
  ],
  dailyTrend: [
    { date: '03/01', count: 8 },
    { date: '03/02', count: 12 },
    { date: '03/03', count: 6 },
    { date: '03/04', count: 15 },
    { date: '03/05', count: 10 },
    { date: '03/06', count: 18 },
    { date: '03/07', count: 9 },
  ],
};

export default function AppointmentsReportPage(): React.ReactElement {
  const { accessToken } = useAuth();
  const defaults = useMemo(getDefaultDates, []);
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);

  const { data, isLoading } = useQuery<AppointmentsReportData>({
    queryKey: ['reports', 'appointments', dateFrom, dateTo],
    queryFn: () =>
      api.get<AppointmentsReportData>(
        `/reports/appointments?from=${dateFrom}&to=${dateTo}`,
        accessToken!,
      ),
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000,
  });

  const report = data ?? placeholderData;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader title="تقرير المواعيد" description="تحليل المواعيد والحجوزات" />

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
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px] rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              icon={Calendar}
              label="إجمالي المواعيد"
              value={report.total}
            />
            <StatCard
              icon={CheckCircle2}
              label="المكتملة"
              value={`${report.completedRate}%`}
              trend={{ value: report.completedRate, direction: 'up' }}
            />
            <StatCard
              icon={XCircle}
              label="الملغية"
              value={`${report.cancelledRate}%`}
            />
            <StatCard
              icon={AlertTriangle}
              label="لم يحضر"
              value={`${report.noShowRate}%`}
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>توزيع الحالات</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={report.statusDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={4}
                        dataKey="value"
                        nameKey="name"
                      >
                        {report.statusDistribution.map((entry, index) => (
                          <Cell key={entry.name} fill={entry.color || PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: 'var(--background)',
                          border: '1px solid var(--border)',
                          borderRadius: '0.5rem',
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>الاتجاه اليومي</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={report.dailyTrend} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
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
                      />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: 'var(--background)',
                          border: '1px solid var(--border)',
                          borderRadius: '0.5rem',
                        }}
                        formatter={(val: number) => [val, 'المواعيد']}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="var(--brand-primary)"
                        strokeWidth={2}
                        dot={{ r: 4, fill: 'var(--brand-primary)' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
