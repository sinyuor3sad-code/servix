'use client';

import { useState, useEffect } from 'react';
import { X, Phone, MessageCircle, Loader2, Check, Send } from 'lucide-react';
import { dashboardService } from '@/services/dashboard.service';
import { useAuth } from '@/hooks/useAuth';
import { B, T, TN, fmt } from '../pos-constants';

interface QRSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceTotal: number;
  publicToken: string | null;
  tenantSlug: string;
  invoiceId: string | null;
  clientPhone?: string | null;
}

type SendStatus = 'idle' | 'sending' | 'sent' | 'error';

export function QRSuccessModal({
  isOpen,
  onClose,
  invoiceTotal,
  publicToken,
  tenantSlug,
  invoiceId,
  clientPhone,
}: QRSuccessModalProps) {
  const { accessToken } = useAuth();
  const [waStat, setWaStat] = useState<SendStatus>('idle');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (isOpen && clientPhone) setPhone(clientPhone);
  }, [isOpen, clientPhone]);

  if (!isOpen) return null;

  const handleSendWhatsApp = async () => {
    if (!invoiceId || !accessToken || !phone.trim()) return;
    setWaStat('sending');
    try {
      await dashboardService.sendInvoice(invoiceId, 'whatsapp', accessToken);
      setWaStat('sent');
    } catch {
      setWaStat('error');
      setTimeout(() => setWaStat('idle'), 3000);
    }
  };

  const handleClose = () => {
    setWaStat('idle');
    setPhone('');
    onClose();
  };

  const isPhoneValid = /^(05|5|966|\+966)\d{8,9}$/.test(phone.replace(/\s/g, ''));

  return (
    <>
      {/* ── Overlay ── */}
      <div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md"
        onClick={handleClose}
        style={{ animation: 'modalOverlay 200ms ease-out' }}
      />

      {/* ── Modal ── */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          data-testid="pos-success-modal"
          className="pointer-events-auto w-full max-w-[360px] overflow-hidden rounded-[20px] shadow-[0_25px_60px_rgba(0,0,0,0.5)]"
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'linear-gradient(170deg, #1a1a2e 0%, #16162a 50%, #0f0f1e 100%)',
            border: '1px solid rgba(255,255,255,0.06)',
            animation: 'modalSlide 350ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* ── Top: Success Banner ── */}
          <div
            className="relative px-6 pt-8 pb-6 text-center"
            style={{
              background: 'linear-gradient(180deg, rgba(16,185,129,0.08) 0%, transparent 100%)',
            }}
          >
            {/* Close */}
            <button
              data-testid="pos-success-close"
              onClick={handleClose}
              className={`${B} absolute top-3 start-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/30 hover:bg-white/10 hover:text-white/60`}
            >
              <X size={14} />
            </button>

            {/* Animated Checkmark */}
            <div
              className="mx-auto mb-4 flex h-[56px] w-[56px] items-center justify-center rounded-full"
              style={{
                background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05))',
                border: '2px solid rgba(16,185,129,0.3)',
                animation: 'checkPop 500ms cubic-bezier(0.34, 1.56, 0.64, 1) 150ms both',
              }}
            >
              <Check className="text-emerald-400" size={26} strokeWidth={3} />
            </div>

            {/* Title */}
            <h2 className="text-[17px] font-bold text-white tracking-tight">
              تمت العملية بنجاح
            </h2>
            <p className="mt-1 text-[11px] font-medium text-white/30 tracking-wide">
              PAYMENT CONFIRMED
            </p>
          </div>

          {/* ── Amount ── */}
          <div className="mx-6 rounded-2xl px-4 py-5 text-center"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/25">
              المبلغ المدفوع
            </p>
            <div className="flex items-baseline justify-center gap-1.5">
              <span
                className="text-[36px] font-black leading-none text-white"
                style={{ ...TN, letterSpacing: '-0.02em' }}
              >
                {fmt(invoiceTotal)}
              </span>
              <span className="text-[13px] font-bold text-white/20">ر.س</span>
            </div>
          </div>

          {/* ── Divider ── */}
          <div className="mx-6 my-4 h-px" style={{ background: 'rgba(255,255,255,0.05)' }} />

          {/* ── Phone + Send ── */}
          <div className="px-6 pb-6 space-y-3">
            {/* Phone input */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-white/40">
                <Phone size={11} />
                رقم جوال العميل
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(ev) => setPhone(ev.target.value)}
                placeholder="05X XXX XXXX"
                dir="ltr"
                className={`w-full rounded-xl px-4 py-3 text-[16px] font-bold text-center text-white tracking-[0.12em] placeholder:text-white/15 placeholder:tracking-[0.05em] placeholder:font-normal focus:outline-none ${T}`}
                style={{
                  ...TN,
                  background: 'rgba(255,255,255,0.04)',
                  border: `1.5px solid ${phone && !isPhoneValid ? 'rgba(239,68,68,0.4)' : isPhoneValid ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.06)'}`,
                }}
              />
              {phone && !isPhoneValid && (
                <p className="text-[10px] text-red-400/80 text-center">رقم غير صحيح</p>
              )}
            </div>

            {/* WhatsApp Send */}
            {invoiceId && (
              <button
                onClick={handleSendWhatsApp}
                disabled={waStat === 'sending' || waStat === 'sent' || !isPhoneValid}
                className={`${B} w-full flex items-center justify-center gap-2.5 rounded-xl py-3.5 text-[13px] font-bold transition-all disabled:cursor-not-allowed ${
                  waStat === 'sent'
                    ? 'bg-emerald-500 text-white'
                    : waStat === 'error'
                    ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                    : 'text-white disabled:opacity-20'
                }`}
                style={waStat !== 'sent' && waStat !== 'error' ? {
                  background: isPhoneValid
                    ? 'linear-gradient(135deg, #25D366, #128C7E)'
                    : 'rgba(255,255,255,0.04)',
                  border: isPhoneValid ? 'none' : '1px solid rgba(255,255,255,0.06)',
                } : undefined}
              >
                {waStat === 'sending' ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : waStat === 'sent' ? (
                  <Check size={16} strokeWidth={3} />
                ) : (
                  <Send size={14} className={isPhoneValid ? '' : 'opacity-40'} />
                )}
                {waStat === 'sent'
                  ? 'تم الإرسال بنجاح'
                  : waStat === 'error'
                  ? 'فشل — حاول مرة أخرى'
                  : waStat === 'sending'
                  ? 'جاري الإرسال...'
                  : 'إرسال الفاتورة عبر واتساب'}
              </button>
            )}

            {/* Close / New */}
            <button
              onClick={handleClose}
              className={`${B} w-full rounded-xl py-3.5 text-[13px] font-bold text-white/70 hover:text-white hover:bg-white/5`}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              إغلاق / عملية جديدة
            </button>
          </div>
        </div>
      </div>

      {/* ── Keyframes ── */}
      <style>{`
        @keyframes modalOverlay {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes modalSlide {
          from {
            opacity: 0;
            transform: translateY(24px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes checkPop {
          from {
            opacity: 0;
            transform: scale(0.3);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </>
  );
}
