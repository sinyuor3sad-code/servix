'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Search, Minus, Plus, Trash2,
  ShoppingCart, Receipt,
  Printer, MessageCircle,
  X, User, Phone, Users, UserPlus,
  Pause, Play, RotateCcw, Split, Percent, Heart, Package,
  CircleDollarSign, Wifi, WifiOff,
  Check, ArrowLeft, ClipboardCheck,
} from 'lucide-react';
import type { E } from '../pos-engine';
import {
  B, BS, T, TN,
  G1, G2, INP,
  brd, bg,
  accentBg, accentColor, accentMix, primaryBg,
  fmt, PAY,
} from '../pos-constants';
import { ClientSection } from './ClientSection';
import { EmployeePicker } from './EmployeePicker';
import { CategoryBar } from './CategoryBar';
import { ServiceGrid } from './ServiceGrid';
import { PanelModals } from './PanelModals';
import { OrderInput } from './OrderInput';
import { QRSuccessModal } from './QRSuccessModal';
import { useAuth } from '@/hooks/useAuth';

export function TouchPOS({ e }: { e: E }) {
  const { currentTenant, userRole, isOwner } = useAuth();
  const isCashierOnly = userRole === 'cashier' && !isOwner;
  const [showCart, setShowCart] = useState(false);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--background)]" dir="rtl" style={{ paddingTop: 'var(--safe-top, 0px)' }}>
      {/* HEADER — compact on phone, full on tablet */}
      <header className={`flex shrink-0 items-center justify-between px-3 py-2 md:px-4 md:py-2.5 ${G2} ${brd(4)} border-b`}>
        <div className="flex items-center gap-2 md:gap-3">
          <div className="flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-xl md:rounded-2xl" style={primaryBg}><Receipt size={14} className="text-white" /></div>
          <div className="hidden sm:block"><span className="text-[14px] font-black text-[var(--foreground)]">SERVIX</span><span className="ms-1 text-[10px] font-bold" style={accentColor}>pos</span></div>
          <div className={`flex items-center gap-1 rounded-lg px-2 py-1 md:rounded-xl md:px-3 md:py-1.5 text-[9px] md:text-[10px] font-bold ${e.online ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/15 text-red-400 animate-pulse'}`}>{e.online ? <Wifi size={10} /> : <WifiOff size={10} />}<span className="hidden xs:inline">{e.online ? 'متصل' : 'غير متصل'}</span></div>
        </div>
        <div className="flex items-center gap-1.5 md:gap-2">
          <button onClick={e.holdBill} className={`${B} group relative flex h-9 w-9 md:h-11 md:w-auto md:px-4 items-center justify-center md:gap-2 rounded-xl md:rounded-2xl ${G1}`}><Pause size={15} className="text-[var(--muted-foreground)]" /><span className="hidden md:inline text-[12px] font-bold text-[var(--muted-foreground)]">تعليق</span>{e.held.length > 0 && <span className="absolute -end-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black text-black" style={accentBg}>{e.held.length}</span>}</button>
          <button onClick={() => e.setPanel('hold-list')} className={`${B} flex h-9 w-9 md:h-11 md:w-auto md:px-4 items-center justify-center md:gap-2 rounded-xl md:rounded-2xl ${G1}`}><Play size={15} className="text-[var(--muted-foreground)]" /><span className="hidden md:inline text-[12px] font-bold text-[var(--muted-foreground)]">استدعاء</span></button>
          <button onClick={() => e.setPanel('refund')} className={`${B} flex h-9 w-9 md:h-11 md:w-auto md:px-4 items-center justify-center md:gap-2 rounded-xl md:rounded-2xl ${G1}`}><RotateCcw size={15} className="text-[var(--muted-foreground)]" /><span className="hidden md:inline text-[12px] font-bold text-[var(--muted-foreground)]">إرجاع</span></button>
          <button onClick={() => e.setPanel('receipt')} className={`${B} flex h-9 w-9 md:h-11 md:w-11 items-center justify-center rounded-xl md:rounded-2xl ${G1}`}><Printer size={15} className="text-[var(--muted-foreground)]" /></button>
          <button onClick={() => e.setPanel('attendance')} className={`${B} flex h-9 w-9 md:h-11 md:w-auto md:px-4 items-center justify-center md:gap-2 rounded-xl md:rounded-2xl bg-emerald-500/10 text-emerald-500`}><ClipboardCheck size={15} /><span className="hidden md:inline text-[12px] font-bold">تحضير</span></button>
          {!isCashierOnly && <Link href="/" className={`${B} flex h-9 w-9 md:h-11 md:w-11 items-center justify-center rounded-xl md:rounded-2xl ${G1}`}><ArrowLeft size={15} className="text-[var(--muted-foreground)]" /></Link>}
        </div>
      </header>

      {/* 2-COLUMN BODY */}
      <div className="flex flex-1 min-h-0">
        {/* SERVICES */}
        <div className="flex flex-1 flex-col min-w-0">
          <OrderInput e={e} />
          <div className="shrink-0 p-3 pb-1 md:p-4 md:pb-2">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 md:start-4 top-1/2 h-4 w-4 md:h-5 md:w-5 -translate-y-1/2 text-[var(--muted-foreground)]" style={{ opacity: 0.3 }} />
              <input value={e.svcSearch} onChange={ev => e.setSvcSearch(ev.target.value)} placeholder="بحث عن خدمة... 🔍" className={`flex h-12 md:h-14 ${INP} rounded-xl md:rounded-2xl ps-10 md:ps-12 pe-10 md:pe-12 text-[16px]`} />
              {e.svcSearch && <button onClick={() => e.setSvcSearch('')} className={`${BS} absolute end-2 md:end-3 top-1/2 -translate-y-1/2 rounded-lg md:rounded-xl p-1.5 md:p-2 text-[var(--muted-foreground)]`}><X size={16} /></button>}
            </div>
          </div>
          <CategoryBar e={e} lg />
          <div className="flex-1 overflow-y-auto p-3 pt-1 md:p-4 md:pt-2 overscroll-contain"><ServiceGrid e={e} lg /></div>
        </div>

        {/* CART SIDEBAR (tablet) */}
        <aside className={`hidden w-[420px] shrink-0 flex-col border-s ${brd(4)} md:flex ${G1}`}>
          <ClientSection e={e} lg />
          <EmployeePicker e={e} lg />
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><ShoppingCart size={14} style={accentColor} /><span className="text-[13px] font-bold text-[var(--foreground)]">السلة</span>{e.cartCount > 0 && <span className="flex h-6 min-w-6 items-center justify-center rounded-lg px-1.5 text-[11px] font-black text-black" style={{ ...TN, ...accentBg }}>{e.cartCount}</span>}</div>
              {e.cart.length > 0 && <button onClick={e.clearAll} className={`${BS} text-[11px] font-semibold text-red-400 hover:bg-red-500/10 rounded-lg px-2 py-1`}>مسح</button>}
            </div>
            {!e.cart.length ? (
              <div className="py-12 text-center text-[var(--muted-foreground)]" style={{ opacity: 0.15 }}><ShoppingCart size={36} className="mx-auto mb-3" strokeWidth={1} /><p className="text-[13px]">اضغط على خدمة لإضافتها</p></div>
            ) : e.cart.map(item => {
              const info = e.itemTotals.find(t => t.id === item.id);
              return (
                <div key={item.id} className={`flex items-center gap-3 rounded-2xl border ${brd(4)} ${bg(2)} p-3.5 ${T}`}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-[var(--foreground)]">{item.service.nameAr}{item.bundleId && <Package size={10} className="inline ms-1 text-[var(--muted-foreground)]" />}</p>
                    <div className="flex items-center gap-2 text-[10px] text-[var(--muted-foreground)]" style={{ opacity: 0.6 }}><span><Users size={9} className="inline" /> {item.employeeName}</span><span style={TN}>{fmt(info?.net ?? 0)}</span></div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => e.updateQty(item.id, -1)} className={`${BS} flex h-10 w-10 items-center justify-center rounded-xl border ${brd(6)} text-[var(--muted-foreground)]`}><Minus size={16} /></button>
                    <span className="w-8 text-center text-[15px] font-black text-[var(--foreground)]" style={TN}>{item.quantity}</span>
                    <button onClick={() => e.updateQty(item.id, 1)} className={`${BS} flex h-10 w-10 items-center justify-center rounded-xl border ${brd(6)} text-[var(--muted-foreground)]`}><Plus size={16} /></button>
                    <button onClick={() => e.removeItem(item.id)} className={`${BS} flex h-10 w-10 items-center justify-center rounded-xl text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-400`} style={{ opacity: 0.3 }}><Trash2 size={16} /></button>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Bottom: Totals + Payment */}
          {e.cart.length > 0 && (
            <div className={`shrink-0 border-t ${brd(4)} p-4 space-y-3`}>
              <div className="flex gap-2">
                <div className="flex flex-1 items-center gap-1.5"><Percent size={12} className="shrink-0 text-[var(--muted-foreground)]" style={{ opacity: 0.3 }} /><input type="number" value={e.globalDisc} onChange={ev => e.setGlobalDisc(ev.target.value)} placeholder="خصم" className={`w-16 rounded-xl border ${brd(6)} ${bg(3)} px-3 py-2.5 text-[12px] text-center text-[var(--foreground)] focus:outline-none ${T}`} style={TN} /><div className={`flex overflow-hidden rounded-xl border ${brd(6)}`}><button onClick={() => e.setGlobalDiscType('fixed')} className={`${BS} px-3 py-2.5 text-[10px] font-bold ${e.globalDiscType === 'fixed' ? 'text-black' : 'text-[var(--muted-foreground)]'}`} style={e.globalDiscType === 'fixed' ? accentBg : undefined}>ر.س</button><button onClick={() => e.setGlobalDiscType('percentage')} className={`${BS} px-3 py-2.5 text-[10px] font-bold ${e.globalDiscType === 'percentage' ? 'text-black' : 'text-[var(--muted-foreground)]'}`} style={e.globalDiscType === 'percentage' ? accentBg : undefined}>%</button></div></div>
                <div className="flex items-center gap-1.5"><Heart size={12} className="shrink-0 text-pink-400" style={{ opacity: 0.5 }} /><input type="number" value={e.tipInput} onChange={ev => e.setTipInput(ev.target.value)} placeholder="إكرامية" className={`w-16 rounded-xl border ${brd(6)} ${bg(3)} px-3 py-2.5 text-[12px] text-center text-[var(--foreground)] focus:outline-none ${T}`} style={TN} /></div>
              </div>
              {e.comms.length > 0 && <div className="flex items-center justify-between rounded-xl bg-emerald-500/5 px-3 py-2"><div className="flex items-center gap-1.5"><CircleDollarSign size={12} className="text-emerald-400" /><span className="text-[11px] font-bold text-emerald-400">العمولات</span></div><span className="text-[12px] font-black text-emerald-400" style={TN}>{fmt(e.totalComm)}</span></div>}
              <div className={`space-y-1.5 rounded-2xl ${bg(2)} p-3.5`}>
                <div className="flex justify-between text-[12px]"><span className="text-[var(--muted-foreground)]">المجموع الفرعي</span><span className="font-semibold text-[var(--foreground)]" style={TN}>{fmt(e.subtotal)}</span></div>
                {e.gDiscVal > 0 && <div className="flex justify-between text-[12px]"><span className="text-emerald-400">الخصم</span><span className="font-semibold text-emerald-400" style={TN}>-{fmt(e.gDiscVal)}</span></div>}
                <div className="flex justify-between text-[12px]"><span className="text-[var(--muted-foreground)]">ضريبة 15%</span><span className="font-semibold text-[var(--foreground)]" style={TN}>{fmt(e.tax)}</span></div>
                {e.tip > 0 && <div className="flex justify-between text-[12px]"><span className="text-pink-400">إكرامية</span><span className="font-semibold text-pink-400" style={TN}>{fmt(e.tip)}</span></div>}
                <div className={`flex items-baseline justify-between border-t ${brd(4)} pt-2`}><span className="text-[13px] font-bold text-[var(--foreground)]">الإجمالي</span><span className="text-[22px] font-black" style={{ ...TN, ...accentColor }}>{fmt(e.total)} <span className="text-[10px] font-semibold opacity-40">ر.س</span></span></div>
              </div>
              <label className={`flex items-center gap-2.5 rounded-xl px-3 py-2 cursor-pointer ${T} hover:${bg(3)}`}><div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${e.sendWA ? 'border-transparent' : brd(10)}`} style={e.sendWA ? accentBg : undefined}>{e.sendWA && <Check size={11} className="text-black" />}</div><input type="checkbox" checked={e.sendWA} onChange={ev => e.setSendWA(ev.target.checked)} className="sr-only" /><MessageCircle size={14} className="text-emerald-400" /><span className="text-[12px] text-[var(--muted-foreground)]">إرسال واتساب</span></label>
              <div className="grid grid-cols-4 gap-2">{PAY.map(pm => (<button key={pm.id} onClick={() => e.setSelectedPayMethod(pm.id)} disabled={e.payMut.isPending || !e.canPay} className={`${BS} flex flex-col items-center gap-1.5 rounded-2xl border ${brd(4)} py-3.5 disabled:opacity-15 disabled:pointer-events-none transition-all duration-150 ${e.selectedPayMethod === pm.id ? 'text-black ring-2 ring-[var(--brand-accent)]/40' : `${bg(2)} text-[var(--muted-foreground)] hover:text-[var(--foreground)]`}`} style={e.selectedPayMethod === pm.id ? { ...accentBg, borderColor: 'var(--brand-accent)' } : undefined}><pm.icon size={20} strokeWidth={1.5} /><span className="text-[10px] font-bold">{pm.label}</span></button>))}</div>
              <button onClick={() => e.setPanel('split')} disabled={!e.canPay} className={`${B} flex w-full items-center justify-center gap-2 rounded-2xl border ${brd(4)} py-3 text-[12px] font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-15`}><Split size={14} /> دفع مقسّم</button>
              <button onClick={() => e.pay(e.selectedPayMethod)} disabled={e.payMut.isPending || !e.canPay} className={`${B} relative flex h-16 w-full items-center justify-center gap-3 rounded-2xl text-[16px] font-black text-black shadow-xl disabled:opacity-15 disabled:pointer-events-none overflow-hidden`} style={e.canPay ? { background: 'linear-gradient(135deg, var(--brand-accent), color-mix(in srgb, var(--brand-accent) 80%, #000))' } : { background: 'var(--muted)', color: 'var(--muted-foreground)' }}>{e.payMut.isPending ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-black/30 border-t-black" /> : <><Receipt size={18} /> إصدار فاتورة — {fmt(e.total)}</>}</button>
            </div>
          )}
        </aside>
      </div>

      {/* MOBILE BOTTOM BAR — glass with safe area */}
      <div className={`flex shrink-0 items-center justify-between border-t ${brd(4)} px-4 py-2.5 md:hidden glass`} style={{ paddingBottom: 'max(0.625rem, var(--safe-bottom, 0px))' }}>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]" style={{ opacity: 0.4 }}>الإجمالي</p>
          <p className="text-[20px] font-black leading-tight" style={{ ...TN, ...accentColor }}>{fmt(e.total)}</p>
        </div>
        <div className="flex items-center gap-2">
          {e.cartCount > 0 ? (
            <button onClick={() => setShowCart(true)} className={`${B} flex items-center gap-2 rounded-xl px-5 py-3 text-[13px] font-bold text-black shadow-lg`} style={accentBg}>
              <ShoppingCart size={16} />
              <span style={TN}>{e.cartCount}</span>
              <span className="mx-0.5">·</span>
              <span>ادفع</span>
            </button>
          ) : (
            <span className="text-[12px] text-[var(--muted-foreground)]">اختر خدمة للبدء</span>
          )}
        </div>
      </div>

      {/* MOBILE CART SHEET */}
      {showCart && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden animate-fade-in" onClick={() => setShowCart(false)} />
          <div className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] rounded-t-3xl bg-[var(--background)] border-t border-[var(--border)] shadow-2xl overflow-y-auto md:hidden animate-fade-in-up" style={{ paddingBottom: 'max(1rem, var(--safe-bottom, 0px))' }}>
            {/* Handle bar + header */}
            <div className="sticky top-0 bg-[var(--background)] p-4 pb-2 border-b border-[var(--border)] z-10">
              <div className="mx-auto h-1 w-10 rounded-full bg-[var(--muted)] mb-3" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><ShoppingCart size={16} style={accentColor} /><span className="text-sm font-bold">السلة</span><span className="text-xs font-black px-1.5 py-0.5 rounded-md text-black" style={accentBg}>{e.cartCount}</span></div>
                <div className="flex items-center gap-2">
                  {e.cart.length > 0 && <button onClick={e.clearAll} className={`${BS} text-[11px] font-semibold text-red-400 rounded-lg px-2 py-1`}>مسح الكل</button>}
                  <button onClick={() => setShowCart(false)} className="p-1.5 rounded-lg hover:bg-[var(--muted)]"><X size={18} /></button>
                </div>
              </div>
            </div>

            {/* Client section — mobile-friendly */}
            <div className={`mx-4 mt-3 mb-1 rounded-xl border ${brd(4)} ${bg(2)} p-3 space-y-2`}>
              <div className="flex items-center gap-1.5">
                <User size={13} style={accentColor} />
                <span className="text-[12px] font-bold text-[var(--foreground)]">العميل</span>
                {!e.client && !e.walkInMode && <span className="text-[10px] text-[var(--muted-foreground)]">(اختياري — زائر تلقائي)</span>}
              </div>

              {e.client ? (
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold" style={{ ...accentMix(15), ...accentColor }}>{e.client.fullName.charAt(0)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-[var(--foreground)]">{e.client.fullName}</p>
                    <p className="text-[11px] text-[var(--muted-foreground)]" dir="ltr">{e.client.phone}</p>
                  </div>
                  <button onClick={() => e.setClient(null)} className={`${BS} text-[11px] font-semibold px-2 py-1 rounded-lg`} style={accentColor}>تغيير</button>
                </div>
              ) : e.walkInMode ? (
                <div className="space-y-2">
                  <div className="relative">
                    <User size={13} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" style={{ opacity: 0.3 }} />
                    <input value={e.walkName} onChange={ev => e.setWalkName(ev.target.value)} placeholder="اسم العميل" className={`${INP} py-2.5 ps-9 pe-3 text-[13px] rounded-xl`} />
                  </div>
                  <div className="relative">
                    <Phone size={13} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" style={{ opacity: 0.3 }} />
                    <input value={e.walkPhone} onChange={ev => e.setWalkPhone(ev.target.value)} placeholder="05xxxxxxxx" dir="ltr" className={`${INP} py-2.5 ps-9 pe-3 text-[13px] rounded-xl`} />
                  </div>
                  <button onClick={() => { e.setWalkInMode(false); e.setWalkName(''); e.setWalkPhone(''); }} className="text-[11px] text-[var(--muted-foreground)]">إلغاء</button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search size={13} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" style={{ opacity: 0.3 }} />
                    <input value={e.cliSearch} onChange={ev => e.setCliSearch(ev.target.value)} placeholder="بحث بالاسم أو الجوال..." className={`${INP} py-2.5 ps-9 pe-3 text-[13px] rounded-xl`} />
                    {e.cliResults.length > 0 && e.cliSearch.length >= 2 && (
                      <div className={`absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl border ${brd(4)} bg-[var(--background)] shadow-lg`}>
                        {e.cliResults.map(c => (
                          <button key={c.id} onClick={() => { e.setClient(c); e.setCliSearch(''); }} className={`${B} flex w-full items-center gap-2.5 px-3 py-2.5 text-start border-b ${brd(3)} last:border-0`}>
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ ...accentMix(12), ...accentColor }}>{c.fullName.charAt(0)}</div>
                            <div className="min-w-0 flex-1"><p className="truncate text-[12px] font-semibold text-[var(--foreground)]">{c.fullName}</p><p className="text-[10px] text-[var(--muted-foreground)]" dir="ltr">{c.phone}</p></div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => e.setWalkInMode(true)} className={`${B} flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed ${brd(6)} py-2.5 text-[12px] font-semibold text-[var(--muted-foreground)]`}>
                    <UserPlus size={14} />
                    عميل جديد
                  </button>
                </div>
              )}
            </div>

            {/* Cart items */}
            <div className="p-4 pt-2 space-y-2">
              {e.cart.map(item => {
                const info = e.itemTotals.find(t => t.id === item.id);
                return (
                  <div key={item.id} className={`flex items-center gap-2.5 rounded-xl border ${brd(4)} ${bg(2)} p-3`}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-[var(--foreground)]">{item.service.nameAr}</p>
                      <p className="text-[11px] text-[var(--muted-foreground)]" style={TN}>{fmt(info?.net ?? 0)} ر.س</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => e.updateQty(item.id, -1)} className={`${BS} flex h-8 w-8 items-center justify-center rounded-lg border ${brd(6)}`}><Minus size={14} /></button>
                      <span className="w-6 text-center text-[13px] font-black" style={TN}>{item.quantity}</span>
                      <button onClick={() => e.updateQty(item.id, 1)} className={`${BS} flex h-8 w-8 items-center justify-center rounded-lg border ${brd(6)}`}><Plus size={14} /></button>
                      <button onClick={() => e.removeItem(item.id)} className={`${BS} flex h-8 w-8 items-center justify-center rounded-lg text-red-400`}><Trash2 size={14} /></button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary + Payment */}
            <div className="p-4 pt-0 space-y-3">
              {/* Financial summary */}
              <div className={`rounded-xl ${bg(2)} p-3 space-y-1.5`}>
                <div className="flex justify-between text-[12px]"><span className="text-[var(--muted-foreground)]">المجموع الفرعي</span><span className="font-semibold text-[var(--foreground)]" style={TN}>{fmt(e.subtotal)}</span></div>
                <div className="flex justify-between text-[12px]"><span className="text-[var(--muted-foreground)]">ضريبة 15%</span><span className="font-semibold text-[var(--foreground)]" style={TN}>{fmt(e.tax)}</span></div>
                <div className={`flex items-baseline justify-between border-t ${brd(4)} pt-1.5`}><span className="text-[13px] font-bold text-[var(--foreground)]">الإجمالي</span><span className="text-[20px] font-black" style={{ ...TN, ...accentColor }}>{fmt(e.total)} <span className="text-[9px] font-semibold opacity-40">ر.س</span></span></div>
              </div>

              {/* Payment methods - select only */}
              <div className="grid grid-cols-4 gap-2">
                {PAY.map(pm => (
                  <button
                    key={pm.id}
                    onClick={() => e.setSelectedPayMethod(pm.id)}
                    disabled={e.payMut.isPending || !e.canPay}
                    className={`${BS} flex flex-col items-center gap-1.5 rounded-xl border ${brd(4)} py-3 disabled:opacity-15 transition-all duration-150 ${e.selectedPayMethod === pm.id ? 'text-black ring-2 ring-[var(--brand-accent)]/40' : `${bg(2)} text-[var(--muted-foreground)] active:text-[var(--foreground)]`}`}
                    style={e.selectedPayMethod === pm.id ? { ...accentBg, borderColor: 'var(--brand-accent)' } : undefined}
                  >
                    <pm.icon size={18} strokeWidth={1.5} />
                    <span className="text-[9px] font-bold">{pm.label}</span>
                  </button>
                ))}
              </div>

              {/* Main pay button */}
              <button
                onClick={() => { setShowCart(false); e.pay(e.selectedPayMethod); }}
                disabled={!e.canPay || e.payMut.isPending}
                className={`${B} relative w-full rounded-xl py-4 text-[15px] font-black text-black shadow-lg disabled:opacity-20 overflow-hidden`}
                style={e.canPay ? { background: 'linear-gradient(135deg, var(--brand-accent), color-mix(in srgb, var(--brand-accent) 80%, #000))' } : { background: 'var(--muted)', color: 'var(--muted-foreground)' }}
              >
                {e.payMut.isPending ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-black/30 border-t-black mx-auto block" /> : <>إصدار فاتورة — {fmt(e.total)} ر.س</>}
              </button>
            </div>
          </div>
        </>
      )}

      <PanelModals e={e} />
      <QRSuccessModal
        isOpen={e.showQRModal}
        onClose={() => { e.setShowQRModal(false); e.clearAll(); }}
        invoiceTotal={e.total || 0}
        publicToken={e.publicToken}
        tenantSlug={currentTenant?.slug || ''}
      />
    </div>
  );
}
