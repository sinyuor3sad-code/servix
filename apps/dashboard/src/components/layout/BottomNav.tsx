'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Calendar,
  CreditCard,
  Users,
  MoreHorizontal,
  X,
  Scissors,
  FileText,
  BarChart3,
  Settings,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BottomNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const mainItems: BottomNavItem[] = [
  { label: 'الرئيسية', href: '/dashboard', icon: LayoutDashboard },
  { label: 'المواعيد', href: '/dashboard/appointments', icon: Calendar },
  { label: 'الكاشير', href: '/dashboard/pos', icon: CreditCard },
  { label: 'العملاء', href: '/dashboard/clients', icon: Users },
];

const moreItems: BottomNavItem[] = [
  { label: 'الخدمات', href: '/dashboard/services', icon: Scissors },
  { label: 'الفواتير', href: '/dashboard/invoices', icon: FileText },
  { label: 'التقارير', href: '/dashboard/reports', icon: BarChart3 },
  { label: 'الإعدادات', href: '/dashboard/settings', icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname.startsWith(href);
}

export function BottomNav(): React.ReactElement {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);

  const toggleMore = useCallback(() => {
    setShowMore((prev) => !prev);
  }, []);

  const closeMore = useCallback(() => {
    setShowMore(false);
  }, []);

  return (
    <>
      {/* "More" Overlay */}
      {showMore && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={closeMore}
          aria-hidden="true"
        />
      )}

      {/* "More" Panel */}
      {showMore && (
        <div className="fixed inset-x-0 bottom-16 z-50 mx-4 rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 shadow-lg md:hidden">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-[var(--foreground)]">
              المزيد
            </span>
            <button
              type="button"
              onClick={closeMore}
              className="rounded-lg p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              aria-label="إغلاق"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {moreItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMore}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-lg p-2 text-xs transition-colors',
                    active
                      ? 'text-[var(--brand-primary)]'
                      : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--background)] md:hidden">
        <div className="flex items-center justify-around py-2">
          {mainItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium transition-colors',
                  active
                    ? 'text-[var(--brand-primary)]'
                    : 'text-[var(--muted-foreground)]'
                )}
              >
                <Icon className={cn('h-5 w-5', active && 'stroke-[2.5]')} />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={toggleMore}
            className={cn(
              'flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium transition-colors',
              showMore
                ? 'text-[var(--brand-primary)]'
                : 'text-[var(--muted-foreground)]'
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>المزيد</span>
          </button>
        </div>
      </nav>
    </>
  );
}
