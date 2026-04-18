import { Injectable, Logger, BadRequestException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type CircuitBreaker from 'opossum';
import { randomUUID } from 'crypto';
import { ZatcaCryptoService } from './zatca-crypto.service';
import { ZatcaXmlBuilder } from './zatca-xml.builder';
import {
  ZatcaCredentials,
  ZatcaInvoiceData,
  ZatcaResponse,
  SignedInvoice,
} from './zatca.types';
import { EncryptionService } from '../../shared/encryption/encryption.service';
import { CircuitBreakerService } from '../../shared/resilience/circuit-breaker.service';

/**
 * ZATCA Phase 2 Service
 * Handles device onboarding, invoice generation, signing, and reporting.
 */
@Injectable()
export class ZatcaService implements OnModuleInit {
  private readonly logger = new Logger(ZatcaService.name);
  private readonly baseUrl: string;

  // In-memory credential cache (production: use encrypted DB storage)
  private readonly credentials = new Map<string, ZatcaCredentials>();

  // Separate breakers for onboarding vs reporting — onboarding is rare and
  // can tolerate a longer timeout; reporting happens per-invoice and must be
  // fast-failing so cashiers don't wait.
  private onboardComplianceBreaker!: CircuitBreaker<[string, string], any>;
  private onboardProductionBreaker!: CircuitBreaker<[string, any], any>;
  private reportingBreaker!: CircuitBreaker<[string, ZatcaCredentials, SignedInvoice], any>;

  constructor(
    private readonly configService: ConfigService,
    private readonly cryptoService: ZatcaCryptoService,
    private readonly xmlBuilder: ZatcaXmlBuilder,
    private readonly encryptionService: EncryptionService,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {
    this.baseUrl = this.configService.get<string>(
      'ZATCA_API_URL',
      'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal',
    );
  }

  onModuleInit() {
    this.onboardComplianceBreaker = this.circuitBreaker.createBreaker(
      'zatca-onboard-compliance',
      (csrBase64: string, otp: string) => this.onboardComplianceRaw(csrBase64, otp),
      { timeout: 30_000, errorThresholdPercentage: 50, resetTimeout: 60_000, volumeThreshold: 3 },
    );

    this.onboardProductionBreaker = this.circuitBreaker.createBreaker(
      'zatca-onboard-production',
      (complianceRequestId: string, authHeader: any) =>
        this.onboardProductionRaw(complianceRequestId, authHeader),
      { timeout: 30_000, errorThresholdPercentage: 50, resetTimeout: 60_000, volumeThreshold: 3 },
    );

    this.reportingBreaker = this.circuitBreaker.createBreaker(
      'zatca-reporting',
      (authHeader: string, creds: ZatcaCredentials, signedInvoice: SignedInvoice) =>
        this.reportToZatcaRaw(authHeader, creds, signedInvoice),
      { timeout: 15_000, errorThresholdPercentage: 50, resetTimeout: 30_000, volumeThreshold: 5 },
    );
  }

  /**
   * Step 1: Onboard a tenant device with ZATCA
   * Requires OTP from ZATCA portal
   */
  async onboardDevice(
    tenantId: string,
    tenantName: string,
    otp: string,
  ): Promise<{ status: string; requestId: string }> {
    this.logger.log(`Onboarding tenant ${tenantId} with ZATCA...`);

    // 1. Generate CSR
    const { privateKey, csr } = this.cryptoService.generateCSR({
      commonName: `SERVIX-${tenantId}`,
      organizationName: tenantName,
      countryCode: 'SA',
      serialNumber: `1-SERVIX|2-${tenantId}|3-${Date.now()}`,
    });

    try {
      // 2. Submit CSR to ZATCA Compliance API (through breaker)
      const complianceData = await this.onboardComplianceBreaker.fire(
        Buffer.from(csr).toString('base64'),
        otp,
      );

      // 3. Request Production CSID (through breaker)
      const authHeader = `Basic ${Buffer.from(
        `${complianceData.binarySecurityToken}:${complianceData.secret}`,
      ).toString('base64')}`;
      const productionData = await this.onboardProductionBreaker.fire(
        complianceData.requestID,
        authHeader,
      );

      // 4. Store credentials (encrypted)
      const creds: ZatcaCredentials = {
        certificate: productionData.binarySecurityToken,
        secret: productionData.secret,
        privateKey: this.encryptionService.encrypt(privateKey),
        requestId: productionData.requestID,
        status: 'active',
      };
      this.credentials.set(tenantId, creds);

      this.logger.log(`Tenant ${tenantId} onboarded with ZATCA successfully`);
      return { status: 'active', requestId: creds.requestId };
    } catch (error) {
      this.logger.error(`ZATCA onboarding failed for ${tenantId}`, error);
      throw new BadRequestException(
        'فشل تسجيل الجهاز مع هيئة الزكاة — تأكد من صحة OTP',
      );
    }
  }

  /**
   * Step 2: Generate, sign, and report an invoice to ZATCA
   */
  async generateAndReport(
    tenantId: string,
    invoiceData: ZatcaInvoiceData,
  ): Promise<{ response: ZatcaResponse; signedInvoice: SignedInvoice }> {
    const creds = this.credentials.get(tenantId);
    if (!creds || creds.status !== 'active') {
      throw new BadRequestException(
        'الصالون غير مسجل في منظومة الفوترة الإلكترونية',
      );
    }

    // 1. Build UBL 2.1 XML
    const xml = this.xmlBuilder.buildInvoiceXml(invoiceData);

    // 2. Hash and sign
    const invoiceHash = this.cryptoService.hashInvoice(xml);
    const privateKey = this.encryptionService.decrypt(creds.privateKey);
    const signature = this.cryptoService.signInvoice(xml, privateKey);

    // 3. Embed signature
    const signedXml = this.cryptoService.embedSignature(xml, signature, invoiceHash);

    // 4. Generate QR code TLV
    const qrBase64 = this.cryptoService.generateTLV({
      sellerName: invoiceData.seller.name,
      vatNumber: invoiceData.seller.vatNumber,
      timestamp: `${invoiceData.issueDate}T${invoiceData.issueTime}`,
      totalWithVat: invoiceData.totalWithVat.toFixed(2),
      vatAmount: invoiceData.totalVat.toFixed(2),
      invoiceHash,
      signature,
      publicKey: creds.certificate,
    });

    const signedInvoice: SignedInvoice = {
      signedXml,
      invoiceHash,
      signature,
      qrBase64,
      uuid: invoiceData.uuid,
    };

    // 5. Report to ZATCA API
    const response = await this.reportToZatca(tenantId, signedInvoice);

    return { response, signedInvoice };
  }

  /**
   * Report signed invoice to ZATCA API (through circuit breaker).
   */
  private async reportToZatca(
    tenantId: string,
    signedInvoice: SignedInvoice,
  ): Promise<ZatcaResponse> {
    const creds = this.credentials.get(tenantId);
    if (!creds) throw new Error('No ZATCA credentials');

    const authHeader = `Basic ${Buffer.from(
      `${creds.certificate}:${creds.secret}`,
    ).toString('base64')}`;

    try {
      const data = await this.reportingBreaker.fire(authHeader, creds, signedInvoice);
      this.logger.log(
        `ZATCA report for ${signedInvoice.uuid}: ${data.validationResults?.status}`,
      );
      return data;
    } catch (error) {
      // Breaker open / upstream dead — return a structured failure so the
      // caller can still persist the local invoice without throwing.
      this.logger.error('ZATCA reporting failed', error);
      return {
        validationResults: {
          status: 'ERROR',
          infoMessages: [],
          warningMessages: [],
          errorMessages: [
            {
              type: 'ERROR',
              code: 'NETWORK',
              category: 'CONNECTIVITY',
              message: 'فشل الاتصال بمنظومة الفوترة',
              status: 'ERROR',
            },
          ],
        },
      };
    }
  }

  // ─────── Raw HTTP calls invoked by breakers ───────

  private async onboardComplianceRaw(csrBase64: string, otp: string): Promise<any> {
    const res = await axios.post(
      `${this.baseUrl}/compliance`,
      { csr: csrBase64 },
      {
        headers: {
          OTP: otp,
          'Accept-Version': 'V2',
          'Content-Type': 'application/json',
        },
      },
    );
    return res.data;
  }

  private async onboardProductionRaw(complianceRequestId: string, authHeader: string): Promise<any> {
    const res = await axios.post(
      `${this.baseUrl}/production/csids`,
      { compliance_request_id: complianceRequestId },
      {
        headers: {
          Authorization: authHeader,
          'Accept-Version': 'V2',
          'Content-Type': 'application/json',
        },
      },
    );
    return res.data;
  }

  private async reportToZatcaRaw(
    authHeader: string,
    _creds: ZatcaCredentials,
    signedInvoice: SignedInvoice,
  ): Promise<any> {
    const res = await axios.post(
      `${this.baseUrl}/invoices/reporting/single`,
      {
        invoiceHash: signedInvoice.invoiceHash,
        uuid: signedInvoice.uuid,
        invoice: Buffer.from(signedInvoice.signedXml).toString('base64'),
      },
      {
        headers: {
          Authorization: authHeader,
          'Clearance-Status': '0', // 0 = reporting, 1 = clearance
          'Accept-Version': 'V2',
          'Content-Type': 'application/json',
          'Accept-Language': 'ar',
        },
      },
    );
    return res.data;
  }

  /**
   * Build ZatcaInvoiceData from SERVIX invoice format
   */
  buildInvoiceData(
    invoice: any,
    tenant: any,
    items: any[],
  ): ZatcaInvoiceData {
    const totalBeforeVat = items.reduce((sum, i) => sum + i.amount, 0);
    const totalVat = totalBeforeVat * 0.15;

    return {
      invoiceNumber: invoice.invoiceNumber || `INV-${Date.now()}`,
      uuid: invoice.id || randomUUID(),
      issueDate: new Date(invoice.createdAt).toISOString().split('T')[0],
      issueTime: new Date(invoice.createdAt).toISOString().split('T')[1].split('.')[0],
      invoiceType: '388', // Standard simplified
      invoiceSubType: '0200000',
      currency: 'SAR',
      seller: {
        name: tenant.nameAr || tenant.nameEn,
        vatNumber: tenant.vatNumber || '',
        commercialRegistration: tenant.commercialRegistration || '',
        address: {
          street: tenant.address?.street || '',
          city: tenant.address?.city || '',
          district: tenant.address?.district || '',
          postalCode: tenant.address?.postalCode || '',
          country: 'SA',
        },
      },
      lines: items.map((item, idx) => ({
        lineNumber: idx + 1,
        serviceName: item.name || item.serviceName,
        quantity: item.quantity || 1,
        unitPrice: item.price || item.unitPrice,
        amount: item.amount,
        vatRate: 15,
        vatAmount: item.amount * 0.15,
      })),
      totalBeforeVat,
      totalVat,
      totalWithVat: totalBeforeVat + totalVat,
    };
  }

  /**
   * Check ZATCA registration status
   */
  getStatus(tenantId: string): { registered: boolean; status: string } {
    const creds = this.credentials.get(tenantId);
    return {
      registered: !!creds,
      status: creds?.status || 'not_registered',
    };
  }
}
