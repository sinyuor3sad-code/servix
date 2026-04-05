'use client';

import Link from 'next/link';
import { Building2, Palette, Clock, Users, Bell, CreditCard, SlidersHorizontal, UserCog, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

const CARDS = [
  { title: 'لوحة التحكم',   desc: 'الحجز، الإجازة، الووك إن', href: '/settings/toggles',       icon: SlidersHorizontal, gradient: 'from-violet-500 to-purple-600' },
  { title: 'بيانات الصالون', desc: 'الاسم، العنوان، التواصل',     href: '/settings/salon',         icon: Building2,         gradient: 'from-sky-500 to-blue-600' },
  { title: 'الشعار والثيم',  desc: 'المظهر، الألوان، الشعار',    href: '/settings/branding',      icon: Palette,           gradient: 'from-fuchsia-500 to-pink-600' },
  { title: 'ساعات العمل',    desc: 'الفتح والإغلاق لكل يوم',    href: '/settings/working-hours', icon: Clock,             gradient: 'from-amber-500 to-orange-600' },
  { title: 'المستخدمين',     desc: 'الأدوار والصلاحيات',          href: '/settings/users',         icon: Users,             gradient: 'from-emerald-500 to-teal-600' },
  { title: 'الإشعارات',      desc: 'التنبيهات والإشعارات',        href: '/settings/notifications', icon: Bell,              gradient: 'from-rose-500 to-red-600' },
  { title: 'الاشتراك',       desc: 'الخطة الحالية والترقية',       href: '/settings/subscription',  icon: CreditCard,        gradient: 'from-indigo-500 to-blue-600' },
  { title: 'الحساب',         desc: 'البيانات وإدارة الحساب',       href: '/settings/account',       icon: UserCog,           gradient: 'from-slate-500 to-gray-600' },
];

export default function SettingsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary)]/70 flex items-center justify-center">
          <SlidersHorizontal className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black">الإعدادات</h1>
          <p className="text-sm text-[var(--muted-foreground)]">إدارة إعدادات الصالون والحساب</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARDS.map(card => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href}>
              <div className={cn('group relative rounded-2xl overflow-hidden bg-gradient-to-l text-white p-5 transition-all hover:shadow-xl hover:-translate-y-1 cursor-pointer h-full', card.gradient)}>
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.1),transparent)]" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                      <Icon className="h-5 w-5" />
                    </div>
                    <ChevronLeft className="h-4 w-4 opacity-40 group-hover:opacity-100 group-hover:-translate-x-1 transition-all" />
                  </div>
                  <h3 className="text-base font-black mt-3">{card.title}</h3>
                  <p className="text-[11px] opacity-70 mt-0.5">{card.desc}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
