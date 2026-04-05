'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Globe, Palmtree, MessageCircle, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch, Spinner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useSettingsSocket } from '@/hooks/useSettingsSocket';
import { settingsService } from '@/services/settings.service';
import { toast } from 'sonner';

const GROUPS = [
  {
    title: 'الحجز الإلكتروني', desc: 'إعدادات صفحة الحجز العامة', icon: Globe, gradient: 'from-violet-500 to-purple-600',
    keys: [
      { key: 'online_booking_enabled', label: 'تفعيل الحجز الإلكتروني', type: 'toggle' as const },
      { key: 'auto_confirm_booking', label: 'تأكيد الحجز تلقائياً', type: 'toggle' as const },
      { key: 'walk_in_enabled', label: 'تفعيل الووك إن', type: 'toggle' as const },
      { key: 'booking_advance_days', label: 'أقصى أيام للحجز مسبقاً', desc: '0 = غير محدود', type: 'number' as const },
      { key: 'min_booking_notice_hours', label: 'ساعات الإشعار قبل الحجز', type: 'number' as const },
      { key: 'cancellation_deadline_hours', label: 'ساعات قبل الموعد للإلغاء', type: 'number' as const },
      { key: 'max_daily_bookings', label: 'الحد الأقصى للحجوزات اليومية', desc: '0 = غير محدود', type: 'number' as const },
    ],
  },
  {
    title: 'وضع الإجازة', desc: 'إيقاف استقبال الحجوزات مؤقتاً', icon: Palmtree, gradient: 'from-amber-500 to-orange-600',
    keys: [
      { key: 'vacation_mode', label: 'تفعيل وضع الإجازة', type: 'toggle' as const },
      { key: 'vacation_message_ar', label: 'رسالة الإجازة', type: 'text' as const },
      { key: 'vacation_start_date', label: 'بداية الإجازة', type: 'date' as const },
      { key: 'vacation_end_date', label: 'نهاية الإجازة', type: 'date' as const },
    ],
  },
  {
    title: 'قنوات التواصل', desc: 'الرسائل التلقائية والإشعارات', icon: MessageCircle, gradient: 'from-emerald-500 to-teal-600',
    keys: [
      { key: 'whatsapp_enabled', label: 'تفعيل واتساب', type: 'toggle' as const },
      { key: 'whatsapp_token', label: 'توكن واتساب', desc: 'من Meta for Developers', type: 'text' as const },
      { key: 'whatsapp_phone_number_id', label: 'Phone Number ID', type: 'text' as const },
      { key: 'sms_enabled', label: 'الرسائل النصية', type: 'toggle' as const },
      { key: 'email_enabled', label: 'البريد الإلكتروني', type: 'toggle' as const },
      { key: 'whatsapp_booking_confirm', label: 'تأكيد الحجز واتساب', type: 'toggle' as const },
      { key: 'whatsapp_booking_reminder', label: 'تذكير الحجز واتساب', type: 'toggle' as const },
      { key: 'whatsapp_invoice_send', label: 'إرسال الفاتورة واتساب', type: 'toggle' as const },
      { key: 'whatsapp_review_request', label: 'طلب التقييم واتساب', type: 'toggle' as const },
    ],
  },
  {
    title: 'المزايا والخصومات', desc: 'برنامج الولاء والكوبونات', icon: Gift, gradient: 'from-rose-500 to-pink-600',
    keys: [
      { key: 'loyalty_enabled', label: 'برنامج الولاء', type: 'toggle' as const },
      { key: 'coupons_enabled', label: 'الكوبونات', type: 'toggle' as const },
    ],
  },
];

function parseBool(v: string | undefined): boolean { return v === 'true'; }

const inputClass = "px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm focus:border-[var(--brand-primary)] outline-none transition-all";

export default function TogglesPage() {
  const router = useRouter();
  const { accessToken, currentTenant } = useAuth();
  const qc = useQueryClient();
  useSettingsSocket(currentTenant?.id, !!accessToken && !!currentTenant);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsService.getAll(accessToken!),
    enabled: !!accessToken,
  });

  const mut = useMutation({
    mutationFn: (updates: { key: string; value: string }[]) => settingsService.updateBatch(accessToken!, updates),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); toast.success('✅ تم التحديث'); },
    onError: (err: Error) => toast.error(err.message || 'فشل التحديث'),
  });

  const [editing, setEditing] = useState<Record<string, string>>({});

  const handleToggle = (key: string, checked: boolean) => mut.mutate([{ key, value: checked ? 'true' : 'false' }]);
  const handleSave = (key: string, value: string) => {
    if (value !== (settings?.[key] ?? '')) mut.mutate([{ key, value }]);
    setEditing(p => { const n = { ...p }; delete n[key]; return n; });
  };

  if (isLoading || !settings) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/settings')} className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--muted)] transition">
          <ArrowRight className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-black">لوحة التحكم</h1>
          <p className="text-xs text-[var(--muted-foreground)]">تفعيل/إيقاف ميزات الصالون</p>
        </div>
      </div>

      {GROUPS.map(group => {
        const Icon = group.icon;
        return (
          <div key={group.title} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
            <div className={cn('px-5 py-4 bg-gradient-to-l text-white', group.gradient)}>
              <div className="flex items-center gap-2">
                <Icon className="h-5 w-5 opacity-70" />
                <div>
                  <h3 className="text-sm font-bold">{group.title}</h3>
                  <p className="text-[10px] opacity-70">{group.desc}</p>
                </div>
              </div>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {group.keys.map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{item.label}</p>
                    {'desc' in item && item.desc && <p className="text-[10px] text-[var(--muted-foreground)]">{item.desc}</p>}
                  </div>
                  {item.type === 'toggle' ? (
                    <Switch checked={parseBool(settings[item.key])} onCheckedChange={c => handleToggle(item.key, c)} disabled={mut.isPending} />
                  ) : (
                    <input
                      type={item.type === 'number' ? 'number' : item.type === 'date' ? 'date' : 'text'}
                      dir="ltr"
                      value={editing[item.key] ?? settings[item.key] ?? ''}
                      onChange={e => setEditing(p => ({ ...p, [item.key]: e.target.value }))}
                      onBlur={e => handleSave(item.key, e.target.value)}
                      className={cn(inputClass, 'w-36 text-center tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none')}
                      disabled={mut.isPending}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
