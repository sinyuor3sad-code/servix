'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useSettingsSocket } from '@/hooks/useSettingsSocket';
import { settingsService } from '@/services/settings.service';
import { PageHeader, Card, CardContent, CardHeader, CardTitle, CardDescription, Switch, Input } from '@/components/ui';
import { Spinner } from '@/components/ui';
import { toast } from 'sonner';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

const TOGGLE_GROUPS: {
  title: string;
  description: string;
  keys: { key: string; label: string; description?: string; type?: 'toggle' | 'number' | 'text' | 'date' }[];
}[] = [
  {
    title: 'الحجز الإلكتروني',
    description: 'إعدادات صفحة الحجز العامة',
    keys: [
      { key: 'online_booking_enabled', label: 'تفعيل الحجز الإلكتروني', type: 'toggle' },
      { key: 'auto_confirm_booking', label: 'تأكيد الحجز تلقائياً', type: 'toggle' },
      { key: 'walk_in_enabled', label: 'تفعيل الووك إن', type: 'toggle' },
      { key: 'booking_advance_days', label: 'أقصى أيام للحجز مسبقاً', description: '0 = غير محدود', type: 'number' },
      { key: 'min_booking_notice_hours', label: 'الحد الأدنى لساعات الإشعار قبل الحجز', type: 'number' },
      { key: 'cancellation_deadline_hours', label: 'ساعات قبل الموعد للإلغاء', type: 'number' },
      { key: 'max_daily_bookings', label: 'الحد الأقصى للحجوزات اليومية', description: '0 = غير محدود', type: 'number' },
    ],
  },
  {
    title: 'وضع الإجازة',
    description: 'عند التفعيل: لا يُقبل حجوزات جديدة',
    keys: [
      { key: 'vacation_mode', label: 'وضع الإجازة', type: 'toggle' },
      { key: 'vacation_message_ar', label: 'رسالة الإجازة (عرضها للعملاء)', type: 'text' },
      { key: 'vacation_start_date', label: 'تاريخ بداية الإجازة', type: 'date' },
      { key: 'vacation_end_date', label: 'تاريخ نهاية الإجازة', type: 'date' },
    ],
  },
  {
    title: 'قنوات التواصل',
    description: 'الرسائل التلقائية والإشعارات. ربط واتساب: أضف التوكن ورقم الهاتف من Meta Business',
    keys: [
      { key: 'whatsapp_enabled', label: 'تفعيل واتساب', type: 'toggle' },
      { key: 'whatsapp_token', label: 'توكن واتساب (EAAxxxx...)', type: 'text', description: 'من Meta for Developers' },
      { key: 'whatsapp_phone_number_id', label: 'رقم الهاتف (Phone Number ID)', type: 'text', description: 'من إعدادات واتساب Business' },
      { key: 'sms_enabled', label: 'تفعيل الرسائل النصية', type: 'toggle' },
      { key: 'email_enabled', label: 'تفعيل البريد الإلكتروني', type: 'toggle' },
      { key: 'whatsapp_booking_confirm', label: 'تأكيد الحجز عبر واتساب', type: 'toggle' },
      { key: 'whatsapp_booking_reminder', label: 'تذكير الحجز عبر واتساب', type: 'toggle' },
      { key: 'whatsapp_invoice_send', label: 'إرسال الفاتورة عبر واتساب', type: 'toggle' },
      { key: 'whatsapp_review_request', label: 'طلب التقييم عبر واتساب', type: 'toggle' },
    ],
  },
  {
    title: 'المزايا والخصومات',
    description: 'برنامج الولاء والكوبونات',
    keys: [
      { key: 'loyalty_enabled', label: 'تفعيل برنامج الولاء', type: 'toggle' },
      { key: 'coupons_enabled', label: 'تفعيل الكوبونات', type: 'toggle' },
    ],
  },
];

function parseBool(value: string | undefined): boolean {
  return value === 'true';
}

export default function TogglesPage(): React.ReactElement {
  const { accessToken, currentTenant } = useAuth();
  const queryClient = useQueryClient();

  useSettingsSocket(currentTenant?.id, !!accessToken && !!currentTenant);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsService.getAll(accessToken!),
    enabled: !!accessToken,
  });

  const updateMutation = useMutation({
    mutationFn: (updates: { key: string; value: string }[]) =>
      settingsService.updateBatch(accessToken!, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('تم تحديث الإعدادات');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'فشل في تحديث الإعدادات');
    },
  });

  const handleToggle = (key: string, checked: boolean) => {
    updateMutation.mutate([{ key, value: checked ? 'true' : 'false' }]);
  };

  const [editingValues, setEditingValues] = useState<Record<string, string>>({});

  const handleValueChange = (key: string, value: string) => {
    updateMutation.mutate([{ key, value }]);
    setEditingValues((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  if (isLoading || !settings) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="لوحة التحكم"
        description="تفعيل/إيقاف ميزات الصالون"
      />

      <div className="grid gap-6">
        {TOGGLE_GROUPS.map((group) => (
          <Card key={group.title}>
            <CardHeader>
              <CardTitle>{group.title}</CardTitle>
              <CardDescription>{group.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {group.keys.map(({ key, label, description, type = 'toggle' }) => (
                <div
                  key={key}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-[var(--foreground)]">{label}</p>
                    {description && (
                      <p className="text-sm text-[var(--muted-foreground)]">
                        {description}
                      </p>
                    )}
                  </div>
                  {type === 'toggle' ? (
                    <Switch
                      checked={parseBool(settings[key])}
                      onCheckedChange={(checked) => handleToggle(key, checked)}
                      disabled={updateMutation.isPending}
                    />
                  ) : (
                    <Input
                      type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
                      value={editingValues[key] ?? settings[key] ?? ''}
                      onChange={(e) =>
                        setEditingValues((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      onBlur={(e) => {
                        const v = e.target.value;
                        if (v !== (settings[key] ?? '')) handleValueChange(key, v);
                      }}
                      className="w-40"
                      disabled={updateMutation.isPending}
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-dashed">
        <CardContent className="flex items-center justify-between p-6">
          <div>
            <p className="font-medium">رسالة الإجازة وتواريخها</p>
            <p className="text-sm text-[var(--muted-foreground)]">
              تعديل النص المعروض عند تفعيل وضع الإجازة
            </p>
          </div>
          <Link
            href="/settings/salon"
            className="inline-flex items-center gap-2 text-sm text-[var(--brand-primary)] hover:underline"
          >
            إعدادات الصالون
            <ArrowRight className="h-4 w-4" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
