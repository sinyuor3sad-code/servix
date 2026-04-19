import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import type {
  ZatcaCertificate,
  ZatcaInvoice,
} from '../../../../generated/tenant';
import { TenantPrismaClient } from '@shared/types';
import { ZatcaOnboardDto } from './dto/onboard.dto';
import * as crypto from 'crypto';

@Injectable()
export class ZatcaService {
  private readonly logger = new Logger(ZatcaService.name);

  /**
   * Onboard a tenant with ZATCA: generate ECDSA key pair and CSR.
   * Production API integration is deferred — this stores keys locally.
   */
  async onboard(db: TenantPrismaClient, dto: ZatcaOnboardDto): Promise<ZatcaCertificate> {
    const salon = await db.salonInfo.findFirst();
    const salonName = salon?.nameAr ?? 'SERVIX Salon';
    const taxNumber = salon?.taxNumber ?? '';

    // Generate ECDSA P-256 key pair
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    // Build CSR content (simplified — in production use proper ASN.1)
    const csrContent = [
      '-----BEGIN CERTIFICATE REQUEST-----',
      `CN=${salonName}`,
      `OU=${dto.organizationUnitName || salonName}`,
      `O=${salonName}`,
      `C=SA`,
      `SN=${taxNumber}`,
      `PublicKey=${publicKey.substring(0, 100)}...`,
      '-----END CERTIFICATE REQUEST-----',
    ].join('\n');

    const certificate = await db.zatcaCertificate.create({
      data: {
        csrContent,
        privateKey,
        isProduction: dto.isProduction ?? false,
        isActive: true,
      },
    });

    this.logger.log(`ZATCA onboarded: certificate ${certificate.id}, production=${dto.isProduction}`);
    return certificate;
  }

  /**
   * Submit an invoice to ZATCA: build XML, sign, generate QR, store.
   * Actual ZATCA API calls are deferred to Phase 2.
   */
  async submitInvoice(db: TenantPrismaClient, invoiceId: string): Promise<ZatcaInvoice> {
    const invoice = await db.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        client: true,
        invoiceItems: { include: { service: true } },
        payments: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('الفاتورة غير موجودة');
    }

