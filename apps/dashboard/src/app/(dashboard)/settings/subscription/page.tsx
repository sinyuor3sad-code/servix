'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CreditCard, Calendar, Users, CheckCircle2, XCircle, ArrowUpCircle, Crown, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Spinner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

interface SubscriptionData {
  plan: { name: string; nameAr: string; price: number; billingCycle: 'monthly' | 'yearly'; };
  renewalDate: string; status: 'active' | 'trial' | 'expired';
  usage: { employees: { used: number; limit: number | null }; clients: { used: number; limit: number | null }; };
}

const FEATURES = [
  { f: 'إدارة الخدمات', basic: true, pro: true, premium: true },
  { f: 'إدارة العملاء', basic: '100', pro: '∞', premium: '∞' },
  { f: 'المواعيد والحجوزات', basic: true, pro: true, premium: true },
  { f: 'نقاط البيع والفواتير', basic: true, pro: true, premium: true },
  { f: 'الموظفات', basic: '3', pro: '10', premium: '∞' },
  { f: 'التقارير الأساسية', basic: true, pro: true, premium: true },
  { f: 'الحجز الإلكتروني', basic: false, pro: true, premium: true },
  { f: 'التقارير المتقدمة', basic: false, pro: true, premium: true },
  { f: 'صلاحيات تفصيلية', basic: false, pro: true, premium: true },
  { f: 'الكوبونات', basic: false, pro: false, premium: true },
  { f: 'نظام الولاء', basic: false, pro: false, premium: true },
  { f: 'واتساب', basic: false, pro: false, premium: true },
  { f: 'تعدد الفروع', basic: false, pro: false, premium: true },
];

const PLANS = [
  { key: 'basic', nameAr: 'أساسي', price: 199, gradient: 'from-slate-500 to-gray-600', desc: 'للصالونات الصغيرة' },
  { key: 'pro', nameAr: 'احترافي', price: 399, gradient: 'from-violet-500 to-purple-600', desc: 'للصالونات المتوسطة', popular: true },
  { key: 'premium', nameAr: 'مميز', price: 699, gradient: 'from-amber-500 to-orange-600', desc: 'للصالونات الكبيرة' },
];

const placeholder: SubscriptionData = {
  plan: { name: 'pro', nameAr: 'احترافي', price: 399, billingCycle: 'monthly' },
  renewalDate: '2026-04-18', status: 'active',
  usage: { employees: { used: 5, limit: 10 }, clients: { used: 187, limit: null } },
};

function Feat({ v }: { v: string | boolean }) {
  if (typeof v === 'boolean') return v ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-[var(--muted-foreground)]/30" />;
  return <span className="text-xs font-black">{v}</span>;
}

