'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageHeader, Button } from '@/components/ui';
import { dashboardService } from '@/services/dashboard.service';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

/* ───────── helpers ───────── */
const DAYS_AR = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

function formatDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function generateTimeSlots() {
  const slots: string[] = [];
  for (let h = 8; h <= 22; h++) {
    slots.push(`${pad(h)}:00`);
    slots.push(`${pad(h)}:30`);
  }
  return slots;
}

function generateDays(count: number) {
  const days: Date[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

const TIME_SLOTS = generateTimeSlots();

/* ───────── component ───────── */
export default function NewAppointmentPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  // ── Client: just name + phone, simple and direct ──
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');

  // ── Booking details ──
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [notes, setNotes] = useState('');

  // ── Data ──
  const { data: employeesData } = useQuery({
    queryKey: ['employees', 'all'],
    queryFn: () => dashboardService.getEmployees({ limit: 100 }, accessToken!),
    enabled: !!accessToken,
  });

  const { data: servicesData } = useQuery({
    queryKey: ['services', 'all'],
    queryFn: () => dashboardService.getServices({ limit: 100 }, accessToken!),
    enabled: !!accessToken,
  });

  const employees = employeesData?.items ?? [];
  const services = servicesData?.items ?? [];

  // ── Days ──
  const days = useMemo(() => generateDays(14), []);

  // ── Submit: create client automatically → then create appointment ──
  const createMutation = useMutation({
    mutationFn: async () => {
      // Step 1: Create or find client automatically
      let resolvedClientId: string | undefined;

      try {
        const newClient = await dashboardService.createClient(
          {
            fullName: clientName.trim(),
            phone: clientPhone.trim() || undefined,
          } as any,
          accessToken!,
        );
        resolvedClientId = newClient?.id;
      } catch {
        // Client might already exist — that's fine, try to continue
      }

      // If client creation didn't return an ID, search for them
      if (!resolvedClientId && clientPhone.trim()) {
        try {
          const searchResult = await dashboardService.getClients(
            { search: clientPhone.trim(), limit: 1 } as any,
            accessToken!,
          );
          resolvedClientId = searchResult?.items?.[0]?.id;
        } catch {
          // ignore
        }
      }

      if (!resolvedClientId) {
        throw new Error('لم نتمكن من إنشاء أو إيجاد العميل');
      }

      // Step 2: Create appointment
      return dashboardService.createAppointment(
        {
          clientId: resolvedClientId,
          employeeId,
          date: selectedDate,
          startTime: selectedTime,
          notes: notes || undefined,
        },
        accessToken!,
      );
    },
    onSuccess: () => {
      toast.success('تم حجز الموعد بنجاح ✅');
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      router.push('/appointments');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'حدث خطأ أثناء حجز الموعد');
    },
  });

  const canSubmit =
    clientName.trim() &&
    selectedServices.length > 0 &&
    employeeId &&
    selectedDate &&
    selectedTime;

  function toggleService(id: string) {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }

  const totalDuration = services
    .filter((s) => selectedServices.includes(s.id))
    .reduce((acc, s) => acc + (s.duration || 0), 0);

  const totalPrice = services
    .filter((s) => selectedServices.includes(s.id))
    .reduce((acc, s) => acc + (Number(s.price) || 0), 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      <PageHeader title="حجز جديد" description="إنشاء موعد جديد للعميل" />

      <div className="space-y-6 mt-6">

        {/* ─── 1. CLIENT: Simple name + phone ─── */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[var(--brand-primary)] text-white flex items-center justify-center text-xs font-bold">1</span>
            بيانات العميل
          </h3>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
                اسم العميل *
              </label>
              <input
                type="text"
                placeholder="مثال: فاطمة أحمد"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--background)] text-sm placeholder:text-[var(--muted-foreground)] focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
                رقم الجوال
              </label>
              <input
                type="tel"
                dir="ltr"
                placeholder="05XXXXXXXX"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--background)] text-sm placeholder:text-[var(--muted-foreground)] focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 outline-none transition-all text-left"
              />
            </div>
          </div>
          <p className="text-[11px] text-[var(--muted-foreground)]">
            💡 يتم حفظ بيانات العميل تلقائياً في قسم العملاء للتسويق
          </p>
        </section>

        {/* ─── 2. SERVICES ─── */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[var(--brand-primary)] text-white flex items-center justify-center text-xs font-bold">2</span>
            الخدمات
            {selectedServices.length > 0 && (
              <span className="text-xs bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] px-2 py-0.5 rounded-full">
                {selectedServices.length} خدمة · {totalDuration} دقيقة · {totalPrice} ر.س
              </span>
            )}
          </h3>

          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
            {services.map((service) => {
              const isSelected = selectedServices.includes(service.id);
              return (
                <button
                  key={service.id}
                  onClick={() => toggleService(service.id)}
                  className={cn(
                    'p-3 rounded-xl border text-right transition-all',
                    isSelected
                      ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5 ring-2 ring-[var(--brand-primary)]/20'
                      : 'border-[var(--border)] hover:border-[var(--brand-primary)]/50',
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className={cn(
                      'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all',
                      isSelected
                        ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)]'
                        : 'border-[var(--border)]',
                    )}>
                      {isSelected && <span className="text-white text-xs">✓</span>}
                    </div>
                  </div>
                  <p className="text-sm font-medium mt-1">{service.nameAr}</p>
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                    {service.price} ر.س · {service.duration} د
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* ─── 3. EMPLOYEE ─── */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[var(--brand-primary)] text-white flex items-center justify-center text-xs font-bold">3</span>
            الموظفة
          </h3>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {employees.map((emp) => {
              const isSelected = employeeId === emp.id;
              return (
                <button
                  key={emp.id}
                  onClick={() => setEmployeeId(emp.id)}
                  className={cn(
                    'flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all',
                    isSelected
                      ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5 ring-2 ring-[var(--brand-primary)]/20'
                      : 'border-[var(--border)] hover:border-[var(--brand-primary)]/50',
                  )}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                    isSelected
                      ? 'bg-[var(--brand-primary)] text-white'
                      : 'bg-[var(--border)] text-[var(--muted-foreground)]',
                  )}>
                    {emp.fullName?.charAt(0)}
                  </div>
                  <span className="text-sm font-medium whitespace-nowrap">{emp.fullName}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ─── 4. DATE ─── */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[var(--brand-primary)] text-white flex items-center justify-center text-xs font-bold">4</span>
            التاريخ
          </h3>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {days.map((day) => {
              const dateStr = formatDate(day);
              const isToday = formatDate(new Date()) === dateStr;
              const isSelected = selectedDate === dateStr;
              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={cn(
                    'flex-shrink-0 flex flex-col items-center px-3 py-2.5 rounded-xl border min-w-[70px] transition-all',
                    isSelected
                      ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white'
                      : 'border-[var(--border)] hover:border-[var(--brand-primary)]/50',
                  )}
                >
                  <span className="text-[10px] font-medium opacity-70">
                    {isToday ? 'اليوم' : DAYS_AR[day.getDay()]}
                  </span>
                  <span className="text-lg font-bold">{day.getDate()}</span>
                  <span className="text-[10px] opacity-70">{MONTHS_AR[day.getMonth()]}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ─── 5. TIME ─── */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[var(--brand-primary)] text-white flex items-center justify-center text-xs font-bold">5</span>
            الوقت
          </h3>

          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {TIME_SLOTS.map((slot) => {
              const isSelected = selectedTime === slot;
              const hour = parseInt(slot.split(':')[0]);
              const isPM = hour >= 12;
              const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
              const minutes = slot.split(':')[1];
              return (
                <button
                  key={slot}
                  onClick={() => setSelectedTime(slot)}
                  className={cn(
                    'py-2.5 px-2 rounded-xl border text-center transition-all text-sm',
                    isSelected
                      ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white font-bold'
                      : 'border-[var(--border)] hover:border-[var(--brand-primary)]/50',
                  )}
                >
                  {displayHour}:{minutes}
                  <span className="text-[10px] mr-0.5 opacity-70">{isPM ? 'م' : 'ص'}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ─── 6. NOTES ─── */}
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[var(--border)] text-[var(--muted-foreground)] flex items-center justify-center text-xs font-bold">6</span>
            ملاحظات (اختياري)
          </h3>
          <textarea
            placeholder="أي ملاحظات إضافية..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--background)] text-sm placeholder:text-[var(--muted-foreground)] focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 outline-none transition-all min-h-[80px] resize-none"
          />
        </section>

        {/* ─── SUMMARY ─── */}
        {canSubmit && (
          <div className="p-4 rounded-2xl bg-[var(--brand-primary)]/5 border border-[var(--brand-primary)]/20 space-y-2">
            <h4 className="text-sm font-bold text-[var(--foreground)]">ملخص الحجز</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-[var(--muted-foreground)]">العميل:</div>
              <div className="font-medium">{clientName}{clientPhone && ` · ${clientPhone}`}</div>
              <div className="text-[var(--muted-foreground)]">الخدمات:</div>
              <div className="font-medium">{selectedServices.length} خدمة ({totalDuration} دقيقة)</div>
              <div className="text-[var(--muted-foreground)]">الموظفة:</div>
              <div className="font-medium">{employees.find((e) => e.id === employeeId)?.fullName}</div>
              <div className="text-[var(--muted-foreground)]">الموعد:</div>
              <div className="font-medium">{selectedDate} · {selectedTime}</div>
              <div className="text-[var(--muted-foreground)]">المبلغ:</div>
              <div className="font-bold text-[var(--brand-primary)]">{totalPrice} ر.س</div>
            </div>
          </div>
        )}

        {/* ─── SUBMIT ─── */}
        <div className="flex items-center gap-3 pt-2 pb-8">
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit || createMutation.isPending}
            className="flex-1"
          >
            {createMutation.isPending ? 'جارٍ الحجز...' : '✅ تأكيد الحجز'}
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push('/appointments')}
          >
            إلغاء
          </Button>
        </div>
      </div>
    </div>
  );
}
