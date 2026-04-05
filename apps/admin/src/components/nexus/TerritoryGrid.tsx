'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';
import {
  Building2,
  DollarSign,
  BarChart3,
  Settings,
} from 'lucide-react';

export interface Territory {
  id: string;
  name: string;
  href: string;
  icon: React.ElementType;
  metric?: string | number;
  metricLabel?: string;
  accentColor: string;
  accentBg: string;
}

const DEFAULT_TERRITORIES: Territory[] = [
  {
    id: 'tenants',
    name: 'الأقاليم',
    href: '/tenants',
    icon: Building2,
    metricLabel: 'صالون مسجل',
    accentColor: '#8B5CF6',
    accentBg: 'rgba(139,92,246,0.08)',
  },
  {
    id: 'revenue',
    name: 'الإيرادات',
    href: '/subscriptions',
    icon: DollarSign,
    metricLabel: 'اشتراك نشط',
    accentColor: '#10B981',
    accentBg: 'rgba(16,185,129,0.08)',
  },
  {
    id: 'intelligence',
    name: 'الاستخبارات',
    href: '/analytics',
    icon: BarChart3,
    metricLabel: 'تحليل متاح',
    accentColor: '#6366F1',
    accentBg: 'rgba(99,102,241,0.08)',
  },
  {
    id: 'codex',
    name: 'البنية التحتية',
    href: '/system',
    icon: Settings,
    metricLabel: 'خدمة نشطة',
    accentColor: '#C9A84C',
    accentBg: 'rgba(201,168,76,0.08)',
  },
];

export function TerritoryGrid({ territories }: { territories?: Territory[] }): ReactElement {
  const items = territories || DEFAULT_TERRITORIES;

  return (
    <div className="os-enter os-enter-5">
      <div className="os-section-label">الأقاليم</div>
      <div className="os-territories">
        {items.map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.id} href={t.href} className="os-territory">
              <div
                className="os-territory-icon"
                style={{ background: t.accentBg }}
              >
                <Icon size={22} strokeWidth={1.5} style={{ color: t.accentColor }} />
              </div>
              <div className="os-territory-name">{t.name}</div>
              {t.metric !== undefined && (
                <>
                  <div className="os-territory-metric os-num">
                    {typeof t.metric === 'number' ? t.metric.toLocaleString('en-US') : t.metric}
                  </div>
                  <div className="os-territory-label">{t.metricLabel}</div>
                </>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
