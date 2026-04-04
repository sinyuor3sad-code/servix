'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageHeader, Button, Input, Select } from '@/components/ui';
import { dashboardService } from '@/services/dashboard.service';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const appointmentSchema = z.object({
  clientId: z.string().min(1, 'يرجى اختيار العميل'),
  serviceIds: z.array(z.string()).min(1, 'يرجى اختيار خدمة واحدة على الأقل'),
  employeeId: z.string().min(1, 'يرجى اختيار الموظفة'),
  date: z.string().min(1, 'يرجى اختيار التاريخ'),
  startTime: z.string().min(1, 'يرجى اختيار الوقت'),
  notes: z.string().optional(),
});

type AppointmentFormData = z.infer<typeof appointmentSchema>;

export default function NewAppointmentPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      clientId: '',
      serviceIds: [],
      employeeId: '',
      date: '',
      startTime: '',
      notes: '',
    },
  });

  const selectedServices = watch('serviceIds');

  const { data: clientsData } = useQuery({
    queryKey: ['clients', 'all'],
    queryFn: () =>
      dashboardService.getClients({ limit: 100 }, accessToken!),
    enabled: !!accessToken,
  });

  const { data: employeesData } = useQuery({
    queryKey: ['employees', 'all'],
    queryFn: () =>
      dashboardService.getEmployees({ limit: 100 }, accessToken!),
    enabled: !!accessToken,
  });

  const { data: servicesData } = useQuery({
    queryKey: ['services', 'all'],
    queryFn: () =>
      dashboardService.getServices({ limit: 100 }, accessToken!),
    enabled: !!accessToken,
  });

  const mutation = useMutation({
    mutationFn: (data: AppointmentFormData) =>
      dashboardService.createAppointment(
        {
          clientId: data.clientId,
          employeeId: data.employeeId,
          date: data.date,
          startTime: data.startTime,
          notes: data.notes,
        },
        accessToken!,
      ),
    onSuccess: () => {
      toast.success('تم حجز الموعد بنجاح');
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      router.push('/appointments');
    },
    onError: () => {
      toast.error('حدث خطأ أثناء حجز الموعد');
    },
  });

  function toggleService(serviceId: string) {
    const current = selectedServices ?? [];
    const updated = current.includes(serviceId)
      ? current.filter((id) => id !== serviceId)
      : [...current, serviceId];
    setValue('serviceIds', updated, { shouldValidate: true });
  }

  function onSubmit(data: AppointmentFormData) {
    mutation.mutate(data);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader title="حجز جديد" description="إنشاء موعد جديد للعميل" />

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mx-auto max-w-2xl space-y-6"
      >
        <Select
          label="العميل"
          placeholder="اختر العميل"
          options={
            clientsData?.items?.map((c) => ({
              value: c.id,
              label: c.fullName,
            })) ?? []
          }
          error={errors.clientId?.message}
          {...register('clientId')}
        />

        <div className="space-y-2">
          <label className="block text-sm font-medium text-[var(--foreground)]">
            الخدمات
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {(servicesData?.items ?? []).map((service) => (
              <label
                key={service.id}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors',
                  selectedServices?.includes(service.id)
                    ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5'
                    : 'border-[var(--border)] hover:border-[var(--brand-primary)]/50',
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedServices?.includes(service.id) ?? false}
                  onChange={() => toggleService(service.id)}
                  className="h-4 w-4 rounded border-[var(--border)] text-[var(--brand-primary)] accent-[var(--brand-primary)]"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    {service.nameAr}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {service.price} ر.س · {service.duration} دقيقة
                  </p>
                </div>
              </label>
            ))}
          </div>
          {errors.serviceIds?.message && (
            <p className="text-xs text-red-500" role="alert">
              {errors.serviceIds.message}
            </p>
          )}
        </div>

        <Select
          label="الموظفة"
          placeholder="اختر الموظفة"
          options={
            employeesData?.items?.map((e) => ({
              value: e.id,
              label: e.fullName,
            })) ?? []
          }
          error={errors.employeeId?.message}
          {...register('employeeId')}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="date"
            label="التاريخ"
            error={errors.date?.message}
            {...register('date')}
          />
          <Input
            type="time"
            label="الوقت"
            error={errors.startTime?.message}
            {...register('startTime')}
          />
        </div>

        <Input
          label="ملاحظات"
          placeholder="ملاحظات إضافية (اختياري)"
          error={errors.notes?.message}
          {...register('notes')}
        />

        <div className="flex items-center gap-3 pt-4">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'جارٍ الحجز...' : 'حجز الموعد'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/appointments')}
          >
            إلغاء
          </Button>
        </div>
      </form>
    </div>
  );
}
