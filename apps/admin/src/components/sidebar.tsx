'use client';

import { useState } from 'react';
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Receipt,
  BarChart3,
  Activity,
  Bell,
  Settings,
  ChevronRight,
  ChevronLeft,
  LogOut,
  Sparkles,
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
  badgeColor?: 'gold' | 'red' | 'green';
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'لوحة المؤشرات الاستراتيجية', icon: LayoutDashboard },
  { id: 'tenants',   label: 'إدارة الشركات',              icon: Building2,   badge: 3, badgeColor: 'gold' },
  { id: 'plans',     label: 'الباقات والاشتراكات',         icon: CreditCard },
  { id: 'finance',   label: 'الماليات والفواتير',          icon: Receipt,     badge: 1, badgeColor: 'red' },
  { id: 'analytics', label: 'التحليلات والتقارير',         icon: BarChart3 },
  { id: 'health',    label: 'صحة النظام و Logs',           icon: Activity },
  { id: 'notifs',    label: 'الإشعارات الجماعية',          icon: Bell,        badge: 5, badgeColor: 'green' },
  { id: 'settings',  label: 'الإعدادات',                   icon: Settings },
];

function Badge({ count, color = 'gold' }: { count: number; color?: 'gold' | 'red' | 'green' }) {
  const colors = {
    gold:  'bg-amber-500/15 text-amber-400 border-amber-500/20',
    red:   'bg-red-500/12 text-red-400 border-red-500/15',
    green: 'bg-emerald-500/12 text-emerald-400 border-emerald-500/15',
  };
  return (
    <span className={`flex h-[22px] min-w-[22px] items-center justify-center rounded-full border px-1.5 text-[10px] font-bold leading-none ${colors[color]}`}>
      {count}
    </span>
  );
}

export default function Sidebar() {
  const [activeId, setActiveId] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`
        group/sidebar sticky top-0 flex h-screen flex-col
        border-l border-white/[0.04]
        transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]
        ${collapsed ? 'w-[76px]' : 'w-[280px]'}
      `}
      style={{
        background: 'linear-gradient(180deg, rgba(10,10,14,0.98) 0%, rgba(6,6,10,1) 100%)',
        backdropFilter: 'blur(30px) saturate(120%)',
      }}
    >

      {/* ═══ LOGO ═══ */}
      <div className={`flex items-center border-b border-white/[0.04] px-5 py-6 ${collapsed ? 'justify-center' : 'gap-3.5'}`}>
        <div className="relative shrink-0">
          <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 shadow-lg shadow-amber-500/20">
            <Sparkles className="h-5 w-5 text-black" strokeWidth={2.5} />
          </div>
          {/* Online indicator */}
          <span className="absolute -bottom-0.5 -left-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-[2.5px] border-[#0a0a0e] bg-emerald-500">
            <span className="block h-1.5 w-1.5 rounded-full bg-white" />
          </span>
        </div>

        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-[15px] font-extrabold tracking-tight text-amber-400">
              SERVIX
            </p>
            <p className="text-[10px] font-semibold tracking-[0.15em] text-white/20">
              OBSIDIAN NEXUS
            </p>
          </div>
        )}
      </div>

      {/* ═══ NAV ═══ */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = activeId === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => setActiveId(item.id)}
                title={collapsed ? item.label : undefined}
                className={`
                  relative flex w-full items-center gap-3 rounded-[14px] px-3 py-3
                  text-[13px] font-medium transition-all duration-300
                  ${collapsed ? 'justify-center' : ''}
                  ${isActive
                    ? 'bg-gradient-to-l from-amber-500/[0.08] to-amber-500/[0.03] text-amber-400 shadow-[inset_0_0_0_1px_rgba(234,179,8,0.15)]'
                    : 'text-white/40 hover:bg-white/[0.03] hover:text-white/70'
                  }
                `}
              >
                {/* Active glow bar */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
                )}

                <Icon
                  className={`shrink-0 transition-colors duration-300 ${
                    isActive ? 'text-amber-400' : 'text-white/25 group-hover/sidebar:text-white/40'
                  }`}
                  size={20}
                  strokeWidth={isActive ? 2 : 1.5}
                />

                {!collapsed && (
                  <>
                    <span className="flex-1 truncate text-start">{item.label}</span>
                    {item.badge && <Badge count={item.badge} color={item.badgeColor} />}
                  </>
                )}

                {collapsed && item.badge && (
                  <span className="absolute -left-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-black">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ═══ COLLAPSE TOGGLE ═══ */}
      <div className="px-3 pb-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[11px] font-medium text-white/20 transition-colors hover:bg-white/[0.03] hover:text-white/40"
        >
          {collapsed
            ? <ChevronLeft size={16} />
            : <><ChevronRight size={14} /><span>طي القائمة</span></>
          }
        </button>
      </div>

      {/* ═══ USER ═══ */}
      <div className="border-t border-white/[0.04] px-3 pb-5 pt-4">
        <div className={`flex items-center gap-3 rounded-[14px] px-3 py-2.5 transition-colors hover:bg-white/[0.03] ${collapsed ? 'justify-center' : ''}`}>
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/25 to-indigo-500/20 ring-2 ring-violet-500/10">
              <span className="text-sm font-bold text-violet-300">س</span>
            </div>
          </div>

          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-white/80">سعد الغامدي</p>
              <p className="text-[11px] text-white/25">مدير المنصة</p>
            </div>
          )}

          {!collapsed && (
            <button
              title="تسجيل الخروج"
              className="shrink-0 rounded-lg p-1.5 text-white/15 transition-colors hover:bg-red-500/10 hover:text-red-400"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
