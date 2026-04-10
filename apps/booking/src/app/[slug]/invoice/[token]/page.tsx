'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Star, MapPin, Globe, Receipt, ExternalLink,
  ShoppingBag, CheckCircle2, AlertTriangle, Loader2, Send,
} from 'lucide-react';
import { menuApi, type InvoiceData } from '@/lib/menu-api';
import { getThemeCSSVars, isDarkTheme } from '@/lib/menu-themes';

/* ═══════════════════════════════════════════════════════════════
   TRANSLATIONS
   ═══════════════════════════════════════════════════════════════ */
const T = {
  ar: {
    loading: 'جارٍ تحميل الفاتورة...',
    invalidLink: 'هذا الرابط لم يعد صالحاً',
    invalidDesc: 'يمكن أن يكون الرابط منتهي الصلاحية أو محذوف',
    networkError: 'حدث خطأ في الاتصال',
    retry: 'إعادة المحاولة',
    browseServices: 'استعراض خدماتنا',
    invoiceNumber: 'رقم الفاتورة',
    paidStatus: 'مدفوعة ✓',
    paidAt: 'تاريخ الدفع',
    services: 'الخدمات',
    qty: 'الكمية',
    price: 'السعر',
    subtotal: 'المجموع الفرعي',
    discount: 'الخصم',
    tax: 'ضريبة 15%',
    total: 'الإجمالي',
    sar: 'ر.س',
    feedbackTitle: 'كيف كانت تجربتك؟',
    feedbackPositive: 'يسعدنا! هل تحبين مشاركة تجربتك على Google؟',
    feedbackNegative: 'نعتذر. هل تحبين إضافة ملاحظة؟',
    shareGoogle: 'شاركي تجربتك',
    submitFeedback: 'إرسال',
    thankYou: 'شكراً لتقييمك! 💜',
    alreadyRated: 'تم التقييم',
    commentPlaceholder: 'أضيفي ملاحظتك هنا...',
    direction: 'الاتجاه إلى الموقع',
    poweredBy: 'Powered by',
  },
  en: {
    loading: 'Loading invoice...',
    invalidLink: 'This link is no longer valid',
    invalidDesc: 'The link may have expired or been removed',
    networkError: 'Connection error',
    retry: 'Try Again',
    browseServices: 'Browse Our Services',
    invoiceNumber: 'Invoice #',
    paidStatus: 'Paid ✓',
    paidAt: 'Paid on',
    services: 'Services',
    qty: 'Qty',
    price: 'Price',
    subtotal: 'Subtotal',
    discount: 'Discount',
    tax: 'Tax 15%',
    total: 'Total',
    sar: 'SAR',
    feedbackTitle: 'How was your experience?',
    feedbackPositive: "We're glad! Would you like to share your experience on Google?",
    feedbackNegative: "We're sorry. Would you like to add a note?",
    shareGoogle: 'Share your experience',
    submitFeedback: 'Submit',
    thankYou: 'Thank you for your feedback! 💜',
    alreadyRated: 'Already rated',
    commentPlaceholder: 'Add your note here...',
    direction: 'Get Directions',
    poweredBy: 'Powered by',
  },
};

type Lang = 'ar' | 'en';

/* ═══════════════════════════════════════════════════════════════
   FORMAT DATE
   ═══════════════════════════════════════════════════════════════ */
function formatDate(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (lang === 'ar') {
    return d.toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }) + ' — ' + d.toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) + ' — ' + d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/* ═══════════════════════════════════════════════════════════════
   STAR RATING
   ═══════════════════════════════════════════════════════════════ */
