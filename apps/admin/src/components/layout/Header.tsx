'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Bell } from 'lucide-react';
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
    <header
      className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-white/[0.04] px-5"
      style={{ background: 'rgba(6,6,10,0.80)', backdropFilter: 'blur(20px) saturate(120%)' }}
    >
      <button
        onClick={onMenuToggle}
        className="rounded-lg p-2 text-white/30 hover:bg-white/[0.05] hover:text-white/60 md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex-1" />

      {/* Notifications */}
      <button className="relative flex h-9 w-9 items-center justify-center rounded-xl text-white/25 transition-colors hover:bg-white/[0.04] hover:text-white/60">
        <Bell size={18} strokeWidth={1.6} />
        <span className="absolute -top-0.5 -left-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-black">
          5
        </span>
      </button>

      {/* User */}
      <div className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/[0.03]">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/25 to-indigo-500/15 ring-1 ring-violet-500/10">
          <span className="text-xs font-bold text-violet-300">س</span>
        </div>
        <div className="hidden sm:block">
          <p className="text-[13px] font-semibold text-white/70">{user?.fullName || 'سعد الغامدي'}</p>
        </div>
      </div>
    </header>
  );
}
