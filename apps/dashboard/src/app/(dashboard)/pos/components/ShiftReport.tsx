'use client';

import {
  Printer, X, Receipt, Banknote, CreditCard, Building2,
  ArrowDown, ArrowUp, Clock, Hash, Percent, RotateCcw,
  CircleDollarSign,
} from 'lucide-react';
import type { PosShiftData } from '../pos-types';
import { Modal } from './Modal';
import {
  B, BS, T, TN, G3,
  brd, bg, accentBg, accentColor, primaryBg, fmt,
} from '../pos-constants';

interface ShiftReportProps {
  shift: PosShiftData | null;
  isOpen: boolean;
  onClose: () => void;
}

function fmtDate(d: string | undefined) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtTime(d: string | undefined) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
}

export function ShiftReport({ shift, isOpen, onClose }: ShiftReportProps) {
  if (!shift) return null;

  const diff = shift.cashDifference ?? 0;
  const isPositive = diff >= 0;

  return (
    <Modal open={isOpen} onClose={onClose} title="تقرير الوردية — Z-Report" wide>
      <div className="space-y-4 print:space-y-2" dir="rtl" id="shift-report-print">
        {/* Time Range */}
        <div className={`flex items-center justify-between rounded-xl ${bg(3)} p-3`}>
          <div className="flex items-center gap-2">
            <Clock size={12} style={accentColor} />
            <span className="text-[10px] text-[var(--muted-foreground)]">فتح</span>
            <span className="text-[11px] font-bold text-[var(--foreground)]" style={TN}>{fmtTime(shift.openedAt)}</span>
          </div>
          <span className="text-[9px] text-[var(--muted-foreground)]">→</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--muted-foreground)]">إغلاق</span>
            <span className="text-[11px] font-bold text-[var(--foreground)]" style={TN}>{fmtTime(shift.closedAt)}</span>
          </div>
          <span className="text-[9px] text-[var(--muted-foreground)]">{fmtDate(shift.openedAt)}</span>
        </div>

        {/* Cash Drawer Summary */}
        <div className={`rounded-xl ${brd(4)} border p-4 space-y-2`}>
          <div className="flex items-center gap-2 mb-3">
            <Banknote size={14} style={accentColor} />
            <span className="text-[12px] font-bold text-[var(--foreground)]">الصندوق النقدي</span>
          </div>
          <Row label="مبلغ البداية" value={shift.openingBalance} />
          <Row label="المبلغ الفعلي" value={shift.closingBalance ?? 0} />
          <Row label="المتوقع" value={shift.expectedCash ?? 0} muted />
          <div className={`flex justify-between rounded-lg px-3 py-2 ${isPositive ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
            <span className="text-[10px] font-bold text-[var(--muted-foreground)]">الفرق</span>
            <span className={`text-[14px] font-black ${isPositive ? 'text-emerald-400' : 'text-red-400'}`} style={TN}>
              {isPositive ? '+' : ''}{fmt(diff)} <span className="text-[8px] opacity-50">ر.س</span>
            </span>
          </div>
        </div>

        {/* Sales Breakdown */}
        <div className={`rounded-xl ${brd(4)} border p-4 space-y-2`}>
          <div className="flex items-center gap-2 mb-3">
            <Receipt size={14} style={accentColor} />
            <span className="text-[12px] font-bold text-[var(--foreground)]">المبيعات</span>
            <span className="ms-auto flex h-6 min-w-6 items-center justify-center rounded-lg px-2 text-[10px] font-black text-black" style={{ ...TN, ...accentBg }}>
              {shift.invoiceCount}
            </span>
          </div>
          <IconRow icon={Banknote} label="نقدي" value={shift.totalCash} color="text-emerald-400" />
          <IconRow icon={CreditCard} label="بطاقة / مدى" value={shift.totalCard} color="text-sky-400" />
          <IconRow icon={Building2} label="تحويل بنكي" value={shift.totalTransfer} color="text-violet-400" />
          <div className={`${brd(3)} border-t pt-2 mt-2`}>
            <Row label="إجمالي المبيعات" value={shift.totalSales} bold />
          </div>
        </div>

        {/* Deductions */}
        <div className={`rounded-xl ${brd(4)} border p-4 space-y-2`}>
          <IconRow icon={Percent} label="الخصومات الممنوحة" value={shift.totalDiscounts} color="text-amber-400" />
          <IconRow icon={RotateCcw} label="الإرجاعات" value={shift.totalRefunds} color="text-red-400" />
          <IconRow icon={CircleDollarSign} label="المصروفات" value={shift.totalExpenses} color="text-orange-400" />
        </div>

        {/* Notes */}
        {shift.notes && (
          <div className={`rounded-xl ${bg(2)} p-3`}>
            <span className="text-[9px] font-bold text-[var(--muted-foreground)]">ملاحظات: </span>
            <span className="text-[10px] text-[var(--foreground)]">{shift.notes}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 print:hidden">
          <button
            onClick={() => window.print()}
            className={`${B} flex flex-1 items-center justify-center gap-2 rounded-2xl ${brd(4)} border py-3 text-[11px] font-bold text-[var(--muted-foreground)] hover:text-[var(--foreground)]`}
          >
            <Printer size={14} /> طباعة التقرير
          </button>
          <button
            onClick={onClose}
            className={`${B} flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-[11px] font-bold text-black`}
            style={accentBg}
          >
            إغلاق
          </button>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #shift-report-print, #shift-report-print * { visibility: visible; }
          #shift-report-print { position: absolute; top: 0; left: 0; right: 0; width: 80mm; font-size: 10px; }
        }
      `}</style>
    </Modal>
  );
}

function Row({ label, value, bold, muted }: { label: string; value: number; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={`text-[10px] ${muted ? 'text-[var(--muted-foreground)]' : 'text-[var(--foreground)]'} ${bold ? 'font-bold' : ''}`}>{label}</span>
      <span className={`text-[12px] ${bold ? 'font-black' : 'font-semibold'} text-[var(--foreground)]`} style={TN}>{fmt(value)}</span>
    </div>
  );
}

function IconRow({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon size={11} className={color} />
        <span className="text-[10px] text-[var(--foreground)]">{label}</span>
      </div>
      <span className="text-[12px] font-semibold text-[var(--foreground)]" style={TN}>{fmt(value)}</span>
    </div>
  );
}
