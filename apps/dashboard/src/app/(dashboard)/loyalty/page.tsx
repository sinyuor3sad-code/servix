'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Gift, Star, ArrowDownUp } from 'lucide-react';
import {
  PageHeader,
  StatCard,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Input,
  Button,
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

const placeholderData: LoyaltyData = {
  settings: {
    pointsPerSar: 1,
    redemptionValue: 0.5,
    minimumRedemption: 100,
  },
  leaderboard: [
    { id: '1', fullName: 'نورة الأحمد', phone: '0501234567', points: 850, totalEarned: 1200, totalRedeemed: 350 },
    { id: '2', fullName: 'سارة المحمد', phone: '0559876543', points: 620, totalEarned: 900, totalRedeemed: 280 },
    { id: '3', fullName: 'ريم العتيبي', phone: '0541112233', points: 480, totalEarned: 700, totalRedeemed: 220 },
    { id: '4', fullName: 'هند القحطاني', phone: '0533445566', points: 350, totalEarned: 500, totalRedeemed: 150 },
    { id: '5', fullName: 'لمياء الدوسري', phone: '0527788990', points: 290, totalEarned: 400, totalRedeemed: 110 },
  ],
};

export default function LoyaltyPage(): React.ReactElement {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [adjustClientId, setAdjustClientId] = useState('');
  const [adjustPoints, setAdjustPoints] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  const { data, isLoading } = useQuery<LoyaltyData>({
    queryKey: ['loyalty'],
    queryFn: () => api.get<LoyaltyData>('/loyalty', accessToken!),
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000,
  });

  const adjustMutation = useMutation({
    mutationFn: () =>
      api.post(
        '/loyalty/adjust',
        {
          clientId: adjustClientId,
          points: parseInt(adjustPoints, 10),
          reason: adjustReason,
        },
        accessToken!,
      ),
    onSuccess: () => {
      toast.success('تم تعديل النقاط بنجاح');
      queryClient.invalidateQueries({ queryKey: ['loyalty'] });
      setAdjustClientId('');
      setAdjustPoints('');
      setAdjustReason('');
    },
    onError: () => {
      toast.error('حدث خطأ أثناء تعديل النقاط');
    },
  });

  const loyalty = data ?? placeholderData;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader title="نظام الولاء" description="إدارة نقاط الولاء والمكافآت" />

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
              icon={Gift}
              label="نقاط لكل ريال"
              value={loyalty.settings.pointsPerSar}
            />
            <StatCard
              icon={Star}
              label="قيمة الاسترداد"
              value={`${loyalty.settings.redemptionValue} ر.س`}
            />
            <StatCard
              icon={ArrowDownUp}
              label="الحد الأدنى للاسترداد"
              value={`${loyalty.settings.minimumRedemption} نقطة`}
            />
          </div>

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
                      <TableHead>العميل</TableHead>
                      <TableHead>الجوال</TableHead>
                      <TableHead>النقاط الحالية</TableHead>
                      <TableHead>إجمالي المكتسبة</TableHead>
                      <TableHead>إجمالي المستبدلة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loyalty.leaderboard.map((client, index) => (
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

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>تعديل النقاط</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid max-w-2xl gap-4 sm:grid-cols-3">
                <Input
                  label="معرّف العميل"
                  placeholder="أدخل معرّف العميل"
                  value={adjustClientId}
                  onChange={(e) => setAdjustClientId(e.target.value)}
                />
                <Input
                  type="number"
                  label="النقاط (+ أو -)"
                  placeholder="50"
                  value={adjustPoints}
                  onChange={(e) => setAdjustPoints(e.target.value)}
                />
                <Input
                  label="السبب"
                  placeholder="سبب التعديل"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                />
              </div>
              <Button
                className="mt-4"
                onClick={() => adjustMutation.mutate()}
                disabled={adjustMutation.isPending || !adjustClientId || !adjustPoints}
              >
                {adjustMutation.isPending ? 'جارٍ التعديل...' : 'تعديل النقاط'}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
