'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import {
  Clock,
  Play,
  Square,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Timer,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { dashboardService } from '@/services/dashboard.service';
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Skeleton,
  EmptyState,
} from '@/components/ui';
import type { Shift, ShiftStatus } from '@/types';

function toDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const statusConfig: Record<ShiftStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' | 'secondary'; icon: typeof Clock }> = {
  scheduled: { label: 'مجدولة', variant: 'secondary', icon: Clock },
  active: { label: 'نشطة', variant: 'success', icon: Play },
  late: { label: 'متأخرة', variant: 'warning', icon: AlertTriangle },
  completed: { label: 'مكتملة', variant: 'default', icon: CheckCircle2 },
  absent: { label: 'غائب', variant: 'destructive', icon: XCircle },
};

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours, 10);
  const period = h >= 12 ? 'م' : 'ص';
  const displayHour = h % 12 || 12;
  return `${displayHour}:${minutes} ${period}`;
}

const AR_DAYS: Record<number, string> = {
  0: 'الأحد', 1: 'الاثنين', 2: 'الثلاثاء', 3: 'الأربعاء',
  4: 'الخميس', 5: 'الجمعة', 6: 'السبت',
};

export default function ShiftsPage(): React.ReactElement {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(() => toDateString(new Date()));

  const dates = useMemo(() => {
    const result: Date[] = [];
    for (let i = -1; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      result.push(d);
    }
    return result;
  }, []);

  const { data: shifts, isLoading } = useQuery({
    queryKey: ['shifts', selectedDate],
    queryFn: () => dashboardService.getShifts(selectedDate, accessToken!),
    enabled: !!accessToken,
  });

  const generateMutation = useMutation({
    mutationFn: () => dashboardService.generateShifts({ startDate: selectedDate }, accessToken!),
    onSuccess: (data) => {
      toast.success(`تم توليد ${data.created} وردية`);
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
    onError: () => toast.error('فشل توليد الورديات'),
  });

  const checkInMutation = useMutation({
    mutationFn: (shiftId: string) => dashboardService.checkInShift(shiftId, accessToken!),
    onSuccess: () => {
      toast.success('تم تسجيل الحضور');
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
    onError: () => toast.error('فشل تسجيل الحضور'),
  });

  const checkOutMutation = useMutation({
    mutationFn: (shiftId: string) => dashboardService.checkOutShift(shiftId, accessToken!),
    onSuccess: () => {
      toast.success('تم تسجيل الانصراف');
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
    onError: () => toast.error('فشل تسجيل الانصراف'),
  });

  const todayStr = toDateString(new Date());

  // Stats
  const stats = useMemo(() => {
    if (!shifts) return { total: 0, active: 0, late: 0, completed: 0 };
    return {
      total: shifts.length,
      active: shifts.filter(s => s.status === 'active').length,
      late: shifts.filter(s => s.status === 'late').length,
      completed: shifts.filter(s => s.status === 'completed').length,
    };
  }, [shifts]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="الورديات"
        description="إدارة ورديات الموظفات وتتبع الحضور"
        actions={
          <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
            <RefreshCw className={`h-4 w-4 me-2 ${generateMutation.isPending ? 'animate-spin' : ''}`} />
            توليد أسبوعي
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'إجمالي', value: stats.total, color: 'text-[var(--foreground)]' },
          { label: 'نشطة', value: stats.active, color: 'text-emerald-500' },
          { label: 'متأخرة', value: stats.late, color: 'text-amber-500' },
          { label: 'مكتملة', value: stats.completed, color: 'text-blue-500' },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-[var(--muted-foreground)]">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Date Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
        {dates.map((date) => {
          const dateStr = toDateString(date);
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => setSelectedDate(dateStr)}
              className={`flex min-w-[72px] shrink-0 flex-col items-center gap-0.5 rounded-xl px-3 py-3 transition-all ${
                isSelected
                  ? 'bg-[var(--brand-primary)] text-white shadow-lg'
                  : 'border border-[var(--border)] bg-[var(--background)] hover:border-[var(--brand-primary)]'
              }`}
            >
              <span className="text-[10px] font-medium opacity-80">
                {isToday ? 'اليوم' : AR_DAYS[date.getDay()]}
              </span>
              <span className="text-lg font-bold">{date.getDate()}</span>
              <span className="text-[10px] opacity-70">
                {date.toLocaleDateString('ar-SA', { month: 'short' })}
              </span>
            </button>
          );
        })}
      </div>

      {/* Shifts List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : !shifts || shifts.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="لا توجد ورديات"
          description="اضغط توليد أسبوعي لإنشاء ورديات من جداول الموظفات"
          actionLabel="توليد الورديات"
          onAction={() => generateMutation.mutate()}
        />
      ) : (
        <div className="space-y-3">
          {shifts.map((shift, i) => {
            const config = statusConfig[shift.status];
            const StatusIcon = config.icon;

            return (
              <motion.div
                key={shift.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 text-lg font-bold text-[var(--brand-primary)]">
                          {shift.employee?.fullName?.charAt(0) || '؟'}
                        </div>
                        <div>
                          <h3 className="font-semibold text-[var(--foreground)]">
                            {shift.employee?.fullName || 'موظف غير محدد'}
                          </h3>
                          <div className="flex items-center gap-3 text-sm text-[var(--muted-foreground)]">
                            <span className="flex items-center gap-1">
                              <Timer className="h-3.5 w-3.5" />
                              {formatTime(shift.startTime)} — {formatTime(shift.endTime)}
                            </span>
                            {shift.lateMinutes > 0 && (
                              <span className="text-amber-500 font-medium">
                                تأخر {shift.lateMinutes} د
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Badge variant={config.variant}>
                          <StatusIcon className="h-3.5 w-3.5 me-1" />
                          {config.label}
                        </Badge>

                        {shift.status === 'scheduled' && (
                          <Button
                            size="sm"
                            onClick={() => checkInMutation.mutate(shift.id)}
                            disabled={checkInMutation.isPending}
                          >
                            <Play className="h-3.5 w-3.5 me-1" />
                            حضور
                          </Button>
                        )}

                        {(shift.status === 'active' || shift.status === 'late') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => checkOutMutation.mutate(shift.id)}
                            disabled={checkOutMutation.isPending}
                          >
                            <Square className="h-3.5 w-3.5 me-1" />
                            انصراف
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Load bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)] mb-1">
                        <span>الحمل</span>
                        <span>{shift.currentLoad} / {shift.maxLoad}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--muted)]">
                        <div
                          className="h-full rounded-full bg-[var(--brand-primary)] transition-all"
                          style={{ width: `${shift.maxLoad > 0 ? Math.min(100, (shift.currentLoad / shift.maxLoad) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
