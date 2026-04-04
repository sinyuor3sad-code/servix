'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { PageHeader, Badge, Button, Spinner } from '@/components/ui';
import { toast } from 'sonner';
import {
  LogIn,
  LogOut,
  Coffee,
  Clock,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  Power,
} from 'lucide-react';
import type { EmployeeRole } from '@/types';
import { cn } from '@/lib/utils';

interface AttendanceRecord {
  id: string | null;
  employeeId: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  isOnBreak: boolean;
  computedStatus?: 'present' | 'absent' | 'on_break' | 'off_duty';
  employee: { id: string; fullName: string; role: string; avatarUrl?: string | null };
}

const ROLE_ICONS: Record<string, string> = {
  stylist: '✂️', cashier: '💵', makeup: '💄', nails: '💅', skincare: '🧴',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  present: { label: 'حاضرة', color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
  absent: { label: 'لم تحضر', color: 'text-red-500 bg-red-50 border-red-200', icon: XCircle },
  on_break: { label: 'استراحة', color: 'text-amber-600 bg-amber-50 border-amber-200', icon: Coffee },
  off_duty: { label: 'انصرفت', color: 'text-slate-500 bg-slate-50 border-slate-200', icon: LogOut },
};

function formatTime(time: string | null): string {
  if (!time) return '--:--';
  const [h, m] = time.split(':');
  const hour = parseInt(h ?? '0', 10);
  const period = hour >= 12 ? 'م' : 'ص';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m ?? '00'} ${period}`;
}

function getNow(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export default function AttendancePage(): React.ReactElement {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [showEndShift, setShowEndShift] = useState(false);
  const [confirmCheckOutId, setConfirmCheckOutId] = useState<string | null>(null);

  const { data: records, isLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ['attendance', 'today'],
    queryFn: () => api.get<AttendanceRecord[]>('/attendance/today', accessToken!),
    enabled: !!accessToken,
    refetchInterval: 30000, // Auto-refresh every 30s
  });

  const checkInMutation = useMutation({
    mutationFn: (employeeId: string) =>
      api.post<AttendanceRecord>('/attendance/check-in', { employeeId }, accessToken!),
    onSuccess: (_, employeeId) => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      const emp = records?.find(r => r.employeeId === employeeId);
      toast.success(`✅ تم تسجيل حضور ${emp?.employee.fullName || 'الموظفة'}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const checkOutMutation = useMutation({
    mutationFn: (employeeId: string) =>
      api.put<AttendanceRecord>('/attendance/check-out', { employeeId }, accessToken!),
    onSuccess: (_, employeeId) => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      const emp = records?.find(r => r.employeeId === employeeId);
      toast.success(`👋 تم تسجيل انصراف ${emp?.employee.fullName || 'الموظفة'}`);
      setConfirmCheckOutId(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setConfirmCheckOutId(null);
    },
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

  const allRecords = records ?? [];
  const presentCount = allRecords.filter(r => r.computedStatus === 'present' || r.computedStatus === 'on_break').length;
  const absentRecords = allRecords.filter(r => r.computedStatus === 'absent');
  const checkedInRecords = allRecords.filter(r => r.computedStatus === 'present' || r.computedStatus === 'on_break');
  const checkedOutRecords = allRecords.filter(r => r.computedStatus === 'off_duty');
  const activeRecords = [...checkedInRecords, ...absentRecords];

  /* End shift: check-out everyone still present */
  const handleEndShift = async () => {
    const stillPresent = allRecords.filter(r => r.computedStatus === 'present' || r.computedStatus === 'on_break');
    for (const r of stillPresent) {
      try {
        await api.put('/attendance/check-out', { employeeId: r.employeeId }, accessToken!);
      } catch { /* skip individual errors */ }
    }
    queryClient.invalidateQueries({ queryKey: ['attendance'] });
    toast.success('✅ تم إنهاء الدوام وتسجيل خروج الجميع');
    setShowEndShift(false);
    // TODO: trigger invoice backup notification to owner
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="الحضور والانصراف"
        description="تسجيل حضور وانصراف الموظفات — يتم بواسطة الكاشيرة"
        actions={
          presentCount > 0 ? (
            <Button
              variant="outline"
              onClick={() => setShowEndShift(true)}
              className="border-red-200 text-red-600 hover:bg-red-50"
            >
              <Power className="h-4 w-4" />
              إنهاء الدوام
            </Button>
          ) : null
        }
      />

      {/* ── Stats Bar ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
          <div className="text-2xl font-bold text-emerald-700">{presentCount}</div>
          <div className="text-xs text-emerald-600 mt-1">حاضرة الآن</div>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{absentRecords.length}</div>
          <div className="text-xs text-red-500 mt-1">لم تحضر</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
          <div className="text-2xl font-bold text-slate-600">{checkedOutRecords.length}</div>
          <div className="text-xs text-slate-500 mt-1">انصرفت</div>
        </div>
      </div>

      {/* ── Quick Check-in (Absent Employees) ── */}
      {absentRecords.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h3 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2 mb-4">
            <LogIn className="h-4 w-4 text-[var(--brand-primary)]" />
            تسجيل حضور — اضغطي على اسم الموظفة لتسجيل وصولها
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {absentRecords.map(r => (
              <button
                key={r.employeeId}
                onClick={() => checkInMutation.mutate(r.employeeId)}
                disabled={checkInMutation.isPending}
                className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-[var(--border)] hover:border-emerald-400 hover:bg-emerald-50 transition-all group"
              >
                <div className="w-8 h-8 rounded-full bg-red-100 text-red-500 flex items-center justify-center text-sm font-bold group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors">
                  {r.employee.fullName?.[0]}
                </div>
                <div className="text-right flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{r.employee.fullName}</div>
                  <div className="text-[10px] text-[var(--muted-foreground)]">
                    {ROLE_ICONS[r.employee.role] || '👤'} اضغطي للتحضير
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Present Employees ── */}
      {checkedInRecords.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h3 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-emerald-600" />
            الموظفات الحاضرات ({checkedInRecords.length})
          </h3>
          <div className="space-y-2">
            {checkedInRecords.map(r => {
              const statusCfg = STATUS_CONFIG[r.computedStatus ?? 'present'];
              const isConfirming = confirmCheckOutId === r.employeeId;

              return (
                <div
                  key={r.employeeId}
                  className={cn(
                    'relative flex items-center justify-between gap-3 p-4 rounded-xl border transition-all',
                    isConfirming ? 'border-red-300 bg-red-50' : 'border-[var(--border)]',
                  )}
                >
                  {/* Inline checkout confirmation */}
                  {isConfirming && (
                    <div className="absolute inset-0 rounded-xl bg-white/95 backdrop-blur-sm z-10 flex items-center justify-center gap-3 px-4">
                      <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
                      <span className="text-sm font-medium">تسجيل خروج {r.employee.fullName}؟</span>
                      <button
                        onClick={() => checkOutMutation.mutate(r.employeeId)}
                        disabled={checkOutMutation.isPending}
                        className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition disabled:opacity-50"
                      >
                        {checkOutMutation.isPending ? '...' : '👋 نعم'}
                      </button>
                      <button
                        onClick={() => setConfirmCheckOutId(null)}
                        className="px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-[var(--muted)] transition"
                      >
                        إلغاء
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                      {r.employee.fullName?.[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{r.employee.fullName}</div>
                      <div className="flex items-center gap-2 text-[11px] text-[var(--muted-foreground)]">
                        <span>{ROLE_ICONS[r.employee.role] || '👤'}</span>
                        <Clock className="h-3 w-3" />
                        <span>دخول: {formatTime(r.checkIn)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Badge variant={r.computedStatus === 'on_break' ? 'warning' : 'success'}>
                      {statusCfg?.label}
                    </Badge>
                    <button
                      onClick={() => toggleBreakMutation.mutate(r.employeeId)}
                      disabled={toggleBreakMutation.isPending}
                      className={cn(
                        'p-2 rounded-lg transition-colors',
                        r.computedStatus === 'on_break'
                          ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                          : 'hover:bg-amber-50 text-[var(--muted-foreground)] hover:text-amber-600',
                      )}
                      title={r.computedStatus === 'on_break' ? 'إنهاء الاستراحة' : 'استراحة'}
                    >
                      <Coffee className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setConfirmCheckOutId(r.employeeId)}
                      className="p-2 rounded-lg hover:bg-red-50 text-[var(--muted-foreground)] hover:text-red-500 transition-colors"
                      title="تسجيل خروج"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Checked Out (Done) ── */}
      {checkedOutRecords.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 opacity-70">
          <h3 className="text-sm font-semibold text-[var(--muted-foreground)] flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-4 w-4" />
            انصرفت ({checkedOutRecords.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {checkedOutRecords.map(r => (
              <div key={r.employeeId} className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--muted)]/30">
                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-xs">
                  {r.employee.fullName?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{r.employee.fullName}</div>
                  <div className="text-[10px] text-[var(--muted-foreground)]">
                    {formatTime(r.checkIn)} → {formatTime(r.checkOut)}
                  </div>
                </div>
                <Badge variant="secondary">انصرفت</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty State ── */}
      {allRecords.length === 0 && (
        <div className="text-center py-20">
          <Clock className="h-12 w-12 mx-auto text-[var(--muted-foreground)] mb-3" />
          <p className="text-[var(--muted-foreground)]">لا يوجد دوام مسجّل اليوم</p>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">تأكدي من إضافة جداول عمل للموظفات أولاً</p>
        </div>
      )}

      {/* ── End Shift Modal ── */}
      {showEndShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <Power className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-lg">إنهاء الدوام</h3>
                <p className="text-sm text-[var(--muted-foreground)]">سيتم تسجيل خروج جميع الموظفات</p>
              </div>
            </div>

            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
              <div className="flex items-center gap-2 text-amber-700 text-sm font-medium mb-2">
                <Download className="h-4 w-4" />
                تذكير: نسخ احتياطي للفواتير
              </div>
              <p className="text-xs text-amber-600">
                قبل إنهاء الدوام، تأكدي من حفظ نسخة احتياطية لفواتير اليوم من صفحة الفواتير.
              </p>
            </div>

            <div className="rounded-xl bg-orange-50 border border-orange-200 p-4">
              <p className="text-xs text-orange-600">
                ⚠️ سيتم إشعار المديرة بانتهاء الدوام
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleEndShift}
                className="flex-1 px-4 py-3 rounded-xl bg-red-500 text-white font-medium text-sm hover:bg-red-600 transition-colors"
              >
                ✅ تأكيد إنهاء الدوام
              </button>
              <button
                onClick={() => setShowEndShift(false)}
                className="px-4 py-3 rounded-xl border border-[var(--border)] text-sm font-medium hover:bg-[var(--muted)] transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
