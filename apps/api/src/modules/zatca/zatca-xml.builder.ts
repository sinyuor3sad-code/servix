import { Injectable, Logger } from '@nestjs/common';
import { ZatcaInvoiceData } from './zatca.types';

/**
 * ZATCA UBL 2.1 XML Invoice Builder
 * Generates ZATCA-compliant XML invoices per Saudi e-invoicing specifications.
 */
@Injectable()
export class ZatcaXmlBuilder {
  private readonly logger = new Logger(ZatcaXmlBuilder.name);

  /**
   * Build a complete UBL 2.1 XML invoice
   */
  buildInvoiceXml(data: ZatcaInvoiceData): string {
    const lines = data.lines
      .map((item) => this.buildInvoiceLine(item))
      .join('\n');

    const buyerParty = data.buyer
      ? `
    <cac:AccountingCustomerParty>
      <cac:Party>
        <cac:PartyLegalEntity>
          <cbc:RegistrationName>${this.escapeXml(data.buyer.name)}</cbc:RegistrationName>
        </cac:PartyLegalEntity>
        ${data.buyer.vatNumber ? `<cac:PartyTaxScheme><cbc:CompanyID>${data.buyer.vatNumber}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` : ''}
      </cac:Party>
    </cac:AccountingCustomerParty>`
      : '';

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">

  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>${data.invoiceNumber}</cbc:ID>
  <cbc:UUID>${data.uuid}</cbc:UUID>
  <cbc:IssueDate>${data.issueDate}</cbc:IssueDate>
  <cbc:IssueTime>${data.issueTime}</cbc:IssueTime>
  <cbc:InvoiceTypeCode name="${data.invoiceSubType}">${data.invoiceType}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${data.currency}</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>${data.currency}</cbc:TaxCurrencyCode>

  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="CRN">${data.seller.commercialRegistration}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PostalAddress>
        <cbc:StreetName>${this.escapeXml(data.seller.address.street)}</cbc:StreetName>
        <cbc:CityName>${this.escapeXml(data.seller.address.city)}</cbc:CityName>
        <cbc:PostalZone>${data.seller.address.postalCode}</cbc:PostalZone>
        <cbc:CitySubdivisionName>${this.escapeXml(data.seller.address.district)}</cbc:CitySubdivisionName>
        <cac:Country>
          <cbc:IdentificationCode>${data.seller.address.country}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${data.seller.vatNumber}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${this.escapeXml(data.seller.name)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  ${buyerParty}

  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${data.currency}">${data.totalVat.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${data.currency}">${data.totalBeforeVat.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${data.currency}">${data.totalVat.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>15</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>

  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${data.currency}">${data.totalBeforeVat.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${data.currency}">${data.totalBeforeVat.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${data.currency}">${data.totalWithVat.toFixed(2)}</cbc:TaxInclusiveAmount>
    ${data.discountTotal ? `<cbc:AllowanceTotalAmount currencyID="${data.currency}">${data.discountTotal.toFixed(2)}</cbc:AllowanceTotalAmount>` : ''}
    <cbc:PayableAmount currencyID="${data.currency}">${data.totalWithVat.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>

${lines}
</Invoice>`;

    this.logger.debug(`Built UBL 2.1 XML for invoice ${data.invoiceNumber}`);
    return xml;
  }

  private buildInvoiceLine(item: ZatcaInvoiceData['lines'][0]): string {
    return `  <cac:InvoiceLine>
    <cbc:ID>${item.lineNumber}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="EA">${item.quantity}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="SAR">${item.amount.toFixed(2)}</cbc:LineExtensionAmount>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="SAR">${item.vatAmount.toFixed(2)}</cbc:TaxAmount>
      <cbc:RoundingAmount currencyID="SAR">${(item.amount + item.vatAmount).toFixed(2)}</cbc:RoundingAmount>
    </cac:TaxTotal>
    <cac:Item>
      <cbc:Name>${this.escapeXml(item.serviceName)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>${item.vatRate}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="SAR">${item.unitPrice.toFixed(2)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`;
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
