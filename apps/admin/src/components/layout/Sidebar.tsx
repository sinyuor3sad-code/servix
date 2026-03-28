'use client';

import { useEffect, useState } from 'react';
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
  LogOut,
  BarChart3,
  Bell,
  ChevronDown,
  Receipt,
  BadgePercent,
  History,
  Layers,
  ToggleRight,
  Activity,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

interface SubItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
  badgeColor?: string;
  children?: SubItem[];
}

/* ═══════════════════════════════════════════════════════════════
   NAV CONFIG
   ═══════════════════════════════════════════════════════════════ */

const NAV: NavItem[] = [
  {
    id: 'dashboard',
    label: 'لوحة المؤشرات الاستراتيجية',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    id: 'tenants',
    label: 'إدارة الشركات',
    href: '/tenants',
    icon: Building2,
    badge: 47,
    badgeColor: 'bg-amber-500/12 text-amber-400 border-amber-500/18',
  },
  {
    id: 'subscriptions',
    label: 'الاشتراكات والخطط',
    href: '/subscriptions',
    icon: CreditCard,
    children: [
      { label: 'الاشتراكات النشطة',  href: '/subscriptions',          icon: CreditCard },
      { label: 'سجل المدفوعات',     href: '/subscriptions/payments',  icon: Receipt },
      { label: 'الكوبونات',         href: '/subscriptions/coupons',   icon: BadgePercent },
      { label: 'التجديدات',         href: '/subscriptions/renewals',  icon: History },
    ],
  },
  {
    id: 'invoices',
    label: 'الفواتير والمدفوعات',
    href: '/invoices',
    icon: FileText,
    badge: 4,
    badgeColor: 'bg-red-500/10 text-red-400 border-red-500/15',
  },
  {
    id: 'plans',
    label: 'الباقات والميزات',
    href: '/plans',
    icon: Package,
    children: [
      { label: 'إدارة الباقات',     href: '/plans',          icon: Layers },
      { label: 'إدارة الميزات',     href: '/features',       icon: ToggleRight },
    ],
  },
  {
    id: 'analytics',
    label: 'التحليلات والتقارير',
    href: '/analytics',
    icon: BarChart3,
  },
  {
    id: 'system',
    label: 'صحة النظام',
    href: '/system',
    icon: Activity,
  },
  {
    id: 'logs',
    label: 'سجل العمليات',
    href: '/audit-logs',
    icon: ScrollText,
  },
  {
    id: 'notifs',
    label: 'الإشعارات الجماعية',
    href: '/notifications',
    icon: Bell,
    badge: 2,
    badgeColor: 'bg-violet-500/10 text-violet-400 border-violet-500/15',
  },
  {
    id: 'settings',
    label: 'الإعدادات',
    href: '/settings',
    icon: Settings,
  },
];

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

function isActiveRoute(pathname: string, item: NavItem): boolean {
  if (item.href === '/dashboard') return pathname === '/dashboard';
  if (item.children) return item.children.some(c => pathname.startsWith(c.href));
  return pathname.startsWith(item.href);
}

