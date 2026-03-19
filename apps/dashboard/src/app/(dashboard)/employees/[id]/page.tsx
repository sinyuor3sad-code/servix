'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Phone, Mail, Percent, Banknote } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { dashboardService } from '@/services/dashboard.service';
import { useAuth } from '@/hooks/useAuth';
import type { EmployeeRole } from '@/types';

const ROLE_LABELS: Record<EmployeeRole, string> = {
  stylist: 'مصففة',
  manager: 'مديرة',
  receptionist: 'موظفة استقبال',
  cashier: 'كاشيرة',
};

const DAYS = [
  { key: 'saturday', label: 'السبت' },
  { key: 'sunday', label: 'الأحد' },
  { key: 'monday', label: 'الاثنين' },
  { key: 'tuesday', label: 'الثلاثاء' },
  { key: 'wednesday', label: 'الأربعاء' },
  { key: 'thursday', label: 'الخميس' },
  { key: 'friday', label: 'الجمعة' },
] as const;

interface DaySchedule {
  enabled: boolean;
  start: string;
  end: string;
}

type WeekSchedule = Record<string, DaySchedule>;

const DEFAULT_SCHEDULE: WeekSchedule = Object.fromEntries(
  DAYS.map((d) => [
    d.key,
    {
      enabled: d.key !== 'friday',
      start: '09:00',
      end: '21:00',
    },
  ]),
);

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { accessToken } = useAuth();
  const [schedule, setSchedule] = useState<WeekSchedule>(DEFAULT_SCHEDULE);

  const { data: employee, isLoading } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => dashboardService.getEmployee(id, accessToken!),
    enabled: !!accessToken && !!id,
  });

  const { data: servicesData } = useQuery({
    queryKey: ['services', 'all'],
    queryFn: () => dashboardService.getServices({ limit: 200 }, accessToken!),
    enabled: !!accessToken,
  });

  function toggleDay(dayKey: string) {
    setSchedule((prev) => ({
      ...prev,
      [dayKey]: { ...prev[dayKey], enabled: !prev[dayKey].enabled },
    }));
  }

  function updateTime(dayKey: string, field: 'start' | 'end', value: string) {
    setSchedule((prev) => ({
      ...prev,
      [dayKey]: { ...prev[dayKey], [field]: value },
    }));
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 text-center">
        <p className="text-[var(--muted-foreground)]">لم يتم العثور على الموظفة</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/employees')}>
          العودة للموظفات
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={employee.fullName}
        description={ROLE_LABELS[employee.role]}
        actions={
          <div className="flex gap-2">
            <Badge variant={employee.isActive ? 'success' : 'secondary'}>
              {employee.isActive ? 'نشطة' : 'غير نشطة'}
            </Badge>
            <Button variant="outline" onClick={() => router.push('/employees')}>
              العودة
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>المعلومات الشخصية</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {employee.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-[var(--muted-foreground)]" />
                <div>
                  <p className="text-xs text-[var(--muted-foreground)]">الجوال</p>
                  <p className="text-sm font-medium text-[var(--foreground)]">{employee.phone}</p>
                </div>
              </div>
            )}
            {employee.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-[var(--muted-foreground)]" />
                <div>
                  <p className="text-xs text-[var(--muted-foreground)]">البريد الإلكتروني</p>
                  <p className="text-sm font-medium text-[var(--foreground)]">{employee.email}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              {employee.commissionType === 'percentage' ? (
                <Percent className="h-4 w-4 text-[var(--muted-foreground)]" />
              ) : (
                <Banknote className="h-4 w-4 text-[var(--muted-foreground)]" />
              )}
              <div>
                <p className="text-xs text-[var(--muted-foreground)]">العمولة</p>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {employee.commissionType === 'none'
                    ? 'بدون عمولة'
                    : employee.commissionType === 'percentage'
                      ? `${employee.commissionValue}%`
                      : `${employee.commissionValue} ر.س`}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs text-[var(--muted-foreground)]">تاريخ الانضمام</p>
              <p className="text-sm font-medium text-[var(--foreground)]">
                {new Intl.DateTimeFormat('ar-SA', { dateStyle: 'long' }).format(
                  new Date(employee.createdAt),
                )}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>جدول العمل</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {DAYS.map((day) => {
                const daySchedule = schedule[day.key];
                return (
                  <div
                    key={day.key}
                    className={cn(
                      'flex items-center gap-4 rounded-lg border p-3 transition-colors',
                      daySchedule.enabled
                        ? 'border-[var(--border)] bg-[var(--background)]'
                        : 'border-[var(--border)] bg-[var(--muted)]/50',
                    )}
                  >
                    <label className="flex w-24 shrink-0 cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={daySchedule.enabled}
                        onChange={() => toggleDay(day.key)}
                        className="h-4 w-4 rounded accent-[var(--brand-primary)]"
                      />
                      <span
                        className={cn(
                          'text-sm font-medium',
                          daySchedule.enabled
                            ? 'text-[var(--foreground)]'
                            : 'text-[var(--muted-foreground)]',
                        )}
                      >
                        {day.label}
                      </span>
                    </label>
                    {daySchedule.enabled ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={daySchedule.start}
                          onChange={(e) => updateTime(day.key, 'start', e.target.value)}
                          className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm text-[var(--foreground)]"
                        />
                        <span className="text-sm text-[var(--muted-foreground)]">إلى</span>
                        <input
                          type="time"
                          value={daySchedule.end}
                          onChange={(e) => updateTime(day.key, 'end', e.target.value)}
                          className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm text-[var(--foreground)]"
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-[var(--muted-foreground)]">إجازة</span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>الخدمات المعيّنة</CardTitle>
        </CardHeader>
        <CardContent>
          {servicesData && servicesData.items.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {servicesData.items.map((service) => (
                <div
                  key={service.id}
                  className="flex items-center justify-between rounded-lg border border-[var(--border)] p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {service.nameAr}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {service.duration} دقيقة
                    </p>
                  </div>
                  <span className="text-sm font-medium text-[var(--foreground)]">
                    {service.price} ر.س
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-center text-[var(--muted-foreground)] py-8">
              لا توجد خدمات معيّنة
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
