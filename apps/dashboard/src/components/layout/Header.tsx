'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Menu,
  Bell,
  Search,
  Sun,
  Moon,
  User,
  Settings,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/stores/auth.store';
import { useUnreadCount } from '@/hooks/useNotifications';
import {
  Avatar,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui';
import { cn } from '@/lib/utils';

const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'مالكة',
  manager: 'مديرة',
  receptionist: 'استقبال',
  cashier: 'كاشيرة',
  staff: 'موظفة',
};

function NotificationBadge() {
  const unreadCount = useUnreadCount();
  if (unreadCount <= 0) return null;

  return (
    <span className="absolute -top-0.5 -inset-e-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-(--danger) px-1 text-[10px] font-bold text-white shadow-[0_0_8px_rgba(239,68,68,0.4)] animate-scale-in">
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
  );
}

interface HeaderProps {
  onMenuToggle: () => void;
}

export function Header({ onMenuToggle }: HeaderProps): React.ReactElement {
  const { user, currentTenant, userRole, isOwner, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  const handleLogout = useCallback(() => {
    logout();
    router.push('/login');
  }, [logout, router]);

  return (
    <header className={cn(
      'sticky top-0 z-20 flex h-[var(--header-height)] items-center gap-3 px-4',
      'border-b border-[var(--border)]/60',
      'glass-panel'
    )}>
      {/* Mobile menu toggle */}
      <button
        type="button"
        onClick={onMenuToggle}
        className="rounded-[var(--radius)] p-2 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors duration-[var(--duration-fast)] md:hidden"
        aria-label="فتح القائمة"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Salon name */}
      <div className="flex-1 min-w-0 flex items-center gap-2.5">
        <h2 className="truncate text-sm font-bold text-[var(--foreground)] md:text-base tracking-tight">
          {currentTenant?.nameAr || 'SERVIX'}
        </h2>
        {userRole && (
          <span className={cn(
            'hidden sm:inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide',
            'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]',
            'border border-[var(--brand-primary)]/15'
          )}>
            {isOwner ? 'مالكة' : ROLE_LABELS[userRole]}
          </span>
        )}
      </div>


      {/* Search (desktop only) — navigates to clients on Enter */}
      <div className="hidden md:flex items-center">
        <div className="relative">
          <Search className="absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            type="search"
            placeholder="بحث عن عميل أو موعد..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const q = (e.target as HTMLInputElement).value.trim();
                if (q) router.push(`/clients?search=${encodeURIComponent(q)}`);
              }
            }}
            className={cn(
              'h-9 w-64 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-sunken)] ps-10 pe-3 text-sm text-[var(--foreground)]',
              'placeholder:text-[var(--muted-foreground)]/60',
              'transition-all duration-[var(--duration-normal)] ease-[var(--ease-out-expo)]',
              'focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/40 focus:border-[var(--brand-primary)] focus:shadow-[var(--glow-primary)]',
              'focus:w-80',
              'hover:border-[var(--muted-foreground)]/30'
            )}
          />
        </div>
      </div>

      {/* Theme toggle */}
      <button
        type="button"
        onClick={toggleTheme}
        className={cn(
          'rounded-[var(--radius)] p-2 text-[var(--muted-foreground)]',
          'hover:bg-[var(--muted)] hover:text-[var(--foreground)]',
          'transition-all duration-[var(--duration-fast)]',
          'hover:shadow-[var(--glow-subtle)]'
        )}
        aria-label={theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
      >
        {theme === 'dark' ? (
          <Sun className="h-5 w-5" />
        ) : (
          <Moon className="h-5 w-5" />
        )}
      </button>

      {/* Notifications */}
      <button
        type="button"
        onClick={() => router.push('/notifications')}
        className={cn(
          'relative rounded-[var(--radius)] p-2 text-[var(--muted-foreground)]',
          'hover:bg-[var(--muted)] hover:text-[var(--foreground)]',
          'transition-all duration-[var(--duration-fast)]'
        )}
        aria-label="الإشعارات"
      >
        <Bell className="h-5 w-5" />
        <NotificationBadge />
      </button>

      {/* User dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger className="rounded-full focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2">
          <Avatar
            src={user?.avatarUrl}
            fallback={user?.fullName || 'م'}
            size="sm"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-[var(--foreground)]">
                {user?.fullName}
              </span>
              <span className="text-xs text-[var(--muted-foreground)]">
                {user?.email}
              </span>
              {userRole && (
                <span className="mt-1.5 inline-flex w-fit rounded-full bg-[var(--brand-primary)]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--brand-primary)] border border-[var(--brand-primary)]/15">
                  {isOwner ? 'مالكة الصالون' : ROLE_LABELS[userRole]}
                </span>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push('/settings/account')}>
            <User className="h-4 w-4" />
            الملف الشخصي
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/settings')}>
            <Settings className="h-4 w-4" />
            الإعدادات
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            تسجيل الخروج
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