export default function SubscriptionPage() {
  const router = useRouter();
  const { accessToken } = useAuth();

  const { data, isLoading } = useQuery<SubscriptionData>({
    queryKey: ['settings', 'subscription'],
    queryFn: async () => {
      const sub = await api.get<any>('/subscriptions/current', accessToken!);
      const price = Number(sub.billingCycle === 'yearly' ? sub.plan.priceYearly : sub.plan.priceMonthly);
      return { plan: { name: sub.plan.name, nameAr: sub.plan.nameAr, price, billingCycle: sub.billingCycle }, renewalDate: sub.currentPeriodEnd, status: sub.status, usage: { employees: { used: 0, limit: null }, clients: { used: 0, limit: null } } };
    },
    enabled: !!accessToken,
  });

  const sub = data ?? placeholder;
  const statusMap: Record<string, { label: string; color: string; bg: string }> = {
    active: { label: 'نشط', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
    trial: { label: 'تجريبي', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
    expired: { label: 'منتهي', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  };
  const st = statusMap[sub.status] || statusMap.active;

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/settings')} className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--muted)] transition"><ArrowRight className="h-4 w-4" /></button>
        <div>
          <h1 className="text-xl font-black">الاشتراك</h1>
          <p className="text-xs text-[var(--muted-foreground)]">إدارة خطة الاشتراك</p>
        </div>
      </div>

      {/* Current Plan Hero */}
      <div className="rounded-2xl bg-gradient-to-l from-indigo-500 to-blue-600 p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.1),transparent)]" />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Crown className="h-5 w-5 opacity-70" />
              <span className="text-xs opacity-60">خطتك الحالية</span>
            </div>
            <h2 className="text-3xl font-black">{sub.plan.nameAr}</h2>
            <div className="flex items-center gap-3 mt-2">
              <span className={cn('px-2 py-0.5 rounded-lg border text-[10px] font-bold', st.bg, st.color)}>{st.label}</span>
              <span className="text-sm opacity-70 tabular-nums" dir="ltr">
                {sub.plan.price.toLocaleString('en')} SAR / {sub.plan.billingCycle === 'monthly' ? 'شهرياً' : 'سنوياً'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-[11px] opacity-60">
              <Calendar className="h-3.5 w-3.5" />
              <span>التجديد: </span>
              <span className="tabular-nums" dir="ltr">{new Date(sub.renewalDate).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
          </div>
          <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20 gap-2">
            <ArrowUpCircle className="h-4 w-4" /> ترقية الخطة
          </Button>
        </div>
      </div>

      {/* Usage */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-[var(--brand-primary)]" />
            <span className="text-sm font-bold">الموظفات</span>
          </div>
          <p className="text-2xl font-black tabular-nums">
            {sub.usage.employees.used}
            {sub.usage.employees.limit !== null && <span className="text-sm font-normal text-[var(--muted-foreground)]"> / {sub.usage.employees.limit}</span>}
          </p>
          {sub.usage.employees.limit !== null && (
            <div className="mt-2 h-2 rounded-full bg-[var(--muted)] overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-l from-[var(--brand-primary)] to-[var(--brand-primary)]/50" style={{ width: `${Math.min((sub.usage.employees.used / sub.usage.employees.limit) * 100, 100)}%` }} />
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-bold">العملاء</span>
          </div>
          <p className="text-2xl font-black tabular-nums">
            {sub.usage.clients.used}
            <span className="text-sm font-normal text-[var(--muted-foreground)]"> {sub.usage.clients.limit !== null ? `/ ${sub.usage.clients.limit}` : '(غير محدود)'}</span>
          </p>
        </div>
      </div>

      {/* Plans Comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PLANS.map(plan => (
          <div key={plan.key} className={cn('rounded-2xl border overflow-hidden transition-all hover:shadow-lg', plan.popular ? 'border-[var(--brand-primary)] ring-2 ring-[var(--brand-primary)]/20' : 'border-[var(--border)]')}>
            {/* Plan Header */}
            <div className={cn('bg-gradient-to-l text-white p-5 text-center relative', plan.gradient)}>
              {plan.popular && (
                <span className="absolute top-2 left-2 bg-white/20 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> الأكثر شيوعاً
                </span>
              )}
              <h3 className="text-lg font-black mt-1">{plan.nameAr}</h3>
              <p className="text-[10px] opacity-60">{plan.desc}</p>
              <p className="text-3xl font-black mt-2 tabular-nums" dir="ltr">{plan.price}</p>
              <p className="text-[10px] opacity-60">SAR / شهرياً</p>
            </div>
            {/* Features */}
            <div className="p-4 bg-[var(--card)]">
              <div className="space-y-2.5">
                {FEATURES.map(feat => (
                  <div key={feat.f} className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-[var(--muted-foreground)]">{feat.f}</span>
                    <Feat v={feat[plan.key as keyof typeof feat] as string | boolean} />
                  </div>
                ))}
              </div>
              <Button className="w-full mt-4" variant={sub.plan.name === plan.key ? 'outline' : 'default'} disabled={sub.plan.name === plan.key}>
                {sub.plan.name === plan.key ? '✅ خطتك الحالية' : 'اختيار'}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
