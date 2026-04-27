'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search, UserPlus, Crown, User, Phone, StickyNote,
  Star, Gift, RotateCcw, Loader2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { E } from '../pos-engine';
import { B, BS, INP, T, G3, brd, bg, accentBg, accentColor, accentMix, TN, fmt } from '../pos-constants';

export function ClientSection({ e, lg }: { e: E; lg?: boolean }) {
  const { accessToken } = useAuth();
  const sz = lg ? { wrap: 'p-4 space-y-3', inp: 'py-3.5 ps-10 pe-4 text-[14px] rounded-2xl', avatar: 'h-12 w-12 text-[16px]', name: 'text-[14px]', ph: 'text-[11px]', btn: 'text-[13px]', note: 'py-2.5 ps-9 pe-3 text-[11px] rounded-xl' }
    : { wrap: 'p-3 space-y-2', inp: 'py-2 ps-8 pe-2 text-[11px]', avatar: 'h-9 w-9 text-[12px]', name: 'text-[11px]', ph: 'text-[8px]', btn: 'text-[9px]', note: 'py-1.5 ps-6 pe-2 text-[8px] rounded-lg' };

  /* ── Last invoice for "Repeat" feature ── */
  const isRealClient = !!e.client && e.client.fullName !== 'زائر';

  const { data: lastInvData } = useQuery({
    queryKey: ['pos-last-invoice', e.client?.id],
    queryFn: () => api.get<{ items: Array<{ id: string; invoiceItems?: Array<{ serviceId?: string; description?: string; quantity?: number }> }> }>(`/invoices?clientId=${e.client!.id}&limit=1`, accessToken!),
    enabled: isRealClient && !!accessToken,
  });

  const lastInvoice = (lastInvData as unknown as { items?: unknown[] })?.items?.[0] as { invoiceItems?: Array<{ serviceId?: string }> } | undefined;

  const [repeatLoading, setRepeatLoading] = useState(false);
  const handleRepeat = () => {
    if (!lastInvoice?.invoiceItems?.length) return;
    setRepeatLoading(true);
    let loaded = 0;
    for (const item of lastInvoice.invoiceItems) {
      if (!item.serviceId) continue;
      const svc = e.allSvcs.find(s => s.id === item.serviceId);
      if (svc) { e.addToCart(svc); loaded++; }
    }
    if (loaded > 0) toast.success(`تم تحميل ${loaded} خدمات من الزيارة السابقة`);
    else toast.error('لم يتم العثور على خدمات');
    setRepeatLoading(false);
  };

  return (
    <div className={`shrink-0 ${brd(4)} border-b ${sz.wrap}`}>
      <div className="flex items-center gap-1.5"><User size={lg ? 14 : 10} style={accentColor} /><span className={`${lg ? 'text-[13px]' : 'text-[10px]'} font-bold text-[var(--foreground)]`}>العميل</span></div>
      {e.client ? (
        <div className={`rounded-xl ${G3} p-2.5`}>
          <div className="flex items-center gap-2">
            <div className={`flex ${sz.avatar} shrink-0 items-center justify-center rounded-full font-bold`} style={{ ...accentMix(15), ...accentColor }}>{e.client.fullName.charAt(0)}</div>
            <div className="min-w-0 flex-1">
              <p className={`truncate ${sz.name} font-bold text-[var(--foreground)]`}>{e.client.fullName}{e.client.totalVisits >= 10 && <Crown size={9} className="inline ms-1" style={accentColor} />}</p>
              <p className={`${sz.ph} text-[var(--muted-foreground)]`} dir="ltr">{e.client.phone}</p>
              {/* Loyalty points */}
              {e.loyaltyPoints !== null && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Star size={8} className={e.loyaltyPoints > 0 ? 'text-amber-400' : 'text-[var(--muted-foreground)]'} style={{ opacity: e.loyaltyPoints > 0 ? 1 : 0.4 }} />
                  <span className={`text-[8px] font-bold ${e.loyaltyPoints > 0 ? 'text-amber-400' : 'text-[var(--muted-foreground)]'}`} style={TN}>
                    {e.loyaltyPoints} نقطة
                  </span>
                </div>
              )}
            </div>
            <button onClick={() => e.setClient(null)} className={`${BS} text-[8px] font-semibold`} style={accentColor}>تغيير</button>
          </div>
          {!lg && <div className={`mt-2 flex gap-4 ${brd(4)} border-t pt-2`}><div><p className="text-[12px] font-black text-[var(--foreground)]" style={TN}>{e.client.totalVisits}</p><p className="text-[7px] text-[var(--muted-foreground)]">زيارة</p></div><div><p className="text-[12px] font-black" style={{ ...TN, ...accentColor }}>{fmt(e.client.totalSpent)}</p><p className="text-[7px] text-[var(--muted-foreground)]">إنفاق</p></div></div>}
          {e.client.notes && <p className="mt-1.5 rounded-lg bg-amber-500/10 px-2 py-1 text-[8px] text-amber-400">{e.client.notes}</p>}

          {/* Loyalty redeem + Repeat buttons */}
          {isRealClient && (
            <div className={`mt-2 flex gap-1 ${brd(4)} border-t pt-2`}>
              {e.loyaltyPoints !== null && e.loyaltyPoints > 0 && (
                <button onClick={e.redeemLoyalty} className={`${BS} flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-[8px] font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/15`}>
                  <Gift size={9} /> استبدال نقاط
                </button>
              )}
              {lastInvoice?.invoiceItems?.length ? (
                <button onClick={handleRepeat} disabled={repeatLoading} className={`${BS} flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-[8px] font-bold text-[var(--muted-foreground)] ${bg(3)} hover:text-[var(--foreground)]`}>
                  {repeatLoading ? <Loader2 size={9} className="animate-spin" /> : <><RotateCcw size={9} /> تكرار آخر زيارة</>}
                </button>
              ) : null}
            </div>
          )}
        </div>
      ) : e.walkInMode ? (
        <div className="space-y-1.5">
          <div className="relative"><User size={11} className="absolute start-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" style={{ opacity: 0.3 }} /><input value={e.walkName} onChange={ev => e.setWalkName(ev.target.value)} placeholder="اسم العميل" className={`${INP} ${sz.inp}`} /></div>
          <div className="relative"><Phone size={11} className="absolute start-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" style={{ opacity: 0.3 }} /><input value={e.walkPhone} onChange={ev => e.setWalkPhone(ev.target.value)} placeholder="رقم الجوال" dir="ltr" className={`${INP} ${sz.inp}`} /></div>
          <button onClick={() => { e.setWalkInMode(false); e.setWalkName(''); e.setWalkPhone(''); }} className="text-[8px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]">إلغاء</button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="relative">
            <Search size={11} className="absolute start-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" style={{ opacity: 0.3 }} />
            <input value={e.cliSearch} onChange={ev => e.setCliSearch(ev.target.value)} placeholder="بحث بالاسم أو الجوال..." className={`${INP} ${sz.inp}`} />
            {e.cliResults.length > 0 && e.cliSearch.length >= 2 && (
              <div className={`absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl ${G3}`}>
                {e.cliResults.map(c => (
                  <button key={c.id} onClick={() => { e.setClient(c); e.setCliSearch(''); }} className={`${B} flex w-full items-center gap-2 px-3 py-2 text-start hover:${bg(4)}`}>
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[8px] font-bold" style={{ ...accentMix(12), ...accentColor }}>{c.fullName.charAt(0)}</div>
                    <div className="min-w-0 flex-1"><p className="truncate text-[10px] font-medium text-[var(--foreground)]">{c.fullName}</p><p className="text-[7px] text-[var(--muted-foreground)]" dir="ltr">{c.phone}</p></div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => e.setWalkInMode(true)} className={`${B} flex w-full items-center justify-center gap-1 rounded-xl border border-dashed ${brd(6)} py-2 ${sz.btn} font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)]`}><UserPlus size={lg ? 16 : 11} /> Walk-in</button>
        </div>
      )}
      <div className="relative">
        <StickyNote size={9} className="absolute start-2 top-1.5 text-[var(--muted-foreground)]" style={{ opacity: 0.2 }} />
        <input value={e.custNote} onChange={ev => e.setCustNote(ev.target.value)} placeholder="ملاحظة..." className={`w-full ${brd(3)} border ${bg(2)} text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none ${T} ${sz.note}`} />
      </div>
    </div>
  );
}
