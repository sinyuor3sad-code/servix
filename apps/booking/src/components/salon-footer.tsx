/**
 * SalonFooter — components/salon-footer.tsx
 * Minimal branded footer for the booking pages.
 */

import { Instagram, Twitter } from 'lucide-react';
import type { SalonInfo } from '@/lib/api';

interface SalonFooterProps {
  salon: SalonInfo;
}

export default function SalonFooter({ salon }: SalonFooterProps): React.ReactElement {
  return (
    <footer
      className="border-t py-8"
      style={{
        borderColor: 'var(--color-border)',
        background:  'var(--color-bg-2)',
      }}
    >
      <div className="mx-auto max-w-5xl px-4">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">

          {/* Salon name */}
          <p
            className="font-heading text-sm font-semibold"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {salon.nameAr}
          </p>

          {/* Social links placeholder */}
          <div className="flex items-center gap-3">
            <a
              href="#"
              aria-label="إنستقرام"
              className="flex h-9 w-9 items-center justify-center rounded-full transition-all"
              style={{
                background:  'var(--color-surface)',
                border:      '1px solid var(--color-border)',
                color:       'var(--color-text-muted)',
              }}
            >
              <Instagram className="h-4 w-4" />
            </a>
            <a
              href="#"
              aria-label="تويتر / X"
              className="flex h-9 w-9 items-center justify-center rounded-full transition-all"
              style={{
                background:  'var(--color-surface)',
                border:      '1px solid var(--color-border)',
                color:       'var(--color-text-muted)',
              }}
            >
              <Twitter className="h-4 w-4" />
            </a>
          </div>

          {/* Powered by */}
          <p
            className="text-xs"
            style={{ color: 'var(--color-text-subtle)' }}
          >
            مدعوم بواسطة{' '}
            <a
              href="https://servi-x.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold transition-opacity hover:opacity-75"
              style={{ color: 'var(--color-primary)' }}
            >
              SERVIX
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
