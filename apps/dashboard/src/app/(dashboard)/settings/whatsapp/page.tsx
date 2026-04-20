'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  MessageCircle,
  RefreshCw,
  Trash2,
  Plug,
  UserX,
  Send,
  Clock,
  Gauge,
  ShieldAlert,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Spinner, Switch, Input, Button } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { settingsService } from '@/services/settings.service';
import {
  whatsappEvolutionService,
  type WhatsAppInstanceStatus,
} from '@/services/whatsapp-evolution.service';

const STATUS_STYLES: Record<
  WhatsAppInstanceStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  connected: { label: 'متصل', bg: 'bg-emerald-500/10', text: 'text-emerald-600', dot: 'bg-emerald-500' },
  connecting: { label: 'جارٍ الاتصال', bg: 'bg-amber-500/10', text: 'text-amber-600', dot: 'bg-amber-500' },
  qr_pending: { label: 'بانتظار QR', bg: 'bg-blue-500/10', text: 'text-blue-600', dot: 'bg-blue-500' },
  disconnected: { label: 'غير متصل', bg: 'bg-slate-500/10', text: 'text-slate-500', dot: 'bg-slate-400' },
  banned: { label: 'محظور', bg: 'bg-red-500/10', text: 'text-red-600', dot: 'bg-red-500' },
  error: { label: 'خطأ', bg: 'bg-red-500/10', text: 'text-red-600', dot: 'bg-red-500' },
};

