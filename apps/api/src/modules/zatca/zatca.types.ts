/**
 * ZATCA Phase 2 Types
 * UBL 2.1 Invoice structure types for Saudi Arabian e-invoicing.
 */

export interface ZatcaCredentials {
  certificate: string;
  secret: string;
  privateKey: string; // encrypted
  requestId: string;
  status: 'not_registered' | 'compliance' | 'active' | 'revoked';
  expiresAt?: Date;
}

export interface ZatcaInvoiceLine {
  lineNumber: number;
  serviceName: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  vatRate: number;       // 15% standard
  vatAmount: number;
  discountAmount?: number;
}

export interface ZatcaInvoiceData {
  invoiceNumber: string;
  uuid: string;
  issueDate: string;     // YYYY-MM-DD
  issueTime: string;     // HH:mm:ss
  invoiceType: '388' | '381' | '383'; // standard | credit | debit
  invoiceSubType: string; // e.g. '0200000' simplified
  currency: 'SAR';
  
  // Seller (Salon)
  seller: {
    name: string;
    vatNumber: string;
    commercialRegistration: string;
    address: {
      street: string;
      city: string;
      district: string;
      postalCode: string;
      country: 'SA';
    };
  };

  // Buyer (optional for simplified invoices)
  buyer?: {
    name: string;
    vatNumber?: string;
  };

  lines: ZatcaInvoiceLine[];
  
  // Totals
  totalBeforeVat: number;
  totalVat: number;
  totalWithVat: number;
  discountTotal?: number;
}

export interface SignedInvoice {
  signedXml: string;
  invoiceHash: string;
  signature: string;
  qrBase64: string;
  uuid: string;
}

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

export interface ZatcaTlvData {
  sellerName: string;
  vatNumber: string;
  timestamp: string;
  totalWithVat: string;
  vatAmount: string;
  invoiceHash: string;
  signature: string;
  publicKey: string;
}
