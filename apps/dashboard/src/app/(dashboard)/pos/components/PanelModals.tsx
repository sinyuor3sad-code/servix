'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Plus, Trash2, X, Pause, RotateCcw, AlertTriangle,
  Hash, Check, Split, Package,
  ClipboardCheck, LogIn, LogOut, Coffee, Clock, Users,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { E } from '../pos-engine';
import type { AttRec } from '../pos-types';
import { Modal } from './Modal';
import {
  B, BS, T, TF, TN, G3, INP,
  brd, bg, accentBg, accentColor, accentMix,
  fmt, PAY, M_BUNDLES, ROLE_ICO, ROLE_LBL, fmtT,
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
      <div className={`flex justify-between rounded-xl ${bg(3)} p-3`}><span className="text-[10px] text-[var(--muted-foreground)]">المتبقي</span><span className={`text-[13px] font-black ${e.splitRem > 0.01 ? 'text-red-400' : 'text-emerald-400'}`} style={TN}>{fmt(e.splitRem)}</span></div>
      <button onClick={e.paySplit} disabled={e.splitRem > 0.01 || e.payMut.isPending} className={`${B} flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-[11px] font-bold text-black shadow-lg disabled:opacity-20`} style={accentBg}>{e.payMut.isPending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" /> : <><Split size={13} /> تأكيد</>}</button>
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
        <div className="flex gap-1"><button onClick={() => e.recallBill(b.id)} className={`${BS} rounded-lg px-3 py-1.5 text-[9px] font-bold text-black`} style={accentBg}>استدعاء</button><button onClick={() => e.setHeld(p => p.filter(x => x.id !== b.id))} className={`${BS} rounded-lg ${brd(5)} border px-2 py-1.5 text-red-400 hover:bg-red-500/10`}><Trash2 size={10} /></button></div>
      </div>
    ))}</div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Refund Panel
   ════════════════════════════════════════════════════════════════ */

function RefundPanel({ e }: { e: E }) {
  return (
    <div className="space-y-3">
      <div><label className="mb-1 block text-[9px] font-bold text-[var(--muted-foreground)]">رقم الفاتورة</label><div className="relative"><Hash size={11} className="absolute start-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" style={{ opacity: 0.3 }} /><input value={e.refId} onChange={ev => e.setRefId(ev.target.value)} placeholder="INV-XXXX" dir="ltr" className={`${INP} py-2.5 ps-8 pe-3 text-[11px]`} /></div></div>
      <div><label className="mb-1 block text-[9px] font-bold text-[var(--muted-foreground)]">سبب الإرجاع</label><textarea value={e.refReason} onChange={ev => e.setRefReason(ev.target.value)} placeholder="السبب..." rows={3} className={`w-full rounded-xl ${brd(6)} border ${bg(4)} p-3 text-[10px] text-[var(--foreground)] resize-none placeholder:text-[var(--muted-foreground)] focus:outline-none ${T}`} /></div>
      <div className="flex items-center gap-2 rounded-xl bg-red-500/10 p-2.5"><AlertTriangle size={12} className="text-red-400" /><p className="text-[8px] text-red-400">سيتم إرجاع المبلغ وتسجيل العملية</p></div>
      <button onClick={() => e.refMut.mutate()} disabled={!e.refId.trim() || !e.refReason.trim() || e.refMut.isPending} className={`${B} flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-red-500 text-[10px] font-bold text-white shadow-lg disabled:opacity-20`}>{e.refMut.isPending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <><RotateCcw size={12} /> تأكيد الإرجاع</>}</button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Bundles Panel
   ════════════════════════════════════════════════════════════════ */

function BundlesPanel({ e }: { e: E }) {
  return (
    <div className="space-y-3">{M_BUNDLES.map(b => (
      <button key={b.id} onClick={() => e.addBundle(b)} className={`${B} group flex w-full flex-col items-start gap-1.5 rounded-xl ${brd(4)} border ${bg(2)} p-4 text-start hover:${bg(4)}`}>
        <div className="flex items-center gap-1.5"><Package size={12} style={accentColor} /><span className="text-[12px] font-bold text-[var(--foreground)]">{b.nameAr}</span></div>
        <div className="flex items-center gap-2"><span className="text-[14px] font-black" style={{ ...TN, ...accentColor }}>{fmt(b.price)}</span><span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-bold text-emerald-400">وفّر {fmt(b.savings)}</span></div>
        <p className="text-[8px] text-[var(--muted-foreground)]">{b.services.map(bs => e.allSvcs.find(s => s.id === bs.serviceId)?.nameAr).filter(Boolean).join(' + ')}</p>
      </button>
    ))}</div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Receipt Panel
   ════════════════════════════════════════════════════════════════ */

function ReceiptPanel({ e }: { e: E }) {
  return (
    <div className="space-y-3">
      <label className={`flex items-center gap-2.5 rounded-xl ${bg(3)} px-3 py-2.5 cursor-pointer ${T}`}>
        <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${e.receiptLogo ? 'border-transparent' : brd(10)}`} style={e.receiptLogo ? accentBg : undefined}>{e.receiptLogo && <Check size={9} className="text-black" />}</div>
        <input type="checkbox" checked={e.receiptLogo} onChange={ev => e.setReceiptLogo(ev.target.checked)} className="sr-only" /><span className="text-[10px] text-[var(--foreground)]">عرض شعار الصالون</span>
      </label>
      <div><label className="mb-1 block text-[9px] font-bold text-[var(--muted-foreground)]">رسالة الشكر</label><input value={e.receiptMsg} onChange={ev => e.setReceiptMsg(ev.target.value)} className={`${INP} py-2.5 px-3 text-[11px]`} /></div>
      <div><label className="mb-1 block text-[9px] font-bold text-[var(--muted-foreground)]">رقم الهاتف في الإيصال</label><input value={e.receiptPhone} onChange={ev => e.setReceiptPhone(ev.target.value)} dir="ltr" className={`${INP} py-2.5 px-3 text-[11px]`} /></div>
      <button onClick={() => { toast.success('تم حفظ الإعدادات'); e.setPanel(null); }} className={`${B} flex h-10 w-full items-center justify-center gap-1.5 rounded-2xl text-[10px] font-bold text-black`} style={accentBg}><Check size={12} /> حفظ</button>
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
   Panels Renderer
   ════════════════════════════════════════════════════════════════ */

export function PanelModals({ e }: { e: E }) {
  return (
    <>
      <Modal open={e.panel === 'split'} onClose={() => e.setPanel(null)} title="دفع مقسّم" wide><SplitPanel e={e} /></Modal>
      <Modal open={e.panel === 'hold-list'} onClose={() => e.setPanel(null)} title="الفواتير المعلقة"><HoldPanel e={e} /></Modal>
      <Modal open={e.panel === 'refund'} onClose={() => e.setPanel(null)} title="إرجاع / إلغاء"><RefundPanel e={e} /></Modal>
      <Modal open={e.panel === 'bundles'} onClose={() => e.setPanel(null)} title="الباقات"><BundlesPanel e={e} /></Modal>
      <Modal open={e.panel === 'receipt'} onClose={() => e.setPanel(null)} title="إعدادات الإيصال"><ReceiptPanel e={e} /></Modal>
      <Modal open={e.panel === 'attendance'} onClose={() => e.setPanel(null)} title="تحضير الموظفات" wide><AttendancePanel e={e} /></Modal>
    </>
  );
}
