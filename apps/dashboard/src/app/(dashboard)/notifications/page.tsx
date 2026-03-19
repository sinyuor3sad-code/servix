'use client';

import { useState } from 'react';
import {
  Bell,
  Calendar,
  CreditCard,
  CheckCheck,
  Clock,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PageHeader,
  Button,
  Skeleton,
  EmptyState,
} from '@/components/ui';
import { useNotifications } from '@/hooks/useNotifications';
import type { Notification } from '@/services/notifications.service';

type FilterKey = 'all' | 'unread' | 'booking' | 'payment' | 'reminder';

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'unread', label: 'غير مقروءة' },
  { key: 'booking', label: 'الحجوزات' },
  { key: 'payment', label: 'المدفوعات' },
  { key: 'reminder', label: 'التذكيرات' },
];

function getFilterParams(filter: FilterKey): { type?: string; isRead?: boolean } {
  switch (filter) {
    case 'unread':
      return { isRead: false };
    case 'booking':
      return { type: 'booking_new' };
    case 'payment':
      return { type: 'payment' };
    case 'reminder':
      return { type: 'reminder' };
    default:
      return {};
  }
}

const TYPE_ICONS: Record<Notification['type'], typeof Bell> = {
  booking_new: Calendar,
  booking_confirmed: Calendar,
  booking_cancelled: Calendar,
  payment: CreditCard,
  reminder: Clock,
  general: MessageSquare,
};

const TYPE_COLORS: Record<Notification['type'], string> = {
  booking_new: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  booking_confirmed: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  booking_cancelled: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  payment: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  reminder: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  general: 'bg-[var(--muted)] text-[var(--muted-foreground)]',
};

function formatTimeAgo(dateString: string): string {
  const now = Date.now();
  const date = new Date(dateString).getTime();
  const diffMs = now - date;
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMinutes < 1) return 'الآن';
  if (diffMinutes < 60) return `منذ ${diffMinutes} دقيقة`;
  if (diffHours < 24) return `منذ ${diffHours} ساعة`;
  if (diffDays < 7) return `منذ ${diffDays} يوم`;
  return new Intl.DateTimeFormat('ar-SA', { dateStyle: 'medium' }).format(new Date(dateString));
}

function NotificationCard({
  notification,
  onMarkAsRead,
}: {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
}) {
  const Icon = TYPE_ICONS[notification.type] ?? Bell;
  const colorClass = TYPE_COLORS[notification.type] ?? TYPE_COLORS.general;

  return (
    <button
      type="button"
      onClick={() => {
        if (!notification.isRead) onMarkAsRead(notification.id);
      }}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl border p-4 text-start transition-colors',
        notification.isRead
          ? 'border-(--border) bg-(--background)'
          : 'border-blue-200 bg-blue-50/50 dark:border-blue-800/40 dark:bg-blue-950/20',
      )}
    >
      <div className={cn('mt-0.5 shrink-0 rounded-lg p-2', colorClass)}>
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              'text-sm',
              notification.isRead
                ? 'font-medium text-(--foreground)'
                : 'font-bold text-(--foreground)',
            )}
          >
            {notification.titleAr}
          </p>
          {!notification.isRead && (
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
          )}
        </div>
        <p className="mt-0.5 text-sm text-(--muted-foreground) line-clamp-2">
          {notification.bodyAr}
        </p>
        <p className="mt-1.5 text-xs text-(--muted-foreground)">
          {formatTimeAgo(notification.createdAt)}
        </p>
      </div>
    </button>
  );
}

function NotificationSkeleton() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-(--border) p-4">
      <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" className="h-4 w-3/4" />
        <Skeleton variant="text" className="h-3.5 w-full" />
        <Skeleton variant="text" className="h-3 w-20" />
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [page, setPage] = useState(1);

  const filterParams = getFilterParams(activeFilter);

  const {
    notifications,
    meta,
    isLoading,
    markAsRead,
    markAllAsRead,
  } = useNotifications({ page, ...filterParams });

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="الإشعارات"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={markAllAsRead}
          >
            <CheckCheck className="h-4 w-4" />
            تعليم الكل كمقروء
          </Button>
        }
      />

      {/* Filter tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-lg bg-(--muted) p-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveFilter(tab.key);
              setPage(1);
            }}
            className={cn(
              'whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors',
              activeFilter === tab.key
                ? 'bg-(--background) text-(--foreground) shadow-sm'
                : 'text-(--muted-foreground) hover:text-(--foreground)',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <NotificationSkeleton key={i} />
          ))
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="لا توجد إشعارات"
            description="ستظهر الإشعارات الجديدة هنا عند وصولها"
          />
        ) : (
          notifications.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onMarkAsRead={markAsRead}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            السابق
          </Button>
          <span className="text-sm text-(--muted-foreground)">
            {page} من {meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
            disabled={page >= meta.totalPages}
          >
            التالي
          </Button>
        </div>
      )}
    </div>
  );
}
