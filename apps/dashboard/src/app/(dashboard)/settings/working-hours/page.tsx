'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Spinner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

interface DaySchedule { dayOfWeek: number; nameAr: string; isOpen: boolean; startTime: string; endTime: string; }

const DAYS: Record<number, string> = { 0: 'السبت', 1: 'الأحد', 2: 'الإثنين', 3: 'الثلاثاء', 4: 'الأربعاء', 5: 'الخميس', 6: 'الجمعة' };
const DAY_EN: Record<number, string> = { 0: 'Sat', 1: 'Sun', 2: 'Mon', 3: 'Tue', 4: 'Wed', 5: 'Thu', 6: 'Fri' };

const defaultSchedule: DaySchedule[] = Array.from({ length: 7 }, (_, i) => ({
  dayOfWeek: i, nameAr: DAYS[i], isOpen: i !== 6, startTime: '09:00', endTime: '21:00',
}));

export default function WorkingHoursPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  const [schedule, setSchedule] = useState<DaySchedule[]>(defaultSchedule);

  const { data, isLoading } = useQuery<DaySchedule[]>({
    queryKey: ['settings', 'working-hours'],
    queryFn: () => api.get<DaySchedule[]>('/salon/working-hours', accessToken!),
    enabled: !!accessToken,
  });

  useEffect(() => { if (data) setSchedule(data.map(d => ({ ...d, nameAr: DAYS[d.dayOfWeek] ?? '' }))); }, [data]);

  const mut = useMutation({
    mutationFn: () => api.put('/salon/working-hours', { schedule }, accessToken!),
    onSuccess: () => { toast.success('✅ تم حفظ ساعات العمل'); qc.invalidateQueries({ queryKey: ['settings', 'working-hours'] }); },
    onError: () => toast.error('خطأ في الحفظ'),
  });

  const toggle = (i: number) => setSchedule(p => p.map((d, j) => j === i ? { ...d, isOpen: !d.isOpen } : d));
  const update = (i: number, f: 'startTime' | 'endTime', v: string) => setSchedule(p => p.map((d, j) => j === i ? { ...d, [f]: v } : d));

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/settings')} className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--muted)] transition"><ArrowRight className="h-4 w-4" /></button>
        <div>
          <h1 className="text-xl font-black">ساعات العمل</h1>
          <p className="text-xs text-[var(--muted-foreground)]">أوقات الفتح والإغلاق لكل يوم</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--border)] flex items-center gap-2">
          <Clock className="h-4 w-4 opacity-70" /><span className="text-xs font-bold">جدول العمل الأسبوعي</span>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {schedule.map((day, i) => (
            <div key={day.dayOfWeek} className={cn('flex items-center justify-between gap-3 px-5 py-3.5 transition', !day.isOpen && 'opacity-40')}>
              <div className="flex items-center gap-3">
                <button onClick={() => toggle(i)}
                  className={cn('relative h-6 w-11 rounded-full transition-colors flex-shrink-0', day.isOpen ? 'bg-emerald-500' : 'bg-[var(--muted)]')}>
                  <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', day.isOpen ? 'start-5' : 'start-0.5')} />
                </button>
                <div>
                  <span className="text-sm font-bold">{day.nameAr}</span>
                  <span className="text-[10px] text-[var(--muted-foreground)] mr-1.5">{DAY_EN[day.dayOfWeek]}</span>
                </div>
              </div>
              {day.isOpen ? (
                <div className="flex items-center gap-2">
                  <input type="time" value={day.startTime} onChange={e => update(i, 'startTime', e.target.value)} dir="ltr"
                    className="px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-center w-24 outline-none focus:border-[var(--brand-primary)] tabular-nums" />
                  <span className="text-xs text-[var(--muted-foreground)]">→</span>
                  <input type="time" value={day.endTime} onChange={e => update(i, 'endTime', e.target.value)} dir="ltr"
                    className="px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-center w-24 outline-none focus:border-[var(--brand-primary)] tabular-nums" />
                </div>
              ) : (
                <span className="text-xs font-bold text-red-400 bg-red-50 px-2.5 py-1 rounded-lg">مغلق</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <Button onClick={() => mut.mutate()} disabled={mut.isPending} className="w-full py-3">
        {mut.isPending ? 'جارٍ الحفظ...' : '💾 حفظ ساعات العمل'}
      </Button>
    </div>
  );
}