    const certificate = await db.zatcaCertificate.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!certificate) {
      throw new NotFoundException('لا يوجد شهادة ZATCA نشطة — يرجى التسجيل أولاً');
    }

    // Use a Serializable transaction to prevent counter race condition.
    // Two concurrent ZATCA submissions could otherwise get the same counter value.
    const zatcaInvoice = await db.$transaction(async (tx) => {
      // Get previous invoice hash for chain — with lock
      const lastZatcaInvoices = await tx.$queryRawUnsafe<{ invoice_counter_value: number; zatca_invoice_hash: string | null }[]>(
        `SELECT invoice_counter_value, zatca_invoice_hash FROM zatca_invoices ORDER BY invoice_counter_value DESC LIMIT 1 FOR UPDATE`,
      );
      const previousHash = lastZatcaInvoices[0]?.zatca_invoice_hash ?? null;
      const counterValue = (lastZatcaInvoices[0]?.invoice_counter_value ?? 0) + 1;

      // Build UBL XML
      const xmlContent = this.buildUblXml(invoice as never);

      // Sign the XML
      const digitalSignature = this.signXml(xmlContent, certificate.privateKey);

      // Hash the invoice
      const xmlHash = crypto.createHash('sha256').update(xmlContent).digest('hex');

      // Build QR
      const salon = await tx.salonInfo.findFirst();
      const qrCode = this.buildQrPayload({
        sellerName: salon?.nameAr ?? 'SERVIX',
        vatNumber: salon?.taxNumber ?? '',
        timestamp: invoice.createdAt.toISOString(),
        totalWithVat: Number(invoice.total),
        vatAmount: Number(invoice.taxAmount),
        xmlHash,
      });

      // Determine type
      const isSimplified = Number(invoice.total) < 1000;

      const created = await tx.zatcaInvoice.create({
        data: {
          invoiceId,
          certificateId: certificate.id,
          invoiceType: isSimplified ? 'simplified' : 'standard',
          invoiceSubType: '0100000',
          xmlContent,
          xmlHash,
          digitalSignature,
          qrCode,
          submissionStatus: 'pending',
          invoiceCounterValue: counterValue,
          previousInvoiceHash: previousHash,
        },
      });

      this.logger.log(`ZATCA invoice created for invoice ${invoiceId}, counter=${counterValue}`);
      return created;
    }, {
      isolationLevel: 'Serializable',
    });

    return zatcaInvoice;
  }

  async getSubmissionStatus(
    db: TenantPrismaClient,
    invoiceId: string,
  ): Promise<ZatcaInvoice | null> {
    return db.zatcaInvoice.findFirst({
      where: { invoiceId },
      include: { certificate: { select: { id: true, isProduction: true } } },
    });
  }

  async getQrForInvoice(db: TenantPrismaClient, invoiceId: string): Promise<string | null> {
    const zatcaInvoice = await db.zatcaInvoice.findFirst({
      where: { invoiceId },
      select: { qrCode: true },
    });
    return zatcaInvoice?.qrCode ?? null;
  }

  async listCertificates(db: TenantPrismaClient): Promise<ZatcaCertificate[]> {
    return db.zatcaCertificate.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Build UBL 2.1 XML for an invoice (simplified structure).
   * In production, this would follow the exact ZATCA UBL 2.1 schema.
   */
  buildUblXml(invoice: {
    invoiceNumber: string;
    createdAt: Date;
    subtotal: unknown;
    taxAmount: unknown;
    total: unknown;
    invoiceItems: Array<{
      description: string;
      quantity: number;
      unitPrice: unknown;
      totalPrice: unknown;
    }>;
    client: { fullName: string; phone: string } | null;
  }): string {
    const lines = invoice.invoiceItems
      .map(
        (item, i) => `
    <cac:InvoiceLine>
      <cbc:ID>${i + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="PCE">${item.quantity}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="SAR">${Number(item.totalPrice).toFixed(2)}</cbc:LineExtensionAmount>
      <cac:Item>
        <cbc:Name>${this.escapeXml(item.description)}</cbc:Name>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="SAR">${Number(item.unitPrice).toFixed(2)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`,
      )
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>${invoice.invoiceNumber}</cbc:ID>
  <cbc:IssueDate>${invoice.createdAt.toISOString().split('T')[0]}</cbc:IssueDate>
  <cbc:IssueTime>${invoice.createdAt.toISOString().split('T')[1]?.substring(0, 8) ?? '00:00:00'}</cbc:IssueTime>
  <cbc:InvoiceTypeCode>388</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName>
        <cbc:Name>${this.escapeXml(invoice.client?.fullName ?? 'عميل')}</cbc:Name>
      </cac:PartyName>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="SAR">${Number(invoice.subtotal).toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="SAR">${Number(invoice.subtotal).toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="SAR">${Number(invoice.total).toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="SAR">${Number(invoice.total).toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="SAR">${Number(invoice.taxAmount).toFixed(2)}</cbc:TaxAmount>
  </cac:TaxTotal>
  ${lines}
</Invoice>`;
  }

  /**
   * Sign XML with ECDSA-SHA256.
   */
  signXml(xml: string, privateKeyPem: string): string {
    const sign = crypto.createSign('SHA256');
    sign.update(xml);
    sign.end();
    return sign.sign(privateKeyPem, 'base64');
  }

  /**
   * Build TLV-encoded QR payload per ZATCA spec.
   * Tags: 1=seller, 2=VAT, 3=timestamp, 4=total, 5=VAT amount, 6=hash
   */
  buildQrPayload(data: {
    sellerName: string;
    vatNumber: string;
    timestamp: string;
    totalWithVat: number;
    vatAmount: number;
    xmlHash: string;
  }): string {
    const entries = [
      { tag: 1, value: data.sellerName },
      { tag: 2, value: data.vatNumber },
      { tag: 3, value: data.timestamp },
      { tag: 4, value: data.totalWithVat.toFixed(2) },
      { tag: 5, value: data.vatAmount.toFixed(2) },
      { tag: 6, value: data.xmlHash },
    ];

    const buffers: Buffer[] = [];
    for (const entry of entries) {
      const valueBuffer = Buffer.from(entry.value, 'utf-8');
      const tagBuffer = Buffer.from([entry.tag]);
      const lengthBuffer = Buffer.from([valueBuffer.length]);
      buffers.push(tagBuffer, lengthBuffer, valueBuffer);
    }

    return Buffer.concat(buffers).toString('base64');
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
