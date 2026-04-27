'use client';

import type { E } from '../pos-engine';
import { fmt } from '../pos-constants';

const PAY_LABELS: Record<string, string> = {
  cash: 'نقدي',
  card: 'بطاقة / مدى',
  bank_transfer: 'تحويل بنكي',
  apple_pay: 'Apple Pay',
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
  const date = new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const time = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  const method = PAY_LABELS[e.lastPaidMethod] ?? e.lastPaidMethod;
  const cashRcv = parseFloat(e.cashReceived);
  const showChange = e.lastPaidMethod === 'cash' && !isNaN(cashRcv) && cashRcv > 0;

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
          {e.client && (
            <>
              <div style={{ borderTop: '1px dashed #999', margin: '2mm 0' }} />
              <div>العميلة: {e.client.fullName}</div>
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
          {e.cart.length > 0 ? (
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
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(e.subtotal || e.lastPaidTotal / 1.15)}</span>
          </div>
          {e.gDiscVal > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>الخصم:</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>-{fmt(e.gDiscVal)}</span>
            </div>
          )}
          {e.couponDiscount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>كوبون:</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>-{fmt(e.couponDiscount)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>ضريبة {Math.round(e.taxRate * 100)}%:</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(e.tax || e.lastPaidTotal - (e.lastPaidTotal / (1 + e.taxRate)))}</span>
          </div>

          <div style={{ borderTop: '2px solid #333', margin: '2mm 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px' }}>
            <span>الإجمالي:</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(e.total || e.lastPaidTotal)}</span>
          </div>

          <div style={{ borderTop: '1px dashed #999', margin: '2mm 0' }} />

          {/* Payment method */}
          <div>طريقة الدفع: {method}</div>
          {showChange && (
            <>
              <div>المبلغ المستلم: {fmt(cashRcv)}</div>
              <div>الباقي: {fmt(cashRcv - (e.total || e.lastPaidTotal))}</div>
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
