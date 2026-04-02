'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background" dir="rtl">
      <div className="text-center px-4">
        <p className="text-6xl font-extrabold text-red-500/30">خطأ</p>
        <h1 className="mt-4 text-2xl font-bold text-foreground">حدث خطأ غير متوقع</h1>
        <p className="mt-2 text-sm text-muted-foreground">نعتذر عن هذا الخطأ. يرجى المحاولة مرة أخرى.</p>
        <button
          onClick={reset}
          className="mt-6 inline-block rounded-xl bg-brand-primary px-6 py-3 text-sm font-bold text-white transition-all hover:opacity-90"
        >
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}
