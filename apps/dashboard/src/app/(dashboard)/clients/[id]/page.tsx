'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Phone, Mail, CalendarDays, CreditCard, Star, Users } from 'lucide-react';
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
import type { AppointmentStatus } from '@/types';

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

        <Card className="lg:col-span-2">
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
  );
}
