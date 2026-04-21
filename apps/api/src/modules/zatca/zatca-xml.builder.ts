import { Injectable, Logger } from '@nestjs/common';
import {
  ZatcaInvoiceData,
  ZatcaInvoiceLine,
  ZatcaBuyer,
  ZatcaAddress,
  VatCategoryCode,
} from './zatca.types';

/**
 * ZATCA UBL 2.1 XML Invoice Builder
 *
 * Generates ZATCA-compliant XML invoices per:
 *   - XML Implementation Standard v1.2 (2023-05-19)
 *   - EN 16931 / UBL 2.1
 *
 * Covers all mandatory business rules:
 *   BR-02..BR-55, BR-CO-04..BR-CO-18, BR-S/Z/E/O,
 *   BR-KSA-03..BR-KSA-83, BR-DEC-*, BR-KSA-F-*
 */
@Injectable()
export class ZatcaXmlBuilder {
  private readonly logger = new Logger(ZatcaXmlBuilder.name);

  /**
   * Build a complete UBL 2.1 XML invoice.
   * The XML is returned *without* the cryptographic stamp (UBLExtensions / ds:Signature) —
   * those are added later by the crypto service after hashing and signing.
   */
  buildInvoiceXml(data: ZatcaInvoiceData): string {
    const xml = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"`,
      `         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"`,
      `         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"`,
      `         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">`,
      ``,
      // ── Header fields ──
      `  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>`,                            // BR-KSA-EN16931-01
      `  <cbc:ID>${this.esc(data.invoiceNumber)}</cbc:ID>`,                         // BR-02 (BT-1)
      `  <cbc:UUID>${data.uuid}</cbc:UUID>`,                                         // BR-KSA-03 (KSA-1)
      `  <cbc:IssueDate>${data.issueDate}</cbc:IssueDate>`,                         // BR-03 (BT-2)
      `  <cbc:IssueTime>${data.issueTime}</cbc:IssueTime>`,                         // BR-KSA-70 (KSA-25)
      `  <cbc:InvoiceTypeCode name="${data.invoiceSubType}">${data.invoiceType}</cbc:InvoiceTypeCode>`, // BR-04, BR-KSA-06
      data.debitCreditNoteReason ? `  <cbc:Note>${this.esc(data.debitCreditNoteReason)}</cbc:Note>` : '',
      `  <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>`,                 // BR-05 (BT-5)
      `  <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>`,                           // BR-KSA-68, BR-KSA-EN16931-02
      ``,
      // ── Invoice counter (KSA-16) ──
      this.buildAdditionalDocRef('ICV', String(data.invoiceCounterValue)),
      // ── Previous invoice hash (KSA-13) ──
      this.buildAdditionalDocRef('PIH', data.previousInvoiceHash, 'text/plain'),
      // ── QR placeholder — filled after signing ──
      this.buildAdditionalDocRef('QR', '', 'text/plain'),
      ``,
      // ── Signature placeholder (BR-KSA-28/29/30) ──
      `  <cac:Signature>`,
      `    <cbc:ID>urn:oasis:names:specification:ubl:signature:Invoice</cbc:ID>`,
      `    <cbc:SignatureMethod>urn:oasis:names:specification:ubl:dsig:enveloped:xades</cbc:SignatureMethod>`,
      `  </cac:Signature>`,
      ``,
      // ── Billing reference for credit/debit notes (BR-KSA-56) ──
      this.buildBillingReference(data),
      // ── Supply date (BR-KSA-15) ──
      this.buildDelivery(data),
      // ── Payment means (BR-KSA-16) ──
      this.buildPaymentMeans(data),
      ``,
      // ── Seller (BR-06, BR-08, BR-KSA-08, BR-KSA-09, BR-KSA-39) ──
      this.buildSupplierParty(data),
      // ── Buyer (BR-10, BR-KSA-10, BR-KSA-42) ──
      this.buildCustomerParty(data),
      ``,
      // ── Allowances on document level (BG-20) ──
      this.buildDocumentAllowances(data),
      // ── Charges on document level (BG-21) ──
      this.buildDocumentCharges(data),
      ``,
      // ── Tax totals (BR-CO-14, BR-CO-18) ──
      this.buildTaxTotal(data),
      // ── Tax total in accounting currency (BR-KSA-EN16931-09) ──
      this.buildTaxTotalAccounting(data),
      ``,
      // ── Monetary totals (BR-13..BR-15, BR-CO-10..BR-CO-16) ──
      this.buildLegalMonetaryTotal(data),
      ``,
      // ── Invoice lines (BR-16..BR-26, BR-CO-04, BR-KSA-50..BR-KSA-53) ──
      ...data.lines.map((line) => this.buildInvoiceLine(line, data)),
      ``,
      `</Invoice>`,
    ];

