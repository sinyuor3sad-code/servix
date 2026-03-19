'use client';

import { useQuery } from '@tanstack/react-query';
import {
  CreditCard,
  Calendar,
  Users,
  CheckCircle2,
  XCircle,
  ArrowUpCircle,
} from 'lucide-react';
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Skeleton,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

interface SubscriptionData {
  plan: {
    name: string;
    nameAr: string;
    price: number;
    billingCycle: 'monthly' | 'yearly';
  };
  renewalDate: string;
  status: 'active' | 'trial' | 'expired';
  usage: {
    employees: { used: number; limit: number | null };
    clients: { used: number; limit: number | null };
  };
}

interface PlanComparison {
  feature: string;
  basic: string | boolean;
  pro: string | boolean;
  premium: string | boolean;
}

const plans: PlanComparison[] = [
  { feature: 'إدارة الخدمات', basic: true, pro: true, premium: true },
  { feature: 'إدارة العملاء', basic: '100 عميل', pro: 'غير محدود', premium: 'غير محدود' },
  { feature: 'المواعيد', basic: true, pro: true, premium: true },
  { feature: 'نقاط البيع', basic: true, pro: true, premium: true },
  { feature: 'الفواتير', basic: true, pro: true, premium: true },
  { feature: 'الموظفات', basic: '3', pro: '10', premium: 'غير محدود' },
  { feature: 'التقارير الأساسية', basic: true, pro: true, premium: true },
  { feature: 'صفحة الحجز الإلكتروني', basic: false, pro: true, premium: true },
  { feature: 'التقارير المتقدمة', basic: false, pro: true, premium: true },
  { feature: 'الصلاحيات التفصيلية', basic: false, pro: true, premium: true },
  { feature: 'الكوبونات', basic: false, pro: false, premium: true },
  { feature: 'نظام الولاء', basic: false, pro: false, premium: true },
  { feature: 'واتساب', basic: false, pro: false, premium: true },
  { feature: 'تعدد الفروع', basic: false, pro: false, premium: true },
];

const planPrices: Record<string, { nameAr: string; price: number }> = {
  basic: { nameAr: 'أساسي', price: 199 },
  pro: { nameAr: 'احترافي', price: 399 },
  premium: { nameAr: 'مميز', price: 699 },
};

function formatCurrency(value: number): string {
  return `${value.toLocaleString('ar-SA')} ر.س`;
}

function FeatureCell({ value }: { value: string | boolean }): React.ReactElement {
  if (typeof value === 'boolean') {
    return value ? (
      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
    ) : (
      <XCircle className="h-5 w-5 text-[var(--muted-foreground)]" />
    );
  }
  return <span className="text-sm font-medium">{value}</span>;
}

const placeholderData: SubscriptionData = {
  plan: { name: 'pro', nameAr: 'احترافي', price: 399, billingCycle: 'monthly' },
  renewalDate: '2026-04-18',
  status: 'active',
  usage: {
    employees: { used: 5, limit: 10 },
    clients: { used: 187, limit: null },
  },
};

