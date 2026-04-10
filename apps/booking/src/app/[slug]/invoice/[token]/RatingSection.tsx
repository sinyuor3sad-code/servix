'use client';

import { useState, useCallback } from 'react';
import {
  Star, CheckCircle2, ExternalLink, Loader2, Send,
  MessageCircle, Sparkles,
} from 'lucide-react';
import { menuApi } from '@/lib/menu-api';

/* ═══════════════════════════════════════════════════════════════
   TRANSLATIONS
   ═══════════════════════════════════════════════════════════════ */
const T = {
  ar: {
    title: 'كيف كانت تجربتك؟',
    positive: 'يسعدنا رضاك! 🎉',
    negative: 'نعتذر عن التجربة 🙏',
    commentPositive: 'أضيفي تعليقاً...',
    commentNegative: 'ساعدينا نتحسن — ما الذي لم يعجبك؟',
    submitRating: 'إرسال التقييم',
    submitNote: 'إرسال الملاحظة',
    thankYou: 'شكراً لتقييمك!',
    thankYouNote: 'شكراً لملاحظاتك، تم إرسالها للإدارة',
    googlePrompt: 'هل تحبين مشاركة تجربتك على Google؟',
    googleButton: 'تقييم على Google ⭐',
    noThanks: 'لا، شكراً',
    alreadyRated: 'شكراً لتقييمك',
    yourComment: 'تعليقك',
  },
  en: {
    title: 'How was your experience?',
    positive: 'We\'re glad you enjoyed it! 🎉',
    negative: 'We\'re sorry about that 🙏',
    commentPositive: 'Add a comment...',
    commentNegative: 'Help us improve — what didn\'t you like?',
    submitRating: 'Submit Rating',
    submitNote: 'Submit Note',
    thankYou: 'Thank you for your feedback!',
    thankYouNote: 'Thanks for your notes, they\'ve been sent to management',
    googlePrompt: 'Would you like to share your experience on Google?',
    googleButton: 'Rate on Google ⭐',
    noThanks: 'No, thanks',
    alreadyRated: 'Thanks for your rating',
    yourComment: 'Your comment',
  },
};

type Lang = 'ar' | 'en';

/* ═══════════════════════════════════════════════════════════════
   ANIMATED STAR RATING
   ═══════════════════════════════════════════════════════════════ */
