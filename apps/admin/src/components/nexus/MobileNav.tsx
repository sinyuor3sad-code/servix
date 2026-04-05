'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import {
  Menu, X, LayoutDashboard, Building2, CreditCard, BarChart3,
  Shield, FileText, ScrollText, Settings, Bell,
  Package, LogOut, Sun, Moon, HardDrive,
} from 'lucide-react';

const NAV = [
  { section: 'القيادة' },
  { href: '/dashboard', label: 'مركز القيادة', icon: LayoutDashboard },
  { href: '/analytics', label: 'التحليلات', icon: BarChart3 },
  { section: 'الإدارة' },
  { href: '/tenants', label: 'الأقاليم', icon: Building2 },
  { href: '/subscriptions', label: 'الاشتراكات', icon: CreditCard },
  { href: '/plans', label: 'الباقات', icon: Package },
  { href: '/invoices', label: 'الفواتير', icon: FileText },
  { section: 'النظام' },
  { href: '/system', label: 'صحة النظام', icon: Shield },
  { href: '/backups', label: 'النسخ الاحتياطي', icon: HardDrive },
  { href: '/audit-logs', label: 'سجل العمليات', icon: ScrollText },
  { href: '/notifications', label: 'الإشعارات', icon: Bell },
  { href: '/settings', label: 'الإعدادات', icon: Settings },
] as const;

export function MobileNav() {
  const pathname = usePathname();
  const logout = useAuthStore((s) => s.logout);
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const saved = localStorage.getItem('nexus-theme');
    if (saved === 'light' || saved === 'dark') setTheme(saved);
    else setTheme(document.documentElement.getAttribute('data-theme') as 'dark' | 'light' || 'dark');
  }, []);

  // Close on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  // Prevent body scroll when drawer open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('nexus-theme', next);
  }, [theme]);

  return (
    <>
      {/* Header bar */}
      <header className="nx-mobile-header">
        <span className="nx-mobile-brand">SERVIX</span>
        <button className="nx-hamburger" onClick={() => setOpen(true)}>
          <Menu size={20} />
        </button>
      </header>

      {/* Overlay */}
      <div
        className={`nx-drawer-overlay ${open ? 'nx-drawer-overlay--open' : ''}`}
        onClick={() => setOpen(false)}
      />

      {/* Drawer */}
      <nav className={`nx-drawer ${open ? 'nx-drawer--open' : ''}`}>
        <div className="nx-drawer-close">
          <button className="nx-hamburger" onClick={() => setOpen(false)}>
            <X size={18} />
          </button>
        </div>

        {NAV.map((item, i) => {
          if ('section' in item) {
            return <div key={i} className="nx-sidebar-section">{item.section}</div>;
          }
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nx-sidebar-link ${active ? 'nx-sidebar-link--active' : ''}`}
            >
              <Icon size={16} strokeWidth={1.5} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <button className="nx-sidebar-link" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={16} strokeWidth={1.5} /> : <Moon size={16} strokeWidth={1.5} />}
            <span>{theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}</span>
          </button>
          <button className="nx-sidebar-link" onClick={logout} style={{ color: 'rgba(248,113,113,0.5)' }}>
            <LogOut size={16} strokeWidth={1.5} />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </nav>
    </>
  );
}
