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
  MessageCircle,
  PackageOpen,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/stores/auth.store';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  group?: string;
  comingSoon?: boolean;
  /** Which roles can see this item. undefined = everyone (owner/manager only by default for admin pages) */
  roles?: UserRole[] | 'all';
}

const navItems: NavItem[] = [
  { label: 'الرئيسية', href: '/dashboard', icon: LayoutDashboard, roles: ['owner', 'manager', 'receptionist', 'staff'] },
  { label: 'المواعيد', href: '/dashboard/appointments', icon: Calendar, roles: ['owner', 'manager', 'receptionist'] },
  { label: 'العملاء', href: '/dashboard/clients', icon: Users, roles: ['owner', 'manager', 'receptionist'] },
  { label: 'الموظفات', href: '/dashboard/employees', icon: UserCog, roles: ['owner', 'manager'] },
  { label: 'الحضور', href: '/dashboard/attendance', icon: ClipboardCheck, roles: ['owner', 'manager'] },
  { label: 'الخدمات', href: '/dashboard/services', icon: Scissors, roles: ['owner', 'manager'] },
  { label: 'الكاشير', href: '/dashboard/pos', icon: CreditCard, roles: 'all' },
  { label: 'كاشير سريع', href: '/dashboard/pos/quick', icon: TabletSmartphone, roles: 'all' },
  { label: 'الفواتير', href: '/dashboard/invoices', icon: FileText, roles: ['owner', 'manager', 'cashier'] },
  { label: 'التقارير', href: '/dashboard/reports', icon: BarChart3, roles: ['owner', 'manager'] },
  { label: 'الكوبونات', href: '/dashboard/coupons', icon: Ticket, roles: ['owner', 'manager'] },
  { label: 'الولاء', href: '/dashboard/loyalty', icon: Heart, roles: ['owner', 'manager'] },
  { label: 'المصروفات', href: '/dashboard/expenses', icon: Wallet, roles: ['owner', 'manager'] },
  { label: 'الإعدادات', href: '/dashboard/settings', icon: Settings, roles: ['owner', 'manager'] },
  { label: 'الباقات', href: '/dashboard/packages', icon: PackageOpen, roles: ['owner', 'manager'] },
  { label: 'الورديات', href: '/dashboard/shifts', icon: Clock, comingSoon: true, roles: ['owner', 'manager'] },
  { label: 'المخزون', href: '/dashboard/inventory', icon: Package, roles: ['owner', 'manager'] },
  { label: 'التسويق', href: '/dashboard/marketing', icon: Megaphone, roles: ['owner', 'manager'] },
  { label: 'التسعير', href: '/dashboard/pricing', icon: TrendingUp, roles: ['owner', 'manager'] },
  { label: 'واتساب', href: '/dashboard/settings/whatsapp', icon: MessageCircle, roles: ['owner', 'manager'] },
  { label: 'ZATCA', href: '/dashboard/zatca', icon: Receipt, comingSoon: true, roles: ['owner', 'manager'] },
];

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

function isActiveRoute(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname.startsWith(href);
}

const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'مالكة',
  manager: 'مديرة',
  receptionist: 'استقبال',
  cashier: 'كاشيرة',
  staff: 'موظفة',
};

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps): React.ReactElement {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { currentTenant, userRole, isOwner } = useAuth();

  // Filter nav items based on user role — owner always sees everything
  const visibleItems = navItems.filter((item) => {
    if (isOwner) return true; // Owner sees all
    if (!item.roles) return true; // No restriction
    if (item.roles === 'all') return true; // Everyone
    return userRole ? item.roles.includes(userRole) : false;
  });

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
      {/* Logo area — premium with subtle brand glow */}
      <div className="flex h-[var(--header-height)] items-center justify-between border-b border-[var(--border)]/60 px-4">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius)] font-bold text-lg text-white',
            'bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-dark)]',
            'shadow-[0_2px_8px_color-mix(in_srgb,var(--brand-primary)_30%,transparent)]',
            'transition-all duration-[var(--duration-normal)]',
            'group-hover:shadow-[0_4px_16px_color-mix(in_srgb,var(--brand-primary)_40%,transparent)]',
            'group-hover:scale-105'
          )}>
            {currentTenant?.nameAr?.charAt(0) || 'S'}
          </div>
          {!collapsed && (
            <span className="text-lg font-bold text-[var(--foreground)] truncate max-w-[180px] tracking-tight">
              {currentTenant?.nameAr || 'SERVIX'}
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={onMobileClose}
          className="rounded-[var(--radius)] p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors md:hidden"
          aria-label="إغلاق القائمة"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        <ul className="space-y-0.5">
          {visibleItems.map((item) => {
            const active = isActiveRoute(pathname, item.href);
            const Icon = item.icon;

            if (item.comingSoon) {
              return (
                <li key={item.href}>
                  <span
                    className={cn(
                      'flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm font-medium cursor-default opacity-40',
                      'text-[var(--muted-foreground)]',
                      collapsed && 'justify-center px-0'
                    )}
                    title={collapsed ? `${item.label} — قريباً` : undefined}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    {!collapsed && (
                      <>
                        <span>{item.label}</span>
                        <span className="ms-auto rounded-full bg-[var(--muted)] px-2 py-0.5 text-[9px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
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
                    'relative flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm font-medium',
                    'transition-all duration-[var(--duration-fast)] ease-[var(--ease-out-expo)]',
                    active
                      ? [
                          'bg-[var(--brand-primary)] text-white',
                          'shadow-[0_2px_12px_color-mix(in_srgb,var(--brand-primary)_35%,transparent)]',
                        ].join(' ')
                      : [
                          'text-[var(--muted-foreground)]',
                          'hover:bg-[var(--muted)] hover:text-[var(--foreground)]',
                        ].join(' '),
                    collapsed && 'justify-center px-0'
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className={cn('h-[18px] w-[18px] shrink-0', active && 'drop-shadow-sm')} />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Collapse Toggle (desktop only) */}
      <div className="hidden border-t border-[var(--border)]/60 p-3 md:block">
        <button
          type="button"
          onClick={toggleCollapse}
          className={cn(
            'flex w-full items-center justify-center rounded-[var(--radius)] p-2',
            'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]',
            'transition-all duration-[var(--duration-fast)]'
          )}
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
      {/* Desktop Sidebar — glass panel */}
      <aside
        className={cn(
          'hidden md:flex md:flex-col md:fixed md:inset-y-0 md:start-0 md:z-30',
          'border-e border-[var(--border)]/60 glass-panel',
          'transition-[width] duration-300 ease-[var(--ease-out-expo)]',
          collapsed
            ? 'md:w-[var(--sidebar-collapsed-width)]'
            : 'md:w-[var(--sidebar-width)]'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Overlay — cinematic blur backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[6px] md:hidden animate-fade-in"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Mobile Sidebar — slides in from the right (RTL start) */}
      <aside
        className={cn(
          'fixed inset-y-0 end-0 z-50 w-[280px] max-w-[85vw]',
          'border-s border-[var(--border)]/60 glass-panel',
          'shadow-[var(--shadow-2xl)]',
          'transition-transform duration-300 ease-[var(--ease-out-expo)] md:hidden',
          mobileOpen ? 'translate-x-0' : 'translate-x-full rtl:-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Spacer to push main content */}
      <div
        className={cn(
          'hidden md:block shrink-0 transition-[width] duration-300 ease-[var(--ease-out-expo)]',
          collapsed
            ? 'md:w-[var(--sidebar-collapsed-width)]'
            : 'md:w-[var(--sidebar-width)]'
        )}
      />
    </>
  );
}
