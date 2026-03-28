'use client';

import { type ReactElement } from 'react';
import { BarChart3, TrendingUp, Users, DollarSign, MapPin, CalendarCheck } from 'lucide-react';
import { Glass, PageTitle, TN } from '@/components/ui/glass';

const CITY_DATA = [
  { city: 'الرياض',  tenants: 18, revenue: 182400, pct: 42 },
  { city: 'جدة',     tenants: 12, revenue: 98500,  pct: 28 },
  { city: 'الدمام',  tenants: 6,  revenue: 45200,  pct: 14 },
  { city: 'مكة',     tenants: 4,  revenue: 22100,  pct: 8 },
  { city: 'المدينة', tenants: 3,  revenue: 18200,  pct: 5 },
  { city: 'أخرى',    tenants: 4,  revenue: 12600,  pct: 3 },
];

const MONTHLY = [
  { month: 'يناير', revenue: 89400, tenants: 38 },
  { month: 'فبراير', revenue: 102300, tenants: 42 },
  { month: 'مارس', revenue: 124850, tenants: 47 },
];

export default function AnalyticsPage(): ReactElement {
  return (
    <div className="space-y-5">
      <PageTitle title="التحليلات والتقارير" desc="إحصائيات تفصيلية عن أداء المنصة والشركات" />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'نمو الإيرادات', value: '+22%', icon: TrendingUp, color: 'text-emerald-400' },
          { label: 'متوسط الإيراد/شركة', value: '2,657 ر.س', icon: DollarSign, color: 'text-amber-400' },
          { label: 'معدل التحويل', value: '68%', icon: Users, color: 'text-violet-400' },
          { label: 'الحجوزات اليومية', value: '948', icon: CalendarCheck, color: 'text-sky-400' },
        ].map((k) => {
          const Icon = k.icon;
          return (
            <Glass key={k.label} hover>
              <div className="flex items-center gap-4 px-5 py-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.025]">
                  <Icon size={18} className={`${k.color} opacity-75`} strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-white/25">{k.label}</p>
                  <p className={`text-lg font-extrabold ${k.color}`} style={TN}>{k.value}</p>
                </div>
              </div>
            </Glass>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Chart placeholder */}
        <Glass className="lg:col-span-7">
          <div className="p-7">
            <h2 className="mb-5 text-[15px] font-bold text-white/70">الإيرادات الشهرية</h2>
            <div className="space-y-3">
              {MONTHLY.map((m) => (
                <div key={m.month} className="flex items-center gap-4">
                  <span className="w-16 text-[12px] font-semibold text-white/35">{m.month}</span>
                  <div className="flex-1 h-8 rounded-lg bg-white/[0.02] overflow-hidden">
                    <div className="h-full rounded-lg bg-gradient-to-l from-amber-500/30 to-amber-500/10" style={{ width: `${(m.revenue / 130000) * 100}%` }} />
                  </div>
                  <span className="w-24 text-end text-[13px] font-bold text-amber-400/60" style={TN}>{m.revenue.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </Glass>

        {/* City distribution */}
        <Glass className="lg:col-span-5">
          <div className="p-7">
            <h2 className="mb-5 flex items-center gap-2 text-[15px] font-bold text-white/70"><MapPin size={16} className="text-white/30" />التوزيع الجغرافي</h2>
            <div className="space-y-3">
              {CITY_DATA.map((c) => (
                <div key={c.city} className="flex items-center gap-3">
                  <span className="w-14 text-[12px] font-semibold text-white/45">{c.city}</span>
                  <div className="flex-1 h-2 rounded-full bg-white/[0.03] overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-l from-violet-400/50 to-violet-500/20" style={{ width: `${c.pct}%` }} />
                  </div>
                  <span className="text-[11px] font-bold text-violet-400/60" style={TN}>{c.tenants}</span>
                  <span className="text-[11px] text-white/15" style={TN}>{c.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </Glass>
      </div>
    </div>
  );
}
