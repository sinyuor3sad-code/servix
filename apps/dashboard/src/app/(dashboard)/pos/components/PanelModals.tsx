'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Plus, Trash2, X, Pause, RotateCcw, AlertTriangle,
  Hash, Check, Split,
  ClipboardCheck, LogIn, LogOut, Coffee, Clock, Users,
  CircleDollarSign, Lock, ShieldAlert, Loader2,
  ShoppingCart, Calendar, Bell, AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { dashboardService } from '@/services/dashboard.service';
import { toast } from 'sonner';
import type { E } from '../pos-engine';
import type { AttRec, PosShiftData } from '../pos-types';
import { Modal } from './Modal';
import {
  B, BS, T, TF, TN, G3, INP,
  brd, bg, accentBg, accentColor, accentMix,
  fmt, PAY, ROLE_ICO, ROLE_LBL, fmtT,
} from '../pos-constants';

/* ════════════════════════════════════════════════════════════════
   Split Payment Panel
   ════════════════════════════════════════════════════════════════ */

function SplitPanel({ e }: { e: E }) {
  return (
    <div className="space-y-3">
      <div className={`rounded-xl ${bg(3)} p-3 text-center`}><p className="text-[8px] text-[var(--muted-foreground)]">الإجمالي</p><p className="text-[18px] font-black" style={{ ...TN, ...accentColor }}>{fmt(e.total)} ر.س</p></div>
      {e.splits.map((entry, i) => (
        <div key={i} className={`flex items-center gap-2 rounded-xl ${G3} p-3`}>
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[9px] font-bold text-black" style={{ ...TN, ...accentBg }}>{i + 1}</span>
          <select value={entry.method} onChange={ev => e.setSplits(p => p.map((x, j) => j === i ? { ...x, method: ev.target.value } : x))} className={`rounded-lg ${brd(5)} border ${bg(3)} px-2 py-1.5 text-[10px] text-[var(--foreground)] focus:outline-none`}>{PAY.map(pm => <option key={pm.id} value={pm.id}>{pm.label}</option>)}</select>
          <input type="number" value={entry.amount || ''} onChange={ev => e.setSplits(p => p.map((x, j) => j === i ? { ...x, amount: parseFloat(ev.target.value) || 0 } : x))} placeholder="المبلغ" className={`flex-1 rounded-lg ${brd(5)} border ${bg(3)} px-2 py-1.5 text-[10px] text-center text-[var(--foreground)] focus:outline-none ${T}`} style={TN} />
          {e.splits.length > 1 && <button onClick={() => e.setSplits(p => p.filter((_, j) => j !== i))} className={`${BS} text-red-400`}><X size={12} /></button>}
        </div>
      ))}
      <button onClick={() => e.setSplits(p => [...p, { method: 'card', amount: 0 }])} className={`${B} flex w-full items-center justify-center gap-1 rounded-xl border border-dashed ${brd(6)} py-2 text-[9px] text-[var(--muted-foreground)]`}><Plus size={10} /> إضافة</button>
      {e.splits.some(entry => entry.method === 'cash') && (
        <div className={`flex items-center gap-2 rounded-xl ${bg(3)} p-3`}>
          <span className="text-[10px] text-[var(--muted-foreground)]">المستلم نقداً</span>
          <input type="number" value={e.cashReceived} onChange={ev => e.setCashReceived(ev.target.value)} placeholder="0.00" dir="ltr" className={`min-w-0 flex-1 rounded-lg ${brd(5)} border ${bg(2)} px-2 py-1.5 text-center text-[11px] text-[var(--foreground)] focus:outline-none ${T}`} style={TN} />
        </div>
      )}
      <div className={`flex justify-between rounded-xl ${bg(3)} p-3`}><span className="text-[10px] text-[var(--muted-foreground)]">{e.splitRem < -0.01 ? 'الزائد' : 'المتبقي'}</span><span className={`text-[13px] font-black ${Math.abs(e.splitRem) > 0.01 ? 'text-red-400' : 'text-emerald-400'}`} style={TN}>{fmt(Math.abs(e.splitRem))}</span></div>
      <button onClick={e.paySplit} disabled={!e.splitPaymentReady || e.payMut.isPending} className={`${B} flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-[11px] font-bold text-black shadow-lg disabled:opacity-20`} style={accentBg}>{e.payMut.isPending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" /> : <><Split size={13} /> تأكيد</>}</button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Hold / Recall Panel
   ════════════════════════════════════════════════════════════════ */

function HoldPanel({ e }: { e: E }) {
  if (!e.held.length) return <div className="py-8 text-center text-[var(--muted-foreground)]" style={{ opacity: 0.2 }}><Pause size={24} className="mx-auto mb-2" strokeWidth={1} /><p className="text-[10px]">لا توجد فواتير معلقة</p></div>;
  return (
    <div className="space-y-2">{e.held.map(b => (
      <div key={b.id} className={`flex items-center justify-between rounded-xl ${G3} p-3`}>
        <div><p className="text-[11px] font-bold text-[var(--foreground)]">{b.label}</p><p className="text-[8px] text-[var(--muted-foreground)]">{b.cart.length} خدمة &middot; {b.time} &middot; <span style={accentColor}>{fmt(b.total)}</span></p></div>
        <div className="flex gap-1"><button onClick={() => e.recallBill(b.id)} className={`${BS} rounded-lg px-3 py-1.5 text-[9px] font-bold text-black`} style={accentBg}>استدعاء</button><button onClick={() => e.deleteHeldBill(b.id)} className={`${BS} rounded-lg ${brd(5)} border px-2 py-1.5 text-red-400 hover:bg-red-500/10`}><Trash2 size={10} /></button></div>
      </div>
    ))}</div>
  );
}

function RefundPanel({ e }: { e: E }) {
  const { accessToken } = useAuth();
  const [searchId, setSearchId] = useState('');
  const [loading, setLoading] = useState(false);
  const [invoice, setInvoice] = useState<Record<string, unknown> | null>(null);
  const [reason, setReason] = useState('');
  const [refunding, setRefunding] = useState(false);
  const [refundMode, setRefundMode] = useState<'full' | 'partial'>('full');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const handleSearch = async () => {
    if (!searchId.trim()) return;
    setLoading(true);
    setInvoice(null);
    setRefundMode('full');
    setSelectedItems(new Set());
    try {
      const inv = await api.get<Record<string, unknown>>(`/invoices/${searchId.trim()}`, accessToken!);
      setInvoice(inv);
    } catch {
      try {
        const res = await api.get<{ items: Record<string, unknown>[] }>(`/invoices?search=${encodeURIComponent(searchId.trim())}&limit=1`, accessToken!);
        if (res?.items?.length) setInvoice(res.items[0]);
        else toast.error('الفاتورة غير موجودة');
      } catch { toast.error('الفاتورة غير موجودة'); }
    }
    setLoading(false);
  };

  const toggleItem = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const isPaid = invoice?.status === 'paid' || invoice?.status === 'partially_paid';
  const items = (invoice?.invoiceItems ?? invoice?.items ?? []) as Array<{ id?: string; description?: string; quantity?: number; unitPrice?: number; total?: number; totalPrice?: number }>;
  const payments = (invoice?.payments ?? []) as Array<{ method?: string; amount?: number }>;
  const client = invoice?.client as { fullName?: string } | undefined;
  const invoiceTotal = Number(invoice?.total ?? 0);

  const refundAmount = refundMode === 'full' ? invoiceTotal :
    items.filter(item => item.id && selectedItems.has(item.id))
         .reduce((sum, item) => sum + Number(item.totalPrice ?? item.total ?? item.unitPrice ?? 0), 0);

  const canRefund = reason.trim().length > 0 && refundAmount > 0 && (refundMode === 'full' || selectedItems.size > 0);

  const handleRefund = async () => {
    if (!invoice || !canRefund) return;
    setRefunding(true);
    try {
      await api.post(`/invoices/${invoice.id}/refund`, {
        reason: reason.trim(),
        itemIds: refundMode === 'partial' ? Array.from(selectedItems) : undefined,
      }, accessToken!);
      toast.success(refundMode === 'partial' ? 'تم الإرجاع الجزئي' : 'تم الإرجاع بنجاح');
      setInvoice(null); setSearchId(''); setReason(''); setSelectedItems(new Set()); setRefundMode('full');
      e.setPanel(null);
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'فشل الإرجاع');
    }
    setRefunding(false);
  };

  const PAY_L: Record<string, string> = { cash: 'نقدي', card: 'بطاقة', bank_transfer: 'تحويل', wallet: 'محفظة' };

  return (
    <div className="space-y-3">
      {/* Step 1: Search */}
      <div>
        <label className="mb-1 block text-[9px] font-bold text-[var(--muted-foreground)]">بحث برقم الفاتورة</label>
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <Hash size={11} className="absolute start-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" style={{ opacity: 0.3 }} />
            <input
              value={searchId}
              onChange={ev => setSearchId(ev.target.value)}
              onKeyDown={ev => { if (ev.key === 'Enter') handleSearch(); }}
              placeholder="INV-XXXX أو UUID"
              dir="ltr"
              className={`${INP} py-2.5 ps-8 pe-3 text-[11px]`}
            />
          </div>
          <button onClick={handleSearch} disabled={loading || !searchId.trim()} className={`${B} rounded-xl px-4 text-[10px] font-bold text-black disabled:opacity-30`} style={accentBg}>
            {loading ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-black/30 border-t-black" /> : 'بحث'}
          </button>
        </div>
      </div>

      {/* Step 2: Invoice Preview */}
      {invoice && (
        <div className={`rounded-xl ${brd(4)} border ${bg(2)} p-3 space-y-2`}>
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[var(--foreground)]" dir="ltr">{String(invoice.invoiceNumber || invoice.id).slice(0, 20)}</span>
            <span className={`rounded-md px-2 py-0.5 text-[8px] font-bold ${isPaid ? 'bg-emerald-500/10 text-emerald-400' : invoice.status === 'refunded' ? 'bg-red-500/10 text-red-400' : 'bg-zinc-500/10 text-zinc-400'}`}>
              {invoice.status === 'paid' ? 'مدفوعة' : invoice.status === 'refunded' ? 'مُرجعة' : invoice.status === 'void' ? 'ملغاة' : String(invoice.status)}
            </span>
          </div>

          {/* Client */}
          {client?.fullName && (
            <div className="flex items-center gap-1 text-[9px] text-[var(--muted-foreground)]">
              <Users size={9} /> {client.fullName}
            </div>
          )}

          {/* Refund Mode Toggle */}
          {isPaid && items.length > 1 && (
            <div className={`flex rounded-xl ${bg(3)} p-0.5`}>
              <button onClick={() => { setRefundMode('full'); setSelectedItems(new Set()); }} className={`${BS} flex-1 rounded-lg py-1.5 text-[9px] font-bold ${refundMode === 'full' ? 'text-black shadow-sm' : 'text-[var(--muted-foreground)]'}`} style={refundMode === 'full' ? accentBg : undefined}>
                <RotateCcw size={9} className="inline me-1" />إرجاع كامل
              </button>
              <button onClick={() => setRefundMode('partial')} className={`${BS} flex-1 rounded-lg py-1.5 text-[9px] font-bold ${refundMode === 'partial' ? 'text-white shadow-sm' : 'text-[var(--muted-foreground)]'}`} style={refundMode === 'partial' ? { background: 'linear-gradient(135deg, #f59e0b, #d97706)' } : undefined}>
                <Check size={9} className="inline me-1" />إرجاع جزئي
              </button>
            </div>
          )}

          {/* Items */}
          <div className={`rounded-lg ${bg(3)} p-2 space-y-1`}>
            {items.map((item, idx) => {
              const isSelected = item.id ? selectedItems.has(item.id) : false;
              const itemTotal = Number(item.totalPrice ?? item.total ?? item.unitPrice ?? 0);
              return (
                <div
                  key={item.id ?? idx}
                  onClick={() => { if (refundMode === 'partial' && item.id) toggleItem(item.id); }}
                  className={`flex items-center gap-2 rounded-lg p-1.5 ${T} ${refundMode === 'partial' ? 'cursor-pointer hover:' + bg(4) : ''} ${isSelected ? 'ring-1 ring-amber-500/40 bg-amber-500/5' : ''}`}
                >
                  {refundMode === 'partial' && (
                    <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${isSelected ? 'border-amber-500 bg-amber-500' : brd(8)}`}>
                      {isSelected && <Check size={9} className="text-white" />}
                    </div>
                  )}
                  <span className="text-[9px] text-[var(--foreground)] truncate flex-1">{item.description || '—'}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-[var(--muted-foreground)] text-[8px]" style={TN}>×{item.quantity ?? 1}</span>
                    <span className={`font-bold text-[9px] ${isSelected ? 'text-amber-400' : 'text-[var(--foreground)]'}`} style={TN}>{fmt(itemTotal)}</span>
                  </span>
                </div>
              );
            })}
          </div>

          {/* Total */}
          <div className="flex justify-between">
            <span className="text-[10px] font-bold text-[var(--foreground)]">الإجمالي</span>
            <span className="text-[14px] font-black" style={{ ...TN, ...accentColor }}>{fmt(invoiceTotal)}</span>
          </div>

          {/* Payment methods */}
          {payments.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {payments.map((p, i) => (
                <span key={i} className={`rounded-md ${bg(3)} px-2 py-0.5 text-[8px] font-semibold text-[var(--muted-foreground)]`}>
                  {PAY_L[p.method ?? ''] ?? p.method} — {fmt(Number(p.amount ?? 0))}
                </span>
              ))}
            </div>
          )}

          {/* Non-refundable warning */}
          {!isPaid && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 p-2">
              <AlertTriangle size={11} className="text-red-400" />
              <span className="text-[9px] text-red-400">لا يمكن إرجاع هذه الفاتورة — الحالة: {String(invoice.status)}</span>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Reason + Confirm */}
      {invoice && isPaid && (
        <>
          <div>
            <label className="mb-1 block text-[9px] font-bold text-[var(--muted-foreground)]">سبب الإرجاع (إلزامي)</label>
            <textarea
              value={reason}
              onChange={ev => setReason(ev.target.value)}
              placeholder="اكتب سبب الإرجاع..."
              rows={2}
              className={`w-full rounded-xl ${brd(6)} border ${bg(4)} p-3 text-[10px] text-[var(--foreground)] resize-none placeholder:text-[var(--muted-foreground)] focus:outline-none ${T}`}
            />
          </div>

          {/* Refund Amount Summary */}
          <div className={`flex items-center justify-between rounded-xl ${bg(3)} p-3`}>
            <span className="text-[9px] text-[var(--muted-foreground)]">المبلغ المسترد</span>
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-black text-red-400" style={TN}>{fmt(refundAmount)} <span className="text-[9px]">ر.س</span></span>
              {refundMode === 'partial' && (
                <span className="text-[8px] text-[var(--muted-foreground)]">(من أصل {fmt(invoiceTotal)})</span>
              )}
            </div>
          </div>

          {/* Partial summary */}
          {refundMode === 'partial' && selectedItems.size > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 p-2">
              <AlertTriangle size={10} className="text-amber-400" />
              <span className="text-[8px] text-amber-400">سيتم إرجاع {selectedItems.size} من {items.length} خدمات بمبلغ {fmt(refundAmount)} ر.س — الفاتورة تبقى مدفوعة</span>
            </div>
          )}

          {/* Full refund warning */}
          {refundMode === 'full' && (
            <div className="flex items-center gap-2 rounded-xl bg-red-500/10 p-2.5">
              <AlertTriangle size={12} className="text-red-400" />
              <p className="text-[8px] text-red-400">سيتم إرجاع المبلغ كاملاً وتسجيل العملية. هذا الإجراء لا يمكن التراجع عنه.</p>
            </div>
          )}

          <button
            onClick={handleRefund}
            disabled={!canRefund || refunding}
            className={`${B} flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-[10px] font-bold text-white shadow-lg disabled:opacity-20`}
            style={{ background: refundMode === 'partial' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #ef4444, #dc2626)' }}
          >
            {refunding ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <><RotateCcw size={12} /> {refundMode === 'partial' ? `إرجاع ${selectedItems.size} خدمات` : 'تأكيد الإرجاع الكامل'}</>}
          </button>
        </>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Receipt Panel
   ════════════════════════════════════════════════════════════════ */

function ReceiptPanel({ e }: { e: E }) {
  const { accessToken } = useAuth();
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        api.put('/settings/pos_receipt_show_logo', { value: e.receiptLogo ? 'true' : 'false' }, accessToken!),
        api.put('/settings/pos_receipt_message', { value: e.receiptMsg }, accessToken!),
        api.put('/settings/pos_receipt_phone', { value: e.receiptPhone }, accessToken!),
      ]);
      toast.success('تم حفظ الإعدادات');
      e.setPanel(null);
    } catch (err) {
      toast.error((err as Error)?.message || 'فشل حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <label className={`flex items-center gap-2.5 rounded-xl ${bg(3)} px-3 py-2.5 cursor-pointer ${T}`}>
        <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${e.receiptLogo ? 'border-transparent' : brd(10)}`} style={e.receiptLogo ? accentBg : undefined}>{e.receiptLogo && <Check size={9} className="text-black" />}</div>
        <input type="checkbox" checked={e.receiptLogo} onChange={ev => e.setReceiptLogo(ev.target.checked)} className="sr-only" /><span className="text-[10px] text-[var(--foreground)]">عرض شعار الصالون</span>
      </label>
      <div><label className="mb-1 block text-[9px] font-bold text-[var(--muted-foreground)]">رسالة الشكر</label><input value={e.receiptMsg} onChange={ev => e.setReceiptMsg(ev.target.value)} className={`${INP} py-2.5 px-3 text-[11px]`} /></div>
      <div><label className="mb-1 block text-[9px] font-bold text-[var(--muted-foreground)]">رقم الهاتف في الإيصال</label><input value={e.receiptPhone} onChange={ev => e.setReceiptPhone(ev.target.value)} dir="ltr" className={`${INP} py-2.5 px-3 text-[11px]`} /></div>
      <button onClick={handleSave} disabled={saving} className={`${B} flex h-10 w-full items-center justify-center gap-1.5 rounded-2xl text-[10px] font-bold text-black disabled:opacity-30`} style={accentBg}>
        {saving ? <Loader2 size={12} className="animate-spin" /> : <><Check size={12} /> حفظ</>}
      </button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Attendance Panel
   ════════════════════════════════════════════════════════════════ */

function AttendancePanel({ e }: { e: E }) {
  const { accessToken } = useAuth();
  const [recs, setRecs] = useState<AttRec[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<AttRec[]>('/attendance/today', accessToken!);
      setRecs(data ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  const doAction = async (action: 'in' | 'out' | 'break', empId: string) => {
    setBusyId(empId);
    try {
      if (action === 'in') {
        await api.post('/attendance/check-in', { employeeId: empId }, accessToken!);
        toast.success('✅ تم التحضير');
      } else if (action === 'out') {
        await api.put('/attendance/check-out', { employeeId: empId }, accessToken!);
        toast.success('👋 تم تسجيل الخروج');
      } else {
        await api.put('/attendance/toggle-break', { employeeId: empId }, accessToken!);
      }
      await load();
    } catch (err: any) { toast.error(err.message || 'حدث خطأ'); }
    setBusyId(null);
  };

  const absent = recs.filter(r => r.computedStatus === 'absent');
  const present = recs.filter(r => r.computedStatus === 'present' || r.computedStatus === 'on_break');
  const done = recs.filter(r => r.computedStatus === 'off_duty');
  const nowTime = new Date();
  const timeStr = `${nowTime.getHours() % 12 || 12}:${String(nowTime.getMinutes()).padStart(2, '0')} ${nowTime.getHours() >= 12 ? 'م' : 'ص'}`;

  if (loading) return (
    <div className="py-16 text-center">
      <div className="inline-block h-8 w-8 rounded-full border-2 border-[var(--brand-primary)] border-t-transparent animate-spin" />
      <p className="text-[11px] text-[var(--muted-foreground)] mt-3">جارٍ التحميل...</p>
    </div>
  );

  return (
    <div className="space-y-5" dir="rtl">
      {/* Live Time + Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={accentBg}>
            <ClipboardCheck size={18} className="text-black" />
          </div>
          <div>
            <div className="text-[13px] font-black text-[var(--foreground)]">تحضير الموظفات</div>
            <div className="text-[10px] text-[var(--muted-foreground)]">الوقت الحالي: <span className="font-bold" style={accentColor}>{timeStr}</span></div>
          </div>
        </div>
        <div className="flex gap-2">
          {[
            { n: present.length, l: 'حاضرة', c: 'bg-emerald-500/15 text-emerald-500' },
            { n: absent.length, l: 'بانتظار', c: 'bg-orange-500/15 text-orange-500' },
            { n: done.length, l: 'انصرفت', c: `${bg(4)} text-[var(--muted-foreground)]` },
          ].map(s => (
            <div key={s.l} className={`rounded-xl ${s.c} px-3 py-2 text-center min-w-[60px]`}>
              <div className="text-[16px] font-black" style={TN}>{s.n}</div>
              <div className="text-[8px] font-bold">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Check-in Cards */}
      {absent.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-2 w-2 rounded-full bg-orange-400 animate-pulse" />
            <span className="text-[11px] font-bold text-[var(--foreground)]">بانتظار التحضير — اضغطي على الاسم</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {absent.map(r => (
              <button
                key={r.employeeId}
                onClick={() => doAction('in', r.employeeId)}
                disabled={busyId === r.employeeId}
                className={`${BS} group relative flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed ${brd(10)} p-4 hover:border-emerald-400 hover:${bg(2)} disabled:opacity-40`}
              >
                {busyId === r.employeeId && <div className="absolute inset-0 rounded-2xl bg-emerald-500/10 flex items-center justify-center"><div className="h-5 w-5 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" /></div>}
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-[16px] font-black ${T} group-hover:scale-110`} style={{ background: 'color-mix(in srgb, var(--brand-accent) 15%, transparent)', color: 'var(--brand-accent)' }}>
                  {r.employee.fullName?.[0]}
                </div>
                <div className="text-center">
                  <div className="text-[12px] font-bold text-[var(--foreground)] truncate max-w-[120px]">{r.employee.fullName}</div>
                  <div className="text-[10px] text-[var(--muted-foreground)]">{ROLE_ICO[r.employee.role]} {ROLE_LBL[r.employee.role] || ''}</div>
                </div>
                <div className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[9px] font-bold ${T} group-hover:bg-emerald-500 group-hover:text-white`} style={accentMix(10)}>
                  <LogIn size={10} />
                  <span>تحضير</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Present Employees */}
      {present.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-[11px] font-bold text-[var(--foreground)]">حاضرات الآن</span>
          </div>
          <div className="space-y-2">
            {present.map(r => {
              const isBreak = r.computedStatus === 'on_break';
              return (
                <div key={r.employeeId} className={`flex items-center gap-3 rounded-2xl p-3.5 ${T} ${isBreak ? 'bg-amber-500/5 border border-amber-500/20' : `${bg(3)}`}`}>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[13px] font-black text-white ${isBreak ? 'bg-gradient-to-br from-amber-400 to-amber-500' : 'bg-gradient-to-br from-emerald-400 to-emerald-600'}`}>
                    {r.employee.fullName?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-bold text-[var(--foreground)] truncate">{r.employee.fullName}</div>
                    <div className="flex items-center gap-1.5 text-[10px] text-[var(--muted-foreground)]">
                      <span>{ROLE_ICO[r.employee.role]}</span>
                      <Clock size={10} />
                      <span style={TN}>{fmtT(r.checkIn)}</span>
                      {isBreak && <span className="rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[8px] font-bold text-amber-500">☕ استراحة</span>}
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => doAction('break', r.employeeId)} disabled={busyId === r.employeeId}
                      className={`${BS} flex h-9 w-9 items-center justify-center rounded-xl ${isBreak ? 'bg-amber-500/20 text-amber-500' : `${bg(5)} text-[var(--muted-foreground)] hover:bg-amber-500/10 hover:text-amber-500`}`}
                      title={isBreak ? 'إنهاء استراحة' : 'استراحة'}>
                      <Coffee size={14} />
                    </button>
                    <button onClick={() => doAction('out', r.employeeId)} disabled={busyId === r.employeeId}
                      className={`${BS} flex h-9 w-9 items-center justify-center rounded-xl ${bg(5)} text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-400`}
                      title="تسجيل خروج">
                      <LogOut size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Done */}
      {done.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className={`h-2 w-2 rounded-full ${bg(15)}`} />
            <span className="text-[10px] font-bold text-[var(--muted-foreground)]">انصرفت ({done.length})</span>
          </div>
          <div className={`rounded-xl ${bg(2)} p-3 space-y-1.5`}>
            {done.map(r => (
              <div key={r.employeeId} className="flex items-center gap-2.5">
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${bg(5)} text-[9px] font-bold text-[var(--muted-foreground)]`}>{r.employee.fullName?.[0]}</div>
                <span className="text-[10px] font-medium text-[var(--muted-foreground)] flex-1 truncate">{r.employee.fullName}</span>
                <span className="text-[9px] text-[var(--muted-foreground)]" style={TN}>{fmtT(r.checkIn)} → {fmtT(r.checkOut)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty */}
      {recs.length === 0 && (
        <div className="py-10 text-center">
          <div className={`flex h-16 w-16 mx-auto items-center justify-center rounded-3xl ${bg(4)} mb-4`}>
            <Users size={28} className="text-[var(--muted-foreground)]" style={{ opacity: 0.3 }} />
          </div>
          <p className="text-[12px] font-bold text-[var(--foreground)]">لا توجد موظفات نشطات</p>
          <p className="text-[10px] text-[var(--muted-foreground)] mt-1">أضيفي موظفات من قسم الموظفات أولاً</p>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Expense Panel
   ════════════════════════════════════════════════════════════════ */

const EXP_CATS = [
  { value: 'supplies', label: 'مستلزمات' },
  { value: 'utilities', label: 'مشروبات / مرطبات' },
  { value: 'other', label: 'صيانة' },
  { value: 'rent', label: 'إيجار' },
  { value: 'salary', label: 'رواتب' },
  { value: 'marketing', label: 'تسويق' },
];

function ExpensePanel({ e }: { e: E }) {
  const { accessToken } = useAuth();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('supplies');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { toast.error('أدخلي مبلغ صحيح'); return; }
    if (!desc.trim()) { toast.error('أدخلي وصف المصروف'); return; }
    setLoading(true);
    try {
      await api.post('/expenses', {
        category,
        description: desc.trim(),
        amount: amt,
        date: new Date().toISOString(),
      }, accessToken!);
      toast.success('تم تسجيل المصروف');
      e.setPanel(null);
    } catch { toast.error('فشل تسجيل المصروف'); }
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      <div><label className="mb-1 block text-[9px] font-bold text-[var(--muted-foreground)]">المبلغ</label>
        <input type="number" value={amount} onChange={ev => setAmount(ev.target.value)} placeholder="0.00" dir="ltr" className={`${INP} py-2.5 px-3 text-[14px] font-black text-center`} style={TN} />
      </div>
      <div><label className="mb-1 block text-[9px] font-bold text-[var(--muted-foreground)]">الفئة</label>
        <select value={category} onChange={ev => setCategory(ev.target.value)} className={`${INP} py-2.5 px-3 text-[11px]`}>
          {EXP_CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
      <div><label className="mb-1 block text-[9px] font-bold text-[var(--muted-foreground)]">الوصف / الملاحظة</label>
        <input value={desc} onChange={ev => setDesc(ev.target.value)} placeholder="مثال: شراء أكياس تغليف" className={`${INP} py-2.5 px-3 text-[11px]`} />
      </div>
      <button onClick={handleSubmit} disabled={loading} className={`${B} flex h-10 w-full items-center justify-center gap-1.5 rounded-2xl text-[10px] font-bold text-black disabled:opacity-30`} style={accentBg}>
        {loading ? <Loader2 size={12} className="animate-spin" /> : <><CircleDollarSign size={12} /> تسجيل المصروف</>}
      </button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Close Shift Panel
   ════════════════════════════════════════════════════════════════ */

function CloseShiftPanel({ e, onShiftClosed }: { e: E; onShiftClosed: (data: PosShiftData) => void }) {
  const { accessToken } = useAuth();
  const [closingAmount, setClosingAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleClose = async () => {
    const amt = parseFloat(closingAmount);
    if (isNaN(amt) || amt < 0) { toast.error('أدخلي المبلغ الفعلي في الصندوق'); return; }
    setLoading(true);
    try {
      const result = await api.post<PosShiftData>('/pos-shifts/close', {
        closingBalance: amt,
        notes: notes.trim() || undefined,
      }, accessToken!);
      toast.success('تم إغلاق الوردية');
      e.setPanel(null);
      onShiftClosed(result);
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'فشل إغلاق الوردية');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      <div className={`rounded-xl ${bg(3)} p-4 text-center`}>
        <Lock size={24} className="mx-auto mb-2 text-red-400" style={{ opacity: 0.6 }} />
        <p className="text-[12px] font-bold text-[var(--foreground)]">إغلاق الوردية</p>
        <p className="text-[10px] text-[var(--muted-foreground)] mt-1">أدخلي المبلغ الفعلي الموجود في الصندوق</p>
      </div>
      <div><label className="mb-1 block text-[9px] font-bold text-[var(--muted-foreground)]">المبلغ الفعلي في الصندوق</label>
        <input type="number" value={closingAmount} onChange={ev => setClosingAmount(ev.target.value)} placeholder="0.00" dir="ltr" className={`${INP} py-3 px-3 text-[18px] font-black text-center`} style={TN} />
      </div>
      <div><label className="mb-1 block text-[9px] font-bold text-[var(--muted-foreground)]">ملاحظات (اختياري)</label>
        <input value={notes} onChange={ev => setNotes(ev.target.value)} placeholder="ملاحظات إضافية..." className={`${INP} py-2.5 px-3 text-[11px]`} />
      </div>
      <button onClick={handleClose} disabled={loading} className={`${B} flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-[11px] font-bold text-white shadow-xl disabled:opacity-30`} style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
        {loading ? <Loader2 size={14} className="animate-spin" /> : <><Lock size={14} /> إغلاق الوردية وعرض التقرير</>}
      </button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Manager Approval Panel (Manager Discount)
   ════════════════════════════════════════════════════════════════ */

function PinOverridePanel({ e }: { e: E }) {
  const { accessToken } = useAuth();
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compute the discount % the cashier wants to apply, so the server binds the
  // approval token to that exact value.
  const discountPercent = (() => {
    const v = parseFloat(e.globalDisc);
    if (isNaN(v) || v <= 0) return 0;
    if (e.globalDiscType === 'percentage') return v;
    if (e.subtotal <= 0) return 0;
    return (v / e.subtotal) * 100;
  })();

  const handleSubmit = async () => {
    if (!password.trim()) { setError('كلمة المرور مطلوبة'); return; }
    if (discountPercent <= 0) { setError('أدخل قيمة الخصم أولاً'); return; }
    if (!e.discountReason.trim()) { setError('سبب الخصم مطلوب'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await dashboardService.requestManagerOverride(
        { password, discountPercent, reason: e.discountReason.trim() },
        accessToken!,
      );
      e.setManagerApproval({
        token: res.data.token,
        approverName: res.data.approvedBy.fullName,
        expiresAt: res.data.expiresAt,
      });
      toast.success(`تم اعتماد ${res.data.approvedBy.fullName.split(' ')[0]}`);
      setPassword('');
      e.setPanel(null);
    } catch (err: unknown) {
      const apiErr = err as { message?: string; statusCode?: number };
      setError(apiErr.message || 'فشل التحقق من كلمة المرور');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className={`rounded-xl ${bg(3)} p-4 text-center`}>
        <ShieldAlert size={28} className="mx-auto mb-2 text-amber-400" style={{ opacity: 0.7 }} />
        <p className="text-[12px] font-bold text-[var(--foreground)]">اعتماد المديرة مطلوب</p>
        <p className="mt-1 text-[10px] text-[var(--muted-foreground)]">
          خصم {discountPercent.toFixed(1)}% يتجاوز حد الكاشيرة ({e.maxDiscountPercent}%)
        </p>
      </div>
      <div>
        <label className="mb-1 block text-[9px] font-bold text-[var(--muted-foreground)]">كلمة مرور المديرة/المالكة</label>
        <input
          type="password"
          value={password}
          onChange={(ev) => { setPassword(ev.target.value); setError(null); }}
          onKeyDown={(ev) => { if (ev.key === 'Enter') handleSubmit(); }}
          placeholder="••••••••"
          dir="ltr"
          autoFocus
          disabled={submitting}
          className={`${INP} py-3 px-3 text-[13px] text-center disabled:opacity-50`}
        />
      </div>
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2">
          <AlertTriangle size={11} className="shrink-0 text-red-400" />
          <span className="text-[10px] text-red-400">{error}</span>
        </div>
      )}
      <button
        onClick={handleSubmit}
        disabled={submitting || !password.trim()}
        className={`${B} flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl text-[11px] font-bold text-black disabled:opacity-30`}
        style={accentBg}
      >
        {submitting ? <Loader2 size={14} className="animate-spin" /> : <><ShieldAlert size={13} /> اعتماد</>}
      </button>
      <p className="text-[8px] text-[var(--muted-foreground)] text-center" style={{ opacity: 0.5 }}>
        الاعتماد صالح لـ 5 دقائق ويُسجَّل في سجل التدقيق
      </p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Notifications Panel
   ════════════════════════════════════════════════════════════════ */

import type { PosNotification } from '../usePosSocket';

const NOTIF_STYLE: Record<string, { color: string; bg: string; Icon: typeof Bell }> = {
  order:       { color: 'text-emerald-400', bg: 'bg-emerald-500/10', Icon: ShoppingCart },
  appointment: { color: 'text-blue-400',    bg: 'bg-blue-500/10',    Icon: Calendar },
  attendance:  { color: 'text-purple-400',  bg: 'bg-purple-500/10',  Icon: Users },
  alert:       { color: 'text-red-400',     bg: 'bg-red-500/10',     Icon: AlertCircle },
};

function NotificationsPanel({ notifications, onDismiss, onClearAll }: {
  notifications: PosNotification[];
  onDismiss: (id: string) => void;
  onClearAll: () => void;
}) {
  if (notifications.length === 0) {
    return (
      <div className="py-10 text-center">
        <Bell size={28} className="mx-auto mb-3 text-[var(--muted-foreground)]" style={{ opacity: 0.15 }} />
        <p className="text-[11px] font-bold text-[var(--foreground)]">لا توجد إشعارات</p>
        <p className="text-[9px] text-[var(--muted-foreground)] mt-1">ستظهر هنا الإشعارات الحية</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-[var(--muted-foreground)]">{notifications.length} إشعار</span>
        <button onClick={onClearAll} className={`${BS} text-[8px] font-bold text-red-400 hover:underline`}>مسح الكل</button>
      </div>
      {notifications.map(n => {
        const style = NOTIF_STYLE[n.type] || NOTIF_STYLE.alert;
        const { Icon } = style;
        return (
          <div key={n.id} className={`flex items-start gap-2.5 rounded-xl ${bg(2)} p-3 ${T}`}>
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${style.bg}`}>
              <Icon size={14} className={style.color} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold ${style.color}`}>{n.title}</span>
                <span className="text-[7px] text-[var(--muted-foreground)]" style={TN}>{n.time}</span>
              </div>
              <p className="text-[9px] text-[var(--muted-foreground)] mt-0.5 truncate">{n.body}</p>
            </div>
            <button onClick={() => onDismiss(n.id)} className={`${BS} shrink-0 mt-0.5 text-[var(--muted-foreground)] hover:text-red-400`}>
              <X size={10} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Panels Renderer
   ════════════════════════════════════════════════════════════════ */

export function PanelModals({ e, onShiftClosed, notifications, onDismissNotif, onClearNotifs }: {
  e: E;
  onShiftClosed?: (data: PosShiftData) => void;
  notifications?: PosNotification[];
  onDismissNotif?: (id: string) => void;
  onClearNotifs?: () => void;
}) {
  return (
    <>
      <Modal open={e.panel === 'split'} onClose={() => e.setPanel(null)} title="دفع مقسّم" wide><SplitPanel e={e} /></Modal>
      <Modal open={e.panel === 'hold-list'} onClose={() => e.setPanel(null)} title="الفواتير المعلقة"><HoldPanel e={e} /></Modal>
      <Modal open={e.panel === 'refund'} onClose={() => e.setPanel(null)} title="إرجاع / إلغاء"><RefundPanel e={e} /></Modal>
      <Modal open={e.panel === 'receipt'} onClose={() => e.setPanel(null)} title="إعدادات الإيصال"><ReceiptPanel e={e} /></Modal>
      <Modal open={e.panel === 'attendance'} onClose={() => e.setPanel(null)} title="تحضير الموظفات" wide><AttendancePanel e={e} /></Modal>
      <Modal open={e.panel === 'expense'} onClose={() => e.setPanel(null)} title="تسجيل مصروف سريع"><ExpensePanel e={e} /></Modal>
      <Modal open={e.panel === 'close-shift'} onClose={() => e.setPanel(null)} title="إغلاق الوردية"><CloseShiftPanel e={e} onShiftClosed={onShiftClosed ?? (() => {})} /></Modal>
      <Modal open={e.panel === 'pin-override'} onClose={() => e.setPanel(null)} title="تأكيد المديرة"><PinOverridePanel e={e} /></Modal>
      <Modal open={e.panel === 'notifications'} onClose={() => e.setPanel(null)} title="الإشعارات">
        <NotificationsPanel notifications={notifications ?? []} onDismiss={onDismissNotif ?? (() => {})} onClearAll={onClearNotifs ?? (() => {})} />
      </Modal>
    </>
  );
}
