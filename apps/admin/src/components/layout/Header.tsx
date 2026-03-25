'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, LogOut, User } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

interface HeaderProps {
  onMenuToggle: () => void;
}

export function Header({ onMenuToggle }: HeaderProps): React.ReactElement {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = useCallback((): void => {
    logout();
    router.push('/login');
  }, [logout, router]);

  return (
    <header className="sticky top-0 z-20 flex h-[var(--header-height)] items-center border-b border-[var(--border)] bg-[var(--card)]/80 backdrop-blur-sm px-4 gap-3">
      <button
        type="button"
        onClick={onMenuToggle}
        className="rounded-lg p-2 text-[var(--muted-foreground)] hover:bg-[var(--muted)] md:hidden"
        aria-label="فتح القائمة"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex-1 min-w-0">
        <h2 className="truncate text-sm font-semibold text-[var(--foreground)] md:text-base">
          لوحة إدارة المنصة
        </h2>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-primary)] text-white text-sm font-bold">
            <User className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-[var(--foreground)]">
              {user?.fullName || 'مسؤول النظام'}
            </span>
            <span className="text-xs text-[var(--muted-foreground)]">
              {user?.email || 'admin@servix.sa'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="rounded-lg p-2 text-[var(--muted-foreground)] hover:bg-red-50 hover:text-red-600 transition-colors"
          aria-label="تسجيل الخروج"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
