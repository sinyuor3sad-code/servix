'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Users,
  UserPlus,
  Repeat,
} from 'lucide-react';
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

interface ClientsReportData {
  totalClients: number;
  newThisMonth: number;
  returningRate: number;
  topClients: {
    id: string;
    fullName: string;
    phone: string;
    totalVisits: number;
    totalSpent: number;
  }[];
}

function formatCurrency(value: number): string {
  return `${value.toLocaleString('ar-SA')} ر.س`;
}

const placeholderData: ClientsReportData = {
  totalClients: 342,
  newThisMonth: 28,
  returningRate: 65.4,
  topClients: [
    { id: '1', fullName: 'نورة الأحمد', phone: '0501234567', totalVisits: 24, totalSpent: 8400 },
    { id: '2', fullName: 'سارة المحمد', phone: '0559876543', totalVisits: 18, totalSpent: 6200 },
    { id: '3', fullName: 'ريم العتيبي', phone: '0541112233', totalVisits: 15, totalSpent: 5100 },
    { id: '4', fullName: 'هند القحطاني', phone: '0533445566', totalVisits: 12, totalSpent: 4800 },
    { id: '5', fullName: 'لمياء الدوسري', phone: '0527788990', totalVisits: 11, totalSpent: 3900 },
  ],
};

export default function ClientsReportPage(): React.ReactElement {
  const { accessToken } = useAuth();

  const { data, isLoading } = useQuery<ClientsReportData>({
    queryKey: ['reports', 'clients'],
    queryFn: () => api.get<ClientsReportData>('/reports/clients', accessToken!),
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000,
  });

  const report = data ?? placeholderData;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader title="تقرير العملاء" description="تحليل بيانات العملاء والولاء" />

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
              icon={Users}
              label="إجمالي العملاء"
              value={report.totalClients}
            />
            <StatCard
              icon={UserPlus}
              label="عملاء جدد هذا الشهر"
              value={report.newThisMonth}
              trend={{ value: report.newThisMonth, direction: 'up' }}
            />
            <StatCard
              icon={Repeat}
              label="معدل العودة"
              value={`${report.returningRate}%`}
            />
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>أفضل العملاء حسب الإيرادات</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>الاسم</TableHead>
                      <TableHead>الجوال</TableHead>
                      <TableHead>عدد الزيارات</TableHead>
                      <TableHead>إجمالي الإنفاق</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.topClients.map((client, index) => (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell className="font-medium">{client.fullName}</TableCell>
                        <TableCell dir="ltr" className="text-end">{client.phone}</TableCell>
                        <TableCell>{client.totalVisits}</TableCell>
                        <TableCell>{formatCurrency(client.totalSpent)}</TableCell>
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
