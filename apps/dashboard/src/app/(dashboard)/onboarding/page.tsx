'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Sparkles,
  Clock,
  Scissors,
  Users,
  PartyPopper,
  ChevronLeft,
  ChevronRight,
  Upload,
  Share2,
  Copy,
  ExternalLink,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Input,
  Textarea,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { settingsService } from '@/services/settings.service';
import { dashboardService } from '@/services/dashboard.service';

// ─── Step 1: Salon Info ───
const step1Schema = z.object({
  salonNameAr: z.string().min(2, 'اسم الصالون بالعربية مطلوب'),
  salonNameEn: z.string().optional(),
  city: z.string().optional(),
  phone: z
    .string()
    .min(10, 'رقم الجوال يجب أن يكون 10 أرقام على الأقل')
    .regex(/^[0-9+]+$/, 'رقم جوال غير صالح'),
  logoUrl: z.string().optional(),
});

// ─── Step 2: Working Hours ───
const dayNames: Record<number, string> = {
  0: 'السبت',
  1: 'الأحد',
  2: 'الإثنين',
  3: 'الثلاثاء',
  4: 'الأربعاء',
  5: 'الخميس',
  6: 'الجمعة',
};

interface DaySchedule {
  dayOfWeek: number;
  nameAr: string;
  isOpen: boolean;
  startTime: string;
  endTime: string;
}

const defaultSchedule: DaySchedule[] = Array.from({ length: 7 }, (_, i) => ({
  dayOfWeek: i,
  nameAr: dayNames[i],
  isOpen: i !== 6,
  startTime: '09:00',
  endTime: '21:00',
}));

// ─── Step 3: Services template (صالون نسائي) ───
const defaultServices = [
  { nameAr: 'قص وتصفيف', nameEn: 'Cut & Style', price: 80, duration: 60 },
  { nameAr: 'صبغ كامل', nameEn: 'Full Color', price: 150, duration: 90 },
  { nameAr: 'تسريحة عروس', nameEn: 'Bridal', price: 500, duration: 180 },
  { nameAr: 'مانيكير', nameEn: 'Manicure', price: 50, duration: 45 },
  { nameAr: 'بديكير', nameEn: 'Pedicure', price: 70, duration: 60 },
  { nameAr: 'عناية بالبشرة', nameEn: 'Facial', price: 120, duration: 60 },
];

// ─── Step 4: Employee ───
const employeeSchema = z.object({
  fullName: z.string().min(2, 'الاسم مطلوب'),
  phone: z.string().min(10, 'رقم الجوال مطلوب').regex(/^[0-9+]+$/, 'رقم غير صالح'),
  role: z.enum(['stylist', 'cashier', 'makeup', 'nails', 'skincare']),
});

type Step1Data = z.infer<typeof step1Schema>;
type EmployeeData = z.infer<typeof employeeSchema>;

const STEPS = [
  { id: 1, title: 'مرحباً! خلنا نجهّز صالونك', icon: Sparkles },
  { id: 2, title: 'أوقات العمل', icon: Clock },
  { id: 3, title: 'أضف خدماتك', icon: Scissors },
  { id: 4, title: 'أضف موظفاتك', icon: Users },
  { id: 5, title: 'صالونك جاهز! 🎉', icon: PartyPopper },
];

