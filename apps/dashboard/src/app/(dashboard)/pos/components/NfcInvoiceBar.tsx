'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Smartphone, Check, Clock, RefreshCw,
  MessageCircle, Printer, QrCode, Copy,
  Nfc, X, Link2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { dashboardService } from '@/services/dashboard.service';
import { toast } from 'sonner';
import type { E } from '../pos-engine';
import {
  B, BS, T, TN,
  brd, bg, accentBg, accentColor,
  fmt,
} from '../pos-constants';

interface NfcInvoice {
  id: string;
  invoiceNumber: string;
  total: number;
  createdAt: string;
  publicToken: string | null;
  terminalId: string | null;
  nfcClaimedAt: string | null;
  client?: { fullName?: string };
}

function timeSince(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'الآن';
  if (m < 60) return `${m} د`;
  return `${Math.floor(m / 60)} س`;
}

function CountdownTimer({ createdAt }: { createdAt: string }) {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    const update = () => {
      const elapsed = Date.now() - new Date(createdAt).getTime();
      const left = 3 * 60 * 1000 - elapsed; // 3 min window
      if (left <= 0) { setRemaining('00:00'); return; }
      const m = Math.floor(left / 60_000);
      const s = Math.floor((left % 60_000) / 1000);
      setRemaining(`${m}:${s.toString().padStart(2, '0')}`);
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [createdAt]);
  return <span className="font-mono text-[8px]" style={TN}>{remaining}</span>;
}

interface NfcInvoiceBarProps {
  e: E;
  salonSlug?: string;
}

