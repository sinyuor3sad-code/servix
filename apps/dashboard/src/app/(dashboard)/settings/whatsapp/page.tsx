'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import {
  MessageCircle,
  Save,
  CheckCircle2,
  XCircle,
  Phone,
  Key,
  ExternalLink,
  Shield,
  Zap,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { dashboardService } from '@/services/dashboard.service';
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Input,
} from '@/components/ui';

export default function WhatsAppSettingsPage(): React.ReactElement {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [accessTokenWa, setAccessTokenWa] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Load existing settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings', 'whatsapp'],
    queryFn: async () => {
      try {
        const allSettings = await dashboardService.getSettings(accessToken!);
        const waPhone = allSettings?.find?.((s: any) => s.key === 'whatsapp_phone_number_id');
        const waToken = allSettings?.find?.((s: any) => s.key === 'whatsapp_access_token');
        return {
          phoneNumberId: waPhone?.value || '',
          accessToken: waToken?.value || '',
        };
      } catch {
        return { phoneNumberId: '', accessToken: '' };
      }
    },
    enabled: !!accessToken,
  });

  useEffect(() => {
    if (settings) {
      setPhoneNumberId(settings.phoneNumberId);
      setAccessTokenWa(settings.accessToken);
    }
  }, [settings]);

  const isConnected = !!(settings?.phoneNumberId && settings?.accessToken);

  const handleSave = async () => {
    if (!accessToken) return;
    setIsSaving(true);
    try {
      await dashboardService.updateSetting('whatsapp_phone_number_id', phoneNumberId, accessToken);
      await dashboardService.updateSetting('whatsapp_access_token', accessTokenWa, accessToken);
      queryClient.invalidateQueries({ queryKey: ['settings', 'whatsapp'] });
      toast.success('تم حفظ إعدادات واتساب بنجاح');
    } catch {
      toast.error('فشل حفظ الإعدادات');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="إعدادات واتساب"
        description="ربط رقم واتساب الصالون لإرسال الإشعارات والفواتير تلقائياً"
      />

      {/* Status Card */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className={isConnected ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/50'}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${isConnected ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                {isConnected ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                ) : (
                  <XCircle className="h-6 w-6 text-amber-600" />
                )}
              </div>
              <div>
                <p className={`font-bold ${isConnected ? 'text-emerald-800' : 'text-amber-800'}`}>
                  {isConnected ? '✅ واتساب متصل' : '⚠️ واتساب غير مربوط'}
                </p>
                <p className={`text-sm ${isConnected ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {isConnected
                    ? 'يمكنك إرسال الإشعارات والفواتير عبر واتساب'
                    : 'قم بإدخال بيانات Meta Cloud API لتفعيل واتساب'
                  }
                </p>
              </div>
              <Badge variant={isConnected ? 'success' : 'warning'} className="mr-auto">
                {isConnected ? 'متصل' : 'غير متصل'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Settings Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-emerald-500" />
            بيانات الربط
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <label className="text-sm font-bold text-[var(--foreground)] mb-2 flex items-center gap-2">
              <Phone className="h-4 w-4 text-[var(--muted-foreground)]" />
              Phone Number ID
            </label>
            <Input
              placeholder="مثال: 123456789012345"
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              dir="ltr"
            />
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              تجده في Meta Business → WhatsApp → Phone Numbers
            </p>
          </div>

          <div>
            <label className="text-sm font-bold text-[var(--foreground)] mb-2 flex items-center gap-2">
              <Key className="h-4 w-4 text-[var(--muted-foreground)]" />
              Access Token
            </label>
            <Input
              type="password"
              placeholder="EAAxxxxxxxx..."
              value={accessTokenWa}
              onChange={(e) => setAccessTokenWa(e.target.value)}
              dir="ltr"
            />
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              Permanent token من Meta Business → System Users
            </p>
          </div>

          <Button
            onClick={handleSave}
            disabled={isSaving || !phoneNumberId || !accessTokenWa}
            className="w-full sm:w-auto"
          >
            <Save className="h-4 w-4 me-2" />
            {isSaving ? 'جارِ الحفظ...' : 'حفظ الإعدادات'}
          </Button>
        </CardContent>
      </Card>

      {/* What WhatsApp Does */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-violet-500" />
            ماذا يُرسل واتساب تلقائياً؟
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { emoji: '✅', title: 'تأكيد الحجز', desc: 'فوراً عند حجز موعد جديد' },
              { emoji: '⏰', title: 'تذكير بالموعد', desc: 'قبل الموعد بساعتين' },
              { emoji: '🧾', title: 'الفاتورة', desc: 'إرسال الفاتورة PDF بعد الدفع' },
              { emoji: '💖', title: 'شكر بعد الزيارة', desc: 'رسالة شكر تلقائية' },
              { emoji: '📢', title: 'حملات تسويقية', desc: 'عروض وخصومات للعملاء' },
              { emoji: '⚠️', title: 'تذكير عدم زيارة', desc: 'للعملاء المنقطعين' },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3 rounded-xl bg-[var(--muted)]/50 p-3">
                <span className="text-xl">{item.emoji}</span>
                <div>
                  <p className="text-sm font-bold text-[var(--foreground)]">{item.title}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Setup Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-blue-500" />
            كيف تربط واتساب؟
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { step: 1, title: 'أنشئ حساب Meta Business', desc: 'business.facebook.com', link: 'https://business.facebook.com' },
              { step: 2, title: 'أنشئ تطبيق في Meta Developers', desc: 'developers.facebook.com', link: 'https://developers.facebook.com' },
              { step: 3, title: 'أضف WhatsApp إلى التطبيق', desc: 'من قسم "Add Products" → WhatsApp' },
              { step: 4, title: 'أضف رقم الصالون', desc: 'رقم جديد غير مسجل واتساب' },
              { step: 5, title: 'انسخ Phone Number ID و Access Token', desc: 'من إعدادات WhatsApp في التطبيق' },
              { step: 6, title: 'الصقها هنا واحفظ!', desc: 'في الحقول أعلاه ✅' },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand-primary)] text-white text-xs font-bold shrink-0">
                  {item.step}
                </div>
                <div>
                  <p className="text-sm font-bold text-[var(--foreground)]">{item.title}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {item.desc}
                    {item.link && (
                      <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-[var(--brand-primary)] hover:underline mr-2 inline-flex items-center gap-0.5">
                        <ExternalLink className="h-3 w-3" />
                        زيارة
                      </a>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Security Notice */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-blue-800">ملاحظة أمنية</p>
              <p className="text-xs text-blue-600">
                بيانات واتساب محفوظة بشكل آمن ومشفر في قاعدة بيانات الصالون المعزولة.
                لا يمكن لأي صالون آخر الوصول إليها. الرسائل تُرسل من رقمك أنت فقط.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
