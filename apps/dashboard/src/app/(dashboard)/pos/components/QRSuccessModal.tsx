'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle2, X, QrCode, MessageCircle, Mail, Loader2, Check } from 'lucide-react';
import { dashboardService } from '@/services/dashboard.service';
import { useAuth } from '@/hooks/useAuth';
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
  invoiceId: string | null;
}

type SendStatus = 'idle' | 'sending' | 'sent' | 'error';

export function QRSuccessModal({
  isOpen,
  onClose,
  invoiceTotal,
  publicToken,
  tenantSlug,
  invoiceId,
}: QRSuccessModalProps) {
  const { accessToken } = useAuth();
  const [waStat, setWaStat] = useState<SendStatus>('idle');
  const [mailStat, setMailStat] = useState<SendStatus>('idle');

  if (!isOpen) return null;

  const invoiceUrl = publicToken
    ? `https://booking.servi-x.com/${tenantSlug}/invoice/${publicToken}`
    : null;

  const handleSend = async (channel: 'whatsapp' | 'email') => {
    if (!invoiceId || !accessToken) return;
    const setter = channel === 'whatsapp' ? setWaStat : setMailStat;
    setter('sending');
    try {
      await dashboardService.sendInvoice(invoiceId, channel, accessToken);
      setter('sent');
    } catch {
      setter('error');
      setTimeout(() => setter('idle'), 3000);
    }
  };

  const handleClose = () => {
    setWaStat('idle');
    setMailStat('idle');
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={handleClose}
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
              onClick={handleClose}
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
                    size={180}
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

            {/* ─── Send Buttons ─── */}
            {invoiceId && (
              <div className="flex gap-3">
                {/* WhatsApp Button */}
                <button
                  onClick={() => handleSend('whatsapp')}
                  disabled={waStat === 'sending' || waStat === 'sent'}
                  className={`${B} flex-1 flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 ${
                    waStat === 'sent'
                      ? 'bg-emerald-500 text-white'
                      : waStat === 'error'
                      ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                      : 'bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20 hover:bg-[#25D366]/20'
                  }`}
                >
                  {waStat === 'sending' ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : waStat === 'sent' ? (
                    <Check size={16} />
                  ) : (
                    <MessageCircle size={16} />
                  )}
                  {waStat === 'sent' ? 'تم ✓' : waStat === 'error' ? 'فشل!' : waStat === 'sending' ? 'جاري...' : 'واتساب'}
                </button>

                {/* Email Button */}
                <button
                  onClick={() => handleSend('email')}
                  disabled={mailStat === 'sending' || mailStat === 'sent'}
                  className={`${B} flex-1 flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 ${
                    mailStat === 'sent'
                      ? 'bg-emerald-500 text-white'
                      : mailStat === 'error'
                      ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                      : `${bg(3)} text-[var(--foreground)] border ${brd(4)} hover:${bg(4)}`
                  }`}
                >
                  {mailStat === 'sending' ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : mailStat === 'sent' ? (
                    <Check size={16} />
                  ) : (
                    <Mail size={16} />
                  )}
                  {mailStat === 'sent' ? 'تم ✓' : mailStat === 'error' ? 'فشل!' : mailStat === 'sending' ? 'جاري...' : 'إيميل'}
                </button>
              </div>
            )}

            {/* Close button */}
            <button
              onClick={handleClose}
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
