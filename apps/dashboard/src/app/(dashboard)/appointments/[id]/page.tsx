'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Calendar,
  Clock,
  User,
  Scissors,
  CheckCircle2,
  XCircle,
  PlayCircle,
  AlertCircle,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Spinner,
} from '@/components/ui';
import { dashboardService } from '@/services/dashboard.service';
import { useAuth } from '@/hooks/useAuth';
import type { AppointmentStatus } from '@/types';

const STATUS_CONFIG: Record<
  AppointmentStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' }
> = {
  pending: { label: 'بانتظار التأكيد', variant: 'warning' },
  confirmed: { label: 'مؤكد', variant: 'default' },
  in_progress: { label: 'جارٍ', variant: 'secondary' },
  completed: { label: 'مكتمل', variant: 'success' },
  cancelled: { label: 'ملغي', variant: 'destructive' },
  no_show: { label: 'لم يحضر', variant: 'destructive' },
};

const TIMELINE_ICONS: Record<AppointmentStatus, typeof CheckCircle2> = {
  pending: AlertCircle,
  confirmed: CheckCircle2,
  in_progress: PlayCircle,
  completed: CheckCircle2,
  cancelled: XCircle,
  no_show: XCircle,
};

export default function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  const { data: appointment, isLoading } = useQuery({
    queryKey: ['appointment', id],
    queryFn: () => dashboardService.getAppointment(id, accessToken!),
    enabled: !!accessToken && !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (status: AppointmentStatus) =>
      dashboardService.updateAppointment(id, { status }, accessToken!),
    onSuccess: () => {
      toast.success('تم تحديث حالة الموعد');
      queryClient.invalidateQueries({ queryKey: ['appointment', id] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
    onError: () => {
      toast.error('حدث خطأ أثناء تحديث الحالة');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      dashboardService.cancelAppointment(id, 'إلغاء من لوحة التحكم', accessToken!),
    onSuccess: () => {
      toast.success('تم إلغاء الموعد');
      queryClient.invalidateQueries({ queryKey: ['appointment', id] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
    onError: () => {
      toast.error('حدث خطأ أثناء إلغاء الموعد');
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 text-center">
        <p className="text-[var(--muted-foreground)]">لم يتم العثور على الموعد</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/appointments')}>
          العودة للمواعيد
        </Button>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[appointment.status];
  const canConfirm = appointment.status === 'pending';
  const canStart = appointment.status === 'confirmed';
  const canComplete = appointment.status === 'in_progress';
  const canCancel = ['pending', 'confirmed'].includes(appointment.status);

  const timelineSteps: { status: AppointmentStatus; label: string; reached: boolean }[] = [
    { status: 'pending', label: 'تم الإنشاء', reached: true },
    {
      status: 'confirmed',
      label: 'تأكيد',
      reached: ['confirmed', 'in_progress', 'completed'].includes(appointment.status),
    },
    {
      status: 'in_progress',
      label: 'بدء الخدمة',
      reached: ['in_progress', 'completed'].includes(appointment.status),
    },
    {
      status: 'completed',
      label: 'اكتمال',
      reached: appointment.status === 'completed',
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={`موعد #${id.slice(0, 8)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {canConfirm && (
              <Button
                onClick={() => updateMutation.mutate('confirmed')}
                disabled={updateMutation.isPending}
              >
                <CheckCircle2 className="h-4 w-4" />
                تأكيد
              </Button>
            )}
            {canStart && (
              <Button
                onClick={() => updateMutation.mutate('in_progress')}
                disabled={updateMutation.isPending}
              >
                <PlayCircle className="h-4 w-4" />
                بدء الخدمة
              </Button>
            )}
            {canComplete && (
              <Button
                onClick={() => updateMutation.mutate('completed')}
                disabled={updateMutation.isPending}
              >
                <CheckCircle2 className="h-4 w-4" />
                إكمال
              </Button>
            )}
            {canCancel && (
              <Button
                variant="destructive"
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
              >
                <XCircle className="h-4 w-4" />
                إلغاء
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>تفاصيل الموعد</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <User className="mt-0.5 h-5 w-5 text-[var(--muted-foreground)]" />
                  <div>
                    <dt className="text-sm text-[var(--muted-foreground)]">العميل</dt>
                    <dd className="font-medium text-[var(--foreground)]">
                      {appointment.client?.fullName ?? '—'}
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Scissors className="mt-0.5 h-5 w-5 text-[var(--muted-foreground)]" />
                  <div>
                    <dt className="text-sm text-[var(--muted-foreground)]">الموظفة</dt>
                    <dd className="font-medium text-[var(--foreground)]">
                      {appointment.employee?.fullName ?? '—'}
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="mt-0.5 h-5 w-5 text-[var(--muted-foreground)]" />
                  <div>
                    <dt className="text-sm text-[var(--muted-foreground)]">التاريخ</dt>
                    <dd className="font-medium text-[var(--foreground)]">
                      {new Intl.DateTimeFormat('ar-SA', { dateStyle: 'full' }).format(
                        new Date(appointment.date),
                      )}
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="mt-0.5 h-5 w-5 text-[var(--muted-foreground)]" />
                  <div>
                    <dt className="text-sm text-[var(--muted-foreground)]">الوقت</dt>
                    <dd className="font-medium text-[var(--foreground)]">
                      {appointment.startTime} — {appointment.endTime}
                    </dd>
                  </div>
                </div>
              </dl>

              <div className="mt-6 flex items-center gap-3">
                <span className="text-sm text-[var(--muted-foreground)]">الحالة:</span>
                <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
              </div>

              {appointment.notes && (
                <div className="mt-4 rounded-lg bg-[var(--muted)] p-4">
                  <p className="text-sm text-[var(--muted-foreground)]">ملاحظات</p>
                  <p className="mt-1 text-sm text-[var(--foreground)]">{appointment.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>الخدمات</CardTitle>
            </CardHeader>
            <CardContent>
              {appointment.appointmentServices && appointment.appointmentServices.length > 0 ? (
                <div className="divide-y divide-[var(--border)]">
                  {appointment.appointmentServices.map((as) => (
                    <div key={as.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                      <div>
                        <p className="font-medium text-[var(--foreground)]">
                          {as.service?.nameAr ?? '—'}
                        </p>
                        <p className="text-sm text-[var(--muted-foreground)]">
                          {as.duration} دقيقة · {as.employee?.fullName ?? '—'}
                        </p>
                      </div>
                      <p className="font-semibold text-[var(--foreground)]">{as.price} ر.س</p>
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t border-[var(--border)] pt-3 mt-3">
                    <p className="font-bold text-[var(--foreground)]">الإجمالي</p>
                    <p className="font-bold text-[var(--foreground)]">{appointment.totalPrice} ر.س</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--muted-foreground)]">لا توجد خدمات</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>سير الموعد</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative space-y-6 ps-8">
                <div className="absolute start-3 top-1 bottom-1 w-px bg-[var(--border)]" />
                {appointment.status === 'cancelled' ? (
                  <>
                    {timelineSteps.slice(0, 1).map((step) => {
                      const Icon = TIMELINE_ICONS[step.status];
                      return (
                        <div key={step.status} className="relative">
                          <div className="absolute -start-5 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--background)]">
                            <Icon className="h-4 w-4 text-emerald-500" />
                          </div>
                          <p className="text-sm font-medium text-[var(--foreground)]">{step.label}</p>
                          <p className="text-xs text-[var(--muted-foreground)]">
                            {new Intl.DateTimeFormat('ar-SA', { dateStyle: 'short', timeStyle: 'short' }).format(
                              new Date(appointment.createdAt),
                            )}
                          </p>
                        </div>
                      );
                    })}
                    <div className="relative">
                      <div className="absolute -start-5 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--background)]">
                        <XCircle className="h-4 w-4 text-red-500" />
                      </div>
                      <p className="text-sm font-medium text-red-600">تم الإلغاء</p>
                      {appointment.cancelledAt && (
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {new Intl.DateTimeFormat('ar-SA', { dateStyle: 'short', timeStyle: 'short' }).format(
                            new Date(appointment.cancelledAt),
                          )}
                        </p>
                      )}
                      {appointment.cancellationReason && (
                        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                          {appointment.cancellationReason}
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  timelineSteps.map((step) => {
                    const Icon = TIMELINE_ICONS[step.status];
                    return (
                      <div key={step.status} className="relative">
                        <div className="absolute -start-5 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--background)]">
                          <Icon
                            className={`h-4 w-4 ${
                              step.reached ? 'text-emerald-500' : 'text-[var(--muted-foreground)]'
                            }`}
                          />
                        </div>
                        <p
                          className={`text-sm font-medium ${
                            step.reached
                              ? 'text-[var(--foreground)]'
                              : 'text-[var(--muted-foreground)]'
                          }`}
                        >
                          {step.label}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
