'use client';

import { useQuery } from '@tanstack/react-query';
import {
  UserCog,
  Star,
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

interface EmployeePerformance {
  id: string;
  fullName: string;
  appointments: number;
  revenue: number;
  averageRating: number;
}

interface EmployeesReportData {
  totalEmployees: number;
  averageRating: number;
  employees: EmployeePerformance[];
}

function formatCurrency(value: number): string {
  return `${value.toLocaleString('ar-SA')} ر.س`;
}

const placeholderData: EmployeesReportData = {
  totalEmployees: 8,
  averageRating: 4.6,
  employees: [
    { id: '1', fullName: 'فاطمة العلي', appointments: 45, revenue: 12500, averageRating: 4.9 },
    { id: '2', fullName: 'منى السعيد', appointments: 38, revenue: 10200, averageRating: 4.7 },
    { id: '3', fullName: 'عبير الحربي', appointments: 32, revenue: 8900, averageRating: 4.5 },
    { id: '4', fullName: 'هدى المطيري', appointments: 28, revenue: 7600, averageRating: 4.8 },
    { id: '5', fullName: 'أمل الشمري', appointments: 25, revenue: 6800, averageRating: 4.3 },
  ],
};

export default function EmployeesReportPage(): React.ReactElement {
  const { accessToken } = useAuth();

  const { data, isLoading } = useQuery<EmployeesReportData>({
    queryKey: ['reports', 'employees'],
    queryFn: () =>
      api.get<EmployeesReportData>('/reports/employees', accessToken!),
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000,
  });

  const report = data ?? placeholderData;

  const revenueChartData = report.employees.map((emp) => ({
    name: emp.fullName,
    revenue: emp.revenue,
  }));

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader title="تقرير الموظفات" description="تحليل أداء الموظفات" />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px] rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatCard
              icon={UserCog}
              label="إجمالي الموظفات"
              value={report.totalEmployees}
            />
            <StatCard
              icon={Star}
              label="متوسط التقييم"
              value={`${report.averageRating} / 5`}
            />
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>الإيرادات لكل موظفة</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={revenueChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      type="number"
                      stroke="var(--muted-foreground)"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val: number) => `${val}`}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      stroke="var(--muted-foreground)"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      width={100}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--background)',
                        border: '1px solid var(--border)',
                        borderRadius: '0.5rem',
                      }}
                      formatter={(val: number) => [formatCurrency(val), 'الإيرادات']}
                    />
                    <Bar dataKey="revenue" fill="var(--brand-primary)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>تفاصيل الأداء</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الموظفة</TableHead>
                      <TableHead>المواعيد</TableHead>
                      <TableHead>الإيرادات</TableHead>
                      <TableHead>التقييم</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.employees.map((emp) => (
                      <TableRow key={emp.id}>
                        <TableCell className="font-medium">{emp.fullName}</TableCell>
                        <TableCell>{emp.appointments}</TableCell>
                        <TableCell>{formatCurrency(emp.revenue)}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                            {emp.averageRating}
                          </span>
                        </TableCell>
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