function isActiveChild(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/');
}

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR COMPONENT
   ═══════════════════════════════════════════════════════════════ */

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps): React.ReactElement {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  useEffect(() => {
    const auto: Record<string, boolean> = {};
    for (const item of NAV) {
      if (item.children && isActiveRoute(pathname, item)) {
        auto[item.id] = true;
      }
    }
    setExpanded(prev => ({ ...prev, ...auto }));
  }, [pathname]);

  const toggle = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const content = (
    <div className="flex h-full flex-col">

      {/* ── LOGO ── */}
      <div className="flex h-[68px] items-center justify-between border-b border-white/[0.04] px-5">
        <Link href="/dashboard" className="flex items-center gap-3" onClick={onMobileClose}>
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 shadow-lg shadow-amber-500/25">
              <Sparkles className="h-[18px] w-[18px] text-black" strokeWidth={2.5} />
            </div>
            <span className="absolute -bottom-0.5 -left-0.5 flex h-3 w-3 items-center justify-center rounded-full border-[2px] border-[#0a0a0e] bg-emerald-500">
              <span className="block h-1.5 w-1.5 rounded-full bg-white" />
            </span>
          </div>
          <div className="overflow-hidden">
            <p className="text-[14px] font-extrabold tracking-tight text-amber-400 leading-tight">Obsidian Nexus</p>
            <p className="text-[9px] font-bold tracking-[0.18em] text-white/18 leading-tight">SERVIX SUPER ADMIN</p>
          </div>
        </Link>
        <button onClick={onMobileClose} className="rounded-lg p-1.5 text-white/25 hover:bg-white/[0.05] md:hidden">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* ── SECTION LABEL ── */}
      <div className="px-5 pt-5 pb-2">
        <p className="text-[10px] font-bold tracking-[0.15em] text-white/12">القائمة الرئيسية</p>
      </div>

      {/* ── NAV ── */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4 scrollbar-thin">
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const active = isActiveRoute(pathname, item);
            const Icon = item.icon;
            const hasChildren = !!item.children;
            const isOpen = expanded[item.id];

            return (
              <li key={item.id}>
                {/* Parent item */}
                {hasChildren ? (
                  <button
                    onClick={() => toggle(item.id)}
                    className={`
                      relative flex w-full items-center gap-3 rounded-[13px] px-3 py-[11px]
                      text-[13px] font-medium transition-all duration-300
                      ${active
                        ? 'text-amber-400'
                        : 'text-white/40 hover:bg-white/[0.025] hover:text-white/65'
                      }
                    `}
                  >
                    <Icon size={18} strokeWidth={active ? 2 : 1.5} className={active ? 'text-amber-400' : 'text-white/22'} />
                    <span className="flex-1 text-start">{item.label}</span>
                    {item.badge && (
                      <span className={`flex h-[20px] min-w-[20px] items-center justify-center rounded-full border px-1.5 text-[9px] font-bold leading-none ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                    )}
                    <ChevronDown
                      size={14}
                      className={`text-white/15 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                ) : (
                  <Link
                    href={item.href}
                    onClick={onMobileClose}
                    className={`
                      relative flex items-center gap-3 rounded-[13px] px-3 py-[11px]
                      text-[13px] font-medium transition-all duration-300
                      ${active
                        ? 'bg-gradient-to-l from-amber-500/[0.09] to-amber-500/[0.025] text-amber-400 shadow-[inset_0_0_0_1px_rgba(234,179,8,0.15)]'
                        : 'text-white/40 hover:bg-white/[0.025] hover:text-white/65'
                      }
                    `}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(234,179,8,0.6)]" />
                    )}
                    <Icon size={18} strokeWidth={active ? 2 : 1.5} className={active ? 'text-amber-400' : 'text-white/22'} />
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className={`flex h-[20px] min-w-[20px] items-center justify-center rounded-full border px-1.5 text-[9px] font-bold leading-none ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                )}

                {/* Children */}
                {hasChildren && (
                  <div
                    className="overflow-hidden transition-all duration-400 ease-[cubic-bezier(0.23,1,0.32,1)]"
                    style={{
                      maxHeight: isOpen ? `${item.children!.length * 44 + 12}px` : '0px',
                      opacity: isOpen ? 1 : 0,
                    }}
                  >
                    <ul className="mr-5 mt-1 space-y-0.5 border-r border-white/[0.04] pr-3">
                      {item.children!.map((child) => {
                        const childActive = isActiveChild(pathname, child.href);
                        const CIcon = child.icon;
                        return (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              onClick={onMobileClose}
                              className={`
                                flex items-center gap-2.5 rounded-xl px-3 py-2 text-[12px] font-medium transition-all duration-200
                                ${childActive
                                  ? 'bg-amber-500/[0.06] text-amber-400'
                                  : 'text-white/30 hover:bg-white/[0.02] hover:text-white/55'
                                }
                              `}
                            >
                              <CIcon size={14} strokeWidth={childActive ? 2 : 1.4} className={childActive ? 'text-amber-400/70' : 'text-white/15'} />
                              {child.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── SYSTEM STATUS ── */}
      <div className="mx-4 mb-3">
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/10 bg-emerald-500/[0.04] px-3.5 py-2.5">
          <Activity size={14} className="text-emerald-400" />
          <div className="flex-1">
            <p className="text-[11px] font-bold text-emerald-400">النظام يعمل بكفاءة</p>
            <p className="text-[9px] text-emerald-400/40">وقت التشغيل: 99.98%</p>
          </div>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
        </div>
      </div>

      {/* ── USER ── */}
      <div className="border-t border-white/[0.04] px-3 pb-4 pt-3">
        <div className="group flex items-center gap-3 rounded-[13px] px-3 py-2.5 transition-colors hover:bg-white/[0.025]">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/30 to-indigo-600/20 ring-2 ring-violet-500/15 transition-all duration-300 group-hover:ring-violet-500/25">
              <span className="text-[14px] font-bold text-violet-300">س</span>
            </div>
            <span className="absolute -bottom-0.5 -left-0.5 flex h-3 w-3 items-center justify-center rounded-full border-2 border-[#0a0a0e] bg-emerald-500">
              <span className="block h-1 w-1 rounded-full bg-white" />
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-white/75 group-hover:text-white/90">سعد الغامدي</p>
            <p className="text-[10px] font-medium text-white/20">مدير المنصة · Super Admin</p>
          </div>

          <button
            title="تسجيل الخروج"
            className="shrink-0 rounded-lg p-2 text-white/12 transition-all duration-300 hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut size={15} strokeWidth={1.7} />
          </button>
        </div>
      </div>
    </div>
  );

  const glass = {
    background: 'linear-gradient(180deg, rgba(10,10,14,0.98) 0%, rgba(6,6,10,1) 100%)',
    backdropFilter: 'blur(30px) saturate(120%)',
  };

  return (
    <>
      {/* Desktop */}
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:start-0 md:z-30 md:w-[272px] border-e border-white/[0.04]" style={glass}>
        {content}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" onClick={onMobileClose} />}

      {/* Mobile drawer */}
      <aside
        className={`fixed inset-y-0 end-0 z-50 w-[272px] border-s border-white/[0.04] transition-transform duration-300 md:hidden ${mobileOpen ? 'translate-x-0' : 'translate-x-full rtl:-translate-x-full'}`}
        style={glass}
      >
        {content}
      </aside>

      {/* Spacer */}
      <div className="hidden md:block shrink-0 w-[272px]" />
    </>
  );
}
