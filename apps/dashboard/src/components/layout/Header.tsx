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

function NotificationBadge() {
  const unreadCount = useUnreadCount();
  if (unreadCount <= 0) return null;

  return (
    <span className="absolute -top-0.5 -inset-e-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-(--danger) px-1 text-[10px] font-bold text-white">
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
  );
}

interface HeaderProps {
  onMenuToggle: () => void;
}

export function Header({ onMenuToggle }: HeaderProps): React.ReactElement {
  const { user, currentTenant, logout } = useAuth();
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
    <header className="sticky top-0 z-20 flex h-[var(--header-height)] items-center border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-sm px-4 gap-3">
      {/* Mobile menu toggle */}
      <button
        type="button"
        onClick={onMenuToggle}
        className="rounded-lg p-2 text-[var(--muted-foreground)] hover:bg-[var(--muted)] md:hidden"
        aria-label="فتح القائمة"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Salon name */}
      <div className="flex-1 min-w-0">
        <h2 className="truncate text-sm font-semibold text-[var(--foreground)] md:text-base">
          {currentTenant?.nameAr || 'SERVIX'}
        </h2>
      </div>

      {/* Search (desktop only) */}
      <div className="hidden md:flex items-center">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            type="search"
            placeholder="بحث..."
            className={cn(
              'h-9 w-64 rounded-lg border border-[var(--border)] bg-[var(--muted)] ps-10 pe-3 text-sm text-[var(--foreground)]',
              'placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]'
            )}
          />
        </div>
      </div>

      {/* Theme toggle */}
      <button
        type="button"
        onClick={toggleTheme}
        className="rounded-lg p-2 text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
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
        className="relative rounded-lg p-2 text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
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
            <div className="flex flex-col">
              <span className="text-sm font-medium text-[var(--foreground)]">
                {user?.fullName}
              </span>
              <span className="text-xs text-[var(--muted-foreground)]">
                {user?.email}
              </span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push('/dashboard/settings/account')}>
            <User className="h-4 w-4" />
            الملف الشخصي
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/dashboard/settings')}>
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
