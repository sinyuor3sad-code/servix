'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import {
  Check,
  ChevronRight,
  Clock,
  Loader2,
  Scissors,
  User,
  CalendarDays,
  ClipboardList,
  CircleCheckBig,
  Sparkles,
  ShieldCheck,
  Sun,
  Sunset,
  Moon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  bookingApi,
  type ServiceCategory,
  type BookingEmployee,
  type BookingService,
} from '@/lib/api';

// ─── Types ──────────────────────────────────────────────

interface BookingState {
  step: number;
  selectedServices: string[];
  selectedEmployee: string | null;
  selectedDate: string | null;
  selectedTime: string | null;
  clientName: string;
  clientPhone: string;
  notes: string;
  otpCode: string;
  otpVerified: boolean;
}

// ─── Constants ──────────────────────────────────────────

const STEP_META = [
  { label: 'الخدمات', icon: Scissors },
  { label: 'الموظفة', icon: User },
  { label: 'الموعد', icon: CalendarDays },
  { label: 'البيانات', icon: ClipboardList },
  { label: 'التحقق', icon: ShieldCheck },
  { label: 'التأكيد', icon: CircleCheckBig },
] as const;

const TOTAL_STEPS = STEP_META.length;
const ANY_EMPLOYEE_ID = 'any';
const PHONE_REGEX = /^05\d{8}$/;

const AR_DAYS_SHORT: Record<number, string> = {
  0: 'أحد',
  1: 'إثنين',
  2: 'ثلاثاء',
  3: 'أربعاء',
  4: 'خميس',
  5: 'جمعة',
  6: 'سبت',
};

const ROLE_LABELS: Record<string, string> = {
  stylist: 'مصففة',
  manager: 'مديرة',
  receptionist: 'استقبال',
  cashier: 'كاشيرة',
  staff: 'موظفة',
};

// ─── Helpers ────────────────────────────────────────────

function formatPrice(price: number): string {
  return `${price.toLocaleString('ar-SA')} ر.س`;
}

