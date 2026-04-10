'use client';

import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle2, X, QrCode } from 'lucide-react';
import {
  B, T, TN,
  G1, brd, bg,
  accentBg, accentColor, primaryBg,
  fmt,
} from '../pos-constants';

interface QRSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceTotal: number;
  publicToken: string | null;
  tenantSlug: string;
}

export function QRSuccessModal({
  isOpen,
  onClose,
  invoiceTotal,
  publicToken,
  tenantSlug,
}: QRSuccessModalProps) {
  if (!isOpen) return null;

  const invoiceUrl = publicToken
    ? `https://${tenantSlug}.servix.com/invoice/${publicToken}`
    : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
        <div
          className={`pointer-events-auto w-full max-w-sm rounded-3xl ${G1} shadow-2xl border ${brd(4)} overflow-hidden animate-fade-in-up`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <div className="flex justify-end p-3 pb-0">
            <button
              onClick={onClose}
              className={`${B} flex h-8 w-8 items-center justify-center rounded-xl ${bg(3)} text-[var(--muted-foreground)] hover:text-[var(--foreground)]`}
            >
              <X size={14} />
            </button>
          </div>

          {/* Content */}
          <div className="px-8 pb-8 pt-2 text-center space-y-5">
            {/* Success icon */}
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>

            {/* Success text */}
            <div>
              <h2 className="text-lg font-black text-[var(--foreground)]">
                تم الدفع بنجاح ✅
              </h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                المبلغ النهائي
              </p>
            </div>

            {/* Total amount */}
            <div
              className={`rounded-2xl ${bg(2)} py-4`}
            >
              <span
                className="text-3xl font-black"
                style={{ ...TN, ...accentColor }}
              >
                {fmt(invoiceTotal)}{' '}
                <span className="text-sm font-semibold opacity-40">ر.س</span>
              </span>
            </div>

            {/* QR Code */}
            {invoiceUrl ? (
              <div className="space-y-3">
                <div
                  className={`mx-auto flex items-center justify-center rounded-2xl ${bg(2)} p-5`}
                  style={{ width: 'fit-content' }}
                >
                  <QRCodeSVG
                    value={invoiceUrl}
                    size={220}
                    level="M"
                    bgColor="transparent"
                    fgColor="var(--foreground)"
                    includeMargin={false}
                  />
                </div>
                <div className="flex items-center justify-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                  <QrCode size={12} />
                  <span>امسحي الكود لعرض فاتورتك</span>
                </div>
              </div>
            ) : (
              <div className={`rounded-2xl ${bg(2)} py-8 text-center`}>
                <QrCode size={32} className="mx-auto mb-2 text-[var(--muted-foreground)]" style={{ opacity: 0.2 }} />
                <p className="text-xs text-[var(--muted-foreground)]" style={{ opacity: 0.5 }}>QR غير متوفر</p>
              </div>
            )}

            {/* Close button */}
            <button
              onClick={onClose}
              className={`${B} w-full rounded-2xl py-3.5 text-sm font-bold text-black shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]`}
              style={accentBg}
            >
              إغلاق / عملية جديدة
            </button>
          </div>
        </div>
      </div>

    </>
  );
}
