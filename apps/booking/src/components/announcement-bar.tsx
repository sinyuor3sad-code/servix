/**
 * AnnouncementBar — components/announcement-bar.tsx
 *
 * A dismissible sticky banner shown at the top of the booking page.
 * Reads content from the salon's settings (passed as props from Server Component).
 * State (dismissed) is managed client-side in sessionStorage so it resets per session.
 */

'use client';

import { useState, useEffect } from 'react';
import { X, Megaphone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

interface AnnouncementBarProps {
  /** The announcement message (Arabic text) */
  message: string;
  /** Optional CTA text */
  ctaText?: string;
  /** Optional CTA href */
  ctaHref?: string;
  /** Unique key to scope the dismissal to this salon + message */
  storageKey?: string;
  /** Optional extra className */
  className?: string;
}

export default function AnnouncementBar({
  message,
  ctaText,
  ctaHref,
  storageKey = 'servix-announcement-dismissed',
  className,
}: AnnouncementBarProps): React.ReactElement | null {
  const [visible, setVisible] = useState(false);

  // ── Hydration-safe: read sessionStorage only on client ──────────────────
  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return;
    const dismissed = sessionStorage.getItem(storageKey);
    if (!dismissed) setVisible(true);
  }, [storageKey]);

  const dismiss = () => {
    setVisible(false);
    try {
      sessionStorage.setItem(storageKey, '1');
    } catch {
      // Private browsing may block sessionStorage writes — no-op
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            'relative z-40 overflow-hidden',
            className,
          )}
          style={{
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent, var(--color-primary)))',
          }}
        >
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5">
            {/* Icon + message */}
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <Megaphone
                className="h-4 w-4 shrink-0 opacity-90"
                style={{ color: 'var(--color-primary-fg)' }}
              />
              <p
                className="truncate text-sm font-semibold leading-snug"
                style={{ color: 'var(--color-primary-fg)' }}
              >
                {message}
              </p>
            </div>

            {/* Optional CTA */}
            {ctaText && ctaHref && (
              <a
                href={ctaHref}
                className="shrink-0 rounded-full px-3 py-1 text-xs font-bold transition-opacity hover:opacity-80"
                style={{
                  background: 'rgba(255,255,255,0.22)',
                  color:      'var(--color-primary-fg)',
                  backdropFilter: 'blur(4px)',
                }}
              >
                {ctaText}
              </a>
            )}

            {/* Dismiss button */}
            <button
              onClick={dismiss}
              aria-label="إغلاق الإعلان"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-70"
              style={{
                background: 'rgba(255,255,255,0.15)',
                color:      'var(--color-primary-fg)',
              }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