    const result = xml.filter((l) => l !== '').join('\n');
    this.logger.debug(`Built UBL 2.1 XML for invoice ${data.invoiceNumber}`);
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Additional Document References
  // ═══════════════════════════════════════════════════════════════════════════

  private buildAdditionalDocRef(id: string, value: string, mimeCode?: string): string {
    const mime = mimeCode ? ` mimeCode="${mimeCode}"` : '';
    return [
      `  <cac:AdditionalDocumentReference>`,
      `    <cbc:ID>${id}</cbc:ID>`,
      value
        ? `    <cac:Attachment><cbc:EmbeddedDocumentBinaryObject${mime}>${value}</cbc:EmbeddedDocumentBinaryObject></cac:Attachment>`
        : `    <cac:Attachment><cbc:EmbeddedDocumentBinaryObject${mime}></cbc:EmbeddedDocumentBinaryObject></cac:Attachment>`,
      `  </cac:AdditionalDocumentReference>`,
    ].join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Billing Reference (BR-KSA-56, BR-55)
  // ═══════════════════════════════════════════════════════════════════════════

  private buildBillingReference(data: ZatcaInvoiceData): string {
    if (!data.billingReferenceId) return '';
    return [
      `  <cac:BillingReference>`,
      `    <cac:InvoiceDocumentReference>`,
      `      <cbc:ID>${this.esc(data.billingReferenceId)}</cbc:ID>`,
      `    </cac:InvoiceDocumentReference>`,
      `  </cac:BillingReference>`,
    ].join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Delivery (BR-KSA-15, BR-KSA-35, BR-KSA-36)
  // ═══════════════════════════════════════════════════════════════════════════

  private buildDelivery(data: ZatcaInvoiceData): string {
    if (!data.supplyDate) return '';
    const lines = [
      `  <cac:Delivery>`,
      `    <cbc:ActualDeliveryDate>${data.supplyDate}</cbc:ActualDeliveryDate>`,
    ];
    if (data.supplyEndDate) {
      lines.push(`    <cbc:LatestDeliveryDate>${data.supplyEndDate}</cbc:LatestDeliveryDate>`);
    }
    lines.push(`  </cac:Delivery>`);
    return lines.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Payment Means (BR-49, BR-KSA-16)
  // ═══════════════════════════════════════════════════════════════════════════

  private buildPaymentMeans(data: ZatcaInvoiceData): string {
    if (!data.paymentMeansCode) return '';
    const lines = [
      `  <cac:PaymentMeans>`,
      `    <cbc:PaymentMeansCode>${data.paymentMeansCode}</cbc:PaymentMeansCode>`,
    ];
    // BR-KSA-17: Reason for debit/credit note
    if (data.debitCreditNoteReason && (data.invoiceType === '381' || data.invoiceType === '383')) {
      lines.push(`    <cbc:InstructionNote>${this.esc(data.debitCreditNoteReason)}</cbc:InstructionNote>`);
    }
    lines.push(`  </cac:PaymentMeans>`);
    return lines.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Supplier Party (BR-06, BR-08, BR-09, BR-KSA-08, BR-KSA-09, BR-KSA-39/40)
  // ═══════════════════════════════════════════════════════════════════════════

  private buildSupplierParty(data: ZatcaInvoiceData): string {
    const s = data.seller;
    return [
      `  <cac:AccountingSupplierParty>`,
      `    <cac:Party>`,
      // BR-KSA-08: Seller ID with schemeID
      `      <cac:PartyIdentification>`,
      `        <cbc:ID schemeID="${s.idScheme}">${this.esc(s.commercialRegistration)}</cbc:ID>`,
      `      </cac:PartyIdentification>`,
      // BR-08, BR-KSA-09: Postal address
      this.buildAddress(s.address, '      '),
      // BR-KSA-39/40: VAT registration (15 digits, starts & ends with 3)
      `      <cac:PartyTaxScheme>`,
      `        <cbc:CompanyID>${s.vatNumber}</cbc:CompanyID>`,
      `        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>`,
      `      </cac:PartyTaxScheme>`,
      // BR-06: Seller name
      `      <cac:PartyLegalEntity>`,
      `        <cbc:RegistrationName>${this.esc(s.name)}</cbc:RegistrationName>`,
      `      </cac:PartyLegalEntity>`,
      `    </cac:Party>`,
      `  </cac:AccountingSupplierParty>`,
    ].join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Customer Party (BR-10, BR-KSA-10, BR-KSA-42, BR-KSA-14)
  // ═══════════════════════════════════════════════════════════════════════════

  private buildCustomerParty(data: ZatcaInvoiceData): string {
    const b = data.buyer;
    if (!b) return '';

    const parts = [
      `  <cac:AccountingCustomerParty>`,
      `    <cac:Party>`,
    ];

    // BR-KSA-14: Buyer identification
    if (b.id && b.idScheme) {
      parts.push(
        `      <cac:PartyIdentification>`,
        `        <cbc:ID schemeID="${b.idScheme}">${this.esc(b.id)}</cbc:ID>`,
        `      </cac:PartyIdentification>`,
      );
    }

    // BR-10: Buyer address
    if (b.address) {
      parts.push(this.buildAddress(b.address as ZatcaAddress, '      '));
    }

    // BR-KSA-44: Buyer VAT number
    if (b.vatNumber) {
      parts.push(
        `      <cac:PartyTaxScheme>`,
        `        <cbc:CompanyID>${b.vatNumber}</cbc:CompanyID>`,
        `        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>`,
        `      </cac:PartyTaxScheme>`,
      );
    }

    // BR-KSA-42: Buyer name
    if (b.name) {
      parts.push(
        `      <cac:PartyLegalEntity>`,
        `        <cbc:RegistrationName>${this.esc(b.name)}</cbc:RegistrationName>`,
        `      </cac:PartyLegalEntity>`,
      );
    }

    parts.push(`    </cac:Party>`, `  </cac:AccountingCustomerParty>`);
    return parts.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Address builder (BR-KSA-09, BR-KSA-37, BR-KSA-64, BR-KSA-66)
  // ═══════════════════════════════════════════════════════════════════════════

  private buildAddress(addr: Partial<ZatcaAddress>, indent: string): string {
    const parts = [`${indent}<cac:PostalAddress>`];

    if (addr.street)             parts.push(`${indent}  <cbc:StreetName>${this.esc(addr.street)}</cbc:StreetName>`);
    if (addr.additionalStreet)   parts.push(`${indent}  <cbc:AdditionalStreetName>${this.esc(addr.additionalStreet)}</cbc:AdditionalStreetName>`);
    if (addr.buildingNumber)     parts.push(`${indent}  <cbc:BuildingNumber>${addr.buildingNumber}</cbc:BuildingNumber>`);           // BR-KSA-37: 4 digits
    if (addr.additionalNumber)   parts.push(`${indent}  <cbc:PlotIdentification>${addr.additionalNumber}</cbc:PlotIdentification>`); // BR-KSA-64: 4 digits
    if (addr.district)           parts.push(`${indent}  <cbc:CitySubdivisionName>${this.esc(addr.district)}</cbc:CitySubdivisionName>`);
    if (addr.city)               parts.push(`${indent}  <cbc:CityName>${this.esc(addr.city)}</cbc:CityName>`);
    if (addr.postalCode)         parts.push(`${indent}  <cbc:PostalZone>${addr.postalCode}</cbc:PostalZone>`);                       // BR-KSA-66: 5 digits
    if (addr.region)             parts.push(`${indent}  <cbc:CountrySubentity>${this.esc(addr.region)}</cbc:CountrySubentity>`);

    parts.push(
      `${indent}  <cac:Country>`,
      `${indent}    <cbc:IdentificationCode>${addr.country || 'SA'}</cbc:IdentificationCode>`,
      `${indent}  </cac:Country>`,
      `${indent}</cac:PostalAddress>`,
    );

    return parts.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Document-level Allowances & Charges (BR-31..BR-37, BR-KSA-19..BR-KSA-22)
  // ═══════════════════════════════════════════════════════════════════════════

  private buildDocumentAllowances(data: ZatcaInvoiceData): string {
    if (!data.discountTotal || data.discountTotal <= 0) return '';
    return [
      `  <cac:AllowanceCharge>`,
      `    <cbc:ChargeIndicator>false</cbc:ChargeIndicator>`,
      `    <cbc:AllowanceChargeReasonCode>95</cbc:AllowanceChargeReasonCode>`,
      `    <cbc:AllowanceChargeReason>Discount</cbc:AllowanceChargeReason>`,
      `    <cbc:Amount currencyID="SAR">${data.discountTotal.toFixed(2)}</cbc:Amount>`,
      `    <cac:TaxCategory>`,
      `      <cbc:ID>S</cbc:ID>`,
      `      <cbc:Percent>15</cbc:Percent>`,
      `      <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>`,
      `    </cac:TaxCategory>`,
      `  </cac:AllowanceCharge>`,
    ].join('\n');
  }

  private buildDocumentCharges(data: ZatcaInvoiceData): string {
    if (!data.chargeTotal || data.chargeTotal <= 0) return '';
    return [
      `  <cac:AllowanceCharge>`,
      `    <cbc:ChargeIndicator>true</cbc:ChargeIndicator>`,
      `    <cbc:AllowanceChargeReasonCode>CG</cbc:AllowanceChargeReasonCode>`,
      `    <cbc:AllowanceChargeReason>Charge</cbc:AllowanceChargeReason>`,
      `    <cbc:Amount currencyID="SAR">${data.chargeTotal.toFixed(2)}</cbc:Amount>`,
      `    <cac:TaxCategory>`,
      `      <cbc:ID>S</cbc:ID>`,
      `      <cbc:Percent>15</cbc:Percent>`,
      `      <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>`,
      `    </cac:TaxCategory>`,
      `  </cac:AllowanceCharge>`,
    ].join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Tax Total (BR-CO-14, BR-CO-17, BR-CO-18, BR-45..BR-48)
  // Groups by distinct (vatCategory, vatRate) — Section 9.6
  // ═══════════════════════════════════════════════════════════════════════════

  private buildTaxTotal(data: ZatcaInvoiceData): string {
    // Group lines by vatCategory + vatRate for VAT Breakdown
    const groups = this.groupByVat(data);

    const subtotals = groups.map((g) => [
      `    <cac:TaxSubtotal>`,
      `      <cbc:TaxableAmount currencyID="SAR">${g.taxableAmount.toFixed(2)}</cbc:TaxableAmount>`,
      `      <cbc:TaxAmount currencyID="SAR">${g.taxAmount.toFixed(2)}</cbc:TaxAmount>`,
      `      <cac:TaxCategory>`,
      `        <cbc:ID>${g.category}</cbc:ID>`,
      `        <cbc:Percent>${g.rate}</cbc:Percent>`,
      this.buildExemptionReason(g.category, data),
      `        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>`,
      `      </cac:TaxCategory>`,
      `    </cac:TaxSubtotal>`,
    ].filter(Boolean).join('\n'));

    return [
      `  <cac:TaxTotal>`,
      `    <cbc:TaxAmount currencyID="SAR">${data.totalVat.toFixed(2)}</cbc:TaxAmount>`,
      ...subtotals,
      `  </cac:TaxTotal>`,
    ].join('\n');
  }

  /** Second TaxTotal in accounting currency (BR-53, BR-KSA-EN16931-09) */
  private buildTaxTotalAccounting(data: ZatcaInvoiceData): string {
    return [
      `  <cac:TaxTotal>`,
      `    <cbc:TaxAmount currencyID="SAR">${data.totalVat.toFixed(2)}</cbc:TaxAmount>`,
      `  </cac:TaxTotal>`,
    ].join('\n');
  }

  private buildExemptionReason(category: VatCategoryCode, data: ZatcaInvoiceData): string {
    if (category === 'S') return '';
    // BR-KSA-23/24/69, BR-Z-10, BR-E-10, BR-O-10
    const code = data.vatExemptionReasonCode || '';
    const text = data.vatExemptionReasonText || '';
    return [
      code ? `        <cbc:TaxExemptionReasonCode>${code}</cbc:TaxExemptionReasonCode>` : '',
      text ? `        <cbc:TaxExemptionReason>${this.esc(text)}</cbc:TaxExemptionReason>` : '',
    ].filter(Boolean).join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Legal Monetary Total (BR-CO-10..BR-CO-16)
  // ═══════════════════════════════════════════════════════════════════════════

  private buildLegalMonetaryTotal(data: ZatcaInvoiceData): string {
    const payable = data.payableAmount ?? data.totalWithVat;
    // BR-CO-13: TaxExclusiveAmount = LineExtensionAmount - AllowanceTotalAmount + ChargeTotalAmount
    const taxExclusive = data.totalBeforeVat
      - (data.discountTotal || 0)
      + (data.chargeTotal || 0);
    const parts = [
      `  <cac:LegalMonetaryTotal>`,
      `    <cbc:LineExtensionAmount currencyID="SAR">${data.totalBeforeVat.toFixed(2)}</cbc:LineExtensionAmount>`,
      `    <cbc:TaxExclusiveAmount currencyID="SAR">${taxExclusive.toFixed(2)}</cbc:TaxExclusiveAmount>`,
      `    <cbc:TaxInclusiveAmount currencyID="SAR">${data.totalWithVat.toFixed(2)}</cbc:TaxInclusiveAmount>`,
    ];

    if (data.discountTotal && data.discountTotal > 0) {
      parts.push(`    <cbc:AllowanceTotalAmount currencyID="SAR">${data.discountTotal.toFixed(2)}</cbc:AllowanceTotalAmount>`);
    }
    if (data.chargeTotal && data.chargeTotal > 0) {
      parts.push(`    <cbc:ChargeTotalAmount currencyID="SAR">${data.chargeTotal.toFixed(2)}</cbc:ChargeTotalAmount>`);
    }
    if (data.prepaidAmount && data.prepaidAmount > 0) {
      parts.push(`    <cbc:PrepaidAmount currencyID="SAR">${data.prepaidAmount.toFixed(2)}</cbc:PrepaidAmount>`);
    }

    parts.push(
      `    <cbc:PayableAmount currencyID="SAR">${payable.toFixed(2)}</cbc:PayableAmount>`,
      `  </cac:LegalMonetaryTotal>`,
    );
    return parts.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Invoice Line (BR-21..BR-26, BR-CO-04, BR-KSA-50..53, BR-KSA-EN16931-11)
  // ═══════════════════════════════════════════════════════════════════════════

  private buildInvoiceLine(item: ZatcaInvoiceLine, data: ZatcaInvoiceData): string {
    const lineWithVat = item.amount + item.vatAmount;  // KSA-12
    const unitCode = item.unitCode || 'EA';

    const parts = [
      `  <cac:InvoiceLine>`,
      `    <cbc:ID>${item.lineNumber}</cbc:ID>`,
      `    <cbc:InvoicedQuantity unitCode="${unitCode}">${item.quantity}</cbc:InvoicedQuantity>`,
      `    <cbc:LineExtensionAmount currencyID="SAR">${item.amount.toFixed(2)}</cbc:LineExtensionAmount>`,
    ];

    // Line-level allowance (BT-136)
    if (item.discountAmount && item.discountAmount > 0) {
      parts.push(
        `    <cac:AllowanceCharge>`,
        `      <cbc:ChargeIndicator>false</cbc:ChargeIndicator>`,
        `      <cbc:AllowanceChargeReasonCode>95</cbc:AllowanceChargeReasonCode>`,
        `      <cbc:AllowanceChargeReason>${this.esc(item.discountReason || 'Discount')}</cbc:AllowanceChargeReason>`,
        `      <cbc:Amount currencyID="SAR">${item.discountAmount.toFixed(2)}</cbc:Amount>`,
        `    </cac:AllowanceCharge>`,
      );
    }

    // Line-level charge (BT-141)
    if (item.chargeAmount && item.chargeAmount > 0) {
      parts.push(
        `    <cac:AllowanceCharge>`,
        `      <cbc:ChargeIndicator>true</cbc:ChargeIndicator>`,
        `      <cbc:AllowanceChargeReasonCode>CG</cbc:AllowanceChargeReasonCode>`,
        `      <cbc:AllowanceChargeReason>${this.esc(item.chargeReason || 'Charge')}</cbc:AllowanceChargeReason>`,
        `      <cbc:Amount currencyID="SAR">${item.chargeAmount.toFixed(2)}</cbc:Amount>`,
        `    </cac:AllowanceCharge>`,
      );
    }

    // KSA-11/12: Line-level tax total (BR-KSA-50..53)
    parts.push(
      `    <cac:TaxTotal>`,
      `      <cbc:TaxAmount currencyID="SAR">${item.vatAmount.toFixed(2)}</cbc:TaxAmount>`,
      `      <cbc:RoundingAmount currencyID="SAR">${lineWithVat.toFixed(2)}</cbc:RoundingAmount>`,
      `    </cac:TaxTotal>`,
    );

    // Item details
    parts.push(
      `    <cac:Item>`,
      `      <cbc:Name>${this.esc(item.serviceName)}</cbc:Name>`,
      // BR-CO-04: ClassifiedTaxCategory
      `      <cac:ClassifiedTaxCategory>`,
      `        <cbc:ID>${item.vatCategory}</cbc:ID>`,
      `        <cbc:Percent>${item.vatRate}</cbc:Percent>`,
      `        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>`,
      `      </cac:ClassifiedTaxCategory>`,
      `    </cac:Item>`,
    );

    // Price details (BR-26)
    parts.push(
      `    <cac:Price>`,
      `      <cbc:PriceAmount currencyID="SAR">${item.unitPrice.toFixed(2)}</cbc:PriceAmount>`,
      `      <cbc:BaseQuantity unitCode="${unitCode}">1</cbc:BaseQuantity>`,
      `    </cac:Price>`,
    );

    parts.push(`  </cac:InvoiceLine>`);
    return parts.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  /** Group invoice lines by (vatCategory, vatRate) for VAT Breakdown (Sec.9.6) */
  private groupByVat(data: ZatcaInvoiceData): Array<{
    category: VatCategoryCode;
    rate: number;
    taxableAmount: number;
    taxAmount: number;
  }> {
    const map = new Map<string, { category: VatCategoryCode; rate: number; taxableAmount: number; taxAmount: number }>();

    for (const line of data.lines) {
      const key = `${line.vatCategory}-${line.vatRate}`;
      const existing = map.get(key);
      if (existing) {
        existing.taxableAmount += line.amount;
        existing.taxAmount += line.vatAmount;
      } else {
        map.set(key, {
          category: line.vatCategory,
          rate: line.vatRate,
          taxableAmount: line.amount,
          taxAmount: line.vatAmount,
        });
      }
    }

    // Apply document-level allowances/charges to the first applicable group
    if (data.discountTotal && data.discountTotal > 0) {
      const firstS = [...map.values()].find((g) => g.category === 'S');
      if (firstS) firstS.taxableAmount -= data.discountTotal;
    }
    if (data.chargeTotal && data.chargeTotal > 0) {
      const firstS = [...map.values()].find((g) => g.category === 'S');
      if (firstS) firstS.taxableAmount += data.chargeTotal;
    }

    return [...map.values()];
  }

  /** Escape XML special characters (BR-KSA-F-03: no empty elements from bad encoding) */
  private esc(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
