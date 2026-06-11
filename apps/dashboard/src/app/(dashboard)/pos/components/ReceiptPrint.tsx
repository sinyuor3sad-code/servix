'use client';

import type { E } from '../pos-engine';
import { fmt } from '../pos-constants';

const PAY_LABELS: Record<string, string> = {
  cash: 'نقدي',
  card: 'بطاقة / مدى',
  bank_transfer: 'تحويل بنكي',
  apple_pay: 'Apple Pay',
  split: 'دفع مقسّم',
};

interface ReceiptPrintProps {
  e: E;
  tenantName: string;
}

/**
 * Hidden receipt component — only visible during @media print.
 * Uses a separate ID (#receipt-print) so it doesn't conflict
 * with the ShiftReport print (#shift-report-print).
 */
export function ReceiptPrint({ e, tenantName }: ReceiptPrintProps) {
  const snapshot = e.lastPaidSnapshot;
  const issuedAt = snapshot?.issuedAt ? new Date(snapshot.issuedAt) : new Date();
  const date = issuedAt.toLocaleDateString('ar-SA', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const time = issuedAt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  const hasServerSnapshot = snapshot?.source === 'server';
  const receiptMethod = snapshot?.method ?? e.lastPaidMethod;
  const method = PAY_LABELS[receiptMethod] ?? receiptMethod;
  const cashRcv = parseFloat(snapshot?.cashReceived ?? e.cashReceived);
  const showChange = receiptMethod === 'cash' && !isNaN(cashRcv) && cashRcv > 0;
  const clientName = snapshot?.clientName ?? e.client?.fullName;
  const receiptItems = snapshot?.items;
  const receiptSubtotal = snapshot?.subtotal ?? (e.subtotal || e.lastPaidTotal / 1.15);
  const receiptDiscount = snapshot?.discount ?? e.gDiscVal;
  const receiptCouponDiscount = snapshot?.couponDiscount ?? e.couponDiscount;
  const receiptTaxRate = snapshot?.taxRate ?? e.taxRate;
  const receiptTax = snapshot?.tax ?? (e.tax || e.lastPaidTotal - (e.lastPaidTotal / (1 + e.taxRate)));
  const receiptTotal = snapshot?.total ?? (e.total || e.lastPaidTotal);

  return (
    <>
      {/* Hidden receipt — only shows in print */}
      <div id="receipt-print" className="hidden" dir="rtl">
        <div style={{ fontFamily: "'Courier New', monospace", fontSize: '11px', width: '80mm', padding: '4mm', lineHeight: 1.6 }}>
          {/* Header */}
          {e.receiptLogo && (
            <div style={{ textAlign: 'center', marginBottom: '4mm' }}>
              <div style={{ fontSize: '16px', fontWeight: 'bold', letterSpacing: '2px' }}>{tenantName}</div>
            </div>
          )}

          <div style={{ borderTop: '1px dashed #999', margin: '2mm 0' }} />

          {/* Invoice info */}
          <div>التاريخ: {date}</div>
          <div>الوقت: {time}</div>

          {/* Client */}
          {clientName && (
            <>
              <div style={{ borderTop: '1px dashed #999', margin: '2mm 0' }} />
              <div>العميلة: {clientName}</div>
            </>
          )}

          <div style={{ borderTop: '1px dashed #999', margin: '2mm 0' }} />

          {/* Items table header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
            <span>الخدمة</span>
            <span style={{ display: 'flex', gap: '12px' }}>
              <span>الكمية</span>
              <span>المبلغ</span>
            </span>
          </div>
          <div style={{ borderTop: '1px solid #ccc', margin: '1mm 0' }} />

          {/* Items */}
          {receiptItems?.length ? (
            receiptItems.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5mm 0' }}>
                <span style={{ maxWidth: '50%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                <span style={{ display: 'flex', gap: '12px', fontVariantNumeric: 'tabular-nums' }}>
                  <span style={{ minWidth: '20px', textAlign: 'center' }}>{item.quantity}</span>
                  <span style={{ minWidth: '45px', textAlign: 'left' }}>{fmt(item.amount)}</span>
                </span>
              </div>
            ))
          ) : !hasServerSnapshot && e.cart.length > 0 ? (
            /* Legacy fallback only: atomic checkout should provide lastPaidSnapshot. */
            e.cart.map(item => {
              const info = e.itemTotals.find(t => t.id === item.id);
              return (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5mm 0' }}>
                  <span style={{ maxWidth: '50%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.service.nameAr}</span>
                  <span style={{ display: 'flex', gap: '12px', fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ minWidth: '20px', textAlign: 'center' }}>{item.quantity}</span>
                    <span style={{ minWidth: '45px', textAlign: 'left' }}>{fmt(info?.net ?? 0)}</span>
                  </span>
                </div>
              );
            })
          ) : (
            /* After payment, cart is cleared — show from lastPaidTotal */
            <div style={{ textAlign: 'center', padding: '2mm 0', color: '#666' }}>—</div>
          )}

          <div style={{ borderTop: '1px dashed #999', margin: '2mm 0' }} />

          {/* Totals */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>المجموع الفرعي:</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(receiptSubtotal)}</span>
          </div>
          {receiptDiscount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>الخصم:</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>-{fmt(receiptDiscount)}</span>
            </div>
          )}
          {receiptCouponDiscount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>كوبون:</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>-{fmt(receiptCouponDiscount)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>ضريبة {Math.round(receiptTaxRate * 100)}%:</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(receiptTax)}</span>
          </div>

          <div style={{ borderTop: '2px solid #333', margin: '2mm 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px' }}>
            <span>الإجمالي:</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(receiptTotal)}</span>
          </div>

          <div style={{ borderTop: '1px dashed #999', margin: '2mm 0' }} />

          {/* Payment method */}
          <div>طريقة الدفع: {method}</div>
          {showChange && (
            <>
              <div>المبلغ المستلم: {fmt(cashRcv)}</div>
              <div>الباقي: {fmt(cashRcv - receiptTotal)}</div>
            </>
          )}

          {/* Footer */}
          <div style={{ borderTop: '1px dashed #999', margin: '2mm 0' }} />
          {e.receiptMsg && (
            <div style={{ textAlign: 'center', padding: '1mm 0' }}>{e.receiptMsg}</div>
          )}
          {e.receiptPhone && (
            <div style={{ textAlign: 'center', fontSize: '10px', color: '#666' }}>{e.receiptPhone}</div>
          )}
        </div>
      </div>

      {/* Print-only CSS — uses #receipt-print ID to avoid conflict with #shift-report-print */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #receipt-print, #receipt-print * { visibility: visible !important; }
          #receipt-print {
            display: block !important;
            position: absolute;
            top: 0; left: 0; right: 0;
            width: 80mm;
            font-size: 11px;
            font-family: 'Courier New', monospace;
          }
          /* Hide ShiftReport print area when printing receipt */
          #shift-report-print { display: none !important; }
        }
      `}</style>
    </>
  );
}
