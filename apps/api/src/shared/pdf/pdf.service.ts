import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';
import ArabicReshaper from 'arabic-reshaper';
import bidiFactory from 'bidi-js';
import type { TenantPrismaClient } from '../types/tenant-db.type';

/** ZATCA Phase 1 QR: TLV format (seller name, tax number, date, total, VAT) */
function buildZatcaQrData(
  sellerName: string,
  taxNumber: string,
  date: Date,
  total: number,
  vatAmount: number,
): string {
  const tlv: Buffer[] = [];
  const enc = (tag: number, value: string) => {
    const buf = Buffer.from(value, 'utf8');
    tlv.push(Buffer.from([tag, buf.length]), buf);
  };
  enc(1, sellerName);
  enc(2, taxNumber || '');
  enc(3, date.toISOString().replace(/\.\d{3}Z$/, 'Z'));
  enc(4, total.toFixed(2));
  enc(5, vatAmount.toFixed(2));
  return Buffer.concat(tlv).toString('base64');
}

const FONTS_DIR = path.join(__dirname, 'fonts');
const REGULAR_FONT_PATH = path.join(FONTS_DIR, 'Amiri-Regular.ttf');
const BOLD_FONT_PATH = path.join(FONTS_DIR, 'Amiri-Bold.ttf');

const bidi = bidiFactory();

