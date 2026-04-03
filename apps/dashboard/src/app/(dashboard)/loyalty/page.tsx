'use client';

import { useQuery } from '@tanstack/react-query';
import { Gift, Star, ArrowDownUp, Heart } from 'lucide-react';
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
  EmptyState,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

interface LoyaltySettings {
  pointsPerSar: number;
  redemptionValue: number;
  minimumRedemption: number;
}

interface LoyaltyClient {
  id: string;
  fullName: string;
  phone: string;
  points: number;
  totalEarned: number;
  totalRedeemed: number;
}

interface LoyaltyData {
  settings: LoyaltySettings;
  leaderboard: LoyaltyClient[];
}

export default function LoyaltyPage(): React.ReactElement {
  const { accessToken } = useAuth();

  const { data, isLoading } = useQuery<LoyaltyData>({
    queryKey: ['loyalty'],
    queryFn: () => api.get<LoyaltyData>('/loyalty', accessToken!),
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="نظام الولاء"
        description="النقاط تتراكم تلقائياً مع كل عملية شراء من الكاشير"
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px] rounded-xl" />
          ))}
        </div>
      ) : !data ? (
        <EmptyState
          icon={Heart}
          title="لا توجد بيانات ولاء"
          description="ستظهر نقاط الولاء تلقائياً بعد أول عملية شراء من الكاشير"
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              icon={Gift}
              label="نقاط لكل ريال"
              value={data.settings.pointsPerSar}
            />
            <StatCard
              icon={Star}
              label="قيمة الاسترداد"
              value={`${data.settings.redemptionValue} ر.س`}
            />
            <StatCard
              icon={ArrowDownUp}
              label="الحد الأدنى للاسترداد"
              value={`${data.settings.minimumRedemption} نقطة`}
            />
          </div>

          {data.leaderboard.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>لوحة المتصدرين</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>العميلة</TableHead>
                        <TableHead>الجوال</TableHead>
                        <TableHead>النقاط الحالية</TableHead>
                        <TableHead>إجمالي المكتسبة</TableHead>
                        <TableHead>إجمالي المستبدلة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.leaderboard.map((client, index) => (
                        <TableRow key={client.id}>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell className="font-medium">{client.fullName}</TableCell>
                          <TableCell dir="ltr" className="text-end">{client.phone}</TableCell>
                          <TableCell>
                            <span className="font-bold text-[var(--brand-primary)]">
                              {client.points.toLocaleString('ar-SA')}
                            </span>
                          </TableCell>
                          <TableCell>{client.totalEarned.toLocaleString('ar-SA')}</TableCell>
                          <TableCell>{client.totalRedeemed.toLocaleString('ar-SA')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Info Card */}
          <Card className="mt-6 border-emerald-200 bg-emerald-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Gift className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-emerald-800">النقاط تلقائية 100%</p>
                  <p className="text-sm text-emerald-600">
                    يتم إضافة النقاط تلقائياً عند كل عملية شراء من الكاشير. لا تحتاجين لأي إجراء يدوي — العميلات يجمعن النقاط ويستبدلنها بخصومات.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
