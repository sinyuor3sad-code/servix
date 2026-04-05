'use client';

import { useState, useEffect, useCallback, type ReactElement } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Hexagon,
  Building2,
  CreditCard,
  FileText,
  Package,
  BarChart3,
  Activity,
  ScrollText,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   NAV CONFIG — Minimal, icon-driven
   ═══════════════════════════════════════════════════════════════ */

const NAV_ITEMS = [
  { id: 'dashboard',     icon: Hexagon,      href: '/dashboard',     label: 'مركز القيادة' },
  { id: 'tenants',       icon: Building2,    href: '/tenants',       label: 'الشركات', badge: 47 },
  { id: 'subscriptions', icon: CreditCard,   href: '/subscriptions', label: 'الاشتراكات' },
  { id: 'invoices',      icon: FileText,     href: '/invoices',      label: 'الفواتير' },
  { id: 'plans',         icon: Package,      href: '/plans',         label: 'الباقات' },
  { id: 'analytics',     icon: BarChart3,    href: '/analytics',     label: 'التحليلات' },
  { id: 'system',        icon: Activity,     href: '/system',        label: 'صحة النظام' },
  { id: 'logs',          icon: ScrollText,   href: '/audit-logs',    label: 'سجل العمليات' },
  { id: 'notifs',        icon: Bell,         href: '/notifications', label: 'الإشعارات' },
  { id: 'settings',      icon: Settings,     href: '/settings',      label: 'الإعدادات' },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname.startsWith(href);
}

/* ═══════════════════════════════════════════════════════════════
   NERVE RAIL — Desktop
   ═══════════════════════════════════════════════════════════════ */

export function NerveRail(): ReactElement {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop Rail */}
      <aside className="nx-rail hidden md:flex" style={{ insetInlineEnd: 'auto', insetInlineStart: 0 }}>
        {/* Logo */}
        <Link href="/dashboard" className="mb-6 flex items-center justify-center">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-[15px]"
            style={{
              background: 'linear-gradient(135deg, #d4a853 0%, #c49a3f 100%)',
              boxShadow: '0 4px 24px rgba(212,168,83,0.25)',
            }}
          >
            <span className="text-[16px] font-black text-[#04040a]">S</span>
            <span
              className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2"
              style={{ borderColor: '#04040a', background: '#6ee7b7' }}
            />
          </div>
        </Link>

        {/* Divider */}
        <div className="mx-auto mb-3 h-px w-8" style={{ background: 'var(--nx-border)' }} />

        {/* Nav Items */}
        <nav className="flex flex-1 flex-col items-center gap-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link key={item.id} href={item.href} className={`nx-rail-icon ${active ? 'active' : ''}`}>
                <Icon size={20} strokeWidth={active ? 2 : 1.4} />
                <span className="nx-rail-tooltip">{item.label}</span>
                {item.badge && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full text-[8px] font-bold"
                    style={{ background: 'var(--nx-gold)', color: '#000' }}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom: system status + logout */}
        <div className="flex flex-col items-center gap-2 pb-2">
          <div className="relative flex h-3 w-3 items-center justify-center">
            <span className="absolute h-full w-full animate-ping rounded-full opacity-30" style={{ background: '#6ee7b7' }} />
            <span className="relative h-2 w-2 rounded-full" style={{ background: '#6ee7b7' }} />
          </div>
          <div className="mx-auto my-2 h-px w-8" style={{ background: 'var(--nx-border)' }} />
          <button className="nx-rail-icon" style={{ color: 'var(--nx-text-3)' }} title="تسجيل الخروج">
            <LogOut size={18} strokeWidth={1.4} />
            <span className="nx-rail-tooltip">تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Desktop spacer */}
      <div className="hidden md:block" style={{ width: 'var(--nx-rail-w)', flexShrink: 0 }} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   COMMAND BAR — Top bar, intelligence-first
   ═══════════════════════════════════════════════════════════════ */

interface CommandBarProps {
  onMenuToggle: () => void;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return 'ليلة هادئة';
  if (h < 12) return 'صباح الخير';
  if (h < 17) return 'مساء النور';
  if (h < 21) return 'مساء الخير';
  return 'ليلة سعيدة';
}

