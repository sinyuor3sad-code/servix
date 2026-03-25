'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import {
  Phone, Mail, CalendarDays, CreditCard, Star, Users,
  Brain, ShieldAlert, TrendingUp, Target, RefreshCw, Crown,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  StatCard,
  Spinner,
} from '@/components/ui';
import { dashboardService } from '@/services/dashboard.service';
import { useAuth } from '@/hooks/useAuth';
import type { AppointmentStatus, ChurnRisk } from '@/types';

const churnConfig: Record<ChurnRisk, { label: string; color: string; bg: string }> = {
  low: { label: 'منخفض', color: 'text-emerald-600', bg: 'bg-emerald-100' },
  medium: { label: 'متوسط', color: 'text-amber-600', bg: 'bg-amber-100' },
  high: { label: 'مرتفع', color: 'text-orange-600', bg: 'bg-orange-100' },
  critical: { label: 'حرج', color: 'text-red-600', bg: 'bg-red-100' },
};

function formatCurrency(value: number): string {
  return `${value.toLocaleString('ar-SA')} ر.س`;
}

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: 'بانتظار التأكيد',
  confirmed: 'مؤكد',
  in_progress: 'جارٍ',
  completed: 'مكتمل',
  cancelled: 'ملغي',
  no_show: 'لم يحضر',
};

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: () => dashboardService.getClient(id, accessToken!),
    enabled: !!accessToken && !!id,
  });

  const { data: appointmentsData } = useQuery({
    queryKey: ['client-appointments', id],
    queryFn: () =>
      dashboardService.getAppointments({ limit: 10, search: '' }, accessToken!),
    enabled: !!accessToken && !!id,
  });

  const { data: dna } = useQuery({
    queryKey: ['client-dna', id],
    queryFn: () => dashboardService.getClientDna(id, accessToken!),
    enabled: !!accessToken && !!id,
  });

  const computeDnaMutation = useMutation({
    mutationFn: () => dashboardService.computeClientDna(id, accessToken!),
    onSuccess: () => {
      toast.success('تم تحديث ملف العميل');
      queryClient.invalidateQueries({ queryKey: ['client-dna', id] });
    },
    onError: () => toast.error('فشل تحديث الملف'),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 text-center">
        <p className="text-[var(--muted-foreground)]">لم يتم العثور على العميل</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/clients')}>
          العودة للعملاء
        </Button>
      </div>
    );
  }

  const loyaltyPoints = Math.floor(client.totalSpent / 10);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={client.fullName}
        description={client.gender === 'female' ? 'عميلة' : 'عميل'}
        actions={
          <Button variant="outline" onClick={() => router.push('/clients')}>
            العودة للعملاء
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          icon={Users}
          label="عدد الزيارات"
          value={client.totalVisits}
        />
        <StatCard
          icon={CreditCard}
          label="إجمالي الإنفاق"
          value={`${client.totalSpent.toLocaleString('ar-SA')} ر.س`}
        />
        <StatCard
          icon={Star}
          label="نقاط الولاء"
          value={loyaltyPoints.toLocaleString('ar-SA')}
        />
        <StatCard
          icon={CalendarDays}
          label="آخر زيارة"
          value={
            client.lastVisitAt
              ? new Intl.DateTimeFormat('ar-SA', { dateStyle: 'medium' }).format(
                  new Date(client.lastVisitAt),
                )
              : '—'
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>معلومات العميل</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-[var(--muted-foreground)]" />
              <div>
                <p className="text-xs text-[var(--muted-foreground)]">الجوال</p>
                <p className="text-sm font-medium text-[var(--foreground)]">{client.phone}</p>
              </div>
            </div>
            {client.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-[var(--muted-foreground)]" />
                <div>
                  <p className="text-xs text-[var(--muted-foreground)]">البريد الإلكتروني</p>
                  <p className="text-sm font-medium text-[var(--foreground)]">{client.email}</p>
                </div>
              </div>
            )}
            <div>
              <p className="text-xs text-[var(--muted-foreground)]">الجنس</p>
              <p className="text-sm font-medium text-[var(--foreground)]">
                {client.gender === 'female' ? 'أنثى' : 'ذكر'}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted-foreground)]">تاريخ التسجيل</p>
              <p className="text-sm font-medium text-[var(--foreground)]">
                {new Intl.DateTimeFormat('ar-SA', { dateStyle: 'long' }).format(
                  new Date(client.createdAt),
                )}
              </p>
            </div>
            {client.notes && (
              <div className="rounded-lg bg-[var(--muted)] p-3">
                <p className="text-xs text-[var(--muted-foreground)]">ملاحظات</p>
                <p className="mt-1 text-sm text-[var(--foreground)]">{client.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          {/* Client DNA Section */}
          {dna && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-violet-200 bg-gradient-to-r from-violet-50/50 to-fuchsia-50/50">
                <CardHeader className="flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-[var(--brand-primary)]" />
                    <CardTitle>الملف الذكي (DNA)</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => computeDnaMutation.mutate()}
                    disabled={computeDnaMutation.isPending}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 me-1 ${computeDnaMutation.isPending ? 'animate-spin' : ''}`} />
                    تحديث
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-4">
                    {/* Churn Risk */}
                    <div className="rounded-xl bg-white p-3 text-center">
                      <div className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full ${churnConfig[dna.churnRisk].bg}`}>
                        <ShieldAlert className={`h-5 w-5 ${churnConfig[dna.churnRisk].color}`} />
                      </div>
                      <p className={`text-sm font-bold ${churnConfig[dna.churnRisk].color}`}>
                        {churnConfig[dna.churnRisk].label}
                      </p>
                      <p className="text-[10px] text-[var(--muted-foreground)]">خطر الفقدان</p>
                    </div>

                    {/* VIP Score */}
                    <div className="rounded-xl bg-white p-3 text-center">
                      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                        <Crown className={`h-5 w-5 ${dna.isVip ? 'text-amber-600' : 'text-gray-400'}`} />
                      </div>
                      <p className="text-sm font-bold text-[var(--foreground)]">{dna.vipScore.toFixed(0)}</p>
                      <p className="text-[10px] text-[var(--muted-foreground)]">
                        {dna.isVip ? 'عميل VIP ⭐' : 'درجة VIP'}
                      </p>
                    </div>

                    {/* Predicted CLV */}
                    <div className="rounded-xl bg-white p-3 text-center">
                      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                        <TrendingUp className="h-5 w-5 text-emerald-600" />
                      </div>
                      <p className="text-sm font-bold text-emerald-600">{formatCurrency(dna.predictedClv)}</p>
                      <p className="text-[10px] text-[var(--muted-foreground)]">CLV المتوقع</p>
                    </div>

                    {/* Avg Ticket */}
                    <div className="rounded-xl bg-white p-3 text-center">
                      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                        <Target className="h-5 w-5 text-blue-600" />
                      </div>
                      <p className="text-sm font-bold text-blue-600">{formatCurrency(dna.avgTicketValue)}</p>
                      <p className="text-[10px] text-[var(--muted-foreground)]">متوسط الفاتورة</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-white p-2.5">
                      <span className="text-[var(--muted-foreground)]">متوسط أيام بين الزيارات: </span>
                      <span className="font-semibold">{dna.avgDaysBetweenVisits.toFixed(0)} يوم</span>
                    </div>
                    <div className="rounded-lg bg-white p-2.5">
                      <span className="text-[var(--muted-foreground)]">آخر زيارة منذ: </span>
                      <span className="font-semibold">{dna.daysSinceLastVisit} يوم</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>سجل الزيارات</CardTitle>
            </CardHeader>
            <CardContent>
              {appointmentsData && appointmentsData.items.length > 0 ? (
                <div className="divide-y divide-[var(--border)]">
                  {appointmentsData.items.map((appt) => (
                    <div
                      key={appt.id}
                      className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                    >
                      <div>
                        <p className="text-sm font-medium text-[var(--foreground)]">
                          {new Intl.DateTimeFormat('ar-SA', { dateStyle: 'medium' }).format(
                            new Date(appt.date),
                          )}
                        </p>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {appt.startTime} · {appt.appointmentServices?.map((s) => s.service?.nameAr).filter(Boolean).join('، ') || '—'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-[var(--foreground)]">
                          {appt.totalPrice} ر.س
                        </span>
                        <Badge variant="outline">
                          {STATUS_LABELS[appt.status]}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--muted-foreground)] text-center py-8">
                  لا توجد زيارات سابقة
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
