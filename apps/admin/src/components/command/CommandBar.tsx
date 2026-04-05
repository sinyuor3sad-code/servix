'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Compass,
  Building2,
  DollarSign,
  BarChart3,
  Settings,
} from 'lucide-react';

const COMMANDS = [
  { id: 'nexus',    label: 'القيادة',     href: '/dashboard',     icon: Compass },
  { id: 'tenants',  label: 'الأقاليم',    href: '/tenants',       icon: Building2 },
  { id: 'revenue',  label: 'الإيرادات',   href: '/subscriptions', icon: DollarSign },
  { id: 'intel',    label: 'الاستخبارات', href: '/analytics',     icon: BarChart3 },
  { id: 'codex',    label: 'النظام',      href: '/system',        icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname.startsWith(href);
}

export function CommandBar() {
  const pathname = usePathname();

  return (
    <nav className="nx-cmdbar" role="navigation">
      {COMMANDS.map((cmd) => {
        const Icon = cmd.icon;
        const active = isActive(pathname, cmd.href);
        return (
          <Link
            key={cmd.id}
            href={cmd.href}
            className={`nx-cmdbar-item ${active ? 'active' : ''}`}
          >
            <Icon size={17} strokeWidth={active ? 2 : 1.4} />
            <span>{cmd.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