export function CommandBar({ onMenuToggle }: CommandBarProps): ReactElement {
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }));
      setDate(now.toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long' }));
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="nx-command-bar">
      {/* Right side: greeting */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="flex h-9 w-9 items-center justify-center rounded-xl md:hidden"
          style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--nx-text-2)' }}
        >
          <Menu size={18} />
        </button>

        <div>
          <p className="text-[14px] font-bold" style={{ color: 'var(--nx-text-1)' }}>
            {getGreeting()}، <span className="nx-gold-text">سعد</span>
          </p>
          <p className="text-[11px]" style={{ color: 'var(--nx-text-3)' }}>
            {date} · {time}
          </p>
        </div>
      </div>

      {/* Left side: actions */}
      <div className="flex items-center gap-3">
        {/* Notification */}
        <button className="relative flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300 hover:bg-white/[0.03]"
          style={{ color: 'var(--nx-text-3)' }}
        >
          <Bell size={18} strokeWidth={1.5} />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full nx-animate-pulse"
            style={{ background: 'var(--nx-gold)' }}
          />
        </button>

        {/* Owner avatar */}
        <div className="flex items-center gap-3 rounded-xl px-3 py-1.5 transition-all duration-300 cursor-pointer hover:bg-white/[0.02]">
          <div className="relative">
            <div className="flex h-8 w-8 items-center justify-center rounded-full"
              style={{
                background: 'linear-gradient(135deg, rgba(212,168,83,0.15), rgba(212,168,83,0.05))',
                border: '1px solid rgba(212,168,83,0.15)',
              }}
            >
              <span className="text-[12px] font-bold nx-gold-text">س</span>
            </div>
          </div>
          <span className="hidden text-[12px] font-semibold lg:block" style={{ color: 'var(--nx-text-2)' }}>
            سعد الغامدي
          </span>
        </div>
      </div>
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MOBILE NAV DRAWER
   ═══════════════════════════════════════════════════════════════ */

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
}

export function MobileNav({ open, onClose }: MobileNavProps): ReactElement | null {
  const pathname = usePathname();

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed inset-y-0 end-0 z-50 w-[280px] flex flex-col"
        style={{
          background: 'linear-gradient(180deg, rgba(8,8,14,0.98) 0%, rgba(4,4,8,1) 100%)',
          borderInlineStart: '1px solid var(--nx-border)',
        }}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b px-5" style={{ borderColor: 'var(--nx-border)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: 'linear-gradient(135deg, #d4a853, #c49a3f)', boxShadow: '0 4px 16px rgba(212,168,83,0.2)' }}
            >
              <span className="text-[13px] font-black text-[#04040a]">S</span>
            </div>
            <span className="text-[13px] font-bold nx-gold-text">SERVIX</span>
          </div>
          <button onClick={onClose} className="rounded-lg p-2" style={{ color: 'var(--nx-text-3)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 text-[13px] font-medium transition-all duration-300"
                    style={{
                      color: active ? 'var(--nx-gold)' : 'var(--nx-text-2)',
                      background: active ? 'rgba(212,168,83,0.06)' : 'transparent',
                      borderInlineEnd: active ? '2px solid var(--nx-gold)' : '2px solid transparent',
                    }}
                  >
                    <Icon size={18} strokeWidth={active ? 2 : 1.4} />
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full text-[9px] font-bold"
                        style={{ background: 'var(--nx-gold)', color: '#000' }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t px-4 py-4" style={{ borderColor: 'var(--nx-border)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ background: 'linear-gradient(135deg, rgba(212,168,83,0.15), rgba(212,168,83,0.05))', border: '1px solid rgba(212,168,83,0.15)' }}
            >
              <span className="text-[13px] font-bold nx-gold-text">س</span>
            </div>
            <div>
              <p className="text-[13px] font-bold" style={{ color: 'var(--nx-text-1)' }}>سعد الغامدي</p>
              <p className="text-[10px]" style={{ color: 'var(--nx-text-3)' }}>مدير المنصة</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
