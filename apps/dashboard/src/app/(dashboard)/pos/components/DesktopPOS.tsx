'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Search, Minus, Plus, Trash2,
  ShoppingCart, Receipt,
  Printer, MessageCircle, Mail,
  QrCode, X, Users, ChevronDown, ChevronUp,
  Pause, Play, RotateCcw, Split, Percent, Heart,
  CircleDollarSign, Wifi, WifiOff, Package,
  Check, ArrowLeft, ClipboardCheck,
} from 'lucide-react';
import type { E } from '../pos-engine';
import {
  B, BS, T, TN,
  G1, G2, G3,
  INP,
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

export function DesktopPOS({ e }: { e: E }) {
  const { currentTenant } = useAuth();
  const searchRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const h = (ev: KeyboardEvent) => { if (ev.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName ?? '')) { ev.preventDefault(); searchRef.current?.focus(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--background)]" dir="rtl">
      {/* HEADER */}
      <header className={`flex shrink-0 items-center justify-between gap-3 px-4 py-2 ${G2} ${brd(4)} border-b`}>
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl shadow-lg" style={primaryBg}><Receipt size={14} className="text-white" /></div>
          <div><span className="text-[13px] font-black tracking-tight text-[var(--foreground)]">SERVIX</span><span className="ms-1.5 text-[9px] font-bold" style={accentColor}>POS</span></div>
          <div className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[8px] font-bold ${e.online ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/15 text-red-400 animate-pulse'}`}>{e.online ? <Wifi size={9} /> : <WifiOff size={9} />}{e.online ? 'متصل' : 'غير متصل'}</div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={e.holdBill} className={`${B} group relative flex h-8 items-center gap-1.5 rounded-xl px-3 ${G3}`}><Pause size={12} className="text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]" /><span className="hidden text-[9px] font-semibold text-[var(--muted-foreground)] group-hover:text-[var(--foreground)] sm:inline">تعليق</span>{e.held.length > 0 && <span className="absolute -end-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[7px] font-black text-black" style={accentBg}>{e.held.length}</span>}</button>
          <button onClick={() => e.setPanel('hold-list')} className={`${B} group flex h-8 items-center gap-1.5 rounded-xl px-3 ${G3}`}><Play size={12} className="text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]" /><span className="hidden text-[9px] font-semibold text-[var(--muted-foreground)] group-hover:text-[var(--foreground)] sm:inline">استدعاء</span></button>
          <button onClick={() => e.setPanel('refund')} className={`${B} group flex h-8 items-center gap-1.5 rounded-xl px-3 ${G3}`}><RotateCcw size={12} className="text-[var(--muted-foreground)] group-hover:text-red-400" /><span className="hidden text-[9px] font-semibold text-[var(--muted-foreground)] group-hover:text-red-400 sm:inline">إرجاع</span></button>
          <button onClick={() => e.setPanel('receipt')} className={`${B} group flex h-8 items-center gap-1.5 rounded-xl px-3 ${G3}`}><Printer size={12} className="text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]" /></button>
          <button onClick={() => e.setPanel('attendance')} className={`${B} group flex h-8 items-center gap-1.5 rounded-xl px-3 ${G3}`}><ClipboardCheck size={12} className="text-[var(--muted-foreground)] group-hover:text-emerald-400" /><span className="hidden text-[9px] font-semibold text-[var(--muted-foreground)] group-hover:text-emerald-400 sm:inline">تحضير</span></button>
          <div className={`mx-0.5 h-4 w-px ${bg(6)}`} />
          <Link href="/" className={`${B} flex h-8 w-8 items-center justify-center rounded-xl ${G3} text-[var(--muted-foreground)] hover:text-[var(--foreground)]`}><ArrowLeft size={13} /></Link>
        </div>
      </header>

      {/* 3-COLUMN BODY */}
      <div className="flex flex-1 min-h-0">
        {/* COL 1: CLIENT */}
        <aside className={`hidden w-[270px] shrink-0 flex-col ${brd(4)} border-e lg:flex ${G1}`}>
          <ClientSection e={e} />
          <EmployeePicker e={e} />
          {e.comms.length > 0 && (
            <div className={`shrink-0 ${brd(4)} border-b p-3 space-y-1.5`}>
              <div className="flex items-center justify-between"><div className="flex items-center gap-1.5"><CircleDollarSign size={10} className="text-emerald-400" /><span className="text-[10px] font-bold text-[var(--foreground)]">العمولات</span></div><span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-bold text-emerald-400" style={TN}>{fmt(e.totalComm)}</span></div>
              {e.comms.map((c, i) => (<div key={i} className={`flex justify-between rounded-lg ${bg(2)} px-2 py-1`}><span className="text-[9px] text-[var(--muted-foreground)]">{c.name} <span className="opacity-40">({c.type === 'percentage' ? `${c.rate}%` : `${c.rate}ر.س`})</span></span><span className="text-[9px] font-bold text-emerald-400" style={TN}>{fmt(c.amount)}</span></div>))}
            </div>
          )}
          <div className="flex-1" />
          <div className="shrink-0 p-3 space-y-0.5">
            <p className="mb-1 text-[7px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]" style={{ opacity: 0.4 }}>إرسال الإيصال</p>
            {[{ ck: e.sendWA, set: e.setSendWA, icon: MessageCircle, label: 'واتساب', clr: 'text-emerald-400' }, { ck: e.sendMail, set: e.setSendMail, icon: Mail, label: 'إيميل', clr: 'text-sky-400' }].map(o => (
              <label key={o.label} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer ${T} hover:${bg(3)}`}>
                <div className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${o.ck ? 'border-transparent' : brd(10)} ${T}`} style={o.ck ? accentBg : undefined}>{o.ck && <Check size={8} className="text-black" />}</div>
                <input type="checkbox" checked={o.ck} onChange={ev => o.set(ev.target.checked)} className="sr-only" />
                <o.icon size={10} className={o.clr} /><span className="text-[9px] text-[var(--muted-foreground)]">{o.label}</span>
              </label>
            ))}
          </div>
        </aside>

        {/* COL 2: SERVICES */}
        <main className="flex flex-1 flex-col min-w-0">
          <OrderInput e={e} />
          <div className="shrink-0 p-3 pb-1.5">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" style={{ opacity: 0.3 }} />
              <input ref={searchRef} value={e.svcSearch} onChange={ev => e.setSvcSearch(ev.target.value)} placeholder='بحث عن خدمة...  ⌨ /' className={`flex h-11 w-full rounded-2xl ${brd(5)} border ${bg(3)} backdrop-blur-xl ps-11 pe-10 text-[12px] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]/30 ${T}`} />
              {e.svcSearch && <button onClick={() => e.setSvcSearch('')} className={`${BS} absolute end-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[var(--muted-foreground)] hover:${bg(5)}`}><X size={11} /></button>}
            </div>
          </div>
          <CategoryBar e={e} />
          <div className="flex-1 overflow-y-auto p-3 pt-1"><ServiceGrid e={e} /></div>
        </main>

        {/* COL 3: CART */}
        <aside className={`hidden w-[340px] shrink-0 flex-col ${brd(4)} border-s lg:flex ${G1}`}>
          <div className={`flex shrink-0 items-center justify-between px-3.5 py-2.5 ${brd(4)} border-b`}>
            <div className="flex items-center gap-2"><ShoppingCart size={12} style={accentColor} /><span className="text-[11px] font-bold text-[var(--foreground)]">السلة</span>{e.cartCount > 0 && <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-md px-1 text-[8px] font-black text-black" style={{ ...TN, ...accentBg }}>{e.cartCount}</span>}</div>
            {e.cart.length > 0 && <button onClick={e.clearAll} className={`${BS} rounded-md px-2 py-0.5 text-[8px] font-semibold text-red-400 hover:bg-red-500/10`}>مسح</button>}
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {!e.cart.length ? (
              <div className="flex h-full flex-col items-center justify-center gap-1.5 text-[var(--muted-foreground)]" style={{ opacity: 0.15 }}><ShoppingCart size={24} strokeWidth={1} /><p className="text-[9px]">اضغط على خدمة لإضافتها</p></div>
            ) : (
              <div className="space-y-1">{e.cart.map(item => {
                const info = e.itemTotals.find(t => t.id === item.id);
                const isExp = expanded === item.id;
                return (
                  <div key={item.id} className={`rounded-xl ${brd(3)} border ${bg(2)} ${T} ${isExp ? 'ring-1 ring-[color-mix(in_srgb,var(--foreground)_6%,transparent)]' : ''}`}>
                    <div className="flex items-center gap-1 p-2">
                      <button onClick={() => setExpanded(isExp ? null : item.id)} className={`${BS} flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] hover:${bg(4)} hover:text-[var(--foreground)]`} style={{ opacity: 0.3 }}>{isExp ? <ChevronUp size={10} /> : <ChevronDown size={10} />}</button>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[10px] font-semibold text-[var(--foreground)]">{item.service.nameAr}{item.bundleId && <Package size={7} className="inline ms-1 text-[var(--muted-foreground)]" />}</p>
                        <div className="flex items-center gap-1 text-[7px] text-[var(--muted-foreground)]" style={{ opacity: 0.6 }}><Users size={6} /> {item.employeeName}{item.discount > 0 && <span className="text-emerald-400">-{item.discountType === 'percentage' ? `${item.discount}%` : fmt(item.discount)}</span>}</div>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => e.updateQty(item.id, -1)} className={`${BS} flex h-6 w-6 items-center justify-center rounded-md ${brd(5)} border text-[var(--muted-foreground)]`}><Minus size={9} /></button>
                        <span className="w-5 text-center text-[10px] font-bold text-[var(--foreground)]" style={TN}>{item.quantity}</span>
                        <button onClick={() => e.updateQty(item.id, 1)} className={`${BS} flex h-6 w-6 items-center justify-center rounded-md ${brd(5)} border text-[var(--muted-foreground)]`}><Plus size={9} /></button>
                      </div>
                      <span className="w-14 text-end text-[10px] font-bold" style={{ ...TN, ...accentColor }}>{fmt(info?.net ?? 0)}</span>
                      <button onClick={() => { e.removeItem(item.id); setExpanded(null); }} className={`${BS} flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-400`} style={{ opacity: 0.2 }}><Trash2 size={9} /></button>
                    </div>
                    {isExp && (
                      <div className={`${brd(3)} border-t px-2.5 py-2 space-y-1.5`}>
                        <div><label className="mb-0.5 block text-[7px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]" style={{ opacity: 0.4 }}>الموظفة</label><div className="flex flex-wrap gap-1">{e.emps.map(emp => (<button key={emp.id} onClick={() => e.setItemEmp(item.id, emp)} className={`${BS} rounded-md px-2 py-1 text-[8px] font-semibold ${item.employeeId === emp.id ? 'text-black' : `${bg(3)} text-[var(--muted-foreground)]`}`} style={item.employeeId === emp.id ? accentBg : undefined}>{emp.fullName.split(' ')[0]}</button>))}</div></div>
                        <div><label className="mb-0.5 block text-[7px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]" style={{ opacity: 0.4 }}>خصم خاص</label><div className="flex items-center gap-1"><input type="number" value={item.discount || ''} onChange={ev => e.setItemDisc(item.id, parseFloat(ev.target.value) || 0, item.discountType)} placeholder="0" className={`w-14 rounded-md ${brd(5)} border ${bg(3)} px-2 py-1 text-[9px] text-center text-[var(--foreground)] focus:outline-none ${T}`} style={TN} /><div className={`flex overflow-hidden rounded-md ${brd(5)} border`}><button onClick={() => e.setItemDisc(item.id, item.discount, 'fixed')} className={`${BS} px-1.5 py-1 text-[7px] font-bold ${item.discountType === 'fixed' ? 'text-black' : 'text-[var(--muted-foreground)]'}`} style={item.discountType === 'fixed' ? accentBg : undefined}>ر.س</button><button onClick={() => e.setItemDisc(item.id, item.discount, 'percentage')} className={`${BS} px-1.5 py-1 text-[7px] font-bold ${item.discountType === 'percentage' ? 'text-black' : 'text-[var(--muted-foreground)]'}`} style={item.discountType === 'percentage' ? accentBg : undefined}>%</button></div></div></div>
                        <input value={item.note} onChange={ev => e.setItemNote(item.id, ev.target.value)} placeholder="ملاحظة..." className={`w-full rounded-md ${brd(3)} border ${bg(2)} px-2 py-1 text-[8px] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none ${T}`} />
                      </div>
                    )}
                  </div>
                );
              })}</div>
            )}
          </div>
          {/* Totals + Payment */}
          {e.cart.length > 0 && (
            <div className={`shrink-0 ${brd(4)} border-t px-3.5 py-2.5 space-y-2`}>
              <div className="flex gap-2">
                <div className="flex flex-1 items-center gap-1"><Percent size={9} className="shrink-0 text-[var(--muted-foreground)]" style={{ opacity: 0.3 }} /><input type="number" value={e.globalDisc} onChange={ev => e.setGlobalDisc(ev.target.value)} placeholder="خصم" className={`w-14 rounded-lg ${brd(5)} border ${bg(3)} px-2 py-1.5 text-[9px] text-center text-[var(--foreground)] focus:outline-none ${T}`} style={TN} /><div className={`flex overflow-hidden rounded-lg ${brd(5)} border`}><button onClick={() => e.setGlobalDiscType('fixed')} className={`${BS} px-1.5 py-1.5 text-[7px] font-bold ${e.globalDiscType === 'fixed' ? 'text-black' : 'text-[var(--muted-foreground)]'}`} style={e.globalDiscType === 'fixed' ? accentBg : undefined}>ر.س</button><button onClick={() => e.setGlobalDiscType('percentage')} className={`${BS} px-1.5 py-1.5 text-[7px] font-bold ${e.globalDiscType === 'percentage' ? 'text-black' : 'text-[var(--muted-foreground)]'}`} style={e.globalDiscType === 'percentage' ? accentBg : undefined}>%</button></div></div>
                <div className="flex items-center gap-1"><Heart size={9} className="shrink-0 text-pink-400" style={{ opacity: 0.5 }} /><input type="number" value={e.tipInput} onChange={ev => e.setTipInput(ev.target.value)} placeholder="إكرامية" className={`w-14 rounded-lg ${brd(5)} border ${bg(3)} px-2 py-1.5 text-[9px] text-center text-[var(--foreground)] focus:outline-none ${T}`} style={TN} /></div>
              </div>
              <div className={`space-y-1 rounded-xl ${bg(2)} p-2.5`}>
                <div className="flex justify-between text-[9px]"><span className="text-[var(--muted-foreground)]">المجموع الفرعي</span><span className="font-semibold text-[var(--foreground)]" style={TN}>{fmt(e.subtotal)}</span></div>
                {e.gDiscVal > 0 && <div className="flex justify-between text-[9px]"><span className="text-emerald-400">الخصم</span><span className="font-semibold text-emerald-400" style={TN}>-{fmt(e.gDiscVal)}</span></div>}
                <div className="flex justify-between text-[9px]"><span className="text-[var(--muted-foreground)]">ضريبة 15%</span><span className="font-semibold text-[var(--foreground)]" style={TN}>{fmt(e.tax)}</span></div>
                {e.tip > 0 && <div className="flex justify-between text-[9px]"><span className="text-pink-400">إكرامية</span><span className="font-semibold text-pink-400" style={TN}>{fmt(e.tip)}</span></div>}
                <div className={`flex items-baseline justify-between ${brd(4)} border-t pt-1.5`}><span className="text-[10px] font-bold text-[var(--foreground)]">الإجمالي</span><span className="text-[17px] font-black" style={{ ...TN, ...accentColor }}>{fmt(e.total)} <span className="text-[8px] font-semibold opacity-40">ر.س</span></span></div>
              </div>
              <div className="grid grid-cols-4 gap-1">{PAY.map(pm => (<button key={pm.id} onClick={() => e.pay(pm.id)} disabled={e.payMut.isPending || !e.canPay} className={`${BS} flex flex-col items-center gap-1 rounded-xl ${brd(4)} border ${bg(2)} py-2.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-15 disabled:pointer-events-none`}><pm.icon size={15} strokeWidth={1.5} /><span className="text-[7px] font-bold">{pm.label}</span></button>))}</div>
              <button onClick={() => { e.setSplits([{ method: 'cash', amount: 0 }, { method: 'card', amount: 0 }]); e.setPanel('split'); }} disabled={!e.canPay} className={`${B} flex w-full items-center justify-center gap-1 rounded-xl ${brd(4)} border py-2 text-[9px] font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-15`}><Split size={11} /> دفع مقسّم</button>
              <button onClick={() => e.pay('cash')} disabled={e.payMut.isPending || !e.canPay} className={`${B} relative flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[13px] font-black shadow-xl disabled:opacity-15 disabled:pointer-events-none overflow-hidden`} style={e.canPay ? { background: 'linear-gradient(135deg, var(--brand-accent), color-mix(in srgb, var(--brand-accent) 80%, #000))', color: '#000' } : { background: 'var(--muted)', color: 'var(--muted-foreground)' }}>{e.payMut.isPending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" /> : <><Receipt size={14} /> إصدار فاتورة — {fmt(e.total)}</>}</button>
              <div className="flex gap-1"><button className={`${B} flex flex-1 items-center justify-center gap-1 rounded-xl ${brd(4)} border py-1.5 text-[8px] font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)]`}><Printer size={10} /> طباعة</button><button className={`${B} flex flex-1 items-center justify-center gap-1 rounded-xl ${brd(4)} border py-1.5 text-[8px] font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)]`}><QrCode size={10} /> ZATCA</button></div>
            </div>
          )}
        </aside>
      </div>

      {/* MOBILE BOTTOM */}
      <div className={`flex shrink-0 items-center justify-between ${brd(4)} border-t px-4 py-3 lg:hidden ${G2}`}>
        <div><p className="text-[7px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]" style={{ opacity: 0.4 }}>الإجمالي</p><p className="text-[17px] font-black" style={{ ...TN, ...accentColor }}>{fmt(e.total)}</p></div>
        <div className="flex items-center gap-2">{e.cartCount > 0 && <span className="flex h-6 min-w-6 items-center justify-center rounded-lg px-1.5 text-[10px] font-black text-black" style={{ ...TN, ...accentBg }}>{e.cartCount}</span>}<button onClick={() => e.pay('cash')} disabled={e.payMut.isPending || !e.canPay} className={`${B} rounded-2xl px-6 py-2.5 text-[12px] font-bold text-black shadow-lg disabled:opacity-20`} style={accentBg}>{e.payMut.isPending ? '...' : 'ادفع'}</button></div>
      </div>

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
