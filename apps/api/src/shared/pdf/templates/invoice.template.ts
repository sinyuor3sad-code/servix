// HTML template for ZATCA-compliant simplified tax invoice (B2C).
// Rendered to PDF via Puppeteer — the browser handles RTL + Arabic
// shaping natively, so no font/bidi gymnastics needed.

export interface InvoiceItemData {
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface InvoiceTemplateData {
  salonName: string;
  /** "city، district، street، مبنى X" — pre-joined upstream */
  salonAddress: string;
  taxNumber: string | null;
  commercialRegistration: string | null;
  invoiceNumber: string;
  date: string;
  time: string;
  clientName: string;
  clientPhone: string;
  items: InvoiceItemData[];
  subtotal: number;
  discountAmount: number;
  taxPercentage: number;
  taxAmount: number;
  total: number;
  paymentMethod: string | null;
  status: string;
  /** base64 data URL of ZATCA Phase-1 QR */
  qrCodeDataUrl: string;
  primaryColor: string;
}

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const fmt = (n: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function buildInvoiceHtml(data: InvoiceTemplateData): string {
  const accent = data.primaryColor || '#8B5CF6';
  const itemsHtml = data.items
    .map(
      (it) => `
        <tr>
          <td class="desc">${escapeHtml(it.description)}</td>
          <td class="num">${it.quantity}</td>
          <td class="num">${fmt(it.unitPrice)}</td>
          <td class="num">${fmt(it.totalPrice)}</td>
        </tr>`,
    )
    .join('');

  const taxNumberLine = data.taxNumber
    ? `<div class="meta-line"><span class="label">الرقم الضريبي:</span> <span class="value mono">${escapeHtml(data.taxNumber)}</span></div>`
    : '';

  const crLine = data.commercialRegistration
    ? `<div class="meta-line"><span class="label">السجل التجاري:</span> <span class="value mono">${escapeHtml(data.commercialRegistration)}</span></div>`
    : '';

  const addressLine = data.salonAddress
    ? `<div class="meta-line"><span class="value">${escapeHtml(data.salonAddress)}</span></div>`
    : '';

  const paymentRow = data.paymentMethod
    ? `<div class="payment-line"><span class="label">طريقة الدفع:</span> <span>${escapeHtml(data.paymentMethod)}</span></div>`
    : '';

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8" />
<title>فاتورة ${escapeHtml(data.invoiceNumber)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  html, body {
    font-family: 'Cairo', 'Noto Sans Arabic', system-ui, -apple-system, sans-serif;
    color: #1f2937;
    background: #ffffff;
    direction: rtl;
    text-align: right;
    font-size: 13px;
    line-height: 1.6;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page {
    max-width: 800px;
    margin: 0 auto;
    padding: 32px 36px;
  }

  /* ── Top label: required by ZATCA ── */
  .invoice-label {
    text-align: center;
    font-weight: 700;
    font-size: 14px;
    color: #6b7280;
    letter-spacing: 0.02em;
    padding: 6px 0;
    border-bottom: 2px solid ${accent};
    margin-bottom: 22px;
  }

  /* ── Salon header ── */
  .salon-header { text-align: center; margin-bottom: 24px; }
  .salon-name {
    font-size: 28px;
    font-weight: 800;
    color: ${accent};
    letter-spacing: -0.01em;
    margin-bottom: 8px;
  }
  .meta-line {
    font-size: 12px;
    color: #4b5563;
    margin: 2px 0;
  }
  .meta-line .label { color: #6b7280; font-weight: 600; }
  .meta-line .value { color: #1f2937; }
  .mono { font-family: 'Cairo', monospace; letter-spacing: 0.02em; }

  /* ── Invoice meta strip ── */
  .meta-strip {
    display: flex;
    justify-content: space-between;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 14px 18px;
    margin: 22px 0 24px;
  }
  .meta-strip .item { display: flex; flex-direction: column; gap: 4px; }
  .meta-strip .item-label {
    font-size: 11px;
    color: #6b7280;
    font-weight: 600;
  }
  .meta-strip .item-value {
    font-size: 14px;
    color: #111827;
    font-weight: 700;
  }

  /* ── Client section ── */
  .section-title {
    font-size: 12px;
    color: #6b7280;
    font-weight: 700;
    text-transform: uppercase;
    margin-bottom: 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid #e5e7eb;
  }
  .client-block { margin-bottom: 22px; }
  .client-row {
    display: flex;
    gap: 24px;
    font-size: 13px;
  }
  .client-row .label { color: #6b7280; font-weight: 600; margin-left: 6px; }

  /* ── Items table ── */
  table.items {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 18px;
  }
  table.items thead th {
    background: ${accent};
    color: #ffffff;
    padding: 10px 12px;
    font-size: 12px;
    font-weight: 700;
    text-align: right;
  }
  table.items thead th.num { text-align: center; }
  table.items thead th:first-child { border-radius: 0 8px 8px 0; }
  table.items thead th:last-child { border-radius: 8px 0 0 8px; }
  table.items tbody td {
    padding: 11px 12px;
    border-bottom: 1px solid #f3f4f6;
    font-size: 13px;
    color: #1f2937;
  }
  table.items tbody td.desc { font-weight: 600; }
  table.items tbody td.num {
    text-align: center;
    font-weight: 600;
    font-feature-settings: 'tnum';
  }
  table.items tbody tr:last-child td { border-bottom: none; }

  /* ── Summary ── */
  .summary {
    margin: 18px 0 24px;
    margin-right: auto;
    width: 320px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 14px 18px;
  }
  .summary table { width: 100%; border-collapse: collapse; }
  .summary td {
    padding: 5px 0;
    font-size: 13px;
    color: #4b5563;
  }
  .summary td:first-child { font-weight: 600; }
  .summary td.num {
    text-align: left;
    font-weight: 700;
    color: #1f2937;
    font-feature-settings: 'tnum';
  }
  .summary tr.total td {
    font-size: 15px;
    color: ${accent};
    font-weight: 800;
    border-top: 2px solid ${accent};
    padding-top: 10px;
    margin-top: 6px;
  }

  /* ── Payment + status ── */
  .payment-block {
    display: flex;
    gap: 20px;
    margin-bottom: 22px;
    flex-wrap: wrap;
  }
  .payment-line {
    background: #f3f4f6;
    border-radius: 8px;
    padding: 8px 14px;
    font-size: 12px;
    font-weight: 600;
  }
  .payment-line .label { color: #6b7280; margin-left: 6px; }
  .badge.paid {
    background: #d1fae5;
    color: #065f46;
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 700;
  }
  .badge.unpaid {
    background: #fef3c7;
    color: #92400e;
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 700;
  }

  /* ── QR ── */
  .qr-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    margin: 26px 0 18px;
    padding: 16px;
    border: 1px dashed #d1d5db;
    border-radius: 12px;
  }
  .qr-block img { width: 110px; height: 110px; }
  .qr-block .qr-label {
    font-size: 10px;
    color: #6b7280;
    font-weight: 600;
    letter-spacing: 0.05em;
  }

  /* ── Footer ── */
  .footer {
    text-align: center;
    margin-top: 22px;
    padding-top: 16px;
    border-top: 1px solid #e5e7eb;
    color: #6b7280;
    font-size: 13px;
  }
  .footer .thanks {
    font-size: 14px;
    font-weight: 700;
    color: #1f2937;
  }
</style>
</head>
<body>
  <div class="page">

    <div class="invoice-label">فاتورة ضريبية مبسطة</div>

    <div class="salon-header">
      <div class="salon-name">${escapeHtml(data.salonName)}</div>
      ${addressLine}
      ${taxNumberLine}
      ${crLine}
    </div>

    <div class="meta-strip">
      <div class="item">
        <span class="item-label">رقم الفاتورة</span>
        <span class="item-value mono">${escapeHtml(data.invoiceNumber)}</span>
      </div>
      <div class="item">
        <span class="item-label">التاريخ</span>
        <span class="item-value">${escapeHtml(data.date)}</span>
      </div>
      <div class="item">
        <span class="item-label">الوقت</span>
        <span class="item-value mono">${escapeHtml(data.time)}</span>
      </div>
    </div>

    <div class="client-block">
      <div class="section-title">بيانات العميل</div>
      <div class="client-row">
        <div><span class="label">الاسم:</span>${escapeHtml(data.clientName)}</div>
        <div><span class="label">الجوال:</span><span class="mono">${escapeHtml(data.clientPhone)}</span></div>
      </div>
    </div>

    <div class="section-title">تفاصيل الخدمات</div>
    <table class="items">
      <thead>
        <tr>
          <th>الوصف</th>
          <th class="num">الكمية</th>
          <th class="num">سعر الوحدة</th>
          <th class="num">المجموع</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>

    <div class="summary">
      <table>
        <tr>
          <td>المجموع الفرعي</td>
          <td class="num">${fmt(data.subtotal)} ر.س</td>
        </tr>
        ${
          data.discountAmount > 0
            ? `<tr><td>الخصم</td><td class="num">- ${fmt(data.discountAmount)} ر.س</td></tr>`
            : ''
        }
        <tr>
          <td>ضريبة القيمة المضافة (${data.taxPercentage}%)</td>
          <td class="num">${fmt(data.taxAmount)} ر.س</td>
        </tr>
        <tr class="total">
          <td>الإجمالي شامل الضريبة</td>
          <td class="num">${fmt(data.total)} ر.س</td>
        </tr>
      </table>
    </div>

    <div class="payment-block">
      ${paymentRow}
      <div class="payment-line">
        <span class="label">الحالة:</span>
        <span class="badge ${data.status === 'paid' || data.status === 'مدفوعة' ? 'paid' : 'unpaid'}">${escapeHtml(data.status)}</span>
      </div>
    </div>

    <div class="qr-block">
      <img src="${data.qrCodeDataUrl}" alt="ZATCA QR" />
      <div class="qr-label">امسح QR للتحقق من الفاتورة</div>
    </div>

    <div class="footer">
      <div class="thanks">شكراً لزيارتكم 🌸</div>
    </div>

  </div>
</body>
</html>`;
}
