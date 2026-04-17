import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
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

@Injectable()
export class PdfService {
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

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const primaryColor = tenantBranding.primaryColor || '#8B5CF6';

    doc
      .fontSize(24)
      .fillColor(primaryColor)
      .text(tenantBranding.nameAr, { align: 'center' })
      .moveDown(0.5);

    if (tenantBranding.logoUrl) {
      doc.fontSize(10).fillColor('#666').text('', { align: 'center' });
    }

    doc
      .fontSize(12)
      .fillColor('#333')
      .text(`رقم الفاتورة: ${invoice.invoiceNumber}`, { align: 'right' })
      .text(`التاريخ: ${invoice.createdAt.toLocaleDateString('ar-SA')}`, { align: 'right' })
      .text(`الوقت: ${invoice.createdAt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}`, { align: 'right' })
      .moveDown(1);

    doc
      .fontSize(14)
      .fillColor('#333')
      .text('بيانات العميل', { align: 'right' })
      .fontSize(11)
      .text(`الاسم: ${invoice.client.fullName}`, { align: 'right' })
      .text(`الجوال: ${invoice.client.phone}`, { align: 'right' });
    if (invoice.client.email) {
      doc.text(`البريد: ${invoice.client.email}`, { align: 'right' });
    }
    doc.moveDown(1);

    doc.fontSize(12).fillColor('#333').text('تفاصيل الخدمات', { align: 'right' }).moveDown(0.5);

    doc.fontSize(10);
    for (const item of invoice.invoiceItems) {
      const serviceName = item.service?.nameAr || item.description;
      const empName = item.employee?.fullName || '';
      const line = `${serviceName} ${empName ? `- ${empName}` : ''} | ${item.quantity} × ${Number(item.unitPrice).toFixed(2)} = ${Number(item.totalPrice).toFixed(2)} ر.س`;
      doc.text(line, { align: 'right' });
    }
    doc.moveDown(1);

    const subtotal = Number(invoice.subtotal);
    const taxAmount = Number(invoice.taxAmount);
    const discountAmount = Number(invoice.discountAmount);
    const total = Number(invoice.total);

    doc
      .fontSize(11)
      .text(`المجموع الفرعي: ${subtotal.toFixed(2)} ر.س`, { align: 'right' });
    if (discountAmount > 0) {
      doc.text(`الخصم: ${discountAmount.toFixed(2)} ر.س`, { align: 'right' });
    }
    doc
      .text(`ضريبة القيمة المضافة (15%): ${taxAmount.toFixed(2)} ر.س`, { align: 'right' })
      .fontSize(12)
      .fillColor(primaryColor)
      .text(`الإجمالي: ${total.toFixed(2)} ر.س`, { align: 'right' })
      .moveDown(1);

    if (invoice.payments.length > 0) {
      doc.fontSize(11).fillColor('#333');
      const paymentMethod = invoice.payments[0].method;
      const methodAr = paymentMethod === 'cash' ? 'نقدي' : paymentMethod === 'card' ? 'بطاقة' : paymentMethod;
      doc.text(`طريقة الدفع: ${methodAr}`, { align: 'right' });
      doc.text(`الحالة: ${invoice.status === 'paid' ? 'مدفوعة' : invoice.status}`, { align: 'right' });
      doc.moveDown(1);
    }

    if (taxNumber) {
      doc.fontSize(9).fillColor('#666').text(`الرقم الضريبي: ${taxNumber}`, { align: 'center' });
    }

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
    doc.image(qrDataUrl, doc.page.width / 2 - 40, doc.y, { width: 80, height: 80 });
    doc.moveDown(6);

    doc
      .fontSize(10)
      .fillColor('#333')
      .text('شكراً لزيارتكم', { align: 'center' })
      .moveDown(0.5);

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
  }
}