export default function OnboardingPage(): React.ReactElement {
  const router = useRouter();
  const { accessToken, currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [schedule, setSchedule] = useState<DaySchedule[]>(defaultSchedule);
  const [services, setServices] = useState(defaultServices);
  const [employees, setEmployees] = useState<EmployeeData[]>([]);

  const step1Form = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: { salonNameAr: '', salonNameEn: '', city: '', phone: '', logoUrl: '' },
  });

  const employeeForm = useForm<EmployeeData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: { fullName: '', phone: '', role: 'stylist' },
  });

  const { data: salonData } = useQuery({
    queryKey: ['salon'],
    queryFn: () => api.get<Record<string, unknown>>('/salon', accessToken!),
    enabled: !!accessToken && step >= 1,
  });

  // Auto-skip step 1 if salon name already exists from registration
  useEffect(() => {
    if (salonData && step === 1) {
      const d = salonData as Record<string, unknown>;
      const existingName = (d.nameAr as string) ?? '';
      if (existingName.length >= 2) {
        // Data already filled from registration — skip to step 2
        setStep(2);
        toast.success('تم تحميل بيانات صالونك تلقائياً');
      } else {
        step1Form.reset({
          salonNameAr: existingName,
          salonNameEn: (d.nameEn as string) ?? '',
          city: (d.city as string) ?? '',
          phone: (d.phone as string) ?? '',
          logoUrl: (d.branding as { logoUrl?: string })?.logoUrl ?? '',
        });
      }
    }
  }, [salonData, step]);

  const saveStep1 = useMutation({
    mutationFn: (data: Step1Data) =>
      api.put('/salon', {
        nameAr: data.salonNameAr,
        nameEn: data.salonNameEn || undefined,
        city: data.city || undefined,
        phone: data.phone,
      }, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salon'] });
      setStep(2);
    },
    onError: () => toast.error('حدث خطأ أثناء الحفظ'),
  });

  const saveStep2 = useMutation({
    mutationFn: () => {
      const workingDays: Record<string, unknown> = {};
      schedule.forEach((d) => {
        workingDays[String(d.dayOfWeek)] = {
          isOpen: d.isOpen,
          startTime: d.startTime,
          endTime: d.endTime,
        };
      });
      return api.put('/salon/working-hours', { workingDays }, accessToken!);
    },
    onSuccess: () => setStep(3),
    onError: () => toast.error('حدث خطأ أثناء حفظ ساعات العمل'),
  });

  const saveStep3 = useMutation({
    mutationFn: async () => {
      const cats = await api.get<{ id: string }[]>('/services/categories', accessToken!);
      let categoryId = cats?.[0]?.id;
      if (!categoryId) {
        const cat = await api.post<{ id: string }>('/services/categories', { nameAr: 'خدمات عامة', nameEn: 'General' }, accessToken!);
        categoryId = cat.id;
      }
      for (const s of services) {
        await api.post('/services', {
          categoryId,
          nameAr: s.nameAr,
          nameEn: s.nameEn,
          price: s.price,
          duration: s.duration,
        }, accessToken!);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setStep(4);
    },
    onError: () => toast.error('حدث خطأ أثناء إضافة الخدمات'),
  });

  const saveStep4 = useMutation({
    mutationFn: async () => {
      for (const emp of employees) {
        await dashboardService.createEmployee(
          { fullName: emp.fullName, phone: emp.phone, role: emp.role, commissionType: 'none', commissionValue: 0 },
          accessToken!,
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setStep(5);
    },
    onError: () => toast.error('حدث خطأ أثناء إضافة الموظفات'),
  });

  const completeOnboarding = useMutation({
    mutationFn: () =>
      settingsService.updateOne(accessToken!, 'onboarding_completed', 'true'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('تم إعداد صالونك بنجاح!');
      router.push('/');
    },
    onError: () => toast.error('حدث خطأ'),
  });

  const handleNext = useCallback(() => {
    if (step === 1) {
      step1Form.handleSubmit((d) => saveStep1.mutate(d))();
    } else if (step === 2) {
      saveStep2.mutate();
    } else if (step === 3) {
      if (services.length < 1) {
        toast.error('أضف خدمة واحدة على الأقل');
        return;
      }
      saveStep3.mutate();
    } else if (step === 4) {
      if (employees.length < 1) {
        toast.error('أضف موظفة واحدة على الأقل');
        return;
      }
      saveStep4.mutate();
    } else if (step === 5) {
      completeOnboarding.mutate();
    }
  }, [step, step1Form, services, employees, saveStep1, saveStep2, saveStep3, saveStep4, completeOnboarding]);

  const handleSkip = useCallback(() => {
    if (step < 5) setStep((s) => s + 1);
  }, [step]);

  const handleAddEmployee = useCallback(() => {
    employeeForm.handleSubmit((d) => {
      setEmployees((prev) => [...prev, d]);
      employeeForm.reset({ fullName: '', phone: '', role: 'stylist' });
    })();
  }, [employeeForm]);

  const bookingBase = typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_BOOKING_URL || window.location.origin)
    : '';
  const bookingUrl = currentTenant?.slug ? `${bookingBase}/${currentTenant.slug}/book` : '';

  const copyBookingLink = useCallback(() => {
    if (bookingUrl) {
      navigator.clipboard.writeText(bookingUrl);
      toast.success('تم نسخ رابط الحجز');
    }
  }, [bookingUrl]);

  const isPending =
    saveStep1.isPending ||
    saveStep2.isPending ||
    saveStep3.isPending ||
    saveStep4.isPending ||
    completeOnboarding.isPending;

  return (
    <div className="min-h-screen bg-[var(--muted)]/20 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold transition-colors ${
                step >= s.id ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--muted)] text-[var(--muted-foreground)]'
              }`}
            >
              {step > s.id ? '✓' : s.id}
            </div>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {(() => {
                const S = STEPS.find((s) => s.id === step);
                return S ? <S.icon className="h-6 w-6" /> : null;
              })()}
              {STEPS.find((s) => s.id === step)?.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1 */}
            {step === 1 && (
              <form className="space-y-4" onSubmit={step1Form.handleSubmit((d) => saveStep1.mutate(d))}>
                <Input
                  label="اسم الصالون (عربي)"
                  placeholder="صالون الأناقة"
                  error={step1Form.formState.errors.salonNameAr?.message}
                  {...step1Form.register('salonNameAr')}
                />
                <Input
                  label="اسم الصالون (إنجليزي) — اختياري"
                  placeholder="Elegance Salon"
                  {...step1Form.register('salonNameEn')}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="المدينة" placeholder="الرياض" {...step1Form.register('city')} />
                  <Input
                    label="رقم الجوال"
                    placeholder="05XXXXXXXX"
                    error={step1Form.formState.errors.phone?.message}
                    {...step1Form.register('phone')}
                  />
                </div>
                <p className="text-sm text-[var(--muted-foreground)]">
                  يمكنك رفع الشعار لاحقاً من الإعدادات
                </p>
              </form>
            )}

            {/* Step 2 */}
            {step === 2 && (
              <div className="space-y-3">
                {schedule.map((day, i) => (
                  <div
                    key={day.dayOfWeek}
                    className="flex flex-col gap-2 rounded-lg border border-[var(--border)] p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setSchedule((prev) =>
                            prev.map((d, j) => (j === i ? { ...d, isOpen: !d.isOpen } : d)),
                          )
                        }
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
                      <span className="min-w-20 font-medium">{day.nameAr}</span>
                    </div>
                    {day.isOpen && (
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={day.startTime}
                          onChange={(e) =>
                            setSchedule((prev) =>
                              prev.map((d, j) => (j === i ? { ...d, startTime: e.target.value } : d)),
                            )
                          }
                          className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm"
                        />
                        <span>—</span>
                        <input
                          type="time"
                          value={day.endTime}
                          onChange={(e) =>
                            setSchedule((prev) =>
                              prev.map((d, j) => (j === i ? { ...d, endTime: e.target.value } : d)),
                            )
                          }
                          className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Step 3 */}
            {step === 3 && (
              <div className="space-y-4">
                <p className="text-sm text-[var(--muted-foreground)]">
                  يمكنك تعديل الأسماء والأسعار والمدد قبل المتابعة
                </p>
                {services.map((s, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="col-span-2 sm:col-span-1">
                      <input
                        type="text"
                        value={s.nameAr}
                        onChange={(e) =>
                          setServices((prev) =>
                            prev.map((sv, j) => (j === i ? { ...sv, nameAr: e.target.value } : sv)),
                          )
                        }
                        className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                        placeholder="اسم الخدمة"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        value={s.price}
                        onChange={(e) =>
                          setServices((prev) =>
                            prev.map((sv, j) => (j === i ? { ...sv, price: Number(e.target.value) } : sv)),
                          )
                        }
                        className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                        placeholder="السعر"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        value={s.duration}
                        onChange={(e) =>
                          setServices((prev) =>
                            prev.map((sv, j) => (j === i ? { ...sv, duration: Number(e.target.value) } : sv)),
                          )
                        }
                        className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                        placeholder="دقيقة"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Step 4 */}
            {step === 4 && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {employees.map((e, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-full bg-[var(--primary-50)] px-3 py-1 text-sm"
                    >
                      {e.fullName}
                      <button
                        type="button"
                        onClick={() => setEmployees((prev) => prev.filter((_, j) => j !== i))}
                        className="text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Input
                    label="الاسم"
                    placeholder="اسم الموظفة"
                    error={employeeForm.formState.errors.fullName?.message}
                    {...employeeForm.register('fullName')}
                  />
                  <Input
                    label="الجوال"
                    placeholder="05XXXXXXXX"
                    error={employeeForm.formState.errors.phone?.message}
                    {...employeeForm.register('phone')}
                  />
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">الدور</label>
                    <select
                      {...employeeForm.register('role')}
                      className="rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                    >
                      <option value="stylist">✂️ مصففة</option>
                      <option value="makeup">💄 مكياج</option>
                      <option value="nails">💅 أظافر</option>
                      <option value="skincare">🧴 عناية بالبشرة</option>
                      <option value="cashier">💵 كاشيرة</option>
                    </select>
                  </div>
                </div>
                <Button type="button" variant="outline" onClick={handleAddEmployee}>
                  إضافة موظفة
                </Button>
              </div>
            )}

            {/* Step 5 */}
            {step === 5 && (
              <div className="space-y-6">
                <p className="text-[var(--muted-foreground)]">
                  صالونك جاهز! يمكنك إضافة أول موعد أو مشاركة رابط الحجز مع عملائك.
                </p>
                {bookingUrl && (
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 p-4">
                    <p className="mb-2 text-sm font-medium">رابط الحجز الإلكتروني</p>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={bookingUrl}
                        className="flex-1 rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                      />
                      <Button variant="outline" size="sm" onClick={copyBookingLink}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => router.push('/appointments/new')}
                  >
                    <ExternalLink className="h-4 w-4" />
                    أضف أول موعد
                  </Button>
                  <Button variant="outline" onClick={copyBookingLink}>
                    <Share2 className="h-4 w-4" />
                    شارك رابط الحجز
                  </Button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4">
              <div>
                {step < 5 && (
                  <Button variant="ghost" onClick={handleSkip} className="text-[var(--muted-foreground)]">
                    تخطي
                  </Button>
                )}
              </div>
              <Button onClick={handleNext} disabled={isPending}>
                {isPending ? 'جارٍ الحفظ...' : step === 5 ? 'ابدأ الآن' : 'التالي'}
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
