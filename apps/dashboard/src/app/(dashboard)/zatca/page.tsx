'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import {
  Receipt,
  Shield,
  FileCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Key,
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
  Input,
  Skeleton,
  EmptyState,
} from '@/components/ui';

const submissionStatusConfig: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' | 'secondary'; icon: typeof Clock }> = {
  pending: { label: 'قيد الانتظار', variant: 'warning', icon: Clock },
  reported: { label: 'تم الإبلاغ', variant: 'success', icon: FileCheck },
  cleared: { label: 'تم التصفية', variant: 'success', icon: CheckCircle2 },
  rejected: { label: 'مرفوض', variant: 'destructive', icon: XCircle },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ar-SA', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function ZatcaPage(): React.ReactElement {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [showOnboard, setShowOnboard] = useState(false);
  const [orgUnit, setOrgUnit] = useState('');

  const { data: certificates, isLoading } = useQuery({
    queryKey: ['zatca', 'certificates'],
    queryFn: () => dashboardService.getZatcaCertificates(accessToken!),
    enabled: !!accessToken,
  });

  const onboardMutation = useMutation({
    mutationFn: () => dashboardService.onboardZatca(
      { organizationUnitName: orgUnit || undefined, isProduction: false },
      accessToken!,
    ),
    onSuccess: () => {
      toast.success('تم إنشاء الشهادة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['zatca'] });
      setShowOnboard(false);
      setOrgUnit('');
    },
    onError: () => toast.error('فشل إنشاء الشهادة'),
  });

  const hasActiveCert = certificates?.some(c => c.isActive);

  return (
    <div className="space-y-6">
      <PageHeader
        title="الفوترة الإلكترونية ZATCA"
        description="إدارة شهادات الفوترة والامتثال لهيئة الزكاة والضريبة"
      />

      {/* Status Card */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className={hasActiveCert ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${hasActiveCert ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                <Shield className={`h-6 w-6 ${hasActiveCert ? 'text-emerald-600' : 'text-amber-600'}`} />
              </div>
              <div>
                <p className={`font-semibold ${hasActiveCert ? 'text-emerald-800' : 'text-amber-800'}`}>
                  {hasActiveCert ? 'مُفعّل' : 'غير مُفعّل'}
                </p>
                <p className={`text-sm ${hasActiveCert ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {hasActiveCert ? 'الشهادة نشطة ومتصلة' : 'تحتاج تفعيل الشهادة'}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-100">
                <Key className="h-6 w-6 text-[var(--brand-primary)]" />
              </div>
              <div>
                <p className="font-semibold text-[var(--foreground)]">{certificates?.length || 0}</p>
                <p className="text-sm text-[var(--muted-foreground)]">شهادة</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowOnboard(true)}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                <FileCheck className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-blue-600">تسجيل شهادة</p>
                <p className="text-sm text-[var(--muted-foreground)]">إنشاء CSR جديد</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Onboarding Form */}
      {showOnboard && (
        <Card>
          <CardHeader>
            <CardTitle>تسجيل شهادة ZATCA جديدة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-w-md space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">اسم الوحدة التنظيمية (اختياري)</label>
                <Input
                  placeholder="مثال: الفرع الرئيسي"
                  value={orgUnit}
                  onChange={(e) => setOrgUnit(e.target.value)}
                />
              </div>
              <div className="rounded-xl bg-[var(--muted)] p-3 text-sm text-[var(--muted-foreground)]">
                <p className="flex items-center gap-2 mb-1">
                  <AlertCircle className="h-4 w-4" />
                  ملاحظة مهمة
                </p>
                <p>سيتم إنشاء مفتاح ECDSA P-256 وتوليد CSR. في البيئة التجريبية (Sandbox) يتم حفظ الشهادة محلياً.</p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => onboardMutation.mutate()}
                  disabled={onboardMutation.isPending}
                >
                  {onboardMutation.isPending ? 'جاري الإنشاء...' : 'إنشاء الشهادة'}
                </Button>
                <Button variant="outline" onClick={() => setShowOnboard(false)}>إلغاء</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Certificates List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : !certificates || certificates.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="لا توجد شهادات"
          description="سجّل أول شهادة ZATCA لبدء الفوترة الإلكترونية"
          actionLabel="تسجيل شهادة"
          onAction={() => setShowOnboard(true)}
        />
      ) : (
        <div>
          <h2 className="text-lg font-semibold mb-4 text-[var(--foreground)]">الشهادات</h2>
          <div className="space-y-3">
            {certificates.map((cert, i) => (
              <motion.div
                key={cert.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${cert.isActive ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                          <Key className={`h-5 w-5 ${cert.isActive ? 'text-emerald-600' : 'text-gray-400'}`} />
                        </div>
                        <div>
                          <h3 className="font-medium text-[var(--foreground)]">
                            شهادة #{cert.id.slice(0, 8)}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                            <span>{formatDate(cert.createdAt)}</span>
                            <span>·</span>
                            <span>{cert.isProduction ? 'إنتاج' : 'تجريبي (Sandbox)'}</span>
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
      )}

      {/* ZATCA Compliance Info */}
      <Card>
        <CardHeader>
          <CardTitle>متطلبات الامتثال</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              { title: 'UBL 2.1 XML', desc: 'تنسيق الفاتورة الإلكتروني المعتمد', done: true },
              { title: 'ECDSA-SHA256 Signing', desc: 'التوقيع الرقمي للفواتير', done: true },
              { title: 'TLV QR Code', desc: 'رمز QR يحتوي بيانات البائع والضريبة', done: true },
              { title: 'Sandbox API', desc: 'الربط مع بيئة الاختبار', done: false },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3 rounded-xl border border-[var(--border)] p-3">
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
  );
}
