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
  UserCog,
  ClipboardCheck,
  Wallet,
  Ticket,
  Heart,
  TabletSmartphone,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/stores/auth.store';

interface BottomNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Which roles can see this item. undefined = owner/manager only. 'all' = everyone */
  roles?: UserRole[] | 'all';
}

const mainItems: BottomNavItem[] = [
  { label: 'الرئيسية', href: '/dashboard', icon: LayoutDashboard, roles: ['owner', 'manager', 'receptionist', 'staff'] },
  { label: 'المواعيد', href: '/dashboard/appointments', icon: Calendar, roles: ['owner', 'manager', 'receptionist'] },
  { label: 'الكاشير', href: '/dashboard/pos', icon: CreditCard, roles: 'all' },
  { label: 'العملاء', href: '/dashboard/clients', icon: Users, roles: ['owner', 'manager', 'receptionist'] },
];

const moreItems: BottomNavItem[] = [
  { label: 'الموظفات', href: '/dashboard/employees', icon: UserCog, roles: ['owner', 'manager'] },
  { label: 'الحضور', href: '/dashboard/attendance', icon: ClipboardCheck, roles: ['owner', 'manager'] },
  { label: 'الخدمات', href: '/dashboard/services', icon: Scissors, roles: ['owner', 'manager'] },
  { label: 'كاشير سريع', href: '/dashboard/pos/quick', icon: TabletSmartphone, roles: 'all' },
  { label: 'الفواتير', href: '/dashboard/invoices', icon: FileText, roles: ['owner', 'manager', 'cashier'] },
  { label: 'التقارير', href: '/dashboard/reports', icon: BarChart3, roles: ['owner', 'manager'] },
  { label: 'الكوبونات', href: '/dashboard/coupons', icon: Ticket, roles: ['owner', 'manager'] },
  { label: 'الولاء', href: '/dashboard/loyalty', icon: Heart, roles: ['owner', 'manager'] },
  { label: 'المصروفات', href: '/dashboard/expenses', icon: Wallet, roles: ['owner', 'manager'] },
  { label: 'الإعدادات', href: '/dashboard/settings', icon: Settings, roles: ['owner', 'manager'] },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname.startsWith(href);
}

export function BottomNav(): React.ReactElement {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);
  const { userRole, isOwner } = useAuth();

  const toggleMore = useCallback(() => {
    setShowMore((prev) => !prev);
  }, []);

  const closeMore = useCallback(() => {
    setShowMore(false);
  }, []);

  // Filter items based on role
  const filterByRole = (items: BottomNavItem[]) =>
    items.filter((item) => {
      if (isOwner) return true;
      if (!item.roles) return false;
      if (item.roles === 'all') return true;
      return userRole ? item.roles.includes(userRole) : false;
    });

  const visibleMainItems = filterByRole(mainItems);
  const visibleMoreItems = filterByRole(moreItems);

  return (
    <>
      {/* "More" Overlay */}
      {showMore && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[6px] md:hidden animate-fade-in"
          onClick={closeMore}
          aria-hidden="true"
        />
      )}

      {/* "More" Panel — premium glass */}
      {showMore && (
        <div className={cn(
          'fixed inset-x-0 bottom-[calc(4rem+var(--safe-bottom,0px))] z-50 mx-3',
          'rounded-[var(--radius-xl)] glass-heavy shadow-[var(--shadow-xl)]',
          'md:hidden animate-cinematic'
        )}>
          <div className="mb-1 flex items-center justify-between p-4 pb-0">
            <span className="text-sm font-bold text-[var(--foreground)] tracking-tight">
              المزيد
            </span>
            <button
              type="button"
              onClick={closeMore}
              className="rounded-full p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors duration-[var(--duration-fast)]"
              aria-label="إغلاق"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1 p-3 pt-1 animate-stagger">
            {visibleMoreItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMore}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-[var(--radius-lg)] p-2.5 text-[11px] font-medium',
                    'transition-all duration-[var(--duration-fast)]',
                    active
                      ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
                      : 'text-[var(--muted-foreground)] active:bg-[var(--muted)]'
                  )}
                >
                  <Icon className={cn('h-5 w-5', active && 'stroke-[2.5]')} />
                  <span className="leading-tight text-center">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar — premium glass */}
      <nav
        className={cn(
          'fixed inset-x-0 bottom-0 z-30 md:hidden',
          'glass-heavy border-t border-[var(--border)]/60',
          'shadow-[0_-4px_20px_rgba(0,0,0,0.05)]'
        )}
        style={{ paddingBottom: 'var(--safe-bottom, 0px)' }}
      >
        <div className="flex items-center justify-around py-1.5 px-2">
          {visibleMainItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex flex-col items-center gap-0.5 rounded-[var(--radius-lg)] px-3 py-1.5 text-[10px] font-semibold',
                  'transition-all duration-[var(--duration-fast)]',
                  active
                    ? 'text-[var(--brand-primary)]'
                    : 'text-[var(--muted-foreground)]'
                )}
              >
                {/* Active indicator — gradient pill */}
                {active && (
                  <span className={cn(
                    'absolute -top-0.5 left-1/2 -translate-x-1/2 h-[3px] w-6 rounded-full',
                    'bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-primary-light)]',
                    'shadow-[0_0_8px_color-mix(in_srgb,var(--brand-primary)_40%,transparent)]',
                    'animate-scale-in'
                  )} />
                )}
                <Icon className={cn(
                  'h-5 w-5 transition-all duration-[var(--duration-fast)]',
                  active && 'stroke-[2.5] scale-110'
                )} />
                <span>{item.label}</span>
              </Link>
            );
          })}
          {visibleMoreItems.length > 0 && (
            <button
              type="button"
              onClick={toggleMore}
              className={cn(
                'flex flex-col items-center gap-0.5 rounded-[var(--radius-lg)] px-3 py-1.5 text-[10px] font-semibold',
                'transition-all duration-[var(--duration-fast)]',
                showMore
                  ? 'text-[var(--brand-primary)]'
                  : 'text-[var(--muted-foreground)]'
              )}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span>المزيد</span>
            </button>
          )}
        </div>
      </nav>
    </>
  );
}
