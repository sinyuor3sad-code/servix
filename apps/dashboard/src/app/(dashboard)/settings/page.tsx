'use client';

import Link from 'next/link';
import { Building2, Palette, Clock, Users, Bell, CreditCard, SlidersHorizontal, UserCog, ChevronLeft, QrCode, TrendingUp, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const CARDS = [
  { title: 'لوحة التحكم',   desc: 'الحجز، الإجازة، الووك إن', href: '/settings/toggles',       icon: SlidersHorizontal, iconColor: 'bg-violet-500/10 text-violet-600' },
  { title: 'بيانات الصالون', desc: 'الاسم، العنوان، التواصل',     href: '/settings/salon',         icon: Building2,         iconColor: 'bg-blue-500/10 text-blue-600' },
  { title: 'الشعار والثيم',  desc: 'المظهر، الألوان، الشعار',    href: '/settings/branding',      icon: Palette,           iconColor: 'bg-rose-500/10 text-rose-600' },
  { title: 'المنيو والعرض العام', desc: 'ثيم المنيو الذكي والغلاف',   href: '/settings/smart-menu',    icon: QrCode,            iconColor: 'bg-cyan-500/10 text-cyan-600' },
  { title: 'ساعات العمل',    desc: 'الفتح والإغلاق لكل يوم',    href: '/settings/working-hours', icon: Clock,             iconColor: 'bg-amber-500/10 text-amber-600' },
  { title: 'المستخدمين',     desc: 'الأدوار والصلاحيات',          href: '/settings/users',         icon: Users,             iconColor: 'bg-emerald-500/10 text-emerald-600' },
  { title: 'الإشعارات',      desc: 'التنبيهات والإشعارات',        href: '/settings/notifications', icon: Bell,              iconColor: 'bg-red-500/10 text-red-500' },
  { title: 'الاشتراك',       desc: 'الخطة الحالية والترقية',       href: '/settings/subscription',  icon: CreditCard,        iconColor: 'bg-indigo-500/10 text-indigo-600' },
  { title: 'التسعير الديناميكي', desc: 'قواعد الذروة والعطلات والصلاة', href: '/settings/pricing',       icon: TrendingUp,        iconColor: 'bg-lime-500/10 text-lime-600' },
  { title: 'الحساب',         desc: 'البيانات وإدارة الحساب',       href: '/settings/account',       icon: UserCog,           iconColor: 'bg-slate-500/10 text-slate-500' },
];

export default function SettingsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-8">
      {/* Hero Header */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-bl from-slate-900 via-slate-800 to-slate-900 p-8">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-violet-500/15 to-transparent rounded-full blur-3xl" />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
            <SlidersHorizontal className="h-6 w-6 text-white/80" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">الإعدادات</h1>
            <p className="text-sm text-white/40 mt-0.5">إدارة إعدادات الصالون والحساب</p>
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARDS.map(card => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href}>
              <div className="group relative rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--card)] p-6 transition-all duration-500 hover:shadow-lg hover:shadow-black/[0.04] hover:-translate-y-1 hover:border-[var(--foreground)]/[0.12] cursor-pointer h-full">
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-5">
                    <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300', card.iconColor)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-[var(--muted)] flex items-center justify-center opacity-0 -translate-x-3 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                      <ArrowUpRight className="h-4 w-4 text-[var(--muted-foreground)]" />
                    </div>
                  </div>
                  <h3 className="text-[15px] font-bold text-[var(--foreground)] mb-1">{card.title}</h3>
                  <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">{card.desc}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