export function NfcInvoiceBar({ e, salonSlug }: NfcInvoiceBarProps) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [showNfcBar, setShowNfcBar] = useState(true);
  const [showLinkModal, setShowLinkModal] = useState(false);

  const { data: recentData } = useQuery({
    queryKey: ['pos-nfc-invoices', e.terminalId],
    queryFn: () => api.get<{ items: NfcInvoice[] }>(`/invoices?terminalId=${e.terminalId}&limit=10&sort=createdAt&order=desc`, accessToken!),
    enabled: !!accessToken && showNfcBar,
    refetchInterval: 5_000,
  });

  const invoices: NfcInvoice[] = (recentData as unknown as { items?: NfcInvoice[] })?.items ?? [];

  const handleReactivate = async (id: string) => {
    try {
      await api.put(`/invoices/${id}`, { nfcClaimedAt: null }, accessToken!);
      queryClient.invalidateQueries({ queryKey: ['pos-nfc-invoices'] });
      toast.success('تم إعادة تفعيل الفاتورة');
    } catch {
      toast.error('فشل إعادة التفعيل');
    }
  };

  const handleWA = async (id: string) => {
    try {
      await dashboardService.sendInvoice(id, 'whatsapp', accessToken!);
      toast.success('تم الإرسال عبر واتساب');
    } catch { toast.error('فشل الإرسال'); }
  };

  const nfcLink = salonSlug
    ? `https://app.servi-x.com/public/tap/${salonSlug}/${e.terminalId}`
    : `https://app.servi-x.com/public/tap/YOUR_SLUG/${e.terminalId}`;

  const copyLink = () => {
    navigator.clipboard.writeText(nfcLink).then(() => toast.success('تم نسخ الرابط'));
  };

  if (invoices.length === 0 && !showLinkModal) {
    return (
      <div className={`flex items-center justify-between px-4 py-1 ${brd(3)} border-b ${bg(1)}`}>
        <div className="flex items-center gap-2">
          <Nfc size={11} style={accentColor} />
          <span className="text-[8px] text-[var(--muted-foreground)]">NFC — لا توجد فواتير حالياً</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowLinkModal(!showLinkModal)} className={`${BS} rounded-md px-2 py-0.5 text-[7px] font-bold text-[var(--muted-foreground)] hover:text-[var(--foreground)]`}>
            <Link2 size={9} className="inline me-0.5" /> رابط NFC
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* NFC Bar */}
      <div className={`shrink-0 ${brd(3)} border-b ${bg(1)}`}>
        <div className="flex items-center gap-2 px-3 py-1.5">
          <div className="flex shrink-0 items-center gap-1.5">
            <Nfc size={12} style={accentColor} />
            <span className="text-[9px] font-bold text-[var(--foreground)]">NFC</span>
          </div>

          <div className="h-4 w-px bg-[var(--muted-foreground)]" style={{ opacity: 0.1 }} />

          {/* Scrollable invoice cards */}
          <div className="flex flex-1 gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {invoices.map(inv => {
              const elapsed = Date.now() - new Date(inv.createdAt).getTime();
              const claimed = !!inv.nfcClaimedAt;
              const isActive = !claimed && elapsed < 3 * 60 * 1000;
              const isStale = !claimed && elapsed >= 3 * 60 * 1000;

              return (
                <div
                  key={inv.id}
                  className={`relative flex shrink-0 flex-col rounded-xl ${brd(4)} border p-2 min-w-[140px] max-w-[170px] ${T} ${
                    claimed ? bg(2) + ' opacity-50' :
                    isActive ? 'ring-1 ring-emerald-500/30' :
                    'ring-1 ring-amber-500/20'
                  }`}
                >
                  {/* Status indicator */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1">
                      {claimed ? (
                        <Check size={8} className="text-zinc-400" />
                      ) : isActive ? (
                        <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      ) : (
                        <Clock size={8} className="text-amber-400" />
                      )}
                      <span className={`text-[9px] font-bold truncate ${
                        claimed ? 'text-zinc-400' :
                        isActive ? 'text-emerald-400' :
                        'text-amber-400'
                      }`}>
                        {inv.client?.fullName?.split(' ')[0] ?? '—'}
                      </span>
                    </div>
                    <span className={`text-[7px] font-semibold ${
                      claimed ? 'text-zinc-500' :
                      isActive ? 'text-emerald-400' :
                      'text-amber-400'
                    }`}>
                      {claimed ? 'تم' : isActive ? 'نشطة' : 'جاهزة'}
                    </span>
                  </div>

                  {/* Price + Time */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black" style={{ ...TN, ...(claimed ? {} : accentColor) }}>{fmt(Number(inv.total))}</span>
                    <span className="text-[7px] text-[var(--muted-foreground)]">
                      {isActive && !claimed ? <CountdownTimer createdAt={inv.createdAt} /> : timeSince(inv.createdAt)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 mt-1.5">
                    {isStale && !claimed && (
                      <button onClick={() => handleReactivate(inv.id)} className={`${BS} flex flex-1 items-center justify-center gap-0.5 rounded-md py-1 text-[7px] font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/15`}>
                        <RefreshCw size={7} /> تفعيل
                      </button>
                    )}
                    {!claimed && (
                      <>
                        <button onClick={() => handleWA(inv.id)} className={`${BS} flex h-5 w-5 items-center justify-center rounded-md ${bg(3)} text-[var(--muted-foreground)] hover:text-emerald-400`}>
                          <MessageCircle size={8} />
                        </button>
                        <button onClick={() => window.print()} className={`${BS} flex h-5 w-5 items-center justify-center rounded-md ${bg(3)} text-[var(--muted-foreground)] hover:text-[var(--foreground)]`}>
                          <Printer size={8} />
                        </button>
                        {inv.publicToken && (
                          <button onClick={() => { e.setPublicToken(inv.publicToken!); e.setShowQRModal(true); }} className={`${BS} flex h-5 w-5 items-center justify-center rounded-md ${bg(3)} text-[var(--muted-foreground)] hover:text-[var(--foreground)]`}>
                            <QrCode size={8} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="h-4 w-px bg-[var(--muted-foreground)]" style={{ opacity: 0.1 }} />

          {/* Toggle + Link */}
          <div className="flex shrink-0 items-center gap-1">
            <button onClick={() => setShowLinkModal(!showLinkModal)} className={`${BS} rounded-md px-1.5 py-1 text-[7px] font-bold text-[var(--muted-foreground)] hover:text-[var(--foreground)]`}>
              <Link2 size={9} />
            </button>
            <button onClick={() => setShowNfcBar(false)} className={`${BS} rounded-md px-1 py-1 text-[var(--muted-foreground)] hover:text-red-400`}>
              <X size={9} />
            </button>
          </div>
        </div>
      </div>

      {/* NFC Link Modal */}
      {showLinkModal && (
        <div className={`shrink-0 px-4 py-3 ${brd(3)} border-b ${bg(2)} space-y-2`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone size={12} style={accentColor} />
              <span className="text-[10px] font-bold text-[var(--foreground)]">رابط NFC للجهاز</span>
            </div>
            <button onClick={() => setShowLinkModal(false)} className={`${BS} text-[var(--muted-foreground)] hover:text-[var(--foreground)]`}>
              <X size={11} />
            </button>
          </div>
          <div className={`flex items-center gap-2 rounded-xl ${bg(3)} p-2.5`}>
            <code className="flex-1 text-[9px] font-mono text-[var(--foreground)] break-all" dir="ltr">{nfcLink}</code>
            <button onClick={copyLink} className={`${B} flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-[9px] font-bold text-black`} style={accentBg}>
              <Copy size={10} /> نسخ
            </button>
          </div>
          <p className="text-[8px] text-[var(--muted-foreground)] leading-relaxed">
            اكتب هذا الرابط على ملصق NFC باستخدام تطبيق NFC Tools. كل جهاز كاشير يحصل على رابط مختلف تلقائياً.
          </p>
          <div className="flex items-center gap-2">
            <span className="text-[8px] text-[var(--muted-foreground)]">Terminal ID:</span>
            <code className="text-[8px] font-mono font-bold" style={accentColor} dir="ltr">{e.terminalId}</code>
          </div>
        </div>
      )}
    </>
  );
}
