'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  FileText,
  Package,
  Sparkles,
  ScrollText,
  Settings,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { label: 'الرئيسية', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'الصالونات', href: '/admin/tenants', icon: Building2 },
  { label: 'الاشتراكات', href: '/admin/subscriptions', icon: CreditCard },
  { label: 'الفواتير', href: '/admin/invoices', icon: FileText },
  { label: 'الباقات', href: '/admin/plans', icon: Package },
  { label: 'الميزات', href: '/admin/features', icon: Sparkles },
  { label: 'سجل العمليات', href: '/admin/audit-logs', icon: ScrollText },
  { label: 'الإعدادات', href: '/admin/settings', icon: Settings },
];

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

function isActiveRoute(pathname: string, href: string): boolean {
  if (href === '/admin/dashboard') return pathname === '/admin/dashboard';
  return pathname.startsWith(href);
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps): React.ReactElement {
  const pathname = usePathname();

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return (): void => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex h-[var(--header-height)] items-center justify-between border-b border-[var(--border)] px-4">
        <Link href="/admin/dashboard" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-primary)] text-white font-bold text-lg">
            S
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold text-[var(--foreground)]">SERVIX</span>
            <span className="text-[10px] font-medium text-[var(--muted-foreground)] -mt-0.5">لوحة الإدارة</span>
          </div>
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

      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const active = isActiveRoute(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onMobileClose}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-[var(--brand-primary)] text-white shadow-sm'
                      : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-[var(--border)] p-4">
        <p className="text-xs text-[var(--muted-foreground)] text-center">
          SERVIX Admin v0.1.0
        </p>
      </div>
    </div>
  );

  return (
    <>
      <aside
        className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:start-0 md:z-30 md:w-[var(--sidebar-width)] border-e border-[var(--border)] bg-[var(--card)]"
      >
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 end-0 z-50 w-[var(--sidebar-width)] border-s border-[var(--border)] bg-[var(--card)] transition-transform duration-300 md:hidden',
          mobileOpen ? 'translate-x-0' : 'translate-x-full rtl:-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>

      <div className="hidden md:block shrink-0 w-[var(--sidebar-width)]" />
    </>
  );
}
