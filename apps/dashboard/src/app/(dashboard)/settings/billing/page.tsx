'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Receipt,
  Shield,
  FileCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  Key,
  CircleAlert,
} from 'lucide-react';
import { Button, Spinner, Card, CardHeader, CardTitle, CardContent, Badge, Input, Skeleton } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { dashboardService } from '@/services/dashboard.service';

// ── Schema for tax info form ──
const taxSchema = z.object({
  taxNumber: z.string().optional(),
  commercialRegistration: z.string().optional(),
  street: z.string().optional(),
  district: z.string().optional(),
  buildingNumber: z.string().optional(),
  postalCode: z.string().optional(),
});
type TaxFormData = z.infer<typeof taxSchema>;

interface SalonTaxInfo {
  taxNumber?: string;
  commercialRegistration?: string;
  street?: string;
  district?: string;
  buildingNumber?: string;
  postalCode?: string;
}

const inputClass =
  'w-full px-4 py-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] text-sm focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 outline-none transition-all';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function BillingSettingsPage(): React.ReactElement {
  const router = useRouter();
  const { accessToken } = useAuth();
  const qc = useQueryClient();

  // ── Tax info ──
  const { data: info, isLoading: loadingInfo } = useQuery<SalonTaxInfo>({
    queryKey: ['settings', 'salon'],
    queryFn: () => api.get<SalonTaxInfo>('/salon', accessToken!),
    enabled: !!accessToken,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { isDirty },
  } = useForm<TaxFormData>({ resolver: zodResolver(taxSchema) });

  useEffect(() => {
    if (info) {
      reset({
        taxNumber: info.taxNumber ?? '',
        commercialRegistration: info.commercialRegistration ?? '',
        street: info.street ?? '',
        district: info.district ?? '',
        buildingNumber: info.buildingNumber ?? '',
        postalCode: info.postalCode ?? '',
      });
    }
  }, [info, reset]);

  const taxMut = useMutation({
    mutationFn: (d: TaxFormData) =>
      api.put(
        '/salon',
        {
          taxNumber: d.taxNumber || undefined,
          commercialRegistration: d.commercialRegistration || undefined,
          street: d.street || undefined,
          district: d.district || undefined,
          buildingNumber: d.buildingNumber || undefined,
          postalCode: d.postalCode || undefined,
        },
        accessToken!,
      ),
    onSuccess: () => {
      toast.success('✅ تم حفظ البيانات الضريبية');
      qc.invalidateQueries({ queryKey: ['settings', 'salon'] });
    },
    onError: () => toast.error('خطأ في الحفظ'),
  });

  // Watch fields to compute completeness in realtime as the user types.
  const watched = watch();
  const isTaxComplete = !!(watched.taxNumber && watched.street && watched.district);

  // ── ZATCA certificates (only meaningful once tax info exists) ──
  const { data: certificates, isLoading: loadingCerts } = useQuery({
    queryKey: ['zatca', 'certificates'],
    queryFn: () => dashboardService.getZatcaCertificates(accessToken!),
    enabled: !!accessToken && isTaxComplete,
  });

  const [showOnboard, setShowOnboard] = useState(false);
  const [orgUnit, setOrgUnit] = useState('');
  const [otp, setOtp] = useState('');

  const onboardMut = useMutation({
    mutationFn: () =>
      dashboardService.onboardZatca(
        { otp, organizationUnitName: orgUnit || undefined, isProduction: false },
        accessToken!,
      ),
    onSuccess: () => {
      toast.success('تم التفعيل بنجاح — الفوترة الإلكترونية جاهزة');
      qc.invalidateQueries({ queryKey: ['zatca'] });
      setShowOnboard(false);
      setOrgUnit('');
      setOtp('');
    },
    onError: () => toast.error('فشل التفعيل — تأكدي من رمز التحقق والبيانات الضريبية'),
  });

  const hasActiveCert = certificates?.some((c) => c.isActive);

  if (loadingInfo) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/settings')}
          className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--muted)] transition"
        >
          <ArrowRight className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-black">الفوترة والضرائب</h1>
          <p className="text-xs text-[var(--muted-foreground)]">
            البيانات الضريبية والفوترة الإلكترونية (ZATCA)
          </p>
        </div>
      </div>

      {/* ── Status banner ── */}
      <div
        className={`flex items-center gap-3 rounded-2xl border p-4 ${
          isTaxComplete
            ? 'border-emerald-200 bg-emerald-50'
            : 'border-amber-200 bg-amber-50'
        }`}
      >
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full ${
            isTaxComplete ? 'bg-emerald-100' : 'bg-amber-100'
          }`}
        >
          {isTaxComplete ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          ) : (
            <CircleAlert className="h-5 w-5 text-amber-600" />
          )}
        </div>
        <div>
          <p
            className={`text-sm font-bold ${
              isTaxComplete ? 'text-emerald-800' : 'text-amber-800'
            }`}
          >
            {isTaxComplete ? '✅ البيانات مكتملة' : '⚠️ أكملي البيانات الضريبية'}
          </p>
          <p
            className={`text-xs ${
              isTaxComplete ? 'text-emerald-700' : 'text-amber-700'
            }`}
          >
            {isTaxComplete
              ? 'الرقم الضريبي والعنوان جاهزان للفوترة الإلكترونية'
              : 'الرقم الضريبي + الشارع + الحي مطلوبة على الأقل'}
          </p>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════
          القسم 1: البيانات الضريبية
          ════════════════════════════════════════════════════ */}
      <form onSubmit={handleSubmit((d) => taxMut.mutate(d))} className="space-y-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border)] flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <Receipt className="h-3.5 w-3.5 text-violet-600" />
            </div>
            <span className="text-xs font-bold">البيانات الضريبية</span>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5 block">
                الرقم الضريبي (VAT) *
              </label>
              <input
                {...register('taxNumber')}
                dir="ltr"
                placeholder="300000000000003"
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5 block">
                السجل التجاري
              </label>
              <input
                {...register('commercialRegistration')}
                dir="ltr"
                placeholder="1010000000"
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5 block">
                الشارع *
              </label>
              <input
                {...register('street')}
                placeholder="شارع الملك فهد"
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5 block">
                الحي *
              </label>
              <input
                {...register('district')}
                placeholder="حي العليا"
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5 block">
                رقم المبنى
              </label>
              <input
                {...register('buildingNumber')}
                dir="ltr"
                placeholder="1234"
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[var(--muted-foreground)] mb-1.5 block">
                الرمز البريدي
              </label>
              <input
                {...register('postalCode')}
                dir="ltr"
                placeholder="12345"
                className={inputClass}
              />
            </div>
          </div>
          <div className="px-5 pb-4">
            <p className="text-[10px] text-[var(--muted-foreground)]">
              💡 هذه البيانات تظهر في كل فاتورة وهي مطلوبة لتفعيل الفوترة الإلكترونية.
            </p>
          </div>
        </div>

        <Button type="submit" disabled={taxMut.isPending || !isDirty} className="w-full py-3">
          {taxMut.isPending ? 'جارٍ الحفظ...' : '💾 حفظ البيانات الضريبية'}
        </Button>
      </form>

      {/* ════════════════════════════════════════════════════
          القسم 2: تفعيل الفوترة الإلكترونية
          ════════════════════════════════════════════════════ */}
      {!isTaxComplete ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center text-[var(--muted-foreground)]">
          <Shield className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-bold">تفعيل الفوترة الإلكترونية</p>
          <p className="text-xs mt-1">سيظهر هذا القسم بعد إكمال البيانات الضريبية أعلاه</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Status row */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card
                className={
                  hasActiveCert
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-amber-200 bg-amber-50'
                }
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      hasActiveCert ? 'bg-emerald-100' : 'bg-amber-100'
                    }`}
                  >
                    <Shield
                      className={`h-5 w-5 ${
                        hasActiveCert ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    />
                  </div>
                  <div>
                    <p
                      className={`text-sm font-bold ${
                        hasActiveCert ? 'text-emerald-800' : 'text-amber-800'
                      }`}
                    >
                      {hasActiveCert ? 'مفعّل' : 'غير مفعّل'}
                    </p>
                    <p
                      className={`text-xs ${
                        hasActiveCert ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {hasActiveCert ? 'الفوترة الإلكترونية نشطة' : 'يحتاج تفعيل'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100">
                    <Key className="h-5 w-5 text-[var(--brand-primary)]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{certificates?.length || 0}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">شهادة</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setShowOnboard(true)}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                    <FileCheck className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-blue-600">تفعيل جديد</p>
                    <p className="text-xs text-[var(--muted-foreground)]">إضافة شهادة</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Onboarding form */}
          {showOnboard && (
            <Card>
              <CardHeader>
                <CardTitle>تفعيل الفوترة الإلكترونية</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-w-md space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-bold">
                      رمز التحقق من بوابة فاتورة *
                    </label>
                    <Input
                      placeholder="أدخلي رمز التحقق (6 أرقام)"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      dir="ltr"
                      maxLength={10}
                      className="text-center text-lg font-mono tracking-widest"
                    />
                    <a
                      href="https://fatoora.zatca.gov.sa"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block text-xs text-blue-600 hover:underline"
                    >
                      🔗 احصلي على الرمز من fatoora.zatca.gov.sa
                    </a>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium">
                      اسم الفرع (اختياري)
                    </label>
                    <Input
                      placeholder="مثال: الفرع الرئيسي"
                      value={orgUnit}
                      onChange={(e) => setOrgUnit(e.target.value)}
                    />
                  </div>

                  <div className="rounded-xl bg-[var(--muted)] p-3 text-sm text-[var(--muted-foreground)]">
                    <p className="flex items-center gap-2 mb-2 font-bold">
                      <AlertCircle className="h-4 w-4" />
                      خطوات التفعيل
                    </p>
                    <ol className="list-decimal list-inside space-y-1 text-xs">
                      <li>
                        ادخلي على{' '}
                        <a
                          href="https://fatoora.zatca.gov.sa"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 underline"
                        >
                          fatoora.zatca.gov.sa
                        </a>{' '}
                        واطلبي رمز التحقق
                      </li>
                      <li>الصقي الرمز هنا</li>
                      <li>تم التفعيل! ✅</li>
                    </ol>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => onboardMut.mutate()}
                      disabled={onboardMut.isPending || otp.length < 4}
                    >
                      {onboardMut.isPending ? 'جارٍ التفعيل...' : '🔐 تفعيل'}
                    </Button>
                    <Button variant="outline" onClick={() => setShowOnboard(false)}>
                      إلغاء
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Certificates list */}
          {loadingCerts ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : certificates && certificates.length > 0 ? (
            <div>
              <h2 className="text-sm font-bold mb-3 text-[var(--foreground)]">الشهادات</h2>
              <div className="space-y-2">
                {certificates.map((cert, i) => (
                  <motion.div
                    key={cert.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                                cert.isActive ? 'bg-emerald-100' : 'bg-gray-100'
                              }`}
                            >
                              <Key
                                className={`h-5 w-5 ${
                                  cert.isActive ? 'text-emerald-600' : 'text-gray-400'
                                }`}
                              />
                            </div>
                            <div>
                              <h3 className="font-medium text-sm text-[var(--foreground)]">
                                شهادة #{cert.id.slice(0, 8)}
                              </h3>
                              <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                                <span>{formatDate(cert.createdAt)}</span>
                                <span>·</span>
                                <span>{cert.isProduction ? 'إنتاج' : 'بيئة تجريبية'}</span>
                              </div>
                            </div>
                          </div>
                          <Badge variant={cert.isActive ? 'success' : 'secondary'}>
                            {cert.isActive ? 'نشطة' : 'غير نشطة'}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Compliance card */}
          <Card>
            <CardHeader>
              <CardTitle>متطلبات الامتثال</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  { title: 'UBL 2.1 XML', desc: 'تنسيق الفاتورة الإلكتروني المعتمد', done: true },
                  { title: 'التوقيع الرقمي', desc: 'ECDSA-SHA256 للفواتير', done: true },
                  { title: 'رمز QR', desc: 'يحتوي بيانات البائع والضريبة', done: true },
                  { title: 'الربط مع الهيئة', desc: 'بيئة تجريبية / إنتاج', done: false },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="flex items-start gap-3 rounded-xl border border-[var(--border)] p-3"
                  >
                    {item.done ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <Clock className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-medium text-sm">{item.title}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
