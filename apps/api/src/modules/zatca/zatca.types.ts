/**
 * ZATCA Phase 2 Types — Fully compliant with:
 *   - XML Implementation Standard v1.2 (2023-05-19)
 *   - Security Features Implementation Standards v1.2 (2023-05-19)
 *
 * UBL 2.1 Invoice structure types for Saudi Arabian e-invoicing.
 */

// ─────────────────── Credentials ───────────────────

export interface ZatcaCredentials {
  certificate: string;   // Base64-encoded X.509 certificate
  secret: string;        // Secret from onboarding
  privateKey: string;    // Encrypted ECDSA private key (secp256k1)
  requestId: string;
  status: 'not_registered' | 'compliance' | 'active' | 'revoked';
  expiresAt?: Date;
}

// ─────────────────── Address (BR-KSA-09, BR-KSA-37, BR-KSA-64, BR-KSA-66) ───────────────────

export interface ZatcaAddress {
  street: string;             // BT-35: Street name
  buildingNumber: string;     // KSA-17: 4 digits (BR-KSA-37)
  additionalNumber?: string;  // KSA-23: 4 digits (BR-KSA-64)
  city: string;               // BT-37: City name
  district: string;           // KSA-3: District (CitySubdivisionName)
  postalCode: string;         // BT-38: 5 digits (BR-KSA-66)
  country: 'SA';              // BT-40: Country code
  additionalStreet?: string;  // BT-36: Additional street name
  region?: string;            // BT-39: Country subdivision
}

// ─────────────────── Seller / Buyer ───────────────────

/** BR-KSA-08: Seller identification scheme IDs */
export type SellerIdScheme = 'CRN' | 'MOM' | 'MLS' | '700' | 'SAG' | 'OTH';

/** BR-KSA-14: Buyer identification scheme IDs */
export type BuyerIdScheme = 'TIN' | 'CRN' | 'MOM' | 'MLS' | '700' | 'SAG' | 'NAT' | 'GCC' | 'IQA' | 'PAS' | 'OTH';

export interface ZatcaSeller {
  name: string;                           // BT-27: Legal name
  vatNumber: string;                      // BT-31: 15 digits, starts & ends with '3'
  commercialRegistration: string;         // BT-29: Seller ID value
  idScheme: SellerIdScheme;               // BT-29-1: Scheme ID
  address: ZatcaAddress;
}

export interface ZatcaBuyer {
  name?: string;                          // BT-44: Buyer name (mandatory for tax invoices)
  vatNumber?: string;                     // BT-48: 15 digits if SA
  id?: string;                            // BT-46: Other buyer ID
  idScheme?: BuyerIdScheme;               // BT-46-1: Scheme ID
  address?: Partial<ZatcaAddress>;        // BG-8: Buyer address
}

// ─────────────────── Invoice Line ───────────────────

/** VAT Category codes (UN/CEFACT 5305) */
export type VatCategoryCode = 'S' | 'Z' | 'E' | 'O';

export interface ZatcaInvoiceLine {
  lineNumber: number;              // BT-126: Invoice line identifier
  serviceName: string;             // BT-153: Item name
  quantity: number;                // BT-129: Invoiced quantity
  unitCode?: string;               // BT-130: Unit of measure (default 'EA')
  unitPrice: number;               // BT-146: Item net price
  amount: number;                  // BT-131: Line net amount
  vatCategory: VatCategoryCode;    // BT-151: VAT category code
  vatRate: number;                 // BT-152: VAT rate (e.g. 15)
  vatAmount: number;               // KSA-11: Line VAT amount
  discountAmount?: number;         // BT-136: Line allowance amount
  discountReason?: string;         // BT-139: Allowance reason
  chargeAmount?: number;           // BT-141: Line charge amount
  chargeReason?: string;           // BT-144: Charge reason
}

// ─────────────────── Invoice Types (Section 11.2.1) ───────────────────

/** BT-3: Invoice type codes per UN/CEFACT 1001 */
export type InvoiceTypeCode = '388' | '381' | '383' | '386';

/**
 * KSA-2: Invoice subtype (7 characters: NNPNESB)
 *   NN = 01 (tax) or 02 (simplified)
 *   P  = 3rd party (0/1)
 *   N  = Nominal (0/1)
 *   E  = Export (0/1)
 *   S  = Summary (0/1)
 *   B  = Self-billed (0/1)
 */
export type InvoiceSubType = string;

// ─────────────────── Payment (Section 11.2.5) ───────────────────

/** BT-81: Payment means codes per UN/CEFACT 4461 */
export type PaymentMeansCode = '10' | '30' | '42' | '48' | '1';

