'use client';

import { useState, useEffect } from 'react';
import { X, Phone, Loader2, Check, Send, ChevronDown, User } from 'lucide-react';
import { dashboardService } from '@/services/dashboard.service';
import { useAuth } from '@/hooks/useAuth';
import { B, T, TN, fmt } from '../pos-constants';

const GCC_CODES = [
  { code: '+966', flag: '🇸🇦', label: 'السعودية', len: 9 },
  { code: '+971', flag: '🇦🇪', label: 'الإمارات', len: 9 },
  { code: '+965', flag: '🇰🇼', label: 'الكويت',   len: 8 },
  { code: '+973', flag: '🇧🇭', label: 'البحرين',  len: 8 },
  { code: '+974', flag: '🇶🇦', label: 'قطر',      len: 8 },
  { code: '+968', flag: '🇴🇲', label: 'عمان',     len: 8 },
] as const;

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

function extractApiErrorMessage(err: unknown): string {
  if (!err) return 'فشل الإرسال';
  if (typeof err === 'string') return err;
  const e = err as { message?: unknown; details?: unknown };
  if (typeof e.message === 'string' && e.message.trim()) return e.message;
  if (Array.isArray(e.details) && e.details.length) return String(e.details[0]);
  return 'فشل الإرسال';
}

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
  const [waError, setWaError] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [clientName, setClientName] = useState('');
  const [countryIdx, setCountryIdx] = useState(0);
  const [showCodes, setShowCodes] = useState(false);
  const country = GCC_CODES[countryIdx];

  useEffect(() => {
    if (isOpen && clientPhone) setPhone(clientPhone);
  }, [isOpen, clientPhone]);

  if (!isOpen) return null;

  const handleSendWhatsApp = async () => {
    if (!invoiceId || !accessToken) return;
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== country.len) return;
    // E.164 without + (Evolution API format): "<countryCode><digits>"
    const e164 = `${country.code.replace('+', '')}${digits}`;
    setWaStat('sending');
    setWaError(null);
    try {
      await dashboardService.sendInvoice(invoiceId, 'whatsapp', accessToken, e164);
      setWaStat('sent');
    } catch (err) {
      const msg = extractApiErrorMessage(err);
      console.error('[QRSuccessModal] WA send failed:', err);
      setWaError(msg);
      setWaStat('error');
      setTimeout(() => { setWaStat('idle'); setWaError(null); }, 5000);
    }
  };

  const handleClose = () => {
    setWaStat('idle');
    setWaError(null);
    setPhone('');
    setClientName('');
    setCountryIdx(0);
    setShowCodes(false);
    onClose();
  };

  const digits = phone.replace(/\D/g, '');
  const isPhoneValid = digits.length === country.len;

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
          className="pointer-events-auto w-full max-w-[360px] rounded-[20px] shadow-[0_25px_60px_rgba(0,0,0,0.5)]"
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

          {/* ── Client Name + Phone + Send ── */}
          <div className="px-6 pb-6 space-y-3">
            {/* Client name */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-white/40">
                <User size={11} />
                اسم العميل
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(ev) => setClientName(ev.target.value)}
                placeholder="اسم الزبونة..."
                dir="rtl"
                className={`w-full rounded-xl px-4 py-3 text-[14px] font-semibold text-white placeholder:text-white/15 focus:outline-none ${T}`}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1.5px solid rgba(255,255,255,0.06)',
                }}
              />
            </div>

            {/* Phone input */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-white/40">
                <Phone size={11} />
                رقم جوال العميل
              </label>
              <div className="relative flex items-stretch gap-0" dir="ltr">
                {/* Country code selector */}
                <button
                  type="button"
                  onClick={() => setShowCodes(p => !p)}
                  className={`${B} flex items-center gap-1 rounded-s-xl px-3 text-[13px] font-bold text-white/80 shrink-0`}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    borderTop: '1.5px solid rgba(255,255,255,0.08)',
                    borderBottom: '1.5px solid rgba(255,255,255,0.08)',
                    borderLeft: '1.5px solid rgba(255,255,255,0.08)',
                    borderRight: 'none',
                  }}
                >
                  <span className="text-[16px] leading-none">{country.flag}</span>
                  <span style={TN}>{country.code}</span>
                  <ChevronDown size={10} className="text-white/30" />
                </button>
                {/* Dropdown */}
                {showCodes && (
                  <div
                    className="absolute top-full start-0 z-10 mt-1 w-[200px] rounded-xl overflow-hidden shadow-xl"
                    style={{ background: '#1e1e36', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    {GCC_CODES.map((c, i) => (
                      <button
                        key={c.code}
                        onClick={() => { setCountryIdx(i); setShowCodes(false); }}
                        className={`${B} flex w-full items-center gap-3 px-3.5 py-2.5 text-start text-[12px] hover:bg-white/5 ${
                          i === countryIdx ? 'bg-white/8 text-white' : 'text-white/60'
                        }`}
                      >
                        <span className="text-[18px]">{c.flag}</span>
                        <span className="flex-1 font-semibold">{c.label}</span>
                        <span className="font-bold text-white/30" style={TN}>{c.code}</span>
                        {i === countryIdx && <Check size={12} className="text-emerald-400" />}
                      </button>
                    ))}
                  </div>
                )}
                {/* Number */}
                <input
                  type="tel"
                  value={phone}
                  onChange={(ev) => setPhone(ev.target.value.replace(/\D/g, ''))}
                  placeholder={country.code === '+966' ? '5XXXXXXXX' : 'XXXXXXXX'}
                  dir="ltr"
                  className={`flex-1 min-w-0 rounded-e-xl px-4 py-3 text-[16px] font-bold text-white tracking-[0.1em] placeholder:text-white/15 placeholder:tracking-[0.05em] placeholder:font-normal focus:outline-none ${T}`}
                  style={{
                    ...TN,
                    background: 'rgba(255,255,255,0.04)',
                    borderTop: `1.5px solid ${digits && !isPhoneValid ? 'rgba(239,68,68,0.4)' : isPhoneValid ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.06)'}`,
                    borderBottom: `1.5px solid ${digits && !isPhoneValid ? 'rgba(239,68,68,0.4)' : isPhoneValid ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.06)'}`,
                    borderRight: `1.5px solid ${digits && !isPhoneValid ? 'rgba(239,68,68,0.4)' : isPhoneValid ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.06)'}`,
                    borderLeft: 'none',
                  }}
                />
              </div>
              {digits && !isPhoneValid && (
                <p className="text-[10px] text-red-400/80 text-center">
                  أدخل {country.len} أرقام بعد الكود
                </p>
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
            {waStat === 'error' && waError && (
              <p className="text-[10px] text-red-400/90 text-center leading-relaxed px-1">
                {waError}
              </p>
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