function parseBool(v: string | undefined): boolean {
  return v === 'true';
}
function parseNum(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function WhatsAppSettingsPage(): React.ReactElement {
  const router = useRouter();
  const { accessToken } = useAuth();
  const qc = useQueryClient();

  const instanceQuery = useQuery({
    queryKey: ['whatsapp-evolution', 'status'],
    queryFn: () => whatsappEvolutionService.getStatus(accessToken!),
    enabled: !!accessToken,
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      return status === 'qr_pending' || status === 'connecting' ? 5000 : false;
    },
  });

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsService.getAll(accessToken!),
    enabled: !!accessToken,
  });

  const optOutsQuery = useQuery({
    queryKey: ['whatsapp-evolution', 'opt-outs'],
    queryFn: () => whatsappEvolutionService.listOptOuts(accessToken!),
    enabled: !!accessToken,
  });

  const connectMutation = useMutation({
    mutationFn: () => whatsappEvolutionService.getOrCreateInstance(accessToken!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp-evolution', 'status'] });
      toast.success('✅ تم إنشاء المثيل — امسحي رمز QR من تطبيق واتساب');
    },
    onError: () => toast.error('فشل إنشاء المثيل'),
  });

  const reconnectMutation = useMutation({
    mutationFn: () => whatsappEvolutionService.reconnect(accessToken!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp-evolution', 'status'] });
      toast.success('تم طلب QR جديد');
    },
    onError: () => toast.error('فشل إعادة الاتصال'),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => whatsappEvolutionService.deleteInstance(accessToken!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp-evolution', 'status'] });
      toast.success('تم فصل الحساب');
    },
    onError: () => toast.error('فشل الفصل'),
  });

  const settingsMutation = useMutation({
    mutationFn: (updates: { key: string; value: string }[]) =>
      settingsService.updateBatch(accessToken!, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      toast.success('تم الحفظ');
    },
    onError: () => toast.error('فشل الحفظ'),
  });

  const addOptOutMutation = useMutation({
    mutationFn: (body: { phone: string; reason?: string }) =>
      whatsappEvolutionService.addOptOut(accessToken!, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp-evolution', 'opt-outs'] });
      setNewOptOut('');
      toast.success('تمت الإضافة');
    },
    onError: () => toast.error('فشل الإضافة'),
  });

  const removeOptOutMutation = useMutation({
    mutationFn: (phone: string) => whatsappEvolutionService.removeOptOut(accessToken!, phone),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp-evolution', 'opt-outs'] });
      toast.success('تمت الإزالة');
    },
    onError: () => toast.error('فشل الإزالة'),
  });

  const testSendMutation = useMutation({
    mutationFn: (body: { to: string; message: string }) =>
      whatsappEvolutionService.sendText(accessToken!, body),
    onSuccess: (data) =>
      toast.success(`📨 أُرسلت الرسالة (تأخير ${data?.delayMs ?? 0}ms)`),
    onError: (err: Error) => toast.error(err?.message || 'فشل الإرسال'),
  });

  const [newOptOut, setNewOptOut] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('مرحباً 👋 رسالة تجريبية من Servix');

  if (instanceQuery.isLoading || settingsQuery.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const instance = instanceQuery.data ?? null;
  const settings = settingsQuery.data ?? {};
  const statusKey = (instance?.status ?? 'disconnected') as WhatsAppInstanceStatus;
  const statusStyle = STATUS_STYLES[statusKey];
  const isConnected = statusKey === 'connected';
  const showQr = statusKey === 'qr_pending' && instance?.qrCode;

  const toggleBool = (key: string, checked: boolean) =>
    settingsMutation.mutate([{ key, value: checked ? 'true' : 'false' }]);

  const updateStr = (key: string, value: string) =>
    settingsMutation.mutate([{ key, value }]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/settings')}
          className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--muted)] transition"
        >
          <ArrowRight className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-black">واتساب</h1>
          <p className="text-xs text-[var(--muted-foreground)]">ربط رقم الصالون وإدارة الرسائل التلقائية</p>
        </div>
      </div>

      {/* Connection Card */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <MessageCircle className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold">حالة الاتصال</h3>
              <p className="text-[10px] text-[var(--muted-foreground)]">ربط رقم واتساب الصالون</p>
            </div>
          </div>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold',
              statusStyle.bg,
              statusStyle.text,
            )}
          >
            <span className={cn('w-1.5 h-1.5 rounded-full', statusStyle.dot)} />
            {statusStyle.label}
          </span>
        </div>

        <div className="p-5 space-y-4">
          {!instance ? (
            <div className="text-center py-8">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
                <Plug className="h-7 w-7 text-emerald-600" />
              </div>
              <p className="font-bold text-sm">لم يتم الربط بعد</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1 max-w-sm mx-auto">
                اربطي رقم واتساب الصالون مرة واحدة لإرسال التأكيدات والتذكيرات وطلبات التقييم تلقائياً.
              </p>
              <Button
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending}
                className="mt-4"
              >
                {connectMutation.isPending ? 'جارٍ الإنشاء…' : 'ابدأ الربط'}
              </Button>
            </div>
          ) : (
            <>
              {showQr && instance?.qrCode && (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/40 p-5">
                  <p className="text-sm font-bold mb-3">امسحي رمز QR من تطبيق واتساب</p>
                  <div className="flex justify-center">
                    <div className="p-4 bg-white rounded-2xl">
                      {/* QR returned as base64 data URL */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={instance.qrCode.startsWith('data:') ? instance.qrCode : `data:image/png;base64,${instance.qrCode}`}
                        alt="WhatsApp QR"
                        className="w-60 h-60"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-[var(--muted-foreground)] text-center mt-3">
                    الإعدادات → الأجهزة المرتبطة → ربط جهاز
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-[var(--border)] p-3">
                  <p className="text-[10px] text-[var(--muted-foreground)]">اسم المثيل</p>
                  <p className="font-mono text-[11px] mt-1 truncate" dir="ltr">
                    {instance.instanceName}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--border)] p-3">
                  <p className="text-[10px] text-[var(--muted-foreground)]">الرقم المرتبط</p>
                  <p className="font-mono text-[11px] mt-1 tabular-nums" dir="ltr">
                    {instance.phoneNumber || '—'}
                  </p>
                </div>
                {instance.profileName && (
                  <div className="rounded-xl border border-[var(--border)] p-3 col-span-2">
                    <p className="text-[10px] text-[var(--muted-foreground)]">اسم الملف الشخصي</p>
                    <p className="text-[12px] font-bold mt-1">{instance.profileName}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => reconnectMutation.mutate()}
                  disabled={reconnectMutation.isPending}
                >
                  <RefreshCw className="h-3.5 w-3.5 ml-1.5" />
                  تجديد QR
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (confirm('فصل رقم واتساب؟ ستحتاجين لإعادة المسح للربط مجدداً.')) {
                      disconnectMutation.mutate();
                    }
                  }}
                  disabled={disconnectMutation.isPending}
                  className="text-red-600 hover:bg-red-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5 ml-1.5" />
                  فصل الحساب
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Automation toggles */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Send className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold">الرسائل التلقائية</h3>
              <p className="text-[10px] text-[var(--muted-foreground)]">تحكّمي في أي رسائل تُرسل عبر واتساب</p>
            </div>
          </div>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {[
            { key: 'whatsapp_enabled', label: 'تفعيل إرسال واتساب', hint: 'مفتاح رئيسي لكل الرسائل' },
            { key: 'whatsapp_booking_confirm', label: 'تأكيد الحجز', hint: 'فور تأكيد الحجز' },
            { key: 'whatsapp_booking_reminder', label: 'تذكير الموعد', hint: 'قبل الموعد بساعات' },
            { key: 'whatsapp_invoice_send', label: 'إرسال الفاتورة', hint: 'بعد إتمام الدفع' },
            { key: 'whatsapp_review_request', label: 'طلب تقييم', hint: 'بعد انتهاء الزيارة' },
            { key: 'whatsapp_marketing_enabled', label: 'الحملات التسويقية', hint: 'يُحترم قائمة إلغاء الاشتراك' },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <div>
                <p className="text-sm font-bold">{item.label}</p>
                <p className="text-[11px] text-[var(--muted-foreground)]">{item.hint}</p>
              </div>
              <Switch
                checked={parseBool(settings[item.key])}
                onCheckedChange={(c) => toggleBool(item.key, c)}
                disabled={settingsMutation.isPending}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Anti-ban controls */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold">حماية من الحظر</h3>
              <p className="text-[10px] text-[var(--muted-foreground)]">ساعات العمل وحدود الإرسال</p>
            </div>
          </div>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center justify-between gap-4 sm:col-span-2">
            <div>
              <p className="text-sm font-bold">الالتزام بساعات العمل</p>
              <p className="text-[11px] text-[var(--muted-foreground)]">لا يتم الإرسال خارج الأوقات المحددة</p>
            </div>
            <Switch
              checked={parseBool(settings.whatsapp_business_hours_enabled)}
              onCheckedChange={(c) => toggleBool('whatsapp_business_hours_enabled', c)}
              disabled={settingsMutation.isPending}
            />
          </div>

          <label className="space-y-1.5">
            <span className="text-[11px] font-bold flex items-center gap-1.5">
              <Clock className="h-3 w-3" /> بداية ساعات العمل
            </span>
            <Input
              type="time"
              defaultValue={settings.whatsapp_business_hours_start || '09:00'}
              onBlur={(e) => updateStr('whatsapp_business_hours_start', e.target.value)}
              dir="ltr"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] font-bold flex items-center gap-1.5">
              <Clock className="h-3 w-3" /> نهاية ساعات العمل
            </span>
            <Input
              type="time"
              defaultValue={settings.whatsapp_business_hours_end || '22:00'}
              onBlur={(e) => updateStr('whatsapp_business_hours_end', e.target.value)}
              dir="ltr"
            />
          </label>

          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-[11px] font-bold flex items-center gap-1.5">
              <Gauge className="h-3 w-3" /> الحد الأقصى للرسائل في الساعة
            </span>
            <Input
              type="number"
              min={1}
              max={200}
              defaultValue={parseNum(settings.whatsapp_rate_limit_per_hour, 30)}
              onBlur={(e) => updateStr('whatsapp_rate_limit_per_hour', e.target.value)}
              dir="ltr"
            />
            <span className="text-[10px] text-[var(--muted-foreground)]">
              الموصى به: 20–40 رسالة/ساعة لتجنّب الحظر
            </span>
          </label>

          <label className="space-y-1.5">
            <span className="text-[11px] font-bold">أقل تأخير (ms)</span>
            <Input
              type="number"
              min={500}
              defaultValue={parseNum(settings.whatsapp_random_delay_min_ms, 1500)}
              onBlur={(e) => updateStr('whatsapp_random_delay_min_ms', e.target.value)}
              dir="ltr"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] font-bold">أقصى تأخير (ms)</span>
            <Input
              type="number"
              min={500}
              defaultValue={parseNum(settings.whatsapp_random_delay_max_ms, 4500)}
              onBlur={(e) => updateStr('whatsapp_random_delay_max_ms', e.target.value)}
              dir="ltr"
            />
          </label>
        </div>
      </div>

      {/* Opt-outs */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center">
              <UserX className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold">قائمة إلغاء الاشتراك</h3>
              <p className="text-[10px] text-[var(--muted-foreground)]">
                {optOutsQuery.data?.length ?? 0} رقم — لن يصلها أي رسالة
              </p>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="رقم الجوال (966…)"
              value={newOptOut}
              onChange={(e) => setNewOptOut(e.target.value)}
              dir="ltr"
            />
            <Button
              onClick={() => newOptOut && addOptOutMutation.mutate({ phone: newOptOut })}
              disabled={!newOptOut || addOptOutMutation.isPending}
            >
              <Plus className="h-3.5 w-3.5 ml-1.5" />
              إضافة
            </Button>
          </div>

          {optOutsQuery.data && optOutsQuery.data.length > 0 ? (
            <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
              {optOutsQuery.data.map((item) => (
                <div key={item.id} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <p className="font-mono text-[12px] tabular-nums" dir="ltr">{item.phone}</p>
                    {item.reason && (
                      <p className="text-[10px] text-[var(--muted-foreground)]">{item.reason}</p>
                    )}
                  </div>
                  <button
                    onClick={() => removeOptOutMutation.mutate(item.phone)}
                    disabled={removeOptOutMutation.isPending}
                    className="p-1.5 rounded-lg text-red-600 hover:bg-red-500/10 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-[var(--muted-foreground)] text-center py-4">
              لا توجد أرقام في القائمة
            </p>
          )}
        </div>
      </div>

      {/* Test send */}
      {isConnected && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Send className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold">اختبار الإرسال</h3>
                <p className="text-[10px] text-[var(--muted-foreground)]">أرسلي رسالة تجريبية لرقمك</p>
              </div>
            </div>
          </div>
          <div className="p-5 space-y-3">
            <Input
              placeholder="رقم المستلم (966…)"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              dir="ltr"
            />
            <Input
              placeholder="نص الرسالة"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
            />
            <Button
              onClick={() =>
                testSendMutation.mutate({ to: testPhone, message: testMessage })
              }
              disabled={!testPhone || !testMessage || testSendMutation.isPending}
              className="w-full"
            >
              {testSendMutation.isPending ? 'جارٍ الإرسال…' : 'إرسال'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
