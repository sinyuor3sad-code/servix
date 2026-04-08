'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import {
  LayoutDashboard, Building2, CreditCard, BarChart3,
  Shield, FileText, ScrollText, Settings, Bell,
  Package, LogOut, Sun, Moon, HardDrive, Users,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

const NAV = [
  { section: 'القيادة' },
  { href: '/dashboard', label: 'مركز القيادة', icon: LayoutDashboard },
  { href: '/analytics', label: 'التحليلات', icon: BarChart3 },
  { section: 'الإدارة' },
  { href: '/tenants', label: 'الأقاليم', icon: Building2 },
  { href: '/users', label: 'المستخدمون', icon: Users },
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

export function Sidebar() {
  const pathname = usePathname();
  const logout = useAuthStore((s) => s.logout);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const saved = localStorage.getItem('nexus-theme');
    if (saved === 'light' || saved === 'dark') {
      setTheme(saved);
    } else {
      setTheme(document.documentElement.getAttribute('data-theme') as 'dark' | 'light' || 'dark');
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('nexus-theme', next);
  }, [theme]);

  return (
    <nav className="nx-sidebar">
      {/* Brand */}
      <div className="nx-sidebar-brand">
        <span className="nx-sidebar-brand-text">SERVIX</span>
        <span className="nx-sidebar-brand-ver">v9</span>
      </div>

      {/* Nav links */}
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

      {/* Bottom controls */}
      <div className="nx-sidebar-bottom">
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
  );
}
