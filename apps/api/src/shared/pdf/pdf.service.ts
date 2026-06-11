import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import QRCode from 'qrcode';
import puppeteer, { Browser } from 'puppeteer';
import type { TenantPrismaClient } from '../types/tenant-db.type';
import { buildInvoiceHtml, type InvoiceItemData } from './templates/invoice.template';

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
export class PdfService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfService.name);
  // Singleton Puppeteer browser — relaunched on disconnect.
  // First PDF triggers launch (~500ms-1s); subsequent calls reuse the
  // process and only spend ~50-150ms creating a fresh page.
  private browserPromise: Promise<Browser> | null = null;

  async onModuleDestroy(): Promise<void> {
    if (!this.browserPromise) return;
    try {
      const browser = await this.browserPromise;
      await browser.close();
    } catch (err) {
      this.logger.warn(`Error closing puppeteer browser: ${(err as Error).message}`);
    }
    this.browserPromise = null;
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browserPromise) {
      const existing = await this.browserPromise;
      if (existing.connected) return existing;
      // Stale browser (crashed / disconnected) — drop and relaunch.
      this.browserPromise = null;
    }
    this.browserPromise = puppeteer.launch({
      headless: true,
      // Required when running as root inside the slim Alpine container.
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      // PUPPETEER_EXECUTABLE_PATH env var (set in Dockerfile) points to
      // /usr/bin/chromium-browser; locally, puppeteer falls back to its
      // bundled binary if it exists.
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    });
    const browser = await this.browserPromise;
    browser.on('disconnected', () => {
      this.logger.warn('Puppeteer browser disconnected; will relaunch on next request');
      this.browserPromise = null;
    });
    return browser;
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
          orderBy: { createdAt: 'asc' },
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
    const commercialRegistration = salonInfo?.commercialRegistration ?? null;
    const taxPercentage = Number(salonInfo?.taxPercentage ?? 15);

    // Build full address from the granular ZATCA fields. Falls back to
    // city alone if street/district are missing.
    const addressParts: string[] = [];
    if (salonInfo?.city) addressParts.push(salonInfo.city);
    if (salonInfo?.district) addressParts.push(salonInfo.district);
    if (salonInfo?.street) addressParts.push(salonInfo.street);
    if (salonInfo?.buildingNumber) addressParts.push(`مبنى ${salonInfo.buildingNumber}`);
    const fullAddress = addressParts.join('، ');

    const subtotal = Number(invoice.subtotal);
    const taxAmount = Number(invoice.taxAmount);
    const discountAmount = Number(invoice.discountAmount);
    const total = Number(invoice.total);

    const items: InvoiceItemData[] = invoice.invoiceItems.map((item) => {
      const baseName = item.service?.nameAr || item.description;
      const empName = item.employee?.fullName || '';
      return {
        description: empName ? `${baseName} — ${empName}` : baseName,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
      };
    });

    const paymentMethod = (() => {
      const method = invoice.payments[0]?.method;
      if (!method) return null;
      if (method === 'cash') return 'نقدي';
      if (method === 'card') return 'بطاقة';
      if (method === 'bank_transfer') return 'تحويل بنكي';
      if (method === 'wallet') return 'محفظة';
      return method;
    })();

    const status = invoice.status === 'paid' ? 'مدفوعة' : invoice.status;

    const dateStr = invoice.createdAt.toLocaleDateString('ar-SA');
    const timeStr = invoice.createdAt.toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // ── QR Code (ZATCA Phase 1) ──
    const qrData = buildZatcaQrData(
      tenantBranding.nameAr,
      taxNumber || '000000000000000',
      invoice.createdAt,
      total,
      taxAmount,
    );
    const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 240,
    });

    const html = buildInvoiceHtml({
      salonName: tenantBranding.nameAr,
      salonAddress: fullAddress,
      taxNumber,
      commercialRegistration,
      invoiceNumber: invoice.invoiceNumber,
      date: dateStr,
      time: timeStr,
      clientName: invoice.client.fullName,
      clientPhone: invoice.client.phone,
      items,
      subtotal,
      discountAmount,
      taxPercentage,
      taxAmount,
      total,
      paymentMethod,
      status,
      qrCodeDataUrl,
      primaryColor: tenantBranding.primaryColor || '#8B5CF6',
    });

    return this.htmlToPdf(html);
  }

  /**
   * Generic HTML → PDF renderer used by invoices and any other report.
   * `networkidle0` waits for Google Fonts CSS so the first render uses
   * Cairo properly instead of flashing a fallback.
   */
  async htmlToPdf(
    html: string,
    options?: { format?: 'A4' | 'A5' | 'Letter'; landscape?: boolean },
  ): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15_000 });
      const pdf = await page.pdf({
        format: options?.format ?? 'A4',
        landscape: options?.landscape ?? false,
        printBackground: true,
        margin: { top: '12mm', right: '10mm', bottom: '12mm', left: '10mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await page.close().catch((err) => {
        this.logger.warn(`Failed to close puppeteer page: ${(err as Error).message}`);
      });
    }
  }
}
