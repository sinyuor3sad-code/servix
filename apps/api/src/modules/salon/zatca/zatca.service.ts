import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type {
  ZatcaCertificate,
  ZatcaInvoice,
} from '../../../../generated/tenant';
import { TenantPrismaClient } from '@shared/types';
import { ZatcaOnboardDto } from './dto/onboard.dto';
import { ZatcaCryptoService } from '../../zatca/zatca-crypto.service';
import { ZatcaXmlBuilder } from '../../zatca/zatca-xml.builder';
import { ZatcaService as PlatformZatcaService } from '../../zatca/zatca.service';
import { EncryptionService } from '../../../shared/encryption/encryption.service';
import {
  ZatcaInvoiceData,
  ZatcaInvoiceLine,
  ZatcaSeller,
} from '../../zatca/zatca.types';

/**
 * Salon-level ZATCA Service
 *
 * Orchestrates ZATCA e-invoicing for a single tenant (salon).
 * Delegates all crypto and XML operations to shared core services
 * from modules/zatca/ to ensure consistency and avoid duplication.
 *
 * Responsibilities:
 *   - Onboarding (CSR generation → ZATCA API → Production CSID)
 *   - Invoice submission (builds data → XML → sign → QR → store)
 *   - Status queries
 */
@Injectable()
export class SalonZatcaService {
  private readonly logger = new Logger(SalonZatcaService.name);

