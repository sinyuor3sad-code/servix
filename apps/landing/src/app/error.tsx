'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Landing error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: '#03020a' }} dir="rtl">
      <div className="text-center px-4">
        <p className="text-6xl font-extrabold text-red-500/15">خطأ</p>
        <h1 className="mt-4 text-2xl font-bold text-white/80">حدث خطأ غير متوقع</h1>
        <p className="mt-2 text-sm text-white/35">نعتذر عن هذا الخطأ. يرجى المحاولة مرة أخرى.</p>
        <button
          onClick={reset}
          className="mt-6 inline-block rounded-xl bg-purple-600 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-purple-500"
        >
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}
