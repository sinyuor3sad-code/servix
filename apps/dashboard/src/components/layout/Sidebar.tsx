'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Calendar,
  Users,
  UserCog,
  Scissors,
  CreditCard,
  FileText,
  BarChart3,
  Ticket,
  Heart,
  Wallet,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
  ClipboardCheck,
  TabletSmartphone,
  Package,
  Clock,
  Megaphone,
  TrendingUp,
  Receipt,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  group?: string;
  comingSoon?: boolean;
}

const navItems: NavItem[] = [
  { label: 'الرئيسية', href: '/dashboard', icon: LayoutDashboard },
  { label: 'المواعيد', href: '/dashboard/appointments', icon: Calendar },
  { label: 'العملاء', href: '/dashboard/clients', icon: Users },
  { label: 'الموظفات', href: '/dashboard/employees', icon: UserCog },
  { label: 'الحضور', href: '/dashboard/attendance', icon: ClipboardCheck },
  { label: 'الخدمات', href: '/dashboard/services', icon: Scissors },
  { label: 'الكاشير', href: '/dashboard/pos', icon: CreditCard },
  { label: 'كاشير سريع', href: '/dashboard/pos/quick', icon: TabletSmartphone },
  { label: 'الفواتير', href: '/dashboard/invoices', icon: FileText },
  { label: 'التقارير', href: '/dashboard/reports', icon: BarChart3 },
  { label: 'الكوبونات', href: '/dashboard/coupons', icon: Ticket },
  { label: 'الولاء', href: '/dashboard/loyalty', icon: Heart },
  { label: 'المصروفات', href: '/dashboard/expenses', icon: Wallet },
  { label: 'الإعدادات', href: '/dashboard/settings', icon: Settings },
  { label: 'الورديات', href: '/dashboard/shifts', icon: Clock, comingSoon: true },
  { label: 'المخزون', href: '/dashboard/inventory', icon: Package, comingSoon: true },
  { label: 'التسويق', href: '/dashboard/marketing', icon: Megaphone, comingSoon: true },
  { label: 'التسعير', href: '/dashboard/pricing', icon: TrendingUp, comingSoon: true },
  { label: 'ZATCA', href: '/dashboard/zatca', icon: Receipt, comingSoon: true },
];

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

function isActiveRoute(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname.startsWith(href);
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps): React.ReactElement {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { currentTenant } = useAuth();

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-[var(--header-height)] items-center justify-between border-b border-[var(--border)] px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-primary)] text-white font-bold text-lg">
            {currentTenant?.nameAr?.charAt(0) || 'S'}
          </div>
          {!collapsed && (
            <span className="text-xl font-bold text-[var(--foreground)] truncate max-w-[180px]">
              {currentTenant?.nameAr || 'SERVIX'}
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={onMobileClose}
          className="rounded-lg p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)] md:hidden"
          aria-label="إغلاق القائمة"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const active = isActiveRoute(pathname, item.href);
            const Icon = item.icon;

            if (item.comingSoon) {
              return (
                <li key={item.href}>
                  <span
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium cursor-default opacity-50',
                      'text-[var(--muted-foreground)]',
                      collapsed && 'justify-center px-0'
                    )}
                    title={collapsed ? `${item.label} — قريباً` : undefined}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {!collapsed && (
                      <>
                        <span>{item.label}</span>
                        <span className="ms-auto rounded-full bg-[var(--muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted-foreground)]">
                          قريباً
                        </span>
                      </>
                    )}
                  </span>
                </li>
              );
            }

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onMobileClose}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-[var(--brand-primary)] text-white shadow-sm'
                      : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]',
                    collapsed && 'justify-center px-0'
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Collapse Toggle (desktop only) */}
      <div className="hidden border-t border-[var(--border)] p-3 md:block">
        <button
          type="button"
          onClick={toggleCollapse}
          className="flex w-full items-center justify-center rounded-lg p-2 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          aria-label={collapsed ? 'توسيع القائمة' : 'طي القائمة'}
        >
          {collapsed ? (
            <ChevronLeft className="h-5 w-5" />
          ) : (
            <ChevronRight className="h-5 w-5" />
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden md:flex md:flex-col md:fixed md:inset-y-0 md:start-0 md:z-30 border-e border-[var(--border)] bg-[var(--background)] transition-[width] duration-300',
          collapsed
            ? 'md:w-[var(--sidebar-collapsed-width)]'
            : 'md:w-[var(--sidebar-width)]'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Mobile Sidebar — slides in from the right (RTL start) */}
      <aside
        className={cn(
          'fixed inset-y-0 end-0 z-50 w-[var(--sidebar-width)] border-s border-[var(--border)] bg-[var(--background)] transition-transform duration-300 md:hidden',
          mobileOpen ? 'translate-x-0' : 'translate-x-full rtl:-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Spacer to push main content */}
      <div
        className={cn(
          'hidden md:block shrink-0 transition-[width] duration-300',
          collapsed
            ? 'md:w-[var(--sidebar-collapsed-width)]'
            : 'md:w-[var(--sidebar-width)]'
        )}
      />
    </>
  );
}
