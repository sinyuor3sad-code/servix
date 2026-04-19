'use client';

import { Share2 } from 'lucide-react';

interface ShareButtonProps {
  bookingId: string;
  salonName: string;
  slug: string;
}

export function ShareButton({ bookingId, salonName, slug }: ShareButtonProps) {
  const handleShare = async () => {
    const shareData = {
      title: `حجز في ${salonName}`,
      text: `تم تأكيد حجزي في ${salonName} — رقم الحجز: ${bookingId}`,
      url: typeof window !== 'undefined' ? window.location.href : `/${slug}/confirmation/${bookingId}`,
    };

    try {
      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
        alert('تم نسخ تفاصيل الحجز ✅');
      }
    } catch (err) {
      // User cancelled share or error — ignore
      if ((err as Error)?.name !== 'AbortError') {
        try {
          await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
          alert('تم نسخ تفاصيل الحجز ✅');
        } catch {
          // Final fallback
        }
      }
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-white border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
    >
      <Share2 className="w-5 h-5" />
      مشاركة تفاصيل الحجز
    </button>
  );
}
