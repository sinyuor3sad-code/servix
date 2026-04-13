'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import {
  MessageCircle,
  CheckCircle2,
  XCircle,
  Bot,
  Shield,
  Loader2,
  Unplug,
  Smartphone,
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
} from '@/components/ui';

const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID || '939601825381781';

// Facebook Login for Business config ID for WhatsApp Embedded Signup
const FB_CONFIG_ID = process.env.NEXT_PUBLIC_FB_CONFIG_ID || '1614290979791301';

declare global {
  interface Window {
    FB: any;
    fbAsyncInit: () => void;
  }
}

export default function WhatsAppSettingsPage(): React.ReactElement {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [botEnabled, setBotEnabled] = useState(true);
  const [welcomeMessage, setWelcomeMessage] = useState('أهلاً وسهلاً! كيف أقدر أساعدك؟ 💈');
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);

  // Captured from Embedded Signup message event
  const [embeddedData, setEmbeddedData] = useState<{
    phoneNumberId?: string;
    wabaId?: string;
  }>({});

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
          displayPhone: findKey('whatsapp_display_phone'),
          connectedAt: findKey('whatsapp_connected_at'),
          botEnabled: findKey('whatsapp_bot_enabled') !== 'false',
          welcomeMessage: findKey('whatsapp_welcome_message') || 'أهلاً وسهلاً! كيف أقدر أساعدك؟ 💈',
        };
      } catch {
        return { phoneNumberId: '', accessToken: '', displayPhone: '', connectedAt: '', botEnabled: true, welcomeMessage: '' };
      }
    },
    enabled: !!accessToken,
  });

  const isConnected = !!(settings?.phoneNumberId && settings?.accessToken);

  useEffect(() => {
    if (settings) {
      setBotEnabled(settings.botEnabled);
      setWelcomeMessage(settings.welcomeMessage);
    }
  }, [settings]);

  // Listen for Embedded Signup message events
  const handleMessage = useCallback((event: MessageEvent) => {
    if (
      event.origin !== 'https://www.facebook.com' &&
      event.origin !== 'https://web.facebook.com'
    ) return;

    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (data.type === 'WA_EMBEDDED_SIGNUP') {
        if (data.event === 'FINISH') {
          setEmbeddedData({
            phoneNumberId: data.data?.phone_number_id,
            wabaId: data.data?.waba_id,
          });
        } else if (data.event === 'CANCEL') {
          setIsConnecting(false);
          toast.info('تم إلغاء عملية الربط');
        } else if (data.event === 'ERROR') {
          setIsConnecting(false);
          toast.error('حدث خطأ أثناء الربط');
        }
      }
    } catch {
      // Not a JSON message or not from Facebook
    }
  }, []);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  // Load Facebook SDK
  useEffect(() => {
    if (!META_APP_ID) return;

    window.fbAsyncInit = function () {
      window.FB.init({
        appId: META_APP_ID,
        autoLogAppEvents: true,
        xfbml: true,
        version: 'v21.0',
      });
      setSdkLoaded(true);
    };

    // Load SDK script if not already loaded
    if (!document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.crossOrigin = 'anonymous';
      document.head.appendChild(script);
    } else if (window.FB) {
      // SDK already loaded (e.g. navigated back to this page)
      if (!sdkLoaded) {
        window.FB.init({
          appId: META_APP_ID,
          autoLogAppEvents: true,
          xfbml: true,
          version: 'v21.0',
        });
        setSdkLoaded(true);
      }
    }
  }, []);

  // Handle WhatsApp Connect via Embedded Signup
  const handleConnect = () => {
    // If SDK not loaded yet, init it now synchronously
    if (!window.FB) {
      toast.error('Facebook SDK لم يتم تحميله — أعد تحميل الصفحة');
      return;
    }

    if (!sdkLoaded) {
      window.FB.init({
        appId: META_APP_ID,
        autoLogAppEvents: true,
        xfbml: true,
        version: 'v21.0',
      });
      setSdkLoaded(true);
    }

    setIsConnecting(true);

    const loginOptions: any = {
      response_type: 'code',
      override_default_response_type: true,
      scope: 'whatsapp_business_management,whatsapp_business_messaging',
      extras: {
        feature: 'whatsapp_embedded_signup',
        sessionInfoVersion: 3,
      },
    };

    // Use config_id if available
    if (FB_CONFIG_ID) {
      loginOptions.config_id = FB_CONFIG_ID;
    }

    // FB.login callback MUST be a regular function (not async)
    window.FB.login(
      (response: any) => {
        if (response.authResponse?.code) {
          // Send code to backend (fire async inside regular callback)
          fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/salon/whatsapp/connect`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                code: response.authResponse.code,
                phoneNumberId: embeddedData.phoneNumberId || '',
                wabaId: embeddedData.wabaId || '',
              }),
            },
          )
            .then((res) => res.json())
            .then((data) => {
              if (data?.success || data?.data?.success) {
                const result = data?.data || data;
                toast.success(`✅ تم ربط واتساب بنجاح! الرقم: ${result.displayPhone || ''}`);
                queryClient.invalidateQueries({ queryKey: ['settings', 'whatsapp'] });
              } else {
                toast.error(data?.message || data?.data?.message || 'فشل ربط الواتساب');
              }
            })
            .catch(() => {
              toast.error('خطأ في الاتصال بالخادم');
            })
            .finally(() => {
              setIsConnecting(false);
            });
        } else {
          toast.info('تم إلغاء عملية الربط');
          setIsConnecting(false);
        }
      },
      loginOptions,
    );
  };

  // Handle disconnect
  const handleDisconnect = async () => {
    if (!confirm('هل أنت متأكد من فصل واتساب؟ سيتوقف البوت عن الرد على العملاء.')) return;

    setIsDisconnecting(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/salon/whatsapp/disconnect`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );
      if (res.ok) {
        toast.success('تم فصل واتساب');
        queryClient.invalidateQueries({ queryKey: ['settings', 'whatsapp'] });
      }
    } catch {
      toast.error('فشل فصل الواتساب');
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Save bot preferences
  const handleSavePrefs = async () => {
    if (!accessToken) return;
    setIsSavingPrefs(true);
    try {
      await dashboardService.updateSetting('whatsapp_bot_enabled', botEnabled ? 'true' : 'false', accessToken);
      await dashboardService.updateSetting('whatsapp_welcome_message', welcomeMessage, accessToken);
      queryClient.invalidateQueries({ queryKey: ['settings', 'whatsapp'] });
      toast.success('تم حفظ الإعدادات');
    } catch {
      toast.error('فشل حفظ الإعدادات');
    } finally {
      setIsSavingPrefs(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--brand-primary)]" />
      </div>
    );
  }

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
              <div className="flex-1">
                <p className={`font-bold ${isConnected ? 'text-emerald-800' : 'text-amber-800'}`}>
                  {isConnected ? '✅ واتساب متصل' : '⚠️ واتساب غير مربوط'}
                </p>
                <p className={`text-sm ${isConnected ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {isConnected
                    ? `الرقم: ${settings?.displayPhone || settings?.phoneNumberId} — البوت يرد تلقائياً`
                    : 'اضغط "ربط واتساب" للبدء — يأخذ أقل من دقيقة'
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

      {/* Connect / Disconnect */}
      {!isConnected ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="p-8 text-center space-y-6">
              <div className="flex justify-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-200">
                  <Smartphone className="h-10 w-10 text-white" />
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold text-[var(--foreground)]">
                  ربط واتساب بضغطة زر
                </h3>
                <p className="text-sm text-[var(--muted-foreground)] mt-2 max-w-md mx-auto">
                  سجّل دخول بحساب Facebook → اختر رقم الصالون → جاهز!
                  <br />
                  البوت الذكي يرد على عملائك تلقائياً 24/7
                </p>
              </div>

              <Button
                onClick={handleConnect}
                disabled={isConnecting || !META_APP_ID}
                size="lg"
                className="bg-[#25D366] hover:bg-[#128C7E] text-white font-bold px-8 py-3 text-base gap-2"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    جاري الربط...
                  </>
                ) : (
                  <>
                    <MessageCircle className="h-5 w-5" />
                    ربط واتساب
                  </>
                )}
              </Button>

              {!META_APP_ID && (
                <p className="text-xs text-red-500">
                  ⚠️ META_APP_ID غير مُعيّن — تواصل مع الدعم الفني
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <>
          {/* Bot Settings */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-violet-500" />
                  إعدادات البوت
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
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
                    رسالة الترحيب
                  </label>
                  <textarea
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-violet-400/50 focus:ring-2 focus:ring-violet-500/20 resize-none"
                    rows={3}
                    value={welcomeMessage}
                    onChange={(e) => setWelcomeMessage(e.target.value)}
                  />
                </div>

                <div className="flex gap-3 flex-wrap">
                  <Button onClick={handleSavePrefs} disabled={isSavingPrefs}>
                    {isSavingPrefs ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={handleDisconnect}
                    disabled={isDisconnecting}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <Unplug className="h-4 w-4 me-2" />
                    {isDisconnecting ? 'جاري الفصل...' : 'فصل واتساب'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}

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
