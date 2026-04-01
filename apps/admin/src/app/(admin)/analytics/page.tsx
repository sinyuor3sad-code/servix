'use client';

import { type ReactElement } from 'react';
import { BarChart3, TrendingUp, Users, DollarSign, MapPin, CalendarCheck } from 'lucide-react';
import { Glass, PageTitle, TN } from '@/components/ui/glass';

export default function AnalyticsPage(): ReactElement {
  return (
    <div className="space-y-5">
      <PageTitle title="التحليلات والتقارير" desc="إحصائيات تفصيلية عن أداء المنصة والشركات" />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'إجمالي الصالونات', value: '—', icon: Users, color: 'text-violet-400' },
          { label: 'إيرادات الشهر', value: '—', icon: DollarSign, color: 'text-amber-400' },
          { label: 'نمو الإيرادات', value: '—', icon: TrendingUp, color: 'text-emerald-400' },
          { label: 'الحجوزات اليومية', value: '—', icon: CalendarCheck, color: 'text-sky-400' },
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

      <Glass>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/10">
            <BarChart3 size={28} className="text-violet-400" />
          </div>
          <h3 className="text-lg font-bold text-white/70 mb-2">التحليلات قيد التطوير</h3>
          <p className="text-[13px] text-white/35 max-w-md">
            ستتوفر التحليلات التفصيلية والرسوم البيانية بعد تسجيل عدد كافٍ من الصالونات في المنصة.
          </p>
        </div>
      </Glass>
    </div>
  );
}
