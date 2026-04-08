'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import {
  Menu, X, LayoutDashboard, Building2, CreditCard, BarChart3,
  Shield, FileText, ScrollText, Settings, Bell,
  Package, LogOut, Sun, Moon, HardDrive, MoreHorizontal, Users,
} from 'lucide-react';

/* ── Route → Page Title mapping ── */
const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'مركز القيادة',
  '/analytics': 'التحليلات',
  '/tenants': 'إدارة الأقاليم',
  '/users': 'المستخدمون',
  '/subscriptions': 'الاشتراكات',
  '/plans': 'الباقات',
  '/invoices': 'الفواتير',
  '/system': 'صحة النظام',
  '/backups': 'النسخ الاحتياطي',
  '/audit-logs': 'سجل العمليات',
  '/notifications': 'الإشعارات',
  '/settings': 'الإعدادات',
  '/features': 'الميزات',
};

/* ── Bottom Tab Bar Items ── */
const TAB_ITEMS = [
  { href: '/dashboard', label: 'الرئيسية', icon: LayoutDashboard },
  { href: '/tenants', label: 'الأقاليم', icon: Building2 },
  { href: '/subscriptions', label: 'الاشتراكات', icon: CreditCard },
  { href: '/invoices', label: 'الفواتير', icon: FileText },
];

/* ── Drawer-only items (accessed via "المزيد" tab) ── */
const NAV_EXTRA = [
  { section: 'التحليلات' },
  { href: '/analytics', label: 'التحليلات', icon: BarChart3 },
  { href: '/plans', label: 'الباقات', icon: Package },
  { section: 'الإدارة' },
  { href: '/users', label: 'المستخدمون', icon: Users },
  { section: 'النظام' },
  { href: '/system', label: 'صحة النظام', icon: Shield },
  { href: '/backups', label: 'النسخ الاحتياطي', icon: HardDrive },
  { href: '/audit-logs', label: 'سجل العمليات', icon: ScrollText },
  { href: '/notifications', label: 'الإشعارات', icon: Bell },
  { href: '/settings', label: 'الإعدادات', icon: Settings },
] as const;

function getPageTitle(pathname: string): string {
  // Exact match first
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  // Dynamic routes (e.g. /subscriptions/[id])
  const base = '/' + pathname.split('/').filter(Boolean)[0];
  return PAGE_TITLES[base] || 'SERVIX';
}

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

  const pageTitle = getPageTitle(pathname);
  const activeBase = '/' + pathname.split('/').filter(Boolean)[0];
  const isTabActive = TAB_ITEMS.some(t => t.href === activeBase);

  return (
    <>
      {/* ═══ Top App Header ═══ */}
      <header className="nx-mobile-header">
        <div className="nx-app-header-right">
          <div className="nx-app-logo">S</div>
          <div className="nx-app-header-titles">
            <span className="nx-app-header-brand">SERVIX</span>
            <span className="nx-app-header-page">{pageTitle}</span>
          </div>
        </div>
        <button className="nx-hamburger" onClick={() => setOpen(true)}>
          <Menu size={18} />
        </button>
      </header>

      {/* ═══ Bottom Tab Bar ═══ */}
      <nav className="nx-bottom-tabs">
        {TAB_ITEMS.map(item => {
          const Icon = item.icon;
          const active = activeBase === item.href;
          return (
            <Link key={item.href} href={item.href} className={`nx-tab-item ${active ? 'nx-tab-item--active' : ''}`}>
              <Icon size={20} strokeWidth={active ? 2 : 1.5} />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button className={`nx-tab-item ${!isTabActive ? 'nx-tab-item--active' : ''}`} onClick={() => setOpen(true)}>
          <MoreHorizontal size={20} strokeWidth={!isTabActive ? 2 : 1.5} />
          <span>المزيد</span>
        </button>
      </nav>

      {/* ═══ Drawer Overlay ═══ */}
      <div
        className={`nx-drawer-overlay ${open ? 'nx-drawer-overlay--open' : ''}`}
        onClick={() => setOpen(false)}
      />

      {/* ═══ Drawer Panel ═══ */}
      <nav className={`nx-drawer ${open ? 'nx-drawer--open' : ''}`}>
        <div className="nx-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="nx-app-logo" style={{ width: 36, height: 36, fontSize: 14 }}>S</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: '0.08em', color: 'var(--slate)' }}>SERVIX</div>
              <div style={{ fontSize: 10, color: 'var(--ghost)', fontWeight: 600 }}>نظام القيادة المركزي</div>
            </div>
          </div>
          <button className="nx-hamburger" style={{ width: 36, height: 36 }} onClick={() => setOpen(false)}>
            <X size={16} />
          </button>
        </div>

        {NAV_EXTRA.map((item, i) => {
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
