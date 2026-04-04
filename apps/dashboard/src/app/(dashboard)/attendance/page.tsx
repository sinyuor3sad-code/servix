'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { Button, Spinner } from '@/components/ui';
import { toast } from 'sonner';
import {
  LogOut,
  Coffee,
  Clock,
  Power,
  Download,
  CheckCircle2,
} from 'lucide-react';
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

const ROLE_LABELS: Record<string, string> = {
  stylist: 'مصففة', cashier: 'كاشيرة', makeup: 'مكياج', nails: 'أظافر', skincare: 'عناية',
};

function formatTime(time: string | null): string {
  if (!time) return '--:--';
  const [h, m] = time.split(':');
  const hour = parseInt(h ?? '0', 10);
  const period = hour >= 12 ? 'م' : 'ص';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m ?? '00'} ${period}`;
}

function formatCurrentTime(): string {
  const now = new Date();
  const h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  const period = h >= 12 ? 'م' : 'ص';
  return `${h % 12 || 12}:${m} ${period}`;
}

function formatTodayDate(): string {
  const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const now = new Date();
  return `${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]}`;
}

export default function AttendancePage(): React.ReactElement {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [showEndShift, setShowEndShift] = useState(false);
  const [confirmCheckOutId, setConfirmCheckOutId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(formatCurrentTime());

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(formatCurrentTime()), 30000);
    return () => clearInterval(timer);
  }, []);

  const { data: records, isLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ['attendance', 'today'],
    queryFn: () => api.get<AttendanceRecord[]>('/attendance/today', accessToken!),
    enabled: !!accessToken,
    refetchInterval: 30000,
  });

  const checkInMutation = useMutation({
    mutationFn: (employeeId: string) =>
      api.post<AttendanceRecord>('/attendance/check-in', { employeeId }, accessToken!),
    onSuccess: (_, employeeId) => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      const emp = records?.find(r => r.employeeId === employeeId);
      toast.success(`✅ ${emp?.employee.fullName || 'الموظفة'} — تم التحضير`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const checkOutMutation = useMutation({
    mutationFn: (employeeId: string) =>
      api.put<AttendanceRecord>('/attendance/check-out', { employeeId }, accessToken!),
    onSuccess: (_, employeeId) => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      const emp = records?.find(r => r.employeeId === employeeId);
      toast.success(`👋 ${emp?.employee.fullName || 'الموظفة'} — تم الخروج`);
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
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const allRecords = records ?? [];
  const presentCount = allRecords.filter(r => r.computedStatus === 'present' || r.computedStatus === 'on_break').length;
  const absentRecords = allRecords.filter(r => r.computedStatus === 'absent');
  const checkedInRecords = allRecords.filter(r => r.computedStatus === 'present' || r.computedStatus === 'on_break');
  const checkedOutRecords = allRecords.filter(r => r.computedStatus === 'off_duty');

  const handleEndShift = async () => {
    const stillPresent = allRecords.filter(r => r.computedStatus === 'present' || r.computedStatus === 'on_break');
    for (const r of stillPresent) {
      try {
        await api.put('/attendance/check-out', { employeeId: r.employeeId }, accessToken!);
      } catch { /* skip */ }
    }
    queryClient.invalidateQueries({ queryKey: ['attendance'] });
    toast.success('✅ تم إنهاء الدوام — خروج الجميع');
    setShowEndShift(false);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-5">

      {/* ── Header with Date & Time ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">الحضور والانصراف</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">{formatTodayDate()}</p>
        </div>
        <div className="text-left">
          <div className="text-2xl font-bold text-[var(--brand-primary)]">{currentTime}</div>
          {presentCount > 0 && (
            <button
              onClick={() => setShowEndShift(true)}
              className="text-xs text-red-500 hover:text-red-600 font-medium mt-1 flex items-center gap-1"
            >
              <Power className="h-3 w-3" />
              إنهاء الدوام
            </button>
          )}
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-center">
          <div className="text-3xl font-black text-emerald-600">{presentCount}</div>
          <div className="text-[11px] text-emerald-500 font-medium mt-0.5">حاضرة</div>
        </div>
        <div className="rounded-2xl bg-orange-50 border border-orange-100 p-4 text-center">
          <div className="text-3xl font-black text-orange-500">{absentRecords.length}</div>
          <div className="text-[11px] text-orange-400 font-medium mt-0.5">لم تحضر</div>
        </div>
        <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-center">
          <div className="text-3xl font-black text-slate-400">{checkedOutRecords.length}</div>
          <div className="text-[11px] text-slate-400 font-medium mt-0.5">انصرفت</div>
        </div>
      </div>

      {/* ── Quick Check-in ── */}
      {absentRecords.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-[var(--foreground)] mb-3">
            سجّلي حضور 👆
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {absentRecords.map(r => (
              <button
                key={r.employeeId}
                onClick={() => checkInMutation.mutate(r.employeeId)}
                disabled={checkInMutation.isPending}
                className="flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed border-orange-200 bg-white hover:border-emerald-400 hover:bg-emerald-50 active:scale-[0.98] transition-all duration-150 group disabled:opacity-50"
              >
                <div className="w-11 h-11 rounded-full bg-orange-100 text-orange-500 group-hover:bg-emerald-100 group-hover:text-emerald-600 flex items-center justify-center text-lg font-bold shrink-0 transition-colors">
                  {r.employee.fullName?.[0]}
                </div>
                <div className="text-right flex-1 min-w-0">
                  <div className="text-sm font-bold truncate">{r.employee.fullName}</div>
                  <div className="text-[11px] text-[var(--muted-foreground)]">
                    {ROLE_ICONS[r.employee.role]} {ROLE_LABELS[r.employee.role] || r.employee.role}
                  </div>
                  <div className="text-[10px] text-orange-400 group-hover:text-emerald-500 font-medium mt-0.5 transition-colors">
                    اضغطي للتحضير ←
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Present Employees ── */}
      {checkedInRecords.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-[var(--foreground)] mb-3">
            الموظفات الحاضرات ✅
          </h3>
          <div className="space-y-2.5">
            {checkedInRecords.map(r => {
              const isBreak = r.computedStatus === 'on_break';
              const isConfirming = confirmCheckOutId === r.employeeId;

              return (
                <div
                  key={r.employeeId}
                  className={cn(
                    'relative flex items-center gap-3 p-4 rounded-2xl border transition-all',
                    isBreak ? 'border-amber-200 bg-amber-50/50' : 'border-[var(--border)] bg-white',
                  )}
                >
                  {/* Checkout Confirmation Overlay */}
                  {isConfirming && (
                    <div className="absolute inset-0 rounded-2xl bg-white/95 backdrop-blur-sm z-10 flex items-center justify-center gap-3">
                      <span className="text-sm font-medium">خروج {r.employee.fullName}؟</span>
                      <button
                        onClick={() => checkOutMutation.mutate(r.employeeId)}
                        disabled={checkOutMutation.isPending}
                        className="px-4 py-2 rounded-xl bg-red-500 text-white text-xs font-bold hover:bg-red-600 active:scale-95 transition disabled:opacity-50"
                      >
                        👋 نعم
                      </button>
                      <button
                        onClick={() => setConfirmCheckOutId(null)}
                        className="px-4 py-2 rounded-xl border text-xs font-medium hover:bg-slate-50 transition"
                      >
                        لا
                      </button>
                    </div>
                  )}

                  {/* Avatar */}
                  <div className={cn(
                    'w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0',
                    isBreak
                      ? 'bg-gradient-to-br from-amber-400 to-amber-500'
                      : 'bg-gradient-to-br from-emerald-400 to-emerald-600',
                  )}>
                    {r.employee.fullName?.[0]}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold">{r.employee.fullName}</div>
                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)] mt-0.5">
                      <span>{ROLE_ICONS[r.employee.role]}</span>
                      <Clock className="h-3 w-3" />
                      <span>{formatTime(r.checkIn)}</span>
                      {isBreak && <span className="text-amber-500 font-medium">☕ في استراحة</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleBreakMutation.mutate(r.employeeId)}
                      disabled={toggleBreakMutation.isPending}
                      className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90',
                        isBreak
                          ? 'bg-amber-200 text-amber-700'
                          : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-amber-100 hover:text-amber-600',
                      )}
                      title={isBreak ? 'إنهاء الاستراحة' : 'استراحة'}
                    >
                      <Coffee className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setConfirmCheckOutId(r.employeeId)}
                      className="w-10 h-10 rounded-xl bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-red-100 hover:text-red-500 flex items-center justify-center transition-all active:scale-90"
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

      {/* ── Checked Out ── */}
      {checkedOutRecords.length > 0 && (
        <div className="opacity-60">
          <h3 className="text-sm font-bold text-[var(--muted-foreground)] mb-3">
            انصرفت 👋
          </h3>
          <div className="space-y-1.5">
            {checkedOutRecords.map(r => (
              <div key={r.employeeId} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center font-bold text-xs shrink-0">
                  {r.employee.fullName?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium">{r.employee.fullName}</span>
                </div>
                <span className="text-[11px] text-slate-400">
                  {formatTime(r.checkIn)} → {formatTime(r.checkOut)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty State ── */}
      {allRecords.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto rounded-full bg-[var(--muted)] flex items-center justify-center mb-4">
            <Clock className="h-8 w-8 text-[var(--muted-foreground)]" />
          </div>
          <p className="font-medium text-[var(--foreground)]">لا يوجد دوام مسجّل اليوم</p>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">أضيفي جداول عمل للموظفات من صفحة الموظفات أولاً</p>
        </div>
      )}

      {/* ── End Shift Modal ── */}
      {showEndShift && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-5 animate-in slide-in-from-bottom-4">
            {/* Header */}
            <div className="text-center">
              <div className="w-14 h-14 mx-auto rounded-full bg-red-100 flex items-center justify-center mb-3">
                <Power className="h-7 w-7 text-red-500" />
              </div>
              <h3 className="font-bold text-lg">إنهاء الدوام</h3>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">
                سيتم تسجيل خروج {presentCount} موظفة
              </p>
            </div>

            {/* Checklist */}
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-100">
                <Download className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-bold text-amber-700">نسخ احتياطي للفواتير</div>
                  <p className="text-xs text-amber-600 mt-0.5">تأكدي من حفظ نسخة احتياطية من صفحة الفواتير</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-100">
                <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-bold text-blue-700">إشعار المديرة</div>
                  <p className="text-xs text-blue-600 mt-0.5">سيتم إبلاغ المديرة بانتهاء الدوام تلقائياً</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleEndShift}
                className="flex-1 py-3.5 rounded-2xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 active:scale-[0.98] transition-all"
              >
                ✅ تأكيد إنهاء الدوام
              </button>
              <button
                onClick={() => setShowEndShift(false)}
                className="px-6 py-3.5 rounded-2xl border-2 border-[var(--border)] font-medium text-sm hover:bg-slate-50 active:scale-[0.98] transition-all"
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