function StarRating({
  value,
  hoverValue,
  onChange,
  onHover,
  readOnly,
}: {
  value: number;
  hoverValue: number;
  onChange?: (v: number) => void;
  onHover?: (v: number) => void;
  readOnly?: boolean;
}) {
  const display = hoverValue > 0 ? hoverValue : value;

  return (
    <div className="flex items-center gap-2 justify-center" dir="ltr">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          onClick={() => !readOnly && onChange?.(i)}
          onMouseEnter={() => !readOnly && onHover?.(i)}
          onMouseLeave={() => !readOnly && onHover?.(0)}
          disabled={readOnly}
          className={`transition-all duration-200 ${
            readOnly
              ? 'cursor-default'
              : 'cursor-pointer hover:scale-110 active:scale-90'
          }`}
          type="button"
          style={{ WebkitTapHighlightColor: 'transparent', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          aria-label={`${i} star${i > 1 ? 's' : ''}`}
        >
          <Star
            size={40}
            fill={i <= display ? '#FACC15' : 'transparent'}
            stroke={i <= display ? '#EAB308' : 'var(--sm-border)'}
            strokeWidth={1.5}
            className="transition-all duration-200 drop-shadow-sm"
            style={i <= display ? { filter: 'drop-shadow(0 2px 4px rgba(250,204,21,0.3))' } : undefined}
          />
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
interface RatingSectionProps {
  slug: string;
  token: string;
  lang: Lang;
  googleMapsUrl: string | null;
  existingFeedback: { rating: number; comment: string | null; createdAt: string } | null;
}

type Phase = 'input' | 'submitting' | 'submitted' | 'google-prompt';

export function RatingSection({
  slug,
  token,
  lang,
  googleMapsUrl,
  existingFeedback,
}: RatingSectionProps) {
  const t = T[lang];

  // State
  const [rating, setRating] = useState(existingFeedback?.rating ?? 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [phase, setPhase] = useState<Phase>(existingFeedback ? 'submitted' : 'input');
  const [googleDismissed, setGoogleDismissed] = useState(false);

  // Was this a pre-existing rating from the DB?
  const isExisting = existingFeedback !== null;
  const isHighRating = rating >= 4;
  const hasGoogleUrl = !!googleMapsUrl;

  /* ── Submit feedback ── */
  const handleSubmit = useCallback(async () => {
    if (rating === 0 || phase === 'submitting') return;
    setPhase('submitting');
    try {
      const showGoogle = isHighRating && hasGoogleUrl;
      await menuApi.submitFeedback(slug, token, {
        rating,
        comment: comment.trim() || undefined,
        googlePromptShown: showGoogle,
      });

      // Decide next phase
      if (isHighRating && hasGoogleUrl) {
        setPhase('google-prompt');
      } else {
        setPhase('submitted');
      }
    } catch {
      // 409 = already submitted — treat as success
      setPhase('submitted');
    }
  }, [rating, comment, phase, slug, token, isHighRating, hasGoogleUrl]);

  /* ── Track Google click ── */
  const handleGoogleClick = useCallback(() => {
    menuApi.trackGoogleClick(slug, token).catch(() => {});
  }, [slug, token]);

  /* ═══════════════════════════════════════════════════════════
     STATE 1: Already rated (existing from DB)
     ═══════════════════════════════════════════════════════════ */
  if (isExisting) {
    return (
      <div
        className="rounded-3xl p-6 space-y-4"
        style={{
          background: 'var(--sm-bg-card)',
          border: '1px solid var(--sm-border)',
        }}
      >
        <h2 className="text-base font-black text-center">{t.alreadyRated}</h2>

        <StarRating value={rating} hoverValue={0} readOnly />

        {existingFeedback.comment && (
          <div
            className="rounded-2xl p-4 text-sm"
            style={{
              background: 'var(--sm-accent)',
              color: 'var(--sm-text-secondary)',
            }}
          >
            <p className="text-xs font-bold mb-1.5" style={{ color: 'var(--sm-text-secondary)', opacity: 0.6 }}>
              <MessageCircle size={12} className="inline me-1" />{t.yourComment}
            </p>
            <p className="leading-relaxed">{existingFeedback.comment}</p>
          </div>
        )}

        <div className="flex items-center justify-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: 'rgba(16,185,129,0.1)' }}>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-xs font-semibold" style={{ color: 'var(--sm-text-secondary)' }}>
            {t.thankYou}
          </p>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     STATE 2: Submitted — just-submitted, low rating
     ═══════════════════════════════════════════════════════════ */
  if (phase === 'submitted') {
    return (
      <div
        className="rounded-3xl p-6 space-y-4 animate-[fadeIn_0.4s_ease-out]"
        style={{
          background: 'var(--sm-bg-card)',
          border: '1px solid var(--sm-border)',
        }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full animate-[scaleIn_0.3s_ease-out]" style={{ background: 'rgba(16,185,129,0.1)' }}>
            <CheckCircle2 className="h-7 w-7 text-emerald-500" />
          </div>
          <p className="text-base font-black text-center" style={{ color: 'var(--sm-primary)' }}>
            {isHighRating ? t.thankYou : t.thankYouNote}
          </p>
        </div>

        <StarRating value={rating} hoverValue={0} readOnly />
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     STATE 3: Google Prompt — after high-rating submission
     ═══════════════════════════════════════════════════════════ */
  if (phase === 'google-prompt') {
    if (googleDismissed) {
      return (
        <div
          className="rounded-3xl p-6 space-y-4 animate-[fadeIn_0.4s_ease-out]"
          style={{
            background: 'var(--sm-bg-card)',
            border: '1px solid var(--sm-border)',
          }}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'rgba(16,185,129,0.1)' }}>
              <CheckCircle2 className="h-7 w-7 text-emerald-500" />
            </div>
            <p className="text-base font-black text-center" style={{ color: 'var(--sm-primary)' }}>
              {t.thankYou}
            </p>
          </div>
          <StarRating value={rating} hoverValue={0} readOnly />
        </div>
      );
    }

    return (
      <div
        className="rounded-3xl p-6 space-y-5 animate-[fadeIn_0.4s_ease-out]"
        style={{
          background: 'var(--sm-bg-card)',
          border: '1px solid var(--sm-border)',
        }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'rgba(16,185,129,0.1)' }}>
            <CheckCircle2 className="h-7 w-7 text-emerald-500" />
          </div>
          <p className="text-sm font-bold text-center" style={{ color: 'var(--sm-primary)' }}>
            {t.thankYou}
          </p>
        </div>

        <StarRating value={rating} hoverValue={0} readOnly />

        {/* Google prompt */}
        <div className="space-y-3 text-center">
          <p className="text-sm" style={{ color: 'var(--sm-text-secondary)' }}>
            <Sparkles size={14} className="inline me-1" style={{ color: 'var(--sm-primary)' }} />
            {t.googlePrompt}
          </p>

          <a
            href={googleMapsUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2.5 rounded-2xl px-8 py-4 text-[15px] font-bold text-white shadow-lg transition-transform hover:scale-[1.03] active:scale-[0.97]"
            style={{ background: '#4285F4' }}
            onClick={handleGoogleClick}
          >
            <ExternalLink size={16} /> {t.googleButton}
          </a>

          <button
            onClick={() => setGoogleDismissed(true)}
            className="text-xs font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--sm-text-secondary)', opacity: 0.6 }}
          >
            {t.noThanks}
          </button>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     STATE 4: Input — not yet rated
     ═══════════════════════════════════════════════════════════ */
  return (
    <div
      className="rounded-3xl p-6 space-y-5"
      style={{
        background: 'var(--sm-bg-card)',
        border: '1px solid var(--sm-border)',
      }}
    >
      <h2 className="text-base font-black text-center">{t.title}</h2>

      <StarRating
        value={rating}
        hoverValue={hoverRating}
        onChange={setRating}
        onHover={setHoverRating}
      />

      {/* After star selection */}
      {rating > 0 && (
        <div className="space-y-3 animate-[fadeIn_0.3s_ease-out]">
          {/* ─── High rating (4-5) ─── */}
          {isHighRating ? (
            <div className="space-y-3">
              <p className="text-sm text-center font-semibold" style={{ color: 'var(--sm-primary)' }}>
                {t.positive}
              </p>

              {/* Optional comment */}
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t.commentPositive}
                className="w-full resize-none rounded-2xl p-4 text-sm outline-none transition-all"
                style={{
                  background: 'var(--sm-accent)',
                  color: 'var(--sm-text)',
                  border: '1px solid var(--sm-border)',
                  minHeight: 70,
                } as React.CSSProperties}
                rows={2}
                maxLength={500}
              />

              <button
                onClick={handleSubmit}
                disabled={phase === 'submitting'}
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                style={{ background: 'var(--sm-primary)' }}
              >
                {phase === 'submitting' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send size={14} /> {t.submitRating}
                  </>
                )}
              </button>
            </div>
          ) : (
            /* ─── Low rating (1-3) ─── */
            <div className="space-y-3">
              <p className="text-sm text-center font-semibold" style={{ color: 'var(--sm-text-secondary)' }}>
                {t.negative}
              </p>

              {/* Comment box for feedback */}
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t.commentNegative}
                className="w-full resize-none rounded-2xl p-4 text-sm outline-none transition-all"
                style={{
                  background: 'var(--sm-accent)',
                  color: 'var(--sm-text)',
                  border: '1px solid var(--sm-border)',
                  minHeight: 80,
                } as React.CSSProperties}
                rows={3}
                maxLength={500}
              />

              <button
                onClick={handleSubmit}
                disabled={phase === 'submitting'}
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                style={{ background: 'var(--sm-primary)' }}
              >
                {phase === 'submitting' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send size={14} /> {t.submitNote}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
