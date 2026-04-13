'use client';

import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Bell, MessageCircle, Mail, Smartphone, CalendarCheck, Receipt, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch, Spinner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { settingsService } from '@/services/settings.service';
import { toast } from 'sonner';

const NOTIF_GROUPS = [
  {
    title: 'إشعارات المواعيد', desc: 'تنبيهات الحجوزات والمواعيد', icon: CalendarCheck, accentBg: 'bg-violet-500/10', accentText: 'text-violet-600',
    items: [
      { key: 'notify_new_booking', label: 'إشعار عند حجز جديد' },
      { key: 'notify_booking_cancel', label: 'إشعار عند إلغاء حجز' },
      { key: 'notify_booking_reminder', label: 'تذكير قبل الموعد' },
      { key: 'notify_no_show', label: 'إشعار عدم الحضور' },
    ],
  },
  {
    title: 'إشعارات المالية', desc: 'الفواتير والمصروفات', icon: Receipt, accentBg: 'bg-emerald-500/10', accentText: 'text-emerald-600',
    items: [
      { key: 'notify_invoice_paid', label: 'إشعار عند دفع فاتورة' },
      { key: 'notify_daily_summary', label: 'ملخص يومي للإيرادات' },
    ],
  },
  {
    title: 'إشعارات العملاء', desc: 'العملاء الجدد والتقييمات', icon: Star, accentBg: 'bg-amber-500/10', accentText: 'text-amber-600',
    items: [
      { key: 'notify_new_client', label: 'إشعار عميل جديد' },
      { key: 'notify_new_review', label: 'إشعار تقييم جديد' },
    ],
  },
  {
    title: 'طريقة الإشعار', desc: 'قنوات استلام التنبيهات', icon: Smartphone, accentBg: 'bg-blue-500/10', accentText: 'text-blue-600',
    items: [
      { key: 'notify_via_push', label: 'إشعارات المتصفح (Push)' },
      { key: 'notify_via_email', label: 'إشعارات البريد الإلكتروني' },
      { key: 'notify_via_whatsapp', label: 'إشعارات واتساب' },
    ],
  },
];

function parseBool(v: string | undefined): boolean { return v === 'true'; }

export default function NotificationsPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const qc = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsService.getAll(accessToken!),
    enabled: !!accessToken,
  });

  const mut = useMutation({
    mutationFn: (updates: { key: string; value: string }[]) => settingsService.updateBatch(accessToken!, updates),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); toast.success('✅ تم التحديث'); },
    onError: () => toast.error('فشل التحديث'),
  });

  const toggle = (key: string, checked: boolean) => mut.mutate([{ key, value: checked ? 'true' : 'false' }]);

  if (isLoading || !settings) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/settings')} className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--muted)] transition">
          <ArrowRight className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-black">الإشعارات</h1>
          <p className="text-xs text-[var(--muted-foreground)]">إعدادات التنبيهات والإشعارات</p>
        </div>
      </div>

      {NOTIF_GROUPS.map(group => {
        const Icon = group.icon;
        return (
          <div key={group.title} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-3">
                <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', group.accentBg)}>
                  <Icon className={cn('h-4 w-4', group.accentText)} />
                </div>
                <div>
                  <h3 className="text-sm font-bold">{group.title}</h3>
                  <p className="text-[10px] text-[var(--muted-foreground)]">{group.desc}</p>
                </div>
              </div>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {group.items.map(item => (
                <div key={item.key} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <p className="text-sm font-bold">{item.label}</p>
                  <Switch
                    checked={parseBool(settings[item.key])}
                    onCheckedChange={c => toggle(item.key, c)}
                    disabled={mut.isPending}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Info */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
            <Bell className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="font-bold text-sm">الإشعارات الذكية</p>
            <p className="text-xs text-[var(--muted-foreground)] mt-1 leading-relaxed">
              الإشعارات يتم تسجيلها في إعدادات الصالون. لتفعيل واتساب، اذهبي إلى لوحة التحكم → قنوات التواصل وأضيفي بيانات واتساب.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
