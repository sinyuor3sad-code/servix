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
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden animate-fade-in"
          onClick={closeMore}
          aria-hidden="true"
        />
      )}

      {/* "More" Panel — glass morphism */}
      {showMore && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+var(--safe-bottom,0px))] z-50 mx-3 rounded-2xl glass shadow-lg md:hidden animate-scale-in">
          <div className="mb-2 flex items-center justify-between p-4 pb-0">
            <span className="text-sm font-bold text-[var(--foreground)]">
              المزيد
            </span>
            <button
              type="button"
              onClick={closeMore}
              className="rounded-full p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
              aria-label="إغلاق"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1 p-3 pt-0 animate-stagger">
            {visibleMoreItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMore}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-xl p-2.5 text-[11px] font-medium transition-all',
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

      {/* Bottom Navigation Bar — glass effect */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 glass border-t border-[var(--border)] md:hidden"
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
                  'relative flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[10px] font-semibold transition-all',
                  active
                    ? 'text-[var(--brand-primary)]'
                    : 'text-[var(--muted-foreground)]'
                )}
              >
                {/* Active indicator dot */}
                {active && (
                  <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 h-1 w-5 rounded-full bg-[var(--brand-primary)] animate-scale-in" />
                )}
                <Icon className={cn('h-5 w-5 transition-transform', active && 'stroke-[2.5] scale-110')} />
                <span>{item.label}</span>
              </Link>
            );
          })}
          {visibleMoreItems.length > 0 && (
            <button
              type="button"
              onClick={toggleMore}
              className={cn(
                'flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[10px] font-semibold transition-all',
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
