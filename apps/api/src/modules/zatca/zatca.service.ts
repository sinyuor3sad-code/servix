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
 * ZATCA Phase 2 Service — Production-grade
 *
 * Full onboarding flow per ZATCA Sandbox v2.1.1:
 *   Step 1: Compliance CSID    (API #3) — CSR + OTP → temporary certificate
 *   Step 2: Compliance Checks  (API #6) — send test invoices → PASS/FAIL
 *   Step 3: Production CSID    (API #4) — request ID → production certificate
 *   Step 4: Reporting/Clearance (API #1/#2) — send real invoices
 */
@Injectable()
export class ZatcaService implements OnModuleInit {
  private readonly logger = new Logger(ZatcaService.name);
  private readonly baseUrl: string;

  // In-memory credential cache (production: use encrypted DB storage)
  private readonly credentials = new Map<string, ZatcaCredentials>();

  // Circuit breakers for each API call
  private onboardComplianceBreaker!: CircuitBreaker<[string, string], any>;
  private onboardProductionBreaker!: CircuitBreaker<[string, any], any>;
  private reportingBreaker!: CircuitBreaker<[string, ZatcaCredentials, SignedInvoice], any>;

  /**
   * ZATCA API environments:
   *   developer-portal — Swagger testing (default for development)
   *   simulation       — Pre-production UAT (full flow without legal impact)
   *   core             — Live production (legally binding invoices)
   *
   * Set via ZATCA_API_URL env variable.
   */
  constructor(
    private readonly configService: ConfigService,
    private readonly cryptoService: ZatcaCryptoService,
    private readonly xmlBuilder: ZatcaXmlBuilder,
    private readonly encryptionService: EncryptionService,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {
    const env = this.configService.get<string>('ZATCA_ENV', 'developer-portal');
    this.baseUrl = this.configService.get<string>(
      'ZATCA_API_URL',
      `https://gw-fatoora.zatca.gov.sa/e-invoicing/${env}`,
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

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 1: Full Onboarding (3-step flow per ZATCA spec)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Onboard a tenant device with ZATCA.
   *
   * Flow:
   *   1. Generate CSR + send to Compliance CSID API (API #3)
   *   2. Run compliance checks — send 3 test invoices (API #6)
   *   3. Request Production CSID (API #4)
   *   4. Store encrypted credentials
   */
  async onboardDevice(
    tenantId: string,
    tenantName: string,
    otp: string,
    tenantInfo?: {
      vatNumber?: string;
      commercialRegistration?: string;
      street?: string;
      buildingNumber?: string;
      city?: string;
      district?: string;
      postalCode?: string;
      invoiceType?: string;  // TSCZ binary (e.g., '1100')
      industry?: string;     // e.g., 'Beauty & Wellness'
    },
  ): Promise<{ status: string; requestId: string; complianceResults?: any[] }> {
    this.logger.log(`Onboarding tenant ${tenantId} with ZATCA...`);

    // 1. Generate CSR with ECDSA secp256k1 key + all ZATCA-required fields
    const { privateKey, publicKey, csr } = this.cryptoService.generateCSR({
      commonName: `SERVIX-${tenantId}`,
      organizationName: tenantName,
      countryCode: 'SA',
      serialNumber: `1-SERVIX|2-1.0|3-${Date.now()}`,
      organizationIdentifier: tenantInfo?.vatNumber || '300000000000003',
      organizationUnit: tenantInfo?.commercialRegistration || 'SERVIX EGS Unit',
      invoiceType: tenantInfo?.invoiceType || '1100', // Standard + Simplified
      location: tenantInfo?.city || 'Riyadh',
      industry: tenantInfo?.industry || 'Services',
    });

    try {
      // ── Step 1: Compliance CSID (API #3) ──
      this.logger.log(`[${tenantId}] Step 1/3: Requesting Compliance CSID...`);
      const complianceData = await this.onboardComplianceBreaker.fire(
        Buffer.from(csr).toString('base64'),
        otp,
      );

      const complianceAuth = `Basic ${Buffer.from(
        `${complianceData.binarySecurityToken}:${complianceData.secret}`,
      ).toString('base64')}`;

      this.logger.log(
        `[${tenantId}] Step 1/3 ✅ Compliance CSID received: ${complianceData.requestID}`,
      );

      // ── Step 2: Compliance Checks (API #6) ──
      this.logger.log(`[${tenantId}] Step 2/3: Running compliance checks...`);
      const complianceResults = await this.runComplianceChecks(
        tenantId,
        tenantName,
        privateKey,
        complianceAuth,
        complianceData.binarySecurityToken,
        tenantInfo,
      );

      // Check if all compliance checks passed
      const allPassed = complianceResults.every(
        (r) => r.status === 'PASS' || r.status === 'WARNING',
      );

      if (!allPassed) {
        const errors = complianceResults
          .filter((r) => r.status === 'ERROR')
          .flatMap((r) => r.errors || []);
        this.logger.error(
          `[${tenantId}] Step 2/3 ❌ Compliance checks failed`,
          errors,
        );
        throw new BadRequestException({
          message: 'فشل فحص الامتثال — يرجى مراجعة الأخطاء',
          errors,
        });
      }

      this.logger.log(`[${tenantId}] Step 2/3 ✅ All compliance checks passed`);

      // ── Step 3: Production CSID (API #4) ──
      this.logger.log(`[${tenantId}] Step 3/3: Requesting Production CSID...`);
      const productionData = await this.onboardProductionBreaker.fire(
        complianceData.requestID,
        complianceAuth,
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

      this.logger.log(
        `[${tenantId}] Step 3/3 ✅ Production CSID received — onboarding complete!`,
      );

      return {
        status: 'active',
        requestId: creds.requestId,
        complianceResults,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`ZATCA onboarding failed for ${tenantId}`, error);
      throw new BadRequestException(
        'فشل تسجيل الجهاز مع هيئة الزكاة — تأكد من صحة OTP',
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 2: Compliance Checks — API #6
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Run compliance checks by sending test invoices to ZATCA.
   *
   * Per ZATCA spec, we must send at least:
   *   1. Standard tax invoice (388, subtype 0100000)
   *   2. Simplified tax invoice (388, subtype 0200000)
   *   3. Credit note (381)
   *
   * Returns array of results for each test invoice.
   */
  private async runComplianceChecks(
    tenantId: string,
    tenantName: string,
    privateKey: string,
    authHeader: string,
    certificate: string,
    tenantInfo?: {
      vatNumber?: string;
      commercialRegistration?: string;
      street?: string;
      buildingNumber?: string;
      city?: string;
      district?: string;
      postalCode?: string;
    },
  ): Promise<Array<{ type: string; status: string; errors?: string[] }>> {
    const results: Array<{ type: string; status: string; errors?: string[] }> = [];

    // Build seller data from tenant info
    const seller = {
      name: tenantName,
      vatNumber: tenantInfo?.vatNumber || '300000000000003',
      commercialRegistration: tenantInfo?.commercialRegistration || '1010000000',
      idScheme: 'CRN' as const,
      address: {
        street: tenantInfo?.street || 'Test Street',
        buildingNumber: tenantInfo?.buildingNumber || '1234',
        city: tenantInfo?.city || 'Riyadh',
        district: tenantInfo?.district || 'Test District',
        postalCode: tenantInfo?.postalCode || '12345',
        country: 'SA' as const,
      },
    };

    // ── Test 1: Standard Tax Invoice (0100000) ──
    const standardInvoice = this.buildTestInvoice(seller, {
      invoiceType: '388',
      invoiceSubType: '0100000',
      counterValue: 1,
      buyer: {
        name: 'Test Buyer',
        vatNumber: '300000000000003',
        id: '300000000000003',
        idScheme: 'TIN',
      },
    });

    results.push(
      await this.submitComplianceInvoice(
        'standard-tax',
        standardInvoice,
        privateKey,
        authHeader,
        certificate,
        '1', // Clearance-Status = 1 for standard
      ),
    );

    // ── Test 2: Simplified Tax Invoice (0200000) ──
    const simplifiedInvoice = this.buildTestInvoice(seller, {
      invoiceType: '388',
      invoiceSubType: '0200000',
      counterValue: 2,
      previousHash: this.cryptoService.hashInvoice(
        this.xmlBuilder.buildInvoiceXml(standardInvoice),
      ),
    });

    results.push(
      await this.submitComplianceInvoice(
        'simplified-tax',
        simplifiedInvoice,
        privateKey,
        authHeader,
        certificate,
        '0', // Clearance-Status = 0 for simplified
      ),
    );

    // ── Test 3: Credit Note (381) ──
    const creditNote = this.buildTestInvoice(seller, {
      invoiceType: '381',
      invoiceSubType: '0200000',
      counterValue: 3,
      previousHash: this.cryptoService.hashInvoice(
        this.xmlBuilder.buildInvoiceXml(simplifiedInvoice),
      ),
      billingReferenceId: standardInvoice.invoiceNumber,
      debitCreditNoteReason: 'إرجاع خدمة — اختبار امتثال',
    });

    results.push(
      await this.submitComplianceInvoice(
        'credit-note',
        creditNote,
        privateKey,
        authHeader,
        certificate,
        '0',
      ),
    );

    return results;
  }

  /**
   * Submit a single test invoice for compliance checking.
   */
  private async submitComplianceInvoice(
    testType: string,
    invoiceData: ZatcaInvoiceData,
    privateKey: string,
    authHeader: string,
    certificate: string,
    clearanceStatus: '0' | '1',
  ): Promise<{ type: string; status: string; errors?: string[] }> {
    try {
      // Build, sign, and embed QR
      const xml = this.xmlBuilder.buildInvoiceXml(invoiceData);
      const invoiceHash = this.cryptoService.hashInvoice(xml);
      const invoiceHashBinary = this.cryptoService.hashInvoiceBinary(xml);
      const signature = this.cryptoService.signData(xml, privateKey);
      const signatureBinary = this.cryptoService.signDataBinary(xml, privateKey);

      let signedXml = this.cryptoService.embedSignature(
        xml, signature, invoiceHash, certificate,
      );

      // Extract public key from certificate for QR
      const certInfo = this.cryptoService.parseCertificateInfo(certificate);
      const qrBase64 = this.cryptoService.generateTLV({
        sellerName: invoiceData.seller.name,
        vatNumber: invoiceData.seller.vatNumber,
        timestamp: `${invoiceData.issueDate}T${invoiceData.issueTime}`,
        totalWithVat: invoiceData.totalWithVat.toFixed(2),
        vatAmount: invoiceData.totalVat.toFixed(2),
        invoiceHash: invoiceHashBinary,
        signature: signatureBinary,
        publicKey: certInfo.publicKey,
      });

      signedXml = this.cryptoService.injectQrCode(signedXml, qrBase64);

      // Submit to compliance API
      const res = await axios.post(
        `${this.baseUrl}/compliance/invoices`,
        {
          invoiceHash,
          uuid: invoiceData.uuid,
          invoice: Buffer.from(signedXml).toString('base64'),
        },
        {
          headers: {
            Authorization: authHeader,
            'Clearance-Status': clearanceStatus,
            'Accept-Version': 'V2',
            'Content-Type': 'application/json',
            'Accept-Language': 'ar',
          },
        },
      );

      const status = res.data?.validationResults?.status || 'UNKNOWN';
      const errors = (res.data?.validationResults?.errorMessages || []).map(
        (m: any) => `[${m.code}] ${m.message}`,
      );

      this.logger.log(`Compliance check [${testType}]: ${status}`);

      return { type: testType, status, errors: errors.length > 0 ? errors : undefined };
    } catch (error: any) {
      const errorData = error.response?.data;
      const errors = (errorData?.validationResults?.errorMessages || []).map(
        (m: any) => `[${m.code}] ${m.message}`,
      );

      this.logger.error(`Compliance check [${testType}] failed`, errorData || error.message);

      return {
        type: testType,
        status: 'ERROR',
        errors: errors.length > 0 ? errors : [error.message || 'Unknown error'],
      };
    }
  }

  /**
   * Build a test invoice for compliance checks.
   */
  private buildTestInvoice(
    seller: ZatcaInvoiceData['seller'],
    opts: {
      invoiceType: '388' | '381' | '383';
      invoiceSubType: string;
      counterValue: number;
      previousHash?: string;
      buyer?: ZatcaInvoiceData['buyer'];
      billingReferenceId?: string;
      debitCreditNoteReason?: string;
    },
  ): ZatcaInvoiceData {
    const now = new Date();
    const amount = 100;
    const vatAmount = 15;

    return {
      invoiceNumber: `COMPLIANCE-${opts.counterValue}-${Date.now()}`,
      uuid: randomUUID(),
      issueDate: now.toISOString().split('T')[0],
      issueTime: now.toISOString().split('T')[1].split('.')[0],
      invoiceType: opts.invoiceType,
      invoiceSubType: opts.invoiceSubType,
      currency: 'SAR',
      seller,
      buyer: opts.buyer,
      lines: [
        {
          lineNumber: 1,
          serviceName: 'خدمة اختبار امتثال',
          quantity: 1,
          unitCode: 'EA',
          unitPrice: amount,
          amount,
          vatCategory: 'S',
          vatRate: 15,
          vatAmount,
        },
      ],
      totalBeforeVat: amount,
      totalVat: vatAmount,
      totalWithVat: amount + vatAmount,
      invoiceCounterValue: opts.counterValue,
      previousInvoiceHash: opts.previousHash || ZatcaCryptoService.INITIAL_PREVIOUS_HASH,
      supplyDate: now.toISOString().split('T')[0],
      paymentMeansCode: '10',
      billingReferenceId: opts.billingReferenceId,
      debitCreditNoteReason: opts.debitCreditNoteReason,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 4: Generate, sign, and report/clear an invoice
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generate, sign, and submit an invoice to ZATCA.
   *
   * Automatically chooses:
   *   - Reporting API (simplified invoices, Clearance-Status: 0)
   *   - Clearance API (standard/tax invoices, Clearance-Status: 1)
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
    const invoiceHashBinary = this.cryptoService.hashInvoiceBinary(xml);
    const privateKey = this.encryptionService.decrypt(creds.privateKey);
    const signature = this.cryptoService.signData(xml, privateKey);
    const signatureBinary = this.cryptoService.signDataBinary(xml, privateKey);

    // 3. Embed signature with certificate
    let signedXml = this.cryptoService.embedSignature(xml, signature, invoiceHash, creds.certificate);

    // 4. Generate QR code TLV (binary for tags 6-9)
    const certInfo = this.cryptoService.parseCertificateInfo(creds.certificate);
    const qrBase64 = this.cryptoService.generateTLV({
      sellerName: invoiceData.seller.name,
      vatNumber: invoiceData.seller.vatNumber,
      timestamp: `${invoiceData.issueDate}T${invoiceData.issueTime}`,
      totalWithVat: invoiceData.totalWithVat.toFixed(2),
      vatAmount: invoiceData.totalVat.toFixed(2),
      invoiceHash: invoiceHashBinary,
      signature: signatureBinary,
      publicKey: certInfo.publicKey,
    });

    // 5. Inject QR into XML
    signedXml = this.cryptoService.injectQrCode(signedXml, qrBase64);

    const signedInvoice: SignedInvoice = {
      signedXml,
      invoiceHash,
      signature,
      qrBase64,
      uuid: invoiceData.uuid,
      certificateUsed: creds.certificate,
    };

    // 6. Choose API based on invoice type
    const isStandard = invoiceData.invoiceSubType.startsWith('01');
    const response = isStandard
      ? await this.clearWithZatca(tenantId, signedInvoice)
      : await this.reportToZatca(tenantId, signedInvoice);

    return { response, signedInvoice };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Reporting API (#1) — Simplified invoices
  // ═══════════════════════════════════════════════════════════════════════════

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
        `ZATCA reporting for ${signedInvoice.uuid}: ${data.validationResults?.status}`,
      );
      return data;
    } catch (error) {
      this.logger.error('ZATCA reporting failed', error);
      return this.buildErrorResponse('فشل إرسال الفاتورة المبسطة');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Clearance API (#2) — Standard/Tax invoices
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Submit a standard (tax) invoice for clearance.
   * ZATCA returns the invoice with their stamp + QR code.
   */
  private async clearWithZatca(
    tenantId: string,
    signedInvoice: SignedInvoice,
  ): Promise<ZatcaResponse> {
    const creds = this.credentials.get(tenantId);
    if (!creds) throw new Error('No ZATCA credentials');

    const authHeader = `Basic ${Buffer.from(
      `${creds.certificate}:${creds.secret}`,
    ).toString('base64')}`;

    try {
      const res = await axios.post(
        `${this.baseUrl}/invoices/clearance/single`,
        {
          invoiceHash: signedInvoice.invoiceHash,
          uuid: signedInvoice.uuid,
          invoice: Buffer.from(signedInvoice.signedXml).toString('base64'),
        },
        {
          headers: {
            Authorization: authHeader,
            'Clearance-Status': '1',
            'Accept-Version': 'V2',
            'Content-Type': 'application/json',
            'Accept-Language': 'ar',
          },
        },
      );

      this.logger.log(
        `ZATCA clearance for ${signedInvoice.uuid}: ${res.data?.validationResults?.status}`,
      );
      return res.data;
    } catch (error) {
      this.logger.error('ZATCA clearance failed', error);
      return this.buildErrorResponse('فشل اعتماد الفاتورة الضريبية');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Raw HTTP calls invoked by circuit breakers
  // ═══════════════════════════════════════════════════════════════════════════

  /** API #3: Compliance CSID */
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

  /** API #4: Production CSID */
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

  /** API #1: Reporting (simplified invoices) */
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
          'Clearance-Status': '0',
          'Accept-Version': 'V2',
          'Content-Type': 'application/json',
          'Accept-Language': 'ar',
        },
      },
    );
    return res.data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  private buildErrorResponse(message: string): ZatcaResponse {
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
            message,
            status: 'ERROR',
          },
        ],
      },
    };
  }

  /**
   * Build ZatcaInvoiceData from SERVIX invoice format
   */
  buildInvoiceData(
    invoice: any,
    tenant: any,
    items: any[],
    counterValue = 1,
    previousHash = ZatcaCryptoService.INITIAL_PREVIOUS_HASH,
  ): ZatcaInvoiceData {
    const totalBeforeVat = items.reduce((sum, i) => sum + i.amount, 0);
    const totalVat = +(totalBeforeVat * 0.15).toFixed(2);

    return {
      invoiceNumber: invoice.invoiceNumber || `INV-${Date.now()}`,
      uuid: invoice.id || randomUUID(),
      issueDate: new Date(invoice.createdAt).toISOString().split('T')[0],
      issueTime: new Date(invoice.createdAt).toISOString().split('T')[1].split('.')[0],
      invoiceType: '388',
      invoiceSubType: '0200000',
      currency: 'SAR',
      seller: {
        name: tenant.nameAr || tenant.nameEn,
        vatNumber: tenant.vatNumber || '',
        commercialRegistration: tenant.commercialRegistration || '',
        idScheme: 'CRN',
        address: {
          street: tenant.address?.street || '',
          buildingNumber: tenant.address?.buildingNumber || '0000',
          city: tenant.address?.city || '',
          district: tenant.address?.district || '',
          postalCode: tenant.address?.postalCode || '00000',
          country: 'SA',
        },
      },
      lines: items.map((item, idx) => ({
        lineNumber: idx + 1,
        serviceName: item.name || item.serviceName,
        quantity: item.quantity || 1,
        unitCode: 'EA',
        unitPrice: item.price || item.unitPrice,
        amount: item.amount,
        vatCategory: 'S' as const,
        vatRate: 15,
        vatAmount: +(item.amount * 0.15).toFixed(2),
      })),
      totalBeforeVat,
      totalVat,
      totalWithVat: totalBeforeVat + totalVat,
      invoiceCounterValue: counterValue,
      previousInvoiceHash: previousHash,
      supplyDate: new Date(invoice.createdAt).toISOString().split('T')[0],
      paymentMeansCode: '10',
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
