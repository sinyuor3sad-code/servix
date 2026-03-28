/**
 * SeasonalDecorations — Lightweight inline SVG decorations per seasonal overlay.
 * Rendered server-side inside the seasonal banner.
 * All SVGs are simple paths — no external files, no complex illustrations.
 */

import type { SeasonalId } from '@/lib/themes';

interface SeasonalDecorationsProps {
  seasonalId: SeasonalId;
}

function CrescentMoon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M16 2a14 14 0 1 0 0 28A11 11 0 0 1 16 2z" />
    </svg>
  );
}

function Lantern({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="12" y1="0" x2="12" y2="6" />
      <path d="M8 6h8" />
      <path d="M7 6c-2 4-2 10 0 16h10c2-6 2-12 0-16" fill="currentColor" opacity="0.25" />
      <path d="M7 22c0 3 2 5 5 5s5-2 5-5" />
      <ellipse cx="12" cy="6" rx="4" ry="1.5" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

function Star({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
    </svg>
  );
}

function SimpleMosque({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 32"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M24 2c-6 0-10 6-10 12h20c0-6-4-12-10-12z" opacity="0.8" />
      <rect x="14" y="14" width="20" height="14" opacity="0.6" />
      <rect x="4" y="10" width="4" height="18" rx="1" opacity="0.5" />
      <rect x="40" y="10" width="4" height="18" rx="1" opacity="0.5" />
      <path d="M5 10a1 1 0 0 1 2 0" />
      <path d="M41 10a1 1 0 0 1 2 0" />
      <rect x="21" y="20" width="6" height="8" rx="3" opacity="0.4" />
    </svg>
  );
}

function SwordAndPalm({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 32"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      {/* Sword */}
      <rect x="8" y="14" width="32" height="2" rx="1" />
      <rect x="6" y="12" width="2" height="6" rx="1" />
      <path d="M40 15l4-1v2z" />
      {/* Palm tree */}
      <line x1="24" y1="8" x2="24" y2="20" stroke="currentColor" strokeWidth="1.5" />
      <path d="M24 8c-4-1-8 1-10 3 3-1 7-1 10-1z" opacity="0.7" />
      <path d="M24 8c4-1 8 1 10 3-3-1-7-1-10-1z" opacity="0.7" />
      <path d="M24 6c-3-2-7-1-9 1 3 0 6 0 9-1z" opacity="0.5" />
      <path d="M24 6c3-2 7-1 9 1-3 0-6 0-9-1z" opacity="0.5" />
    </svg>
  );
}

function FoundationEmblem({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <circle cx="16" cy="16" r="10" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      <path d="M16 6v20M6 16h20" strokeWidth="1" stroke="currentColor" opacity="0.3" />
      <circle cx="16" cy="16" r="3" opacity="0.6" />
    </svg>
  );
}

export default function SeasonalDecorations({ seasonalId }: SeasonalDecorationsProps) {
  switch (seasonalId) {
    case 'ramadan':
      return (
        <div className="pointer-events-none flex items-center gap-3" aria-hidden="true">
          <CrescentMoon className="h-5 w-5 text-[#f0c040] opacity-80" />
          <Lantern className="h-6 w-4 text-[#f0c040] opacity-50 hidden sm:block" />
        </div>
      );

    case 'eid-fitr':
      return (
        <div className="pointer-events-none flex items-center gap-2" aria-hidden="true">
          <Star className="h-4 w-4 text-[#d4af37] opacity-70 animate-pulse" />
          <Star className="h-3 w-3 text-white opacity-50 animate-pulse [animation-delay:0.3s]" />
          <Star className="h-4 w-4 text-[#d4af37] opacity-60 animate-pulse [animation-delay:0.6s]" />
        </div>
      );

    case 'eid-adha':
      return (
        <div className="pointer-events-none flex items-center gap-2" aria-hidden="true">
          <SimpleMosque className="h-5 w-8 text-white opacity-50 hidden sm:block" />
        </div>
      );

    case 'national-day':
      return (
        <div className="pointer-events-none flex items-center gap-2" aria-hidden="true">
          <SwordAndPalm className="h-5 w-8 text-white opacity-60 hidden sm:block" />
        </div>
      );

    case 'foundation-day':
      return (
        <div className="pointer-events-none flex items-center gap-2" aria-hidden="true">
          <FoundationEmblem className="h-6 w-6 text-[#d4a054] opacity-60" />
        </div>
      );

    default:
      return null;
  }
}
