'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  Bot,
  Copy,
  TestTube,
  Loader2,
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

const WEBHOOK_URL = 'https://api.servi-x.com/api/v1/webhooks/whatsapp';
const VERIFY_TOKEN = 'servix-webhook-verify-2026';

export default function WhatsAppSettingsPage(): React.ReactElement {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [accessTokenWa, setAccessTokenWa] = useState('');
  const [botEnabled, setBotEnabled] = useState(true);
  const [welcomeMessage, setWelcomeMessage] = useState('أهلاً وسهلاً! كيف أقدر أساعدك؟ 💈');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Load existing settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings', 'whatsapp'],
    queryFn: async () => {
      try {
        const allSettings = await dashboardService.getSettings(accessToken!);
        const findKey = (key: string) => allSettings?.find?.((s: any) => s.key === key)?.value || '';
        return {
          phoneNumberId: findKey('whatsapp_phone_number_id'),
          accessToken: findKey('whatsapp_access_token'),
          botEnabled: findKey('whatsapp_bot_enabled') !== 'false',
          welcomeMessage: findKey('whatsapp_welcome_message') || 'أهلاً وسهلاً! كيف أقدر أساعدك؟ 💈',
        };
      } catch {
        return { phoneNumberId: '', accessToken: '', botEnabled: true, welcomeMessage: '' };
      }
    },
    enabled: !!accessToken,
  });

  useEffect(() => {
    if (settings) {
      setPhoneNumberId(settings.phoneNumberId);
      setAccessTokenWa(settings.accessToken);
      setBotEnabled(settings.botEnabled);
      setWelcomeMessage(settings.welcomeMessage);
    }
  }, [settings]);

  const isConnected = !!(settings?.phoneNumberId && settings?.accessToken);

  const handleSave = async () => {
    if (!accessToken) return;
    setIsSaving(true);
    try {
      await dashboardService.updateSetting('whatsapp_phone_number_id', phoneNumberId, accessToken);
      await dashboardService.updateSetting('whatsapp_access_token', accessTokenWa, accessToken);
      await dashboardService.updateSetting('whatsapp_bot_enabled', botEnabled ? 'true' : 'false', accessToken);
      await dashboardService.updateSetting('whatsapp_welcome_message', welcomeMessage, accessToken);
      queryClient.invalidateQueries({ queryKey: ['settings', 'whatsapp'] });
      toast.success('تم حفظ إعدادات واتساب بنجاح');
    } catch {
      toast.error('فشل حفظ الإعدادات');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!phoneNumberId || !accessTokenWa) {
      toast.error('يرجى إدخال Phone Number ID و Access Token أولاً');
      return;
    }
    setIsTesting(true);
    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${phoneNumberId}?access_token=${accessTokenWa}`,
      );
      if (res.ok) {
        const data = await res.json();
        toast.success(`✅ الاتصال ناجح! الرقم: ${data.display_phone_number || phoneNumberId}`);
      } else {
        toast.error('❌ فشل الاتصال — تأكد من صحة البيانات');
      }
    } catch {
      toast.error('❌ خطأ في الاتصال');
    } finally {
      setIsTesting(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`تم نسخ ${label}`);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="إعدادات واتساب"
        description="ربط رقم واتساب الصالون للبوت الذكي والإشعارات التلقائية"
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
                    ? 'البوت الذكي يستقبل رسائل العملاء ويرد عليها تلقائياً'
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

          {/* Bot Toggle */}
          <div className="flex items-center justify-between rounded-xl border border-[var(--border)] p-4">
            <div className="flex items-center gap-3">
              <Bot className="h-5 w-5 text-violet-500" />
              <div>
                <p className="text-sm font-bold text-[var(--foreground)]">البوت الذكي (AI)</p>
                <p className="text-xs text-[var(--muted-foreground)]">رد تلقائي على رسائل العملاء عبر Gemini AI</p>
              </div>
            </div>
            <button
              onClick={() => setBotEnabled(!botEnabled)}
              className={`relative h-7 w-12 rounded-full transition-colors ${botEnabled ? 'bg-violet-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${botEnabled ? 'start-[calc(100%-1.625rem)]' : 'start-0.5'}`} />
            </button>
          </div>

          {/* Welcome Message */}
          <div>
            <label className="text-sm font-bold text-[var(--foreground)] mb-2 flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-[var(--muted-foreground)]" />
              رسالة الترحيب (اختياري)
            </label>
            <textarea
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-violet-400/50 focus:ring-2 focus:ring-violet-500/20 resize-none"
              rows={3}
              placeholder="أهلاً وسهلاً! كيف أقدر أساعدك؟"
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
            />
          </div>

          <div className="flex gap-3 flex-wrap">
            <Button
              onClick={handleSave}
              disabled={isSaving || !phoneNumberId || !accessTokenWa}
            >
              <Save className="h-4 w-4 me-2" />
              {isSaving ? 'جارِ الحفظ...' : 'حفظ الإعدادات'}
            </Button>

            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={isTesting || !phoneNumberId || !accessTokenWa}
            >
              {isTesting ? (
                <Loader2 className="h-4 w-4 me-2 animate-spin" />
              ) : (
                <TestTube className="h-4 w-4 me-2" />
              )}
              {isTesting ? 'جارِ الاختبار...' : 'اختبار الاتصال'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Webhook Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            إعدادات Webhook (للخطوة 5)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[var(--muted-foreground)]">
            انسخ هذه القيم وأدخلها في Meta Business → WhatsApp → Configuration → Webhook:
          </p>

          {/* Callback URL */}
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] p-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-[var(--muted-foreground)] mb-0.5">Callback URL</p>
              <p className="text-sm font-mono text-[var(--foreground)] truncate" dir="ltr">{WEBHOOK_URL}</p>
            </div>
            <button
              onClick={() => copyToClipboard(WEBHOOK_URL, 'Callback URL')}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] hover:bg-[var(--muted)] transition-colors shrink-0"
            >
              <Copy className={`h-4 w-4 ${copied === 'Callback URL' ? 'text-emerald-500' : 'text-[var(--muted-foreground)]'}`} />
            </button>
          </div>

          {/* Verify Token */}
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] p-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-[var(--muted-foreground)] mb-0.5">Verify Token</p>
              <p className="text-sm font-mono text-[var(--foreground)]" dir="ltr">{VERIFY_TOKEN}</p>
            </div>
            <button
              onClick={() => copyToClipboard(VERIFY_TOKEN, 'Verify Token')}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] hover:bg-[var(--muted)] transition-colors shrink-0"
            >
              <Copy className={`h-4 w-4 ${copied === 'Verify Token' ? 'text-emerald-500' : 'text-[var(--muted-foreground)]'}`} />
            </button>
          </div>

          <p className="text-xs text-[var(--muted-foreground)]">
            ⚠️ تأكد من الاشتراك في: <strong>messages</strong> في Webhook Fields
          </p>
        </CardContent>
      </Card>

      {/* What WhatsApp Does */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-violet-500" />
            ماذا يفعل البوت الذكي؟
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { emoji: '🤖', title: 'رد ذكي تلقائي', desc: 'يجاوب أسئلة العملاء عن الخدمات والأسعار والمواعيد' },
              { emoji: '🎤', title: 'يفهم الصوت', desc: 'يحوّل الرسائل الصوتية لنص ويجاوب عليها' },
              { emoji: '📷', title: 'يحلل الصور', desc: 'يشوف الصور ويفهم ما يريده العميل' },
              { emoji: '📅', title: 'حجز + تقويم', desc: 'يحجز موعد ويرسل رابط يضيف الموعد للتقويم تلقائياً' },
              { emoji: '🧾', title: 'إرسال الفاتورة', desc: 'يرسل الفاتورة PDF بعد الدفع' },
              { emoji: '📢', title: 'حملات تسويقية', desc: 'عروض وخصومات للعملاء' },
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
            كيف تربط واتساب؟ (7 خطوات)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { step: 1, title: 'أنشئ حساب Meta Business (مجاني)', desc: 'business.facebook.com', link: 'https://business.facebook.com' },
              { step: 2, title: 'أنشئ تطبيق في Meta Developers', desc: 'اختر نوع Business', link: 'https://developers.facebook.com/apps/create/' },
              { step: 3, title: 'أضف WhatsApp إلى التطبيق', desc: 'من "Add Products" → WhatsApp → Setup' },
              { step: 4, title: 'أضف رقم الصالون', desc: 'رقم جديد غير مسجل واتساب عادي' },
              { step: 5, title: 'إعداد Webhook', desc: `الصق Callback URL و Verify Token الموضحين أعلاه ← اشترك في messages` },
              { step: 6, title: 'انسخ Phone Number ID و Access Token', desc: 'من WhatsApp → API Setup في التطبيق' },
              { step: 7, title: 'الصقها هنا واضغط "اختبار الاتصال" ✅', desc: 'في الحقول أعلاه' },
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
                بيانات العملاء لا تُرسل لـ AI — فقط إحصائيات مجمّعة.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