function StarRating({
  value,
  onChange,
  readOnly,
}: {
  value: number;
  onChange?: (v: number) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 justify-center" dir="ltr">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          onClick={() => !readOnly && onChange?.(i)}
          disabled={readOnly}
          className={`transition-all duration-200 ${readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-125 active:scale-95'}`}
          type="button"
        >
          <Star
            size={36}
            fill={i <= value ? '#FACC15' : 'transparent'}
            stroke={i <= value ? '#FACC15' : 'var(--sm-border)'}
            strokeWidth={1.5}
            className="transition-all"
          />
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */
export default function PublicInvoicePage() {
  const params = useParams();
  const slug = params.slug as string;
  const token = params.token as string;

  const [data, setData] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<'not_found' | 'network' | null>(null);
  const [lang, setLang] = useState<Lang>('ar');

  // Feedback state
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const t = T[lang];
  const isRTL = lang === 'ar';

  /* ── Fetch invoice ── */
  const fetchInvoice = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await menuApi.getInvoice(slug, token);
      setData(result);
      if (result.feedback) {
        setRating(result.feedback.rating);
        setFeedbackSubmitted(true);
      }
    } catch (err: unknown) {
      const e = err as { statusCode?: number };
      if (e.statusCode === 404) {
        setError('not_found');
      } else {
        setError('network');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoice();
  }, [slug, token]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Submit feedback ── */
  const handleSubmitFeedback = async () => {
    if (rating === 0 || submitting) return;
    setSubmitting(true);
    try {
      const showGoogle = rating >= 4 && !!data?.salon.googleMapsUrl;
      await menuApi.submitFeedback(slug, token, {
        rating,
        comment: comment.trim() || undefined,
        googlePromptShown: showGoogle,
      });
      setFeedbackSubmitted(true);
    } catch {
      // 409 = already submitted, treat as success
      setFeedbackSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Track Google click ── */
  const handleGoogleClick = () => {
    // Fire and forget — don't block the user
    menuApi.trackGoogleClick(slug, token).catch(() => {});
  };

  /* ── Theme ── */
  const paletteId = data?.salon.brandColorPreset || 'purple';
  const themeVars = getThemeCSSVars(paletteId);
  const dark = isDarkTheme(paletteId);

  const salonName = lang === 'en' && data?.salon.nameEn ? data.salon.nameEn : (data?.salon.nameAr || '');

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center" style={{ ...themeVars, background: 'var(--sm-bg)', color: 'var(--sm-text)' } as React.CSSProperties}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin" style={{ color: 'var(--sm-primary)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--sm-text-secondary)' }}>{t.loading}</p>
        </div>
      </div>
    );
  }

  /* ── Error: Not Found ── */
  if (error === 'not_found') {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6" style={{ ...themeVars, background: 'var(--sm-bg)', color: 'var(--sm-text)' } as React.CSSProperties}>
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full" style={{ background: 'rgba(239,68,68,0.1)' }}>
            <AlertTriangle className="h-10 w-10 text-red-500" />
          </div>
          <div>
            <p className="text-xl font-black">{t.invalidLink}</p>
            <p className="text-sm mt-2" style={{ color: 'var(--sm-text-secondary)' }}>{t.invalidDesc}</p>
          </div>
          <a
            href={`/${slug}/order`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-2xl px-8 py-3.5 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105"
            style={{ background: 'var(--sm-primary)' }}
          >
            <ShoppingBag size={16} /> {t.browseServices}
          </a>
        </div>
      </div>
    );
  }

  /* ── Error: Network ── */
  if (error === 'network' || !data) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6" style={{ ...themeVars, background: 'var(--sm-bg)', color: 'var(--sm-text)' } as React.CSSProperties}>
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="text-5xl">😔</div>
          <p className="text-lg font-bold">{t.networkError}</p>
          <button
            onClick={fetchInvoice}
            className="inline-flex items-center gap-2 rounded-2xl px-8 py-3.5 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105"
            style={{ background: 'var(--sm-primary)' }}
          >
            {t.retry}
          </button>
        </div>
      </div>
    );
  }

  const { salon, invoice, feedback } = data;
  const isExistingFeedback = feedback !== null;

  return (
    <div
      className="min-h-dvh"
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{
        ...themeVars,
        background: 'var(--sm-bg)',
        color: 'var(--sm-text)',
        fontFamily: isRTL ? "'Tajawal', 'Cairo', sans-serif" : "'Inter', sans-serif",
      } as React.CSSProperties}
    >
      {/* ── Language Toggle ── */}
      <div className="fixed top-4 z-50" style={{ [isRTL ? 'left' : 'right']: 16 }}>
        <button
          onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
          className="flex h-10 w-10 items-center justify-center rounded-full shadow-lg backdrop-blur-xl transition-transform hover:scale-110"
          style={{
            background: dark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.9)',
            border: '1px solid var(--sm-border)',
            color: 'var(--sm-primary)',
          }}
        >
          <Globe size={18} />
        </button>
      </div>

      <div className="mx-auto max-w-lg px-5 py-8 space-y-6">
        {/* ═══ HEADER — Salon Logo + Name ═══ */}
        <div className="flex flex-col items-center gap-3 pt-4">
          {salon.logoUrl ? (
            <img
              src={salon.logoUrl}
              alt=""
              className="h-20 w-20 rounded-2xl object-contain shadow-md"
              style={{ border: '2px solid var(--sm-border)' }}
            />
          ) : (
            <div
              className="flex h-20 w-20 items-center justify-center rounded-2xl text-2xl font-black text-white shadow-md"
              style={{ background: 'var(--sm-primary)' }}
            >
              {(salon.nameAr || 'S')[0]}
            </div>
          )}
          <h1 className="text-xl font-black text-center">{salonName}</h1>
        </div>

        {/* ═══ INVOICE CARD ═══ */}
        <div
          className="rounded-3xl overflow-hidden shadow-lg"
          style={{
            background: 'var(--sm-bg-card)',
            border: '1px solid var(--sm-border)',
          }}
        >
          {/* Invoice header */}
          <div className="px-5 pt-5 pb-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt size={18} style={{ color: 'var(--sm-primary)' }} />
                <span className="text-xs font-bold" style={{ color: 'var(--sm-text-secondary)' }}>
                  {t.invoiceNumber}
                </span>
              </div>
              <span
                className="rounded-full px-3 py-1 text-xs font-black text-white"
                style={{ background: '#10B981' }}
              >
                {t.paidStatus}
              </span>
            </div>
            <p className="text-2xl font-black" style={{ color: 'var(--sm-primary)', fontFeatureSettings: '"tnum"' }}>
              {invoice.invoiceNumber}
            </p>
            {invoice.paidAt && (
              <p className="text-xs" style={{ color: 'var(--sm-text-secondary)' }}>
                {t.paidAt}: {formatDate(invoice.paidAt, lang)}
              </p>
            )}
          </div>

          {/* Separator */}
          <div className="relative h-6">
            <div className="absolute inset-x-0 top-1/2 border-t border-dashed" style={{ borderColor: 'var(--sm-border)' }} />
            <div className="absolute -start-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full" style={{ background: 'var(--sm-bg)' }} />
            <div className="absolute -end-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full" style={{ background: 'var(--sm-bg)' }} />
          </div>

          {/* Services list */}
          <div className="px-5 pb-4">
            <p className="text-xs font-bold mb-3" style={{ color: 'var(--sm-text-secondary)' }}>
              {t.services}
            </p>
            <div className="space-y-2.5">
              {invoice.items.map((item, i) => (
                <div key={i} className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold" style={{ color: 'var(--sm-text)' }}>
                      {item.description}
                    </p>
                    {item.quantity > 1 && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--sm-text-secondary)' }}>
                        {t.qty}: {item.quantity} × {item.unitPrice.toFixed(2)}
                      </p>
                    )}
                  </div>
                  <span className="text-sm font-bold shrink-0" style={{ color: 'var(--sm-text)', fontFeatureSettings: '"tnum"' }}>
                    {item.totalPrice.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Separator */}
          <div style={{ borderTop: '1px solid var(--sm-border)' }} />

          {/* Totals */}
          <div className="px-5 py-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--sm-text-secondary)' }}>{t.subtotal}</span>
              <span className="font-semibold" style={{ fontFeatureSettings: '"tnum"' }}>{invoice.subtotal.toFixed(2)}</span>
            </div>
            {invoice.discountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-emerald-500">{t.discount}</span>
                <span className="font-semibold text-emerald-500" style={{ fontFeatureSettings: '"tnum"' }}>
                  -{invoice.discountAmount.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--sm-text-secondary)' }}>{t.tax}</span>
              <span className="font-semibold" style={{ fontFeatureSettings: '"tnum"' }}>{invoice.taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex items-baseline justify-between pt-2" style={{ borderTop: '2px solid var(--sm-border)' }}>
              <span className="text-base font-black">{t.total}</span>
              <span className="text-2xl font-black" style={{ color: 'var(--sm-primary)', fontFeatureSettings: '"tnum"' }}>
                {invoice.total.toFixed(2)} <span className="text-xs font-semibold opacity-50">{t.sar}</span>
              </span>
            </div>
          </div>
        </div>

        {/* ═══ FEEDBACK SECTION ═══ */}
        <div
          className="rounded-3xl p-6 space-y-5"
          style={{
            background: 'var(--sm-bg-card)',
            border: '1px solid var(--sm-border)',
          }}
        >
          <h2 className="text-base font-black text-center">{t.feedbackTitle}</h2>

          <StarRating
            value={rating}
            onChange={(v) => {
              if (!feedbackSubmitted && !isExistingFeedback) {
                setRating(v);
              }
            }}
            readOnly={feedbackSubmitted || isExistingFeedback}
          />

          {/* After submission or existing feedback */}
          {(feedbackSubmitted || isExistingFeedback) ? (
            <div className="text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full" style={{ background: 'rgba(16,185,129,0.1)' }}>
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              </div>
              <p className="text-sm font-bold" style={{ color: 'var(--sm-primary)' }}>
                {isExistingFeedback && !feedbackSubmitted ? t.alreadyRated : t.thankYou}
              </p>
              {/* Show Google prompt for high ratings */}
              {rating >= 4 && salon.googleMapsUrl && (
                <a
                  href={salon.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold text-white shadow-md transition-transform hover:scale-105"
                  style={{ background: '#4285F4' }}
                  onClick={handleGoogleClick}
                >
                  <ExternalLink size={14} /> {t.shareGoogle}
                </a>
              )}
            </div>
          ) : (
            <>
              {/* Pre-submission flow */}
              {rating > 0 && (
                <div className="space-y-3 animate-[fadeIn_0.3s_ease-out]">
                  {rating >= 4 ? (
                    /* Positive: Google prompt */
                    <div className="text-center space-y-3">
                      <p className="text-sm" style={{ color: 'var(--sm-text-secondary)' }}>
                        {t.feedbackPositive}
                      </p>
                      {salon.googleMapsUrl && (
                        <a
                          href={salon.googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold text-white shadow-md transition-transform hover:scale-105"
                          style={{ background: '#4285F4' }}
                          onClick={() => {
                            handleGoogleClick();
                            // Submit the positive feedback silently
                            handleSubmitFeedback();
                          }}
                        >
                          <ExternalLink size={14} /> {t.shareGoogle}
                        </a>
                      )}
                      <button
                        onClick={handleSubmitFeedback}
                        disabled={submitting}
                        className="block mx-auto text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
                        style={{ color: 'var(--sm-text-secondary)' }}
                      >
                        {submitting ? '...' : t.submitFeedback}
                      </button>
                    </div>
                  ) : (
                    /* Negative: Comment box */
                    <div className="space-y-3">
                      <p className="text-sm text-center" style={{ color: 'var(--sm-text-secondary)' }}>
                        {t.feedbackNegative}
                      </p>
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder={t.commentPlaceholder}
                        className="w-full resize-none rounded-2xl p-4 text-sm outline-none transition-all focus:ring-2"
                        style={{
                          background: 'var(--sm-accent)',
                          color: 'var(--sm-text)',
                          border: '1px solid var(--sm-border)',
                          minHeight: 80,
                          focusRingColor: 'var(--sm-primary)',
                        } as React.CSSProperties}
                        rows={3}
                        maxLength={500}
                      />
                      <button
                        onClick={handleSubmitFeedback}
                        disabled={submitting}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                        style={{ background: 'var(--sm-primary)' }}
                      >
                        {submitting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Send size={14} /> {t.submitFeedback}
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* ═══ ACTION BUTTONS ═══ */}
        <div className="space-y-3">
          <a
            href={`/${slug}/order`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'var(--sm-accent)',
              color: 'var(--sm-primary)',
            }}
          >
            <ShoppingBag size={16} /> {t.browseServices}
          </a>

          {salon.googleMapsUrl && (
            <a
              href={salon.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: dark ? 'rgba(255,255,255,0.05)' : 'transparent',
                color: 'var(--sm-text-secondary)',
                border: '1px solid var(--sm-border)',
              }}
            >
              <MapPin size={16} /> {t.direction}
            </a>
          )}
        </div>

        {/* ═══ FOOTER ═══ */}
        <div className="pb-8 pt-4 text-center">
          <p className="text-xs" style={{ color: 'var(--sm-text-secondary)', opacity: 0.4 }}>
            {t.poweredBy} <a href="https://servi-x.com" target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700 }}>SERVIX</a>
          </p>
        </div>
      </div>

      {/* ── Global Animations ── */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