// Reshape Arabic letters into their joined visual forms and apply bidi
// reordering so PDFKit (which only renders LTR glyph runs) shows the text
// the same way a human reads it. Numbers and Latin keep their natural order
// inside the RTL paragraph.
function shapeArabic(text: string): string {
  if (!text) return '';
  const reshaped = ArabicReshaper.convertArabic(text);
  // Run UAX#9 bidi with paragraph base direction = RTL.
  const embeddingLevels = bidi.getEmbeddingLevels(reshaped, 'rtl');
  const flipped = bidi.getReorderSegments(reshaped, embeddingLevels);
  const chars = reshaped.split('');
  for (const [start, end] of flipped) {
    const slice = chars.slice(start, end + 1).reverse();
    chars.splice(start, end - start + 1, ...slice);
  }
  return chars.join('');
}

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private fontsLoaded = false;

  private ensureFonts(): boolean {
    if (this.fontsLoaded) return true;
    if (!fs.existsSync(REGULAR_FONT_PATH) || !fs.existsSync(BOLD_FONT_PATH)) {
      this.logger.warn(
        `Arabic fonts missing at ${FONTS_DIR}; PDF Arabic text will not render correctly`,
      );
      return false;
    }
    this.fontsLoaded = true;
    return true;
  }

  async generateInvoicePdf(
    db: TenantPrismaClient,
    invoiceId: string,
    tenantBranding: { nameAr: string; primaryColor: string; logoUrl: string | null },
  ): Promise<Buffer> {
    const invoice = await db.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        invoiceItems: {
          include: {
            service: true,
            employee: { select: { fullName: true } },
          },
        },
        payments: true,
        client: {
          select: { fullName: true, phone: true, email: true },
        },
      },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const salonInfo = await db.salonInfo.findFirst();
    const taxNumber = salonInfo?.taxNumber ?? null;

    const hasFonts = this.ensureFonts();
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    if (hasFonts) {
      doc.registerFont('Arabic', REGULAR_FONT_PATH);
      doc.registerFont('Arabic-Bold', BOLD_FONT_PATH);
      doc.font('Arabic');
    }

    // Helpers wrapping text drawing with shaping + RTL alignment.
    const ar = (text: string) => (hasFonts ? shapeArabic(text) : text);
    const writeRight = (text: string, options?: PDFKit.Mixins.TextOptions) =>
      doc.text(ar(text), { align: 'right', ...options });
    const writeCenter = (text: string, options?: PDFKit.Mixins.TextOptions) =>
      doc.text(ar(text), { align: 'center', ...options });

    const primaryColor = tenantBranding.primaryColor || '#8B5CF6';

    // ── Header: salon name ──
    if (hasFonts) doc.font('Arabic-Bold');
    doc.fontSize(24).fillColor(primaryColor);
    writeCenter(tenantBranding.nameAr);
    doc.moveDown(0.5);
    if (hasFonts) doc.font('Arabic');

    // ── Meta: invoice number, date, time ──
    doc.fontSize(12).fillColor('#333');
    writeRight(`رقم الفاتورة: ${invoice.invoiceNumber}`);
    writeRight(`التاريخ: ${invoice.createdAt.toLocaleDateString('ar-SA')}`);
    writeRight(
      `الوقت: ${invoice.createdAt.toLocaleTimeString('ar-SA', {
        hour: '2-digit',
        minute: '2-digit',
      })}`,
    );
    doc.moveDown(1);

    // ── Client section ──
    if (hasFonts) doc.font('Arabic-Bold');
    doc.fontSize(14).fillColor('#333');
    writeRight('بيانات العميل');
    if (hasFonts) doc.font('Arabic');
    doc.fontSize(11);
    writeRight(`الاسم: ${invoice.client.fullName}`);
    writeRight(`الجوال: ${invoice.client.phone}`);
    if (invoice.client.email) {
      writeRight(`البريد: ${invoice.client.email}`);
    }
    doc.moveDown(1);

    // ── Items header ──
    if (hasFonts) doc.font('Arabic-Bold');
    doc.fontSize(12).fillColor('#333');
    writeRight('تفاصيل الخدمات');
    if (hasFonts) doc.font('Arabic');
    doc.moveDown(0.5);

    // ── Items list ──
    doc.fontSize(10);
    for (const item of invoice.invoiceItems) {
      const serviceName = item.service?.nameAr || item.description;
      const empName = item.employee?.fullName || '';
      const employeePart = empName ? ` - ${empName}` : '';
      const line =
        `${serviceName}${employeePart} | ${item.quantity} × ${Number(
          item.unitPrice,
        ).toFixed(2)} = ${Number(item.totalPrice).toFixed(2)} ر.س`;
      writeRight(line);
    }
    doc.moveDown(1);

    // ── Totals ──
    const subtotal = Number(invoice.subtotal);
    const taxAmount = Number(invoice.taxAmount);
    const discountAmount = Number(invoice.discountAmount);
    const total = Number(invoice.total);

    doc.fontSize(11).fillColor('#333');
    writeRight(`المجموع الفرعي: ${subtotal.toFixed(2)} ر.س`);
    if (discountAmount > 0) {
      writeRight(`الخصم: ${discountAmount.toFixed(2)} ر.س`);
    }
    writeRight(`ضريبة القيمة المضافة (15%): ${taxAmount.toFixed(2)} ر.س`);
    if (hasFonts) doc.font('Arabic-Bold');
    doc.fontSize(12).fillColor(primaryColor);
    writeRight(`الإجمالي: ${total.toFixed(2)} ر.س`);
    if (hasFonts) doc.font('Arabic');
    doc.moveDown(1);

    // ── Payment ──
    if (invoice.payments.length > 0) {
      doc.fontSize(11).fillColor('#333');
      const paymentMethod = invoice.payments[0].method;
      const methodAr =
        paymentMethod === 'cash'
          ? 'نقدي'
          : paymentMethod === 'card'
            ? 'بطاقة'
            : paymentMethod;
      writeRight(`طريقة الدفع: ${methodAr}`);
      writeRight(
        `الحالة: ${invoice.status === 'paid' ? 'مدفوعة' : invoice.status}`,
      );
      doc.moveDown(1);
    }

    if (taxNumber) {
      doc.fontSize(9).fillColor('#666');
      writeCenter(`الرقم الضريبي: ${taxNumber}`);
    }

    // ── ZATCA QR ──
    const qrData = buildZatcaQrData(
      tenantBranding.nameAr,
      taxNumber || '000000000000000',
      invoice.createdAt,
      total,
      taxAmount,
    );
    const qrDataUrl = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 80,
    });
    doc.image(qrDataUrl, doc.page.width / 2 - 40, doc.y, {
      width: 80,
      height: 80,
    });
    doc.moveDown(6);

    // ── Footer ──
    doc.fontSize(10).fillColor('#333');
    writeCenter('شكراً لزيارتكم');
    doc.moveDown(0.5);

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
  }
}