export default function SubscriptionPage(): React.ReactElement {
  const { accessToken } = useAuth();

  const { data, isLoading } = useQuery<SubscriptionData>({
    queryKey: ['settings', 'subscription'],
    queryFn: async () => {
      const sub = await api.get<{
        plan: { name: string; nameAr: string; priceMonthly: unknown; priceYearly: unknown };
        status: string;
        billingCycle: string;
        currentPeriodEnd: string;
      }>('/subscriptions/current', accessToken!);
      const price = Number(sub.billingCycle === 'yearly' ? sub.plan.priceYearly : sub.plan.priceMonthly);
      return {
        plan: {
          name: sub.plan.name,
          nameAr: sub.plan.nameAr,
          price,
          billingCycle: sub.billingCycle as 'monthly' | 'yearly',
        },
        renewalDate: sub.currentPeriodEnd,
        status: sub.status as 'active' | 'trial' | 'expired',
        usage: { employees: { used: 0, limit: null }, clients: { used: 0, limit: null } },
      };
    },
    enabled: !!accessToken,
  });

  const subscription = data ?? placeholderData;

  const statusConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' }> = {
    active: { label: 'نشط', variant: 'success' },
    trial: { label: 'تجريبي', variant: 'warning' },
    expired: { label: 'منتهي', variant: 'destructive' },
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const statusInfo = statusConfig[subscription.status] ?? statusConfig.active;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader title="الاشتراك" description="إدارة خطة الاشتراك" />

      <div className="mx-auto max-w-4xl space-y-6">
        {/* Current Plan */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              الخطة الحالية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-2xl font-bold text-[var(--foreground)]">
                    {subscription.plan.nameAr}
                  </h3>
                  <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                </div>
                <p className="text-lg text-[var(--brand-primary)]">
                  {formatCurrency(subscription.plan.price)}
                  <span className="text-sm text-[var(--muted-foreground)]">
                    {' '}/ {subscription.plan.billingCycle === 'monthly' ? 'شهرياً' : 'سنوياً'}
                  </span>
                </p>
                <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                  <Calendar className="h-4 w-4" />
                  تاريخ التجديد:{' '}
                  {new Intl.DateTimeFormat('ar-SA', { dateStyle: 'long' }).format(
                    new Date(subscription.renewalDate),
                  )}
                </div>
              </div>
              <Button className="gap-2">
                <ArrowUpCircle className="h-4 w-4" />
                ترقية الخطة
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Usage Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              الاستخدام
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-[var(--border)] p-4">
                <p className="text-sm text-[var(--muted-foreground)]">الموظفات</p>
                <p className="mt-1 text-lg font-bold">
                  {subscription.usage.employees.used}
                  {subscription.usage.employees.limit !== null && (
                    <span className="text-sm font-normal text-[var(--muted-foreground)]">
                      {' '}/ {subscription.usage.employees.limit}
                    </span>
                  )}
                </p>
                {subscription.usage.employees.limit !== null && (
                  <div className="mt-2 h-2 rounded-full bg-[var(--muted)]">
                    <div
                      className="h-2 rounded-full bg-[var(--brand-primary)] transition-all"
                      style={{
                        width: `${Math.min(
                          (subscription.usage.employees.used / subscription.usage.employees.limit) * 100,
                          100,
                        )}%`,
                      }}
                    />
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-[var(--border)] p-4">
                <p className="text-sm text-[var(--muted-foreground)]">العملاء</p>
                <p className="mt-1 text-lg font-bold">
                  {subscription.usage.clients.used}
                  {subscription.usage.clients.limit !== null ? (
                    <span className="text-sm font-normal text-[var(--muted-foreground)]">
                      {' '}/ {subscription.usage.clients.limit}
                    </span>
                  ) : (
                    <span className="text-sm font-normal text-[var(--muted-foreground)]">
                      {' '}(غير محدود)
                    </span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Plans Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>مقارنة الخطط</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الميزة</TableHead>
                    <TableHead className="text-center">
                      <div>{planPrices.basic.nameAr}</div>
                      <div className="text-xs font-normal">{formatCurrency(planPrices.basic.price)}/شهر</div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div>{planPrices.pro.nameAr}</div>
                      <div className="text-xs font-normal">{formatCurrency(planPrices.pro.price)}/شهر</div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div>{planPrices.premium.nameAr}</div>
                      <div className="text-xs font-normal">{formatCurrency(planPrices.premium.price)}/شهر</div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((plan) => (
                    <TableRow key={plan.feature}>
                      <TableCell className="font-medium">{plan.feature}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center">
                          <FeatureCell value={plan.basic} />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center">
                          <FeatureCell value={plan.pro} />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center">
                          <FeatureCell value={plan.premium} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
