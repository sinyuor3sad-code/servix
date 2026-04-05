'use client';

import { useState, useEffect } from 'react';
import { LogOut } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

export function SovereignHeader() {
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');
  const [mounted, setMounted] = useState(false);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    setMounted(true);
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }));
      setDate(now.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, []);

  const logout = useAuthStore((s) => s.logout);

  if (!mounted) return <div style={{ height: 80 }} />;

  return (
    <header className="os-sovereign-header os-enter os-enter-1">
      {/* Right — Identity */}
      <div className="flex items-center gap-4">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-[14px]"
          style={{
            background: 'linear-gradient(135deg, rgba(201,168,76,0.15), rgba(201,168,76,0.04))',
            border: '1px solid rgba(201,168,76,0.12)',
          }}
        >
          <span className="text-[15px] font-black" style={{ color: 'var(--os-gold)' }}>
            {user?.fullName?.charAt(0) || 'S'}
          </span>
        </div>
        <div>
          <p className="text-[14px] font-bold" style={{ color: 'var(--os-text-1)' }}>
            {user?.fullName || 'مدير المنصة'}
          </p>
          <p className="text-[11px] font-semibold" style={{ color: 'var(--os-text-3)' }}>
            {date}
          </p>
        </div>
      </div>

      {/* Left — System Pulse + Time + Logout */}
      <div className="flex items-center gap-3">
        <div className="os-system-pulse">
          <span className="os-pulse-dot" />
          <span>النظام يعمل</span>
        </div>
        <span className="text-[13px] font-bold os-num" style={{ color: 'var(--os-text-3)' }}>
          {time}
        </span>
        <button
          onClick={logout}
          className="flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300 hover:bg-red-500/10"
          title="تسجيل الخروج"
        >
          <LogOut size={16} strokeWidth={1.5} style={{ color: 'var(--os-text-3)' }} />
        </button>
      </div>
    </header>
  );
}
