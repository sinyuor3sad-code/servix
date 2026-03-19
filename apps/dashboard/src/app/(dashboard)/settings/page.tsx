'use client';

import Link from 'next/link';
import {
  Building2,
  Palette,
  Clock,
  Users,
  Bell,
  CreditCard,
  ArrowLeft,
  SlidersHorizontal,
  UserCog,
} from 'lucide-react';
import { PageHeader, Card, CardContent } from '@/components/ui';

interface SettingsCard {
  title: string;
  description: string;
  href: string;
  icon: typeof Building2;
}

const settingsCards: SettingsCard[] = [
  {
    title: 'لوحة التحكم',
    description: 'الحجز الإلكتروني، الإجازة، الووك إن، والمزيد',
    href: '/settings/toggles',
    icon: SlidersHorizontal,
  },
  {
    title: 'بيانات الصالون',
    description: 'الاسم، العنوان، معلومات الاتصال',
    href: '/settings/salon',
    icon: Building2,
  },
  {
    title: 'الشعار والثيم',
    description: 'المظهر، الألوان، الشعار',
    href: '/settings/branding',
    icon: Palette,
  },
  {
    title: 'ساعات العمل',
    description: 'أوقات الفتح والإغلاق لكل يوم',
    href: '/settings/working-hours',
    icon: Clock,
  },
  {
    title: 'المستخدمين والصلاحيات',
    description: 'إدارة الأدوار والمستخدمين',
    href: '/settings/users',
    icon: Users,
  },
  {
    title: 'الإشعارات',
    description: 'إعدادات التنبيهات والإشعارات',
    href: '/settings/notifications',
    icon: Bell,
  },
  {
    title: 'الاشتراك',
    description: 'الخطة الحالية والترقية',
    href: '/settings/subscription',
    icon: CreditCard,
  },
  {
    title: 'الحساب',
    description: 'تصدير البيانات وحذف الحساب',
    href: '/settings/account',
    icon: UserCog,
  },
];

export default function SettingsPage(): React.ReactElement {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="الإعدادات"
        description="إدارة إعدادات الصالون والحساب"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {settingsCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href}>
              <Card className="group h-full cursor-pointer transition-all hover:shadow-md hover:border-[var(--brand-primary)]">
                <CardContent className="flex flex-col p-6">
                  <div className="flex items-start justify-between">
                    <div className="rounded-xl bg-[var(--primary-50)] p-3">
                      <Icon className="h-6 w-6 text-[var(--brand-primary)]" />
                    </div>
                    <ArrowLeft className="h-5 w-5 text-[var(--muted-foreground)] transition-transform group-hover:-translate-x-1" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-[var(--foreground)]">
                    {card.title}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                    {card.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