function formatDuration(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h} ساعة و ${m} دقيقة` : `${h} ساعة`;
  }
  return `${minutes} دقيقة`;
}

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function generateNext14Days(): Date[] {
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function getTimePeriod(time: string): 'morning' | 'afternoon' | 'evening' {
  const hour = parseInt(time.split(':')[0], 10);
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

// ─── Slide Animation ────────────────────────────────────

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? -200 : 200, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? 200 : -200, opacity: 0 }),
};

const slideTransition = {
  type: 'tween' as const,
  ease: 'easeInOut' as const,
  duration: 0.28,
};

// ─── Progress Bar ───────────────────────────────────────

function ProgressBar({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-between px-1">
      {STEP_META.map((meta, i) => {
        const StepIcon = meta.icon;
        const stepNum = i + 1;
        const completed = stepNum < currentStep;
        const active = stepNum === currentStep;

        return (
          <div key={meta.label} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full transition-all duration-300',
                  completed && 'bg-(--brand-primary) text-white',
                  active &&
                    'border-2 border-(--brand-primary) bg-violet-50 text-(--brand-primary)',
                  !completed &&
                    !active &&
                    'bg-(--muted) text-(--muted-foreground)',
                )}
              >
                {completed ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <StepIcon className="h-4 w-4" />
                )}
              </div>
              <span
                className={cn(
                  'hidden text-[11px] font-medium sm:block',
                  active
                    ? 'text-(--brand-primary)'
                    : 'text-(--muted-foreground)',
                )}
              >
                {meta.label}
              </span>
            </div>

            {i < TOTAL_STEPS - 1 && (
              <div
                className={cn(
                  'mx-1 h-[2px] flex-1 rounded-full transition-colors duration-300',
                  stepNum < currentStep
                    ? 'bg-(--brand-primary)'
                    : 'bg-(--border)',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1: Select Services (with images) ──────────────

function ServiceStep({
  categories,
  selectedIds,
  onToggle,
}: {
  categories: ServiceCategory[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">اختيار الخدمات</h2>
        <p className="mt-1 text-sm text-(--muted-foreground)">
          اختاري الخدمات المطلوبة
        </p>
      </div>

      {categories.map((cat) => (
        <div key={cat.id} className="space-y-3">
          <h3 className="text-sm font-semibold text-(--muted-foreground) uppercase tracking-wider">
            {cat.nameAr}
          </h3>
          <div className="space-y-2">
            {cat.services.map((service) => {
              const selected = selectedIds.includes(service.id);
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => onToggle(service.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border p-3 text-start transition-all active:scale-[0.98]',
                    selected
                      ? 'border-(--brand-primary) bg-violet-50/60 ring-1 ring-(--brand-primary)/30'
                      : 'border-(--border) bg-white hover:border-violet-200 hover:bg-violet-50/30',
                  )}
                >
                  {service.imageUrl ? (
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg">
                      <Image
                        src={service.imageUrl}
                        alt={service.nameAr}
                        fill
                        sizes="64px"
                        className="object-cover"
                        unoptimized
                      />
                      {selected && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <Check className="h-5 w-5 text-white" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all',
                        selected
                          ? 'border-(--success) bg-(--success) text-white'
                          : 'border-(--border)',
                      )}
                    >
                      {selected && <Check className="h-3.5 w-3.5" />}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug">{service.nameAr}</p>
                    {service.descriptionAr && (
                      <p className="mt-0.5 truncate text-xs text-(--muted-foreground)">
                        {service.descriptionAr}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 text-left">
                    <p className="font-bold text-(--brand-primary)">
                      {formatPrice(service.price)}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-(--muted-foreground)">
                      <Clock className="h-3 w-3" />
                      {service.duration} دقيقة
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Step 2: Select Employee (with specialty) ───────────

function EmployeeStep({
  employees,
  selectedId,
  onSelect,
  selectedServiceIds,
}: {
  employees: BookingEmployee[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  selectedServiceIds: string[];
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">اختيار الموظفة</h2>
        <p className="mt-1 text-sm text-(--muted-foreground)">
          اختاري الموظفة المفضلة أو أي موظفة متاحة
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <EmployeeCard
          id={ANY_EMPLOYEE_ID}
          name="أي موظفة متاحة"
          selected={selectedId === ANY_EMPLOYEE_ID}
          onSelect={onSelect}
          avatar={
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-violet-100 to-fuchsia-100">
              <Sparkles className="h-7 w-7 text-(--brand-primary)" />
            </div>
          }
        />

        {employees.map((emp) => {
          const serviceNames = emp.services
            .filter((s) => selectedServiceIds.includes(s.id))
            .map((s) => s.nameAr);

          return (
            <EmployeeCard
              key={emp.id}
              id={emp.id}
              name={emp.fullName}
              role={ROLE_LABELS[emp.role] || emp.role}
              specialties={serviceNames}
              selected={selectedId === emp.id}
              onSelect={onSelect}
              avatar={
                emp.avatarUrl ? (
                  <div className="relative h-16 w-16 overflow-hidden rounded-full">
                    <Image
                      src={emp.avatarUrl}
                      alt={emp.fullName}
                      fill
                      sizes="64px"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-100 text-xl font-bold text-(--brand-primary)">
                    {emp.fullName.charAt(0)}
                  </div>
                )
              }
            />
          );
        })}
      </div>

      {employees.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8">
          <User className="h-10 w-10 text-(--muted-foreground) opacity-40" />
          <p className="text-center text-(--muted-foreground)">
            لا توجد موظفات متاحات لجميع الخدمات المختارة
          </p>
        </div>
      )}
    </div>
  );
}

function EmployeeCard({
  id,
  name,
  role,
  specialties,
  selected,
  onSelect,
  avatar,
}: {
  id: string;
  name: string;
  role?: string;
  specialties?: string[];
  selected: boolean;
  onSelect: (id: string) => void;
  avatar: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={cn(
        'relative flex flex-col items-center gap-2 rounded-xl border p-4 transition-all active:scale-[0.97]',
        selected
          ? 'border-(--brand-primary) bg-violet-50/60 ring-1 ring-(--brand-primary)/30'
          : 'border-(--border) bg-white hover:border-violet-200',
      )}
    >
      {selected && (
        <div className="absolute inset-s-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-(--success) text-white">
          <Check className="h-3 w-3" />
        </div>
      )}
      {avatar}
      <div className="w-full text-center">
        <p className="text-sm font-semibold leading-snug">{name}</p>
        {role && (
          <p className="mt-0.5 text-xs text-(--muted-foreground)">{role}</p>
        )}
        {specialties && specialties.length > 0 && (
          <div className="mt-1.5 flex flex-wrap justify-center gap-1">
            {specialties.slice(0, 2).map((s) => (
              <span
                key={s}
                className="inline-block rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-(--brand-primary)"
              >
                {s}
              </span>
            ))}
            {specialties.length > 2 && (
              <span className="text-[10px] text-(--muted-foreground)">
                +{specialties.length - 2}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

// ─── Step 3: Date & Time (visual periods) ───────────────

function DateTimeStep({
  selectedDate,
  selectedTime,
  slots,
  slotsLoading,
  onDateSelect,
  onTimeSelect,
  totalPrice,
  totalDuration,
}: {
  selectedDate: string | null;
  selectedTime: string | null;
  slots: string[];
  slotsLoading: boolean;
  onDateSelect: (dateStr: string) => void;
  onTimeSelect: (time: string) => void;
  totalPrice: number;
  totalDuration: number;
}) {
  const dates = useMemo(generateNext14Days, []);
  const todayStr = toDateString(new Date());

  const groupedSlots = useMemo(() => {
    const groups = {
      morning: [] as string[],
      afternoon: [] as string[],
      evening: [] as string[],
    };
    slots.forEach((s) => {
      groups[getTimePeriod(s)].push(s);
    });
    return groups;
  }, [slots]);

  const periodMeta = [
    { key: 'morning' as const, label: 'صباحاً', icon: Sun, color: 'text-amber-500' },
    { key: 'afternoon' as const, label: 'ظهراً', icon: Sunset, color: 'text-orange-500' },
    { key: 'evening' as const, label: 'مساءً', icon: Moon, color: 'text-indigo-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">اختيار التاريخ والوقت</h2>
        <p className="mt-1 text-sm text-(--muted-foreground)">
          المبلغ التقريبي: <span className="font-bold text-(--brand-primary)">{formatPrice(totalPrice)}</span>
          {' · '}
          المدة: {formatDuration(totalDuration)}
        </p>
      </div>

      {/* Date selector */}
      <div>
        <p className="mb-3 text-sm font-medium text-(--muted-foreground)">
          التاريخ
        </p>
        <div
          className="flex gap-2 overflow-x-auto pb-2"
          style={{ scrollbarWidth: 'none' }}
        >
          {dates.map((date) => {
            const dateStr = toDateString(date);
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => onDateSelect(dateStr)}
                className={cn(
                  'flex min-w-18 shrink-0 flex-col items-center gap-0.5 rounded-xl px-3 py-3 transition-all active:scale-95',
                  isSelected
                    ? 'bg-(--brand-primary) text-white shadow-lg shadow-violet-300/40'
                    : 'border border-(--border) bg-white hover:border-violet-200',
                )}
              >
                <span className="text-[10px] font-medium opacity-80">
                  {isToday ? 'اليوم' : AR_DAYS_SHORT[date.getDay()]}
                </span>
                <span className="text-lg font-bold">{date.getDate()}</span>
                <span className="text-[10px] opacity-70">
                  {date.toLocaleDateString('ar-SA', { month: 'short' })}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Time slots grouped by period */}
      {selectedDate && (
        <div>
          {slotsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-(--brand-primary)" />
            </div>
          ) : slots.length > 0 ? (
            <div className="space-y-5">
              {periodMeta.map(({ key, label, icon: Icon, color }) => {
                const periodSlots = groupedSlots[key];
                if (periodSlots.length === 0) return null;
                return (
                  <div key={key}>
                    <div className="mb-2.5 flex items-center gap-2">
                      <Icon className={cn('h-4 w-4', color)} />
                      <span className="text-sm font-medium text-(--muted-foreground)">
                        {label}
                      </span>
                      <span className="text-xs text-(--muted-foreground)">
                        ({periodSlots.length})
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                      {periodSlots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => onTimeSelect(slot)}
                          className={cn(
                            'rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all active:scale-95',
                            selectedTime === slot
                              ? 'border-(--brand-primary) bg-(--brand-primary) text-white shadow-lg shadow-violet-300/40'
                              : 'border-(--border) bg-white hover:border-violet-200',
                          )}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-12 text-(--muted-foreground)">
              <CalendarDays className="h-10 w-10 opacity-40" />
              <p>لا توجد أوقات متاحة في هذا اليوم</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Step 4: Customer Info ──────────────────────────────

function CustomerInfoStep({
  clientName,
  clientPhone,
  notes,
  onChange,
}: {
  clientName: string;
  clientPhone: string;
  notes: string;
  onChange: (field: 'clientName' | 'clientPhone' | 'notes', value: string) => void;
}) {
  const phoneValid = clientPhone.length === 0 || PHONE_REGEX.test(clientPhone);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">بيانات العميل</h2>
        <p className="mt-1 text-sm text-(--muted-foreground)">
          أدخلي بياناتك لتأكيد الحجز
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="clientName" className="mb-1.5 block text-sm font-medium">
            الاسم الكامل
          </label>
          <input
            id="clientName"
            type="text"
            value={clientName}
            onChange={(e) => onChange('clientName', e.target.value)}
            placeholder="أدخلي اسمك الكامل"
            className={cn(
              'w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition-all',
              'border-(--border) focus:border-(--brand-primary) focus:ring-2 focus:ring-(--brand-primary)/20',
            )}
          />
        </div>

        <div>
          <label htmlFor="clientPhone" className="mb-1.5 block text-sm font-medium">
            رقم الجوال
          </label>
          <input
            id="clientPhone"
            type="tel"
            dir="ltr"
            inputMode="numeric"
            value={clientPhone}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
              onChange('clientPhone', digits);
            }}
            placeholder="05XXXXXXXX"
            className={cn(
              'w-full rounded-xl border bg-white px-4 py-3 text-left text-sm outline-none transition-all focus:ring-2',
              phoneValid
                ? 'border-(--border) focus:border-(--brand-primary) focus:ring-(--brand-primary)/20'
                : 'border-(--destructive) focus:border-(--destructive) focus:ring-red-100',
            )}
          />
          {!phoneValid && (
            <p className="mt-1.5 text-xs text-(--destructive)">
              يرجى إدخال رقم جوال صحيح يبدأ بـ 05
            </p>
          )}
        </div>

        <div>
          <label htmlFor="bookingNotes" className="mb-1.5 block text-sm font-medium">
            ملاحظات{' '}
            <span className="text-(--muted-foreground)">(اختياري)</span>
          </label>
          <textarea
            id="bookingNotes"
            value={notes}
            onChange={(e) => onChange('notes', e.target.value)}
            placeholder="أي ملاحظات أو طلبات خاصة..."
            rows={3}
            className={cn(
              'w-full resize-none rounded-xl border bg-white px-4 py-3 text-sm outline-none transition-all',
              'border-(--border) focus:border-(--brand-primary) focus:ring-2 focus:ring-(--brand-primary)/20',
            )}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Step 5: OTP Verification ───────────────────────────

function OtpStep({
  phone,
  slug,
  otpCode,
  otpVerified,
  onCodeChange,
  onVerified,
}: {
  phone: string;
  slug: string;
  otpCode: string;
  otpVerified: boolean;
  onCodeChange: (code: string) => void;
  onVerified: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sent, setSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendOtp = async () => {
    if (sending || countdown > 0) return;
    setSending(true);
    try {
      await bookingApi.sendOtp(slug, phone);
      setSent(true);
      setCountdown(60);
      toast.success('تم إرسال رمز التحقق');
      setTimeout(() => inputRefs.current[0]?.focus(), 200);
    } catch {
      toast.error('فشل إرسال رمز التحقق');
    } finally {
      setSending(false);
    }
  };

  const handleDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const digits = otpCode.split('');
    while (digits.length < 4) digits.push('');
    digits[index] = digit;
    const newCode = digits.join('');
    onCodeChange(newCode);
    if (digit && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    if (verifying || otpCode.length !== 4) return;
    setVerifying(true);
    try {
      const result = await bookingApi.verifyOtp(slug, phone, otpCode);
      if (result.verified) {
        onVerified();
        toast.success('تم التحقق بنجاح');
      } else {
        toast.error('رمز التحقق غير صحيح');
      }
    } catch {
      toast.error('فشل التحقق');
    } finally {
      setVerifying(false);
    }
  };

  if (otpVerified) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold">التحقق من الجوال</h2>
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center gap-4 py-8"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
            <Check className="h-10 w-10 text-emerald-600" />
          </div>
          <p className="text-lg font-semibold text-emerald-700">تم التحقق بنجاح</p>
          <p className="text-sm text-(--muted-foreground)" dir="ltr">
            {phone}
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">التحقق من الجوال</h2>
        <p className="mt-1 text-sm text-(--muted-foreground)">
          سنرسل رمز تحقق على رقمك <span dir="ltr" className="font-semibold">{phone}</span>
        </p>
      </div>

      {!sent ? (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-violet-100">
            <ShieldCheck className="h-10 w-10 text-(--brand-primary)" />
          </div>
          <button
            type="button"
            onClick={handleSendOtp}
            disabled={sending}
            className={cn(
              'flex items-center gap-2 rounded-xl bg-(--brand-primary) px-8 py-3 text-sm font-semibold text-white transition-all',
              'shadow-lg shadow-violet-300/30 hover:bg-(--brand-primary-dark)',
              'disabled:opacity-60',
            )}
          >
            {sending && <Loader2 className="h-4 w-4 animate-spin" />}
            إرسال رمز التحقق
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6 py-4">
          <div className="flex gap-3" dir="ltr">
            {[0, 1, 2, 3].map((i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={otpCode[i] || ''}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="h-14 w-14 rounded-xl border-2 border-(--border) bg-white text-center text-2xl font-bold outline-none transition-all focus:border-(--brand-primary) focus:ring-2 focus:ring-(--brand-primary)/20"
              />
            ))}
          </div>

          <button
            type="button"
            onClick={handleVerify}
            disabled={verifying || otpCode.length !== 4}
            className={cn(
              'flex items-center gap-2 rounded-xl bg-(--brand-primary) px-8 py-3 text-sm font-semibold text-white transition-all',
              'shadow-lg shadow-violet-300/30 hover:bg-(--brand-primary-dark)',
              'disabled:opacity-40 disabled:shadow-none',
            )}
          >
            {verifying && <Loader2 className="h-4 w-4 animate-spin" />}
            تحقق
          </button>

          <button
            type="button"
            onClick={handleSendOtp}
            disabled={countdown > 0 || sending}
            className="text-sm text-(--muted-foreground) hover:text-(--brand-primary) disabled:opacity-50"
          >
            {countdown > 0
              ? `إعادة الإرسال بعد ${countdown} ثانية`
              : 'إعادة إرسال الرمز'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Step 6: Confirmation ───────────────────────────────

function ConfirmationStep({
  services,
  employeeName,
  date,
  time,
  clientName,
  clientPhone,
  totalPrice,
  totalDuration,
}: {
  services: BookingService[];
  employeeName: string;
  date: string;
  time: string;
  clientName: string;
  clientPhone: string;
  totalPrice: number;
  totalDuration: number;
}) {
  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">تأكيد الحجز</h2>
        <p className="mt-1 text-sm text-(--muted-foreground)">
          تأكدي من جميع التفاصيل قبل إتمام الحجز
        </p>
      </div>

      <div className="space-y-3">
        <SummaryCard title="الخدمات">
          <div className="space-y-2">
            {services.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-(--success)" />
                  <span>{s.nameAr}</span>
                </div>
                <span className="font-semibold">{formatPrice(s.price)}</span>
              </div>
            ))}
          </div>
        </SummaryCard>

        <SummaryCard title="الموظفة">
          <p className="text-sm">{employeeName}</p>
        </SummaryCard>

        <SummaryCard title="الموعد">
          <p className="text-sm">
            {formattedDate} — <span className="font-semibold">{time}</span>
          </p>
        </SummaryCard>

        <SummaryCard title="بيانات العميل">
          <p className="text-sm">{clientName}</p>
          <p className="text-sm text-(--muted-foreground)" dir="ltr">
            {clientPhone}
          </p>
        </SummaryCard>

        <div className="rounded-xl border-2 border-(--brand-primary) bg-violet-50/60 p-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold">الإجمالي التقريبي</span>
            <span className="text-lg font-bold text-(--brand-primary)">
              {formatPrice(totalPrice)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-sm text-(--muted-foreground)">
            <span>المدة المتوقعة</span>
            <span>{formatDuration(totalDuration)}</span>
          </div>
          <p className="mt-2 text-xs text-(--muted-foreground)">
            * المبلغ تقريبي وقد يختلف حسب الخدمات الإضافية
          </p>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-(--border) bg-white p-4">
      <h3 className="mb-2 text-xs font-semibold text-(--muted-foreground)">
        {title}
      </h3>
      {children}
    </div>
  );
}

// ─── Main Page Component ────────────────────────────────

export default function BookingPage(): React.ReactElement {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();

  const [state, setState] = useState<BookingState>({
    step: 1,
    selectedServices: [],
    selectedEmployee: null,
    selectedDate: null,
    selectedTime: null,
    clientName: '',
    clientPhone: '',
    notes: '',
    otpCode: '',
    otpVerified: false,
  });

  const [direction, setDirection] = useState(0);

  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [employees, setEmployees] = useState<BookingEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [svc, emp] = await Promise.all([
          bookingApi.getServices(slug),
          bookingApi.getEmployees(slug),
        ]);
        if (!cancelled) {
          setCategories(svc);
          setEmployees(emp);
        }
      } catch {
        if (!cancelled) toast.error('حدث خطأ في تحميل البيانات');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!state.selectedDate || !state.selectedEmployee) return;

    let cancelled = false;
    async function fetchSlots() {
      setSlotsLoading(true);
      setSlots([]);
      try {
        const data = await bookingApi.getAvailableSlots(slug, {
          date: state.selectedDate!,
          employeeId: state.selectedEmployee!,
          serviceIds: state.selectedServices,
        });
        if (!cancelled) setSlots(data);
      } catch {
        if (!cancelled) toast.error('حدث خطأ في تحميل الأوقات');
      } finally {
        if (!cancelled) setSlotsLoading(false);
      }
    }
    fetchSlots();
    return () => {
      cancelled = true;
    };
  }, [slug, state.selectedDate, state.selectedEmployee, state.selectedServices]);

  const serviceMap = useMemo(() => {
    const map = new Map<string, BookingService>();
    categories.forEach((cat) =>
      cat.services.forEach((s) => map.set(s.id, s)),
    );
    return map;
  }, [categories]);

  const selectedServiceDetails = useMemo(
    () =>
      state.selectedServices
        .map((id) => serviceMap.get(id))
        .filter((s): s is BookingService => Boolean(s)),
    [state.selectedServices, serviceMap],
  );

  const totalPrice = useMemo(
    () => selectedServiceDetails.reduce((sum, s) => sum + s.price, 0),
    [selectedServiceDetails],
  );

  const totalDuration = useMemo(
    () => selectedServiceDetails.reduce((sum, s) => sum + s.duration, 0),
    [selectedServiceDetails],
  );

  const filteredEmployees = useMemo(
    () =>
      employees.filter((emp) =>
        state.selectedServices.every((id) =>
          emp.services.some((s) => s.id === id),
        ),
      ),
    [employees, state.selectedServices],
  );

  const employeeName = useMemo(() => {
    if (state.selectedEmployee === ANY_EMPLOYEE_ID) return 'أي موظفة متاحة';
    return (
      employees.find((e) => e.id === state.selectedEmployee)?.fullName ?? ''
    );
  }, [state.selectedEmployee, employees]);

  const canProceed = useMemo(() => {
    switch (state.step) {
      case 1:
        return state.selectedServices.length > 0;
      case 2:
        return state.selectedEmployee !== null;
      case 3:
        return state.selectedDate !== null && state.selectedTime !== null;
      case 4:
        return (
          state.clientName.trim().length >= 3 &&
          PHONE_REGEX.test(state.clientPhone)
        );
      case 5:
        return state.otpVerified;
      default:
        return true;
    }
  }, [state]);

  const toggleService = useCallback((id: string) => {
    setState((prev) => {
      const has = prev.selectedServices.includes(id);
      const next = has
        ? prev.selectedServices.filter((s) => s !== id)
        : [...prev.selectedServices, id];
      return {
        ...prev,
        selectedServices: next,
        selectedEmployee: null,
        selectedDate: null,
        selectedTime: null,
      };
    });
  }, []);

  const selectEmployee = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      selectedEmployee: id,
      selectedDate: null,
      selectedTime: null,
    }));
  }, []);

  const selectDate = useCallback((dateStr: string) => {
    setState((prev) => ({
      ...prev,
      selectedDate: dateStr,
      selectedTime: null,
    }));
  }, []);

  const selectTime = useCallback((time: string) => {
    setState((prev) => ({ ...prev, selectedTime: time }));
  }, []);

  const handleFieldChange = useCallback(
    (field: 'clientName' | 'clientPhone' | 'notes', value: string) => {
      setState((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const goNext = useCallback(() => {
    if (state.step >= TOTAL_STEPS) return;
    setDirection(1);
    setState((prev) => ({ ...prev, step: prev.step + 1 }));
  }, [state.step]);

  const goBack = useCallback(() => {
    if (state.step <= 1) return;
    setDirection(-1);
    setState((prev) => ({ ...prev, step: prev.step - 1 }));
  }, [state.step]);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const result = await bookingApi.createBooking(slug, {
        clientName: state.clientName.trim(),
        clientPhone: state.clientPhone,
        employeeId: state.selectedEmployee!,
        serviceIds: state.selectedServices,
        date: state.selectedDate!,
        startTime: state.selectedTime!,
        notes: state.notes.trim() || undefined,
      });
      toast.success('تم تأكيد الحجز بنجاح');
      router.push(`/${slug}/confirmation/${result.id}`);
    } catch {
      toast.error('حدث خطأ أثناء تأكيد الحجز، يرجى المحاولة مرة أخرى');
    } finally {
      setSubmitting(false);
    }
  }, [slug, state, submitting, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-(--brand-primary)" />
        <p className="text-sm text-(--muted-foreground)">جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-(--muted) pb-32">
      {/* Sticky progress header */}
      <div className="sticky top-0 z-20 border-b border-(--border) bg-white/80 px-4 pb-4 pt-5 backdrop-blur-md">
        <ProgressBar currentStep={state.step} />
      </div>

      {/* Step content */}
      <div className="relative overflow-hidden px-4 py-6">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={state.step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={slideTransition}
          >
            {state.step === 1 && (
              <ServiceStep
                categories={categories}
                selectedIds={state.selectedServices}
                onToggle={toggleService}
              />
            )}

            {state.step === 2 && (
              <EmployeeStep
                employees={filteredEmployees}
                selectedId={state.selectedEmployee}
                onSelect={selectEmployee}
                selectedServiceIds={state.selectedServices}
              />
            )}

            {state.step === 3 && (
              <DateTimeStep
                selectedDate={state.selectedDate}
                selectedTime={state.selectedTime}
                slots={slots}
                slotsLoading={slotsLoading}
                onDateSelect={selectDate}
                onTimeSelect={selectTime}
                totalPrice={totalPrice}
                totalDuration={totalDuration}
              />
            )}

            {state.step === 4 && (
              <CustomerInfoStep
                clientName={state.clientName}
                clientPhone={state.clientPhone}
                notes={state.notes}
                onChange={handleFieldChange}
              />
            )}

            {state.step === 5 && (
              <OtpStep
                phone={state.clientPhone}
                slug={slug}
                otpCode={state.otpCode}
                otpVerified={state.otpVerified}
                onCodeChange={(code) =>
                  setState((prev) => ({ ...prev, otpCode: code }))
                }
                onVerified={() =>
                  setState((prev) => ({ ...prev, otpVerified: true }))
                }
              />
            )}

            {state.step === 6 && (
              <ConfirmationStep
                services={selectedServiceDetails}
                employeeName={employeeName}
                date={state.selectedDate!}
                time={state.selectedTime!}
                clientName={state.clientName}
                clientPhone={state.clientPhone}
                totalPrice={totalPrice}
                totalDuration={totalDuration}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-(--border) bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-3">
          {state.step > 1 && (
            <button
              type="button"
              onClick={goBack}
              className="flex shrink-0 items-center gap-1 rounded-xl px-4 py-3 text-sm font-medium text-(--muted-foreground) transition-colors hover:bg-(--muted) active:bg-slate-200"
            >
              <ChevronRight className="h-4 w-4" />
              السابق
            </button>
          )}

          {state.selectedServices.length > 0 && (
            <div className="min-w-0 flex-1 text-center text-xs leading-relaxed text-(--muted-foreground)">
              <span className="font-semibold text-(--foreground)">
                {state.selectedServices.length} خدمة
              </span>
              {' · '}
              <span className="font-bold text-(--brand-primary)">
                {formatPrice(totalPrice)}
              </span>
              {' · '}
              <span>{formatDuration(totalDuration)}</span>
            </div>
          )}

          {state.step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={goNext}
              disabled={!canProceed}
              className={cn(
                'shrink-0 rounded-xl bg-(--brand-primary) px-6 py-3 text-sm font-semibold text-white transition-all',
                'shadow-lg shadow-violet-300/30 hover:bg-(--brand-primary-dark)',
                'disabled:opacity-40 disabled:shadow-none',
                state.step === 1 && state.selectedServices.length === 0 && 'ms-auto',
              )}
            >
              التالي
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-xl bg-(--brand-primary) px-6 py-3 text-sm font-semibold text-white transition-all',
                'shadow-lg shadow-violet-300/30 hover:bg-(--brand-primary-dark)',
                'disabled:opacity-60',
              )}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              تأكيد الحجز
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
