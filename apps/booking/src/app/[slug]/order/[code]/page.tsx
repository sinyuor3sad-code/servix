'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Clock, CheckCircle2, Loader2, AlertTriangle,
  ArrowRight, Receipt, ShoppingBag, Timer,
} from 'lucide-react';
import { menuApi, type OrderStatus } from '@/lib/menu-api';
import { getThemeCSSVars, isDarkTheme } from '@/lib/menu-themes';

/* ═══════════════════════════════════════════════════════════════
   TRANSLATIONS
   ═══════════════════════════════════════════════════════════════ */
const T = {
  ar: {
    loading: 'جارٍ التحميل...',
    pending: 'بانتظار الكاشيرة',
    pendingDesc: 'اعرضي الرقم على الكاشيرة',
    claimed: 'جاري تجهيز طلبك',
    claimedDesc: 'الكاشيرة استلمت طلبك',
    paid: 'تم الدفع بنجاح ✅',
    paidDesc: 'شكراً لزيارتك',
    expired: 'انتهت صلاحية الطلب',
    expiredDesc: 'يمكنك إنشاء طلب جديد',
    newOrder: 'إنشاء طلب جديد',
    total: 'المجموع التقريبي',
    services: 'الخدمات',
    remaining: 'الوقت المتبقي',
    invoiceNum: 'رقم الفاتورة',
    sar: 'ر.س',
    error: 'حدث خطأ',
    min: 'د',
    sec: 'ث',
    orderNum: 'رقم الطلب',
    viewInvoice: 'عرض الفاتورة الكاملة',
    finalTotal: 'المبلغ النهائي',
  },
  en: {
    loading: 'Loading...',
    pending: 'Waiting for Cashier',
    pendingDesc: 'Show this number to the cashier',
    claimed: 'Preparing Your Order',
    claimedDesc: 'The cashier has received your order',
    paid: 'Payment Successful ✅',
    paidDesc: 'Thank you for visiting',
    expired: 'Order Expired',
    expiredDesc: 'You can create a new order',
    newOrder: 'Create New Order',
    total: 'Estimated Total',
    services: 'Services',
    remaining: 'Time Remaining',
    invoiceNum: 'Invoice #',
    sar: 'SAR',
    error: 'An error occurred',
    min: 'min',
    sec: 'sec',
    orderNum: 'Order #',
    viewInvoice: 'View Full Invoice',
    finalTotal: 'Final Total',
  },
};

