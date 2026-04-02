'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Clock, XCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { subscriptionService } from '@/services/subscription.service';

type BannerLevel = 'warning' | 'danger' | 'locked';

interface BannerConfig {
  level: BannerLevel;
  icon: React.ReactNode;
  message: string;
  detail: string;
  bg: string;
  border: string;
  text: string;
}

function getDaysRemaining(endDate: string): number {
  const end = new Date(endDate).getTime();
  const now = Date.now();
  return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
}

function getBannerConfig(
  status: string,
  daysRemaining: number,
): BannerConfig | null {
  // Trial ending soon (3 days or less)
  if (status === 'trial' && daysRemaining <= 3 && daysRemaining > 0) {
    return {
      level: 'warning',
      icon: <Clock className="h-4 w-4 shrink-0" />,
      message: `الفترة التجريبية تنتهي خلال ${daysRemaining} ${daysRemaining === 1 ? 'يوم' : 'أيام'}`,
      detail: 'اشتركي الآن للاستمرار بدون انقطاع',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      border: 'border-amber-200 dark:border-amber-800',
      text: 'text-amber-800 dark:text-amber-200',
    };
  }

  // Expired — grace period (read-only, days 0-7)
  if (
    (status === 'expired' || status === 'cancelled') &&
    daysRemaining <= 0 &&
    daysRemaining > -7
  ) {
    return {
      level: 'danger',
      icon: <AlertTriangle className="h-4 w-4 shrink-0" />,
      message: 'اشتراكك منتهي — الوضع: قراءة فقط',
      detail: 'جدّدي اشتراكك للاستمرار في إضافة المواعيد والفواتير',
      bg: 'bg-red-50 dark:bg-red-950/30',
      border: 'border-red-200 dark:border-red-800',
      text: 'text-red-800 dark:text-red-200',
    };
  }

  // Expired — locked (day 8-14)
  if (
    (status === 'expired' || status === 'cancelled') &&
    daysRemaining <= -7
  ) {
    return {
      level: 'locked',
      icon: <XCircle className="h-4 w-4 shrink-0" />,
      message: 'حسابك مقفل — جدّدي الاشتراك للعودة',
      detail: 'بياناتك محفوظة ولكن لا يمكنك الوصول لها بدون تجديد',
      bg: 'bg-red-100 dark:bg-red-950/50',
      border: 'border-red-300 dark:border-red-700',
      text: 'text-red-900 dark:text-red-100',
    };
  }

  // Active but ending soon (7 days or less)
  if (status === 'active' && daysRemaining <= 7 && daysRemaining > 0) {
    return {
      level: 'warning',
      icon: <Clock className="h-4 w-4 shrink-0" />,
      message: `اشتراكك ينتهي خلال ${daysRemaining} ${daysRemaining === 1 ? 'يوم' : 'أيام'}`,
      detail: 'جدّدي الآن لتجنب انقطاع الخدمة',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      border: 'border-amber-200 dark:border-amber-800',
      text: 'text-amber-800 dark:text-amber-200',
    };
  }

  return null;
}

export function SubscriptionBanner(): React.ReactElement | null {
  const { accessToken, isAuthenticated, isOwner } = useAuth();

  const { data: subscription } = useQuery({
    queryKey: ['subscription', 'current'],
    queryFn: () => subscriptionService.getCurrent(accessToken!),
    enabled: !!accessToken && isAuthenticated,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Only show to owners/managers, and only when there's subscription data
  if (!subscription || !isOwner) return null;

  const daysRemaining = getDaysRemaining(subscription.currentPeriodEnd);
  const config = getBannerConfig(subscription.status, daysRemaining);

  if (!config) return null;

  return (
    <div
      className={`flex items-center gap-3 border-b px-4 py-2.5 text-sm ${config.bg} ${config.border} ${config.text}`}
      role="alert"
    >
      {config.icon}
      <div className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="font-semibold">{config.message}</span>
        <span className="text-xs opacity-75">{config.detail}</span>
      </div>
      <a
        href="/settings?tab=subscription"
        className="shrink-0 rounded-lg bg-white/80 dark:bg-white/10 px-3 py-1 text-xs font-bold hover:bg-white dark:hover:bg-white/20 transition-colors"
      >
        {config.level === 'locked' ? 'جدّدي الآن' : 'إدارة الاشتراك'}
      </a>
    </div>
  );
}
