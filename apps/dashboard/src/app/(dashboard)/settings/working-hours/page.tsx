'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  PageHeader,
  Card,
  CardContent,
  Button,
  Input,
  Skeleton,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

interface DaySchedule {
  dayOfWeek: number;
  nameAr: string;
  isOpen: boolean;
  startTime: string;
  endTime: string;
}

const dayNames: Record<number, string> = {
  0: 'السبت',
  1: 'الأحد',
  2: 'الإثنين',
  3: 'الثلاثاء',
  4: 'الأربعاء',
  5: 'الخميس',
  6: 'الجمعة',
};

const defaultSchedule: DaySchedule[] = Array.from({ length: 7 }, (_, i) => ({
  dayOfWeek: i,
  nameAr: dayNames[i],
  isOpen: i !== 6,
  startTime: '09:00',
  endTime: '21:00',
}));

export default function WorkingHoursPage(): React.ReactElement {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [schedule, setSchedule] = useState<DaySchedule[]>(defaultSchedule);

  const { data, isLoading } = useQuery<DaySchedule[]>({
    queryKey: ['settings', 'working-hours'],
    queryFn: () => api.get<DaySchedule[]>('/settings/working-hours', accessToken!),
    enabled: !!accessToken,
  });

  useEffect(() => {
    if (data) {
      setSchedule(
        data.map((d) => ({ ...d, nameAr: dayNames[d.dayOfWeek] ?? '' })),
      );
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      api.put('/settings/working-hours', { schedule }, accessToken!),
    onSuccess: () => {
      toast.success('تم حفظ ساعات العمل');
      queryClient.invalidateQueries({ queryKey: ['settings', 'working-hours'] });
    },
    onError: () => {
      toast.error('حدث خطأ أثناء حفظ ساعات العمل');
    },
  });

  function toggleDay(index: number): void {
    setSchedule((prev) =>
      prev.map((day, i) =>
        i === index ? { ...day, isOpen: !day.isOpen } : day,
      ),
    );
  }

  function updateTime(index: number, field: 'startTime' | 'endTime', value: string): void {
    setSchedule((prev) =>
      prev.map((day, i) =>
        i === index ? { ...day, [field]: value } : day,
      ),
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 sm:p-6 lg:p-8">
        <Skeleton className="h-10 w-64" />
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader title="ساعات العمل" description="تحديد أوقات العمل لكل يوم" />

      <div className="mx-auto max-w-2xl space-y-3">
        {schedule.map((day, index) => (
          <Card key={day.dayOfWeek}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleDay(index)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    day.isOpen ? 'bg-[var(--brand-primary)]' : 'bg-[var(--muted)]'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                      day.isOpen ? 'start-5' : 'start-0.5'
                    }`}
                  />
                </button>
                <span className={`min-w-20 text-sm font-semibold ${
                  day.isOpen ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'
                }`}>
                  {day.nameAr}
                </span>
              </div>

              {day.isOpen ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={day.startTime}
                    onChange={(e) => updateTime(index, 'startTime', e.target.value)}
                    className="w-32"
                  />
                  <span className="text-sm text-[var(--muted-foreground)]">—</span>
                  <Input
                    type="time"
                    value={day.endTime}
                    onChange={(e) => updateTime(index, 'endTime', e.target.value)}
                    className="w-32"
                  />
                </div>
              ) : (
                <span className="text-sm text-[var(--muted-foreground)]">مغلق</span>
              )}
            </CardContent>
          </Card>
        ))}

        <div className="pt-4">
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'جارٍ الحفظ...' : 'حفظ ساعات العمل'}
          </Button>
        </div>
      </div>
    </div>
  );
}
