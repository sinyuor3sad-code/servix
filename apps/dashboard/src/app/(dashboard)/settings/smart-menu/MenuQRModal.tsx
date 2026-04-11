'use client';

import { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { X, QrCode, Download, Copy, Check, ExternalLink, Printer } from 'lucide-react';
import { toast } from 'sonner';

interface MenuQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  slug: string;
  salonName?: string;
}

export function MenuQRModal({ isOpen, onClose, slug, salonName }: MenuQRModalProps) {
  const qrWrapRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const menuUrl = `https://booking.servi-x.com/${slug}/order`;

  const handleDownload = () => {
    const canvas = qrWrapRef.current?.querySelector('canvas');
    if (!canvas) {
      toast.error('تعذّر إنشاء الصورة');
      return;
    }
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `servix-menu-${slug}.png`;
    link.href = url;
    link.click();
    toast.success('✅ تم تنزيل الباركود');
  };

  const handlePrint = () => {
    const canvas = qrWrapRef.current?.querySelector('canvas');
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const win = window.open('', '_blank', 'width=600,height=800');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>باركود المنيو</title>
      <style>
        @page { size: A4; margin: 20mm; }
        body { font-family: 'Tajawal', 'Cairo', system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 40px 20px; background: #fff; color: #0f172a; text-align: center; }
        .wrap { border: 2px dashed #cbd5e1; border-radius: 24px; padding: 40px 60px; max-width: 500px; }
        h1 { font-size: 28px; font-weight: 900; margin: 0 0 8px; }
        p  { font-size: 14px; color: #64748b; margin: 0 0 28px; }
        img { width: 280px; height: 280px; }
        .url { margin-top: 24px; direction: ltr; font-size: 11px; color: #94a3b8; word-break: break-all; }
        .brand { margin-top: 32px; font-size: 11px; color: #cbd5e1; letter-spacing: 2px; text-transform: uppercase; }
      </style></head><body><div class="wrap">
      ${salonName ? `<h1>${salonName}</h1>` : ''}
      <p>امسح الباركود لعرض قائمة الخدمات</p>
      <img src="${dataUrl}" alt="Menu QR" />
      <div class="url">${menuUrl}</div>
      <div class="brand">Powered by SERVIX</div>
      </div><script>window.onload=()=>{setTimeout(()=>window.print(),300);};</script></body></html>
    `);
    win.document.close();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(menuUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('تعذّر النسخ');
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-md rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-2xl overflow-hidden animate-fade-in-up"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative px-6 pt-6 pb-5 bg-gradient-to-br from-cyan-500 via-teal-500 to-emerald-600 text-white">
            <button
              onClick={onClose}
              className="absolute top-4 end-4 flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 backdrop-blur hover:bg-white/25 transition"
              aria-label="إغلاق"
            >
              <X size={14} />
            </button>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur shadow-lg">
                <QrCode className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-black leading-tight">باركود المنيو الذكي</h2>
                <p className="text-xs opacity-90 mt-0.5">امسحه للوصول إلى قائمة الخدمات</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-5">
            {/* QR code */}
            <div
              ref={qrWrapRef}
              className="mx-auto w-fit rounded-2xl bg-white p-5 shadow-inner"
              style={{ boxShadow: 'inset 0 0 0 2px #e2e8f0' }}
            >
              <QRCodeCanvas
                value={menuUrl}
                size={240}
                level="H"
                bgColor="#ffffff"
                fgColor="#0f172a"
                includeMargin={false}
              />
            </div>

            {/* URL */}
            <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2.5">
              <ExternalLink size={14} className="shrink-0 text-[var(--muted-foreground)]" />
              <span dir="ltr" className="flex-1 truncate text-xs text-[var(--foreground)] font-mono">
                {menuUrl}
              </span>
              <button
                onClick={handleCopy}
                className="shrink-0 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition"
                aria-label="نسخ الرابط"
              >
                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              </button>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleDownload}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 py-3 text-sm font-bold text-white shadow-lg hover:scale-[1.02] active:scale-[0.98] transition"
              >
                <Download size={14} /> تنزيل PNG
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 py-3 text-sm font-bold text-[var(--foreground)] hover:bg-[var(--muted)]/50 transition"
              >
                <Printer size={14} /> طباعة
              </button>
            </div>

            <p className="text-center text-[11px] text-[var(--muted-foreground)] leading-relaxed px-2">
              اطبعي الباركود وضعيه في الصالون ليتصفح العملاء المنيو على هواتفهم مباشرة
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