  constructor(
    private readonly cryptoService: ZatcaCryptoService,
    private readonly xmlBuilder: ZatcaXmlBuilder,
    private readonly encryptionService: EncryptionService,
    private readonly platformZatca: PlatformZatcaService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // Onboarding — Full ZATCA API Flow
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Onboard a tenant with ZATCA using the full 3-step flow:
   *   1. Generate CSR + send to Compliance CSID API with OTP
   *   2. Run compliance checks (3 test invoices)
   *   3. Request Production CSID
   *   4. Store encrypted credentials locally
   */
  async onboard(db: TenantPrismaClient, dto: ZatcaOnboardDto): Promise<ZatcaCertificate> {
    const salon = await db.salonInfo.findFirst();
    const salonName = salon?.nameAr ?? 'SERVIX Salon';
    const salonId = salon?.id ?? 'unknown';

    // Deactivate any existing certificates
    await db.zatcaCertificate.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    // Call platform-level ZATCA service for full onboarding
    const result = await this.platformZatca.onboardDevice(
      salonId,
      salonName,
      dto.otp,
      {
        vatNumber: salon?.taxNumber || undefined,
        commercialRegistration: salon?.commercialRegistration || undefined,
        street: salon?.street || undefined,
        buildingNumber: salon?.buildingNumber || undefined,
        city: salon?.city || undefined,
        district: salon?.district || undefined,
        postalCode: salon?.postalCode || undefined,
      },
    );

    // Generate local CSR for record-keeping
    const { privateKey, publicKey, csr } = this.cryptoService.generateCSR({
      commonName: `SERVIX-EGS-${salonId}`,
      organizationName: salonName,
      countryCode: 'SA',
      serialNumber: `1-SERVIX|2-${salonId}|3-${Date.now()}`,
      organizationIdentifier: salon?.taxNumber || undefined,
      organizationUnit: dto.organizationUnitName || undefined,
    });

    // Encrypt the private key before storage
    const encryptedPrivateKey = this.encryptionService.encrypt(privateKey);

    const certificate = await db.zatcaCertificate.create({
      data: {
        csrContent: csr,
        privateKey: encryptedPrivateKey,
        publicKey,
        isProduction: dto.isProduction ?? false,
        isActive: true,
      },
    });

    this.logger.log(
      `ZATCA onboarded: certificate ${certificate.id}, production=${dto.isProduction}, requestId=${result.requestId}`,
    );
    return certificate;
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // Invoice Submission
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Submit an invoice to ZATCA: build XML, sign, generate QR, store.
   * Uses Serializable transaction to prevent counter race conditions.
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

    // Serializable transaction to prevent counter race condition
    const zatcaInvoice = await db.$transaction(async (tx) => {
      // Get previous invoice hash with lock
      const lastZatcaInvoices = await tx.$queryRawUnsafe<
        { invoice_counter_value: number; zatca_invoice_hash: string | null }[]
      >(
        `SELECT invoice_counter_value, zatca_invoice_hash FROM zatca_invoices ORDER BY invoice_counter_value DESC LIMIT 1 FOR UPDATE`,
      );

      const previousHash =
        lastZatcaInvoices[0]?.zatca_invoice_hash ??
        ZatcaCryptoService.INITIAL_PREVIOUS_HASH;
      const counterValue = (lastZatcaInvoices[0]?.invoice_counter_value ?? 0) + 1;

      // Get salon info for seller data
      const salon = await tx.salonInfo.findFirst();

      // Build ZATCA-compliant invoice data
      const invoiceData = this.buildInvoiceData(
        invoice as any,
        salon as any,
        counterValue,
        previousHash,
      );

      // 1. Build UBL 2.1 XML using shared builder
      const xml = this.xmlBuilder.buildInvoiceXml(invoiceData);

      // 2. Hash the invoice (with transforms)
      const invoiceHash = this.cryptoService.hashInvoice(xml);
      const invoiceHashBinary = this.cryptoService.hashInvoiceBinary(xml);

      // 3. Decrypt private key and sign
      const decryptedKey = this.encryptionService.decrypt(certificate.privateKey);
      const digitalSignature = this.cryptoService.signData(xml, decryptedKey);
      const signatureBinary = this.cryptoService.signDataBinary(xml, decryptedKey);

      // 4. Extract public key bytes for QR Tag 8
      const publicKeyBytes = (certificate as any).publicKey
        ? this.cryptoService.extractPublicKeyBytes((certificate as any).publicKey)
        : Buffer.alloc(33); // Fallback: will be corrected after first real onboarding

      // 5. Get certificate base64 for embedSignature (if available from ZATCA)
      const certBase64 = (certificate as any).certificateContent ?? undefined;

      // 6. Build QR code with all 9 tags
      const qrCode = this.cryptoService.generateTLV({
        sellerName: invoiceData.seller.name,
        vatNumber: invoiceData.seller.vatNumber,
        timestamp: `${invoiceData.issueDate}T${invoiceData.issueTime}`,
        totalWithVat: invoiceData.totalWithVat.toFixed(2),
        vatAmount: invoiceData.totalVat.toFixed(2),
        invoiceHash: invoiceHashBinary,
        signature: signatureBinary,
        publicKey: publicKeyBytes,
      });

      // 7. Embed XAdES-BES signature with certificate into XML
      let signedXml = this.cryptoService.embedSignature(
        xml, digitalSignature, invoiceHash, certBase64,
      );

      // 8. Inject QR into XML
      signedXml = this.cryptoService.injectQrCode(signedXml, qrCode);

      // Determine invoice type (simplified = no buyer VAT number)
      const isSimplified = !(invoice.client as any)?.taxNumber;

      const created = await tx.zatcaInvoice.create({
        data: {
          invoiceId,
          certificateId: certificate.id,
          invoiceType: isSimplified ? 'simplified' : 'standard',
          invoiceSubType: isSimplified ? '0200000' : '0100000',
          xmlContent: signedXml,
          xmlHash: invoiceHash,
          digitalSignature,
          qrCode,
          submissionStatus: 'pending',
          invoiceCounterValue: counterValue,
          previousInvoiceHash: previousHash,
          zatcaInvoiceHash: invoiceHash,
        },
      });

      this.logger.log(
        `ZATCA invoice created for invoice ${invoiceId}, counter=${counterValue}`,
      );
      return created;
    }, {
      isolationLevel: 'Serializable',
    });

    return zatcaInvoice;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Data transformation — SERVIX Invoice → ZATCA Invoice Data
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Transform a SERVIX invoice into ZATCA-compliant ZatcaInvoiceData.
   */
  private buildInvoiceData(
    invoice: any,
    salon: any,
    counterValue: number,
    previousHash: string,
  ): ZatcaInvoiceData {
    const lines: ZatcaInvoiceLine[] = (invoice.invoiceItems || []).map(
      (item: any, idx: number) => {
        const amount = Number(item.totalPrice || item.amount || 0);
        const vatRate = 15;
        const vatAmount = +(amount * (vatRate / 100)).toFixed(2);

        return {
          lineNumber: idx + 1,
          serviceName: item.description || item.service?.nameAr || item.service?.nameEn || 'خدمة',
          quantity: item.quantity || 1,
          unitCode: 'EA',
          unitPrice: Number(item.unitPrice || item.price || amount),
          amount,
          vatCategory: 'S' as const,
          vatRate,
          vatAmount,
        };
      },
    );

    const totalBeforeVat = lines.reduce((sum, l) => sum + l.amount, 0);
    const totalVat = lines.reduce((sum, l) => sum + l.vatAmount, 0);
    const isSimplified = !invoice.client?.taxNumber;

    const seller: ZatcaSeller = {
      name: salon?.nameAr || salon?.nameEn || 'Salon',
      vatNumber: salon?.taxNumber || '',
      commercialRegistration: salon?.commercialRegistration || '',
      idScheme: 'CRN',
      address: {
        street: salon?.address?.street || salon?.street || '',
        buildingNumber: salon?.address?.buildingNumber || salon?.buildingNumber || '0000',
        city: salon?.address?.city || salon?.city || '',
        district: salon?.address?.district || salon?.district || '',
        postalCode: salon?.address?.postalCode || salon?.postalCode || '00000',
        country: 'SA',
      },
    };

    return {
      invoiceNumber: invoice.invoiceNumber || `INV-${Date.now()}`,
      uuid: invoice.id || randomUUID(),
      issueDate: new Date(invoice.createdAt).toISOString().split('T')[0],
      issueTime: new Date(invoice.createdAt).toISOString().split('T')[1]?.substring(0, 8) ?? '00:00:00',
      invoiceType: '388',
      invoiceSubType: isSimplified ? '0200000' : '0100000',
      currency: 'SAR',
      seller,
      buyer: invoice.client
        ? {
            name: invoice.client.fullName || undefined,
            vatNumber: invoice.client.taxNumber || undefined,
          }
        : undefined,
      lines,
      totalBeforeVat,
      totalVat,
      totalWithVat: totalBeforeVat + totalVat,
      invoiceCounterValue: counterValue,
      previousInvoiceHash: previousHash,
      supplyDate: new Date(invoice.createdAt).toISOString().split('T')[0],
      paymentMeansCode: '10', // Default to cash
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Queries
  // ═══════════════════════════════════════════════════════════════════════════

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
}