type Lang = 'ar' | 'en';

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function OrderStatusPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const code = (params.code as string)?.toUpperCase();

  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>('ar');
  const [now, setNow] = useState(Date.now());
  const [paidData, setPaidData] = useState<{ invoiceToken?: string; invoiceNumber?: string; total?: number } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const t = T[lang];
  const isRTL = lang === 'ar';

  /* ── Fetch order status ── */
  const fetchOrder = useCallback(async () => {
    try {
      const data = await menuApi.getOrderStatus(slug, code);
      setOrder(data);
      setError(null);
      return data;
    } catch (err: unknown) {
      setError((err as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [slug, code]);

  /* ── Initial load ── */
  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  /* ── WebSocket + Polling ── */
  useEffect(() => {
    if (!order || order.status === 'expired' || order.status === 'paid') return;

    // Try WebSocket first
    const wsUrl = (process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000') + `/ws?orderRoom=${slug}:${code}`;
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.event === 'order:status' && msg.data) {
            setOrder((prev) => prev ? { ...prev, ...msg.data } : prev);
          }
          if (msg.event === 'order:paid' && msg.data) {
            // Payment confirmed via WebSocket — update UI immediately
            setPaidData({
              invoiceToken: msg.data.invoiceToken,
              invoiceNumber: msg.data.invoiceNumber,
              total: msg.data.total,
            });
            setOrder((prev) => prev ? { ...prev, status: 'paid' as const } : prev);
          }
        } catch { /* ignore parse errors */ }
      };

      ws.onerror = () => {
        // Fallback to polling
        startPolling();
      };

      ws.onclose = () => {
        // Fallback to polling
        startPolling();
      };
    } catch {
      // WebSocket not available, use polling
      startPolling();
    }

    function startPolling() {
      if (pollRef.current) return;
      pollRef.current = setInterval(async () => {
        const data = await fetchOrder();
        if (data && (data.status === 'expired' || data.status === 'paid')) {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }, 5000);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [order?.status, slug, code, fetchOrder]);

  /* ── Countdown timer ── */
  useEffect(() => {
    if (!order || order.status !== 'pending') return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [order?.status]);

  /* ── Theme ── */
  const themeVars = getThemeCSSVars('purple'); // Default, will be overridden from menu data
  const dark = false;

  /* ── Computed remaining time ── */
  const remaining = order ? Math.max(0, new Date(order.expiresAt).getTime() - now) : 0;
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const urgency = remaining < 5 * 60 * 1000; // Less than 5 minutes

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center" style={{ ...themeVars, background: 'var(--sm-bg)' } as React.CSSProperties}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--sm-primary)' }} />
          <p className="text-sm" style={{ color: 'var(--sm-text-secondary)' }}>{t.loading}</p>
        </div>
      </div>
    );
  }

  /* ── Error ── */
  if (error || !order) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6" style={{ ...themeVars, background: 'var(--sm-bg)' } as React.CSSProperties}>
        <div className="text-center space-y-4">
          <AlertTriangle className="mx-auto h-12 w-12 text-orange-500" />
          <p className="text-lg font-bold" style={{ color: 'var(--sm-text)' }}>{error || t.error}</p>
          <button onClick={() => router.push(`/${slug}/order`)} className="px-6 py-3 rounded-xl text-sm font-bold text-white" style={{ background: 'var(--sm-primary)' }}>
            <ShoppingBag size={16} className="inline me-2" />{t.newOrder}
          </button>
        </div>
      </div>
    );
  }

  const services = (order.services || []) as Array<{ serviceId: string; nameAr: string; nameEn: string | null; price: number; duration: number }>;

  return (
    <div
      className="flex min-h-dvh flex-col"
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{
        ...themeVars,
        background: 'var(--sm-bg)',
        color: 'var(--sm-text)',
        fontFamily: isRTL ? "'Tajawal', sans-serif" : "'Inter', sans-serif",
      } as React.CSSProperties}
    >
      {/* ── Status-based content ── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">

        {/* ═══ PENDING ═══ */}
        {order.status === 'pending' && (
          <div className="w-full max-w-sm space-y-8 text-center">
            {/* Order Code */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--sm-text-secondary)' }}>
                {t.orderNum}
              </p>
              <div className="mx-auto flex h-36 w-60 items-center justify-center rounded-3xl shadow-2xl"
                style={{ background: 'var(--sm-primary)', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
                <span className="text-6xl font-black text-white tracking-wider" style={{ fontFeatureSettings: '"tnum"', letterSpacing: '0.1em' }}>
                  {order.orderCode}
                </span>
              </div>
            </div>

            {/* Status text */}
            <div>
              <p className="text-lg font-black" style={{ color: 'var(--sm-text)' }}>{t.pending}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--sm-text-secondary)' }}>{t.pendingDesc}</p>
            </div>

            {/* Countdown */}
            <div className={`rounded-2xl p-5 ${urgency ? 'animate-pulse' : ''}`}
              style={{ background: urgency ? 'rgba(239,68,68,0.1)' : 'var(--sm-accent)' }}>
              <p className="text-xs font-bold mb-2" style={{ color: urgency ? '#EF4444' : 'var(--sm-text-secondary)' }}>
                <Timer size={12} className="inline me-1" />{t.remaining}
              </p>
              <p className="text-3xl font-black" style={{
                color: urgency ? '#EF4444' : 'var(--sm-primary)',
                fontFeatureSettings: '"tnum"',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
              </p>
            </div>
          </div>
        )}

        {/* ═══ CLAIMED ═══ */}
        {order.status === 'claimed' && (
          <div className="w-full max-w-sm space-y-8 text-center">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full" style={{ background: 'var(--sm-accent)' }}>
              <Loader2 className="h-10 w-10 animate-spin" style={{ color: 'var(--sm-primary)' }} />
            </div>
            <div>
              <p className="text-2xl font-black">{t.claimed}</p>
              <p className="text-sm mt-2" style={{ color: 'var(--sm-text-secondary)' }}>{t.claimedDesc}</p>
            </div>
            <div className="rounded-2xl p-4" style={{ background: 'var(--sm-bg-card)', border: `1px solid var(--sm-border)` }}>
              <p className="text-xs font-bold mb-1" style={{ color: 'var(--sm-text-secondary)' }}>{t.orderNum}</p>
              <p className="text-3xl font-black" style={{ color: 'var(--sm-primary)', fontFeatureSettings: '"tnum"' }}>
                {order.orderCode}
              </p>
            </div>
          </div>
        )}

        {/* ═══ PAID ═══ */}
        {order.status === 'paid' && (
          <div className="w-full max-w-sm space-y-8 text-center animate-[fadeIn_0.5s_ease-out]">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full animate-[scaleIn_0.3s_ease-out]" style={{ background: 'rgba(16,185,129,0.15)' }}>
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-black">{t.paid}</p>
              <p className="text-sm mt-2" style={{ color: 'var(--sm-text-secondary)' }}>{t.paidDesc}</p>
            </div>

            {/* Final total from payment or estimate */}
            {(paidData?.total || order.totalEstimate) && (
              <div className="rounded-2xl p-5" style={{ background: 'var(--sm-accent)' }}>
                <p className="text-xs font-bold mb-1" style={{ color: 'var(--sm-text-secondary)' }}>{t.finalTotal}</p>
                <p className="text-3xl font-black" style={{ color: 'var(--sm-primary)', fontFeatureSettings: '"tnum"' }}>
                  {(paidData?.total || order.totalEstimate).toFixed(2)} {t.sar}
                </p>
              </div>
            )}

            {/* Invoice number */}
            {(paidData?.invoiceNumber || order.invoiceNumber) && (
              <div className="rounded-2xl p-4" style={{ background: 'var(--sm-bg-card)', border: `1px solid var(--sm-border)` }}>
                <p className="text-xs font-bold" style={{ color: 'var(--sm-text-secondary)' }}>{t.invoiceNum}</p>
                <p className="text-lg font-black mt-1" style={{ color: 'var(--sm-primary)', fontFeatureSettings: '"tnum"' }}>
                  {paidData?.invoiceNumber || order.invoiceNumber}
                </p>
              </div>
            )}

            {/* View full invoice button */}
            {(paidData?.invoiceToken || order.invoicePublicToken) && (
              <a
                href={`/${slug}/invoice/${paidData?.invoiceToken || order.invoicePublicToken}`}
                className="mx-auto flex items-center justify-center gap-2 rounded-xl px-8 py-3.5 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105"
                style={{ background: 'var(--sm-primary)' }}
              >
                <Receipt size={16} /> {t.viewInvoice}
              </a>
            )}
          </div>
        )}

        {/* ═══ EXPIRED ═══ */}
        {order.status === 'expired' && (
          <div className="w-full max-w-sm space-y-8 text-center">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full" style={{ background: 'rgba(239,68,68,0.1)' }}>
              <AlertTriangle className="h-12 w-12 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-black">{t.expired}</p>
              <p className="text-sm mt-2" style={{ color: 'var(--sm-text-secondary)' }}>{t.expiredDesc}</p>
            </div>
            <button
              onClick={() => router.push(`/${slug}/order`)}
              className="mx-auto flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-bold text-white shadow-lg"
              style={{ background: 'var(--sm-primary)' }}
            >
              <ShoppingBag size={16} /> {t.newOrder}
            </button>
          </div>
        )}
      </div>

      {/* ── Services List ── */}
      {services.length > 0 && (
        <div className="px-6 pb-8">
          <div className="mx-auto max-w-sm rounded-2xl p-4" style={{ background: 'var(--sm-bg-card)', border: `1px solid var(--sm-border)` }}>
            <p className="text-xs font-bold mb-3" style={{ color: 'var(--sm-text-secondary)' }}>{t.services}</p>
            <div className="space-y-2">
              {services.map((svc, i) => (
                <div key={i} className="flex items-center justify-between py-1.5"
                  style={{ borderTop: i > 0 ? `1px solid var(--sm-border)` : undefined }}>
                  <span className="text-sm font-medium" style={{ color: 'var(--sm-text)' }}>
                    {lang === 'en' && svc.nameEn ? svc.nameEn : svc.nameAr}
                  </span>
                  <span className="text-sm font-black" style={{ color: 'var(--sm-primary)', fontFeatureSettings: '"tnum"' }}>
                    {svc.price} {t.sar}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: `2px solid var(--sm-border)` }}>
              <span className="text-sm font-bold">{t.total}</span>
              <span className="text-lg font-black" style={{ color: 'var(--sm-primary)', fontFeatureSettings: '"tnum"' }}>
                {order.totalEstimate} {t.sar}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Powered By ── */}
      <div className="pb-6 text-center">
        <p className="text-xs" style={{ color: 'var(--sm-text-secondary)', opacity: 0.4 }}>
          Powered by <a href="https://servi-x.com" target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700 }}>SERVIX</a>
        </p>
      </div>
    </div>
  );
}
