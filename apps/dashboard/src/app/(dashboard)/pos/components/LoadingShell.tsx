'use client';

import { Receipt } from 'lucide-react';
import { accentMix, accentColor } from '../pos-constants';

export function LoadingShell() {
  return (
    <div className="flex h-[100dvh] items-center justify-center bg-[var(--background)]" dir="rtl">
      <div className="flex flex-col items-center gap-4 animate-pulse">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={accentMix(15)}>
          <Receipt size={24} style={accentColor} />
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">جارٍ التحميل...</p>
      </div>
    </div>
  );
}
