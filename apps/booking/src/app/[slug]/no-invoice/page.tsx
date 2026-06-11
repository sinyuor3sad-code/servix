'use client';

import { useParams, useRouter } from 'next/navigation';
import { Smartphone, RefreshCcw, ArrowLeft } from 'lucide-react';

export default function NoInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const handleRetry = () => {
    // Go back (which will re-trigger the NFC tap URL)
    router.back();
  };

  return (
    <div className="flex min-h-dvh items-center justify-center px-4" dir="rtl">
      <div className="text-center max-w-sm mx-auto space-y-6">
        {/* Icon */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-purple-500/10 to-pink-500/10">
          <Smartphone size={36} className="text-purple-400" strokeWidth={1.5} />
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-gray-900">لا توجد فاتورة في الانتظار</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            لم يتم العثور على فاتورة مرتبطة بهذا الجهاز حالياً.<br />
            حاولي مرة أخرى أو اطلبي من الكاشيرة المساعدة.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleRetry}
            className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-purple-500/20 transition-all active:scale-95"
          >
            <RefreshCcw size={16} />
            حاولي مرة أخرى
          </button>
          <button
            onClick={() => router.push(`/${slug}`)}
            className="flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-gray-500 transition-all hover:text-gray-700"
          >
            <ArrowLeft size={14} />
            العودة للقائمة
          </button>
        </div>

        {/* Footer */}
        <p className="text-[10px] text-gray-300">
          Powered by <span className="font-bold text-purple-400">SERVIX</span>
        </p>
      </div>
    </div>
  );
}