// ─────────────────── VAT Exemption Reasons (Section 11.2.4) ───────────────────

export type VatExemptionReasonCode =
  | 'VATEX-SA-29' | 'VATEX-SA-29-7' | 'VATEX-SA-30'       // Exempt (E)
  | 'VATEX-SA-32' | 'VATEX-SA-33' | 'VATEX-SA-34-1'       // Zero-rated (Z)
  | 'VATEX-SA-34-2' | 'VATEX-SA-34-3' | 'VATEX-SA-34-4'
  | 'VATEX-SA-34-5' | 'VATEX-SA-35' | 'VATEX-SA-36'
  | 'VATEX-SA-EDU' | 'VATEX-SA-HEA' | 'VATEX-SA-MLTRY'
  | 'VATEX-SA-OOS';                                        // Not subject (O)

// ─────────────────── Invoice Data ───────────────────

export interface ZatcaInvoiceData {
  invoiceNumber: string;                    // BT-1: Sequential invoice number
  uuid: string;                             // KSA-1: UUID v4
  issueDate: string;                        // BT-2: YYYY-MM-DD
  issueTime: string;                        // KSA-25: HH:mm:ss
  invoiceType: InvoiceTypeCode;             // BT-3
  invoiceSubType: InvoiceSubType;           // KSA-2
  currency: 'SAR';                          // BT-5

  seller: ZatcaSeller;
  buyer?: ZatcaBuyer;

  lines: ZatcaInvoiceLine[];

  // Totals
  totalBeforeVat: number;                   // BT-109
  totalVat: number;                         // BT-110
  totalWithVat: number;                     // BT-112
  payableAmount?: number;                   // BT-115 (defaults to totalWithVat)
  discountTotal?: number;                   // BT-107
  chargeTotal?: number;                     // BT-108
  prepaidAmount?: number;                   // BT-113

  // Payment (BR-KSA-16)
  paymentMeansCode?: PaymentMeansCode;      // BT-81

  // Supply date (BR-KSA-15, BR-KSA-35)
  supplyDate?: string;                      // KSA-5: Actual delivery date
  supplyEndDate?: string;                   // KSA-24: Latest delivery date

  // Billing reference for credit/debit notes (BR-KSA-56)
  billingReferenceId?: string;              // BT-25: Referenced invoice number
  debitCreditNoteReason?: string;           // KSA-10: Reason for issuing

  // Invoice chain (BR-KSA-33, BR-KSA-26, BR-KSA-61)
  invoiceCounterValue: number;              // KSA-16: Sequential counter
  previousInvoiceHash: string;              // KSA-13: Base64 SHA-256 hash

  // VAT exemption at document level
  vatExemptionReasonCode?: VatExemptionReasonCode;  // BT-121
  vatExemptionReasonText?: string;                   // BT-120
}

// ─────────────────── Signed Invoice ───────────────────

export interface SignedInvoice {
  signedXml: string;       // Complete XML with embedded XAdES signature
  invoiceHash: string;     // SHA-256 hash (base64)
  signature: string;       // ECDSA signature (base64)
  qrBase64: string;        // TLV-encoded QR payload (base64)
  uuid: string;            // Invoice UUID
  certificateUsed: string; // Base64 certificate for audit trail
}

// ─────────────────── ZATCA API Response ───────────────────

export interface ZatcaResponse {
  validationResults: {
    status: 'PASS' | 'WARNING' | 'ERROR';
    infoMessages: ZatcaMessage[];
    warningMessages: ZatcaMessage[];
    errorMessages: ZatcaMessage[];
  };
  reportingStatus?: string;
  clearanceStatus?: string;
}

export interface ZatcaMessage {
  type: string;
  code: string;
  category: string;
  message: string;
  status: string;
}

// ─────────────────── QR TLV Data (Security Features Sec.4, Table 3) ───────────────────

export interface ZatcaTlvData {
  sellerName: string;             // Tag 1: UTF-8
  vatNumber: string;              // Tag 2: UTF-8
  timestamp: string;              // Tag 3: ISO 8601 UTF-8
  totalWithVat: string;           // Tag 4: UTF-8
  vatAmount: string;              // Tag 5: UTF-8
  invoiceHash: Buffer;            // Tag 6: SHA-256 binary (32 bytes)
  signature: Buffer;              // Tag 7: ECDSA signature binary
  publicKey: Buffer;              // Tag 8: ECDSA public key binary
  certificateStamp?: Buffer;      // Tag 9: ZATCA CA stamp binary (simplified only)
}
