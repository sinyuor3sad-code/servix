'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { PageHeader, Card, CardContent, CardHeader, CardTitle, CardDescription, Button, Badge, Avatar, Spinner } from '@/components/ui';
import { toast } from 'sonner';
import { LogIn, LogOut, Coffee } from 'lucide-react';

interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  isOnBreak: boolean;
  computedStatus?: 'present' | 'absent' | 'on_break' | 'off_duty';
  employee: { id: string; fullName: string; role: string; avatarUrl?: string | null };
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' | 'secondary' }> = {
  present: { label: 'حاضرة', variant: 'success' },
  absent: { label: 'غائبة', variant: 'destructive' },
  on_break: { label: 'في استراحة', variant: 'warning' },
  off_duty: { label: 'منتهية الدوام', variant: 'secondary' },
};

function formatTime(time: string): string {
  const [h, m] = time.split(':');
  const hour = parseInt(h ?? '0', 10);
  const period = hour >= 12 ? 'م' : 'ص';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m ?? '00'} ${period}`;
}

export default function AttendancePage(): React.ReactElement {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  const { data: records, isLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ['attendance', 'today'],
    queryFn: () => api.get<AttendanceRecord[]>('/attendance/today', accessToken!),
    enabled: !!accessToken,
  });

  const checkInMutation = useMutation({
    mutationFn: (employeeId: string) =>
      api.post<AttendanceRecord>('/attendance/check-in', { employeeId }, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast.success('تم تسجيل الحضور');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const checkOutMutation = useMutation({
    mutationFn: (employeeId: string) =>
      api.put<AttendanceRecord>('/attendance/check-out', { employeeId }, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast.success('تم تسجيل الانصراف');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleBreakMutation = useMutation({
    mutationFn: (employeeId: string) =>
      api.put<AttendanceRecord>('/attendance/toggle-break', { employeeId }, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast.success('تم تحديث حالة الاستراحة');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading || !records) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="الحضور"
        description="تسجيل حضور وانصراف الموظفات"
      />

      <Card>
        <CardHeader>
          <CardTitle>حضور اليوم</CardTitle>
          <p className="text-sm text-[var(--muted-foreground)]">
            {records.length} موظفة مسجّلة
          </p>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="py-12 text-center text-[var(--muted-foreground)]">
              لا يوجد حضور مسجّل اليوم
            </p>
          ) : (
            <div className="space-y-3">
              {records.map((r) => {
                const status = statusConfig[r.computedStatus ?? 'absent'] ?? statusConfig.absent;
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] p-4"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar
                        src={r.employee.avatarUrl ?? undefined}
                        alt={r.employee.fullName}
                        fallback={r.employee.fullName}
                        size="lg"
                      />
                      <div>
                        <p className="font-medium text-[var(--foreground)]">
                          {r.employee.fullName}
                        </p>
                        <p className="text-sm text-[var(--muted-foreground)]">
                          {r.checkIn && `دخول: ${formatTime(r.checkIn)}`}
                          {r.checkOut && ` — خروج: ${formatTime(r.checkOut)}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={status.variant}>{status.label}</Badge>
                      {r.checkIn && !r.checkOut && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleBreakMutation.mutate(r.employeeId)}
                            disabled={toggleBreakMutation.isPending}
                          >
                            <Coffee className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => checkOutMutation.mutate(r.employeeId)}
                            disabled={checkOutMutation.isPending}
                          >
                            <LogOut className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {records.some((r) => r.computedStatus === 'absent') && (
        <Card>
          <CardHeader>
            <CardTitle>تسجيل حضور سريع</CardTitle>
            <CardDescription>
              الموظفات اللاتي لديهن دوام اليوم ولم يسجّلن الحضور بعد
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {records
                .filter((r) => r.computedStatus === 'absent')
                .map((r) => (
                  <Button
                    key={r.employeeId}
                    variant="outline"
                    size="sm"
                    onClick={() => checkInMutation.mutate(r.employeeId)}
                    disabled={checkInMutation.isPending}
                  >
                    <LogIn className="ml-2 h-4 w-4" />
                    {r.employee.fullName}
                  </Button>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
