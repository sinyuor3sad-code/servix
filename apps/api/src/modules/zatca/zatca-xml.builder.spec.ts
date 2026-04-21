import { ZatcaXmlBuilder } from './zatca-xml.builder';
import { ZatcaInvoiceData } from './zatca.types';

describe('ZatcaXmlBuilder', () => {
  let builder: ZatcaXmlBuilder;

  const sampleInvoice: ZatcaInvoiceData = {
    invoiceNumber: 'INV-2026-001',
    uuid: 'test-uuid-123',
    issueDate: '2026-04-08',
    issueTime: '14:30:00',
    invoiceType: '388',
    invoiceSubType: '0200000',
    currency: 'SAR',
    seller: {
      name: 'صالون الجمال الذهبي',
      vatNumber: '300000000000003',
      commercialRegistration: '1010000000',
      idScheme: 'CRN',
      address: {
        street: 'شارع الملك فهد',
        buildingNumber: '1234',
        city: 'الرياض',
        district: 'العليا',
        postalCode: '12345',
        country: 'SA',
      },
    },
    lines: [
      {
        lineNumber: 1,
        serviceName: 'قص شعر رجالي',
        quantity: 1,
        unitPrice: 50,
        amount: 50,
        vatCategory: 'S',
        vatRate: 15,
        vatAmount: 7.5,
      },
      {
        lineNumber: 2,
        serviceName: 'صبغة شعر',
        quantity: 1,
        unitPrice: 200,
        amount: 200,
        vatCategory: 'S',
        vatRate: 15,
        vatAmount: 30,
      },
    ],
    totalBeforeVat: 250,
    totalVat: 37.5,
    totalWithVat: 287.5,
    invoiceCounterValue: 1,
    previousInvoiceHash: 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzlj',
  };

  beforeEach(() => {
    builder = new ZatcaXmlBuilder();
  });

  it('should generate valid UBL 2.1 XML', () => {
    const xml = builder.buildInvoiceXml(sampleInvoice);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('urn:oasis:names:specification:ubl:schema:xsd:Invoice-2');
    expect(xml).toContain('</Invoice>');
  });

  it('should include mandatory header fields (BR-KSA-03, BR-KSA-06, BR-KSA-EN16931-01)', () => {
    const xml = builder.buildInvoiceXml(sampleInvoice);

    expect(xml).toContain('<cbc:ProfileID>reporting:1.0</cbc:ProfileID>');
    expect(xml).toContain('INV-2026-001');
    expect(xml).toContain('<cbc:UUID>test-uuid-123</cbc:UUID>');
    expect(xml).toContain('2026-04-08');
    expect(xml).toContain('14:30:00');
    expect(xml).toContain('<cbc:InvoiceTypeCode name="0200000">388</cbc:InvoiceTypeCode>');
    expect(xml).toContain('<cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>');
  });

  it('should include ICV and PIH document references (BR-KSA-33)', () => {
    const xml = builder.buildInvoiceXml(sampleInvoice);

    expect(xml).toContain('<cbc:ID>ICV</cbc:ID>');
    expect(xml).toContain('<cbc:ID>PIH</cbc:ID>');
    expect(xml).toContain('<cbc:ID>QR</cbc:ID>');
  });

  it('should include cac:Signature placeholder (BR-KSA-28/29/30)', () => {
    const xml = builder.buildInvoiceXml(sampleInvoice);

    expect(xml).toContain('urn:oasis:names:specification:ubl:signature:Invoice');
    expect(xml).toContain('urn:oasis:names:specification:ubl:dsig:enveloped:xades');
  });

  it('should include seller with schemeID and BuildingNumber (BR-KSA-08, BR-KSA-37)', () => {
    const xml = builder.buildInvoiceXml(sampleInvoice);

    expect(xml).toContain('schemeID="CRN"');
    expect(xml).toContain('1010000000');
    expect(xml).toContain('300000000000003');
    expect(xml).toContain('<cbc:BuildingNumber>1234</cbc:BuildingNumber>');
    expect(xml).toContain('<cbc:CitySubdivisionName>العليا</cbc:CitySubdivisionName>');
    expect(xml).toContain('<cbc:PostalZone>12345</cbc:PostalZone>');
  });

  it('should include all invoice lines with ClassifiedTaxCategory (BR-CO-04)', () => {
    const xml = builder.buildInvoiceXml(sampleInvoice);

    expect(xml).toContain('50.00');
    expect(xml).toContain('200.00');
    expect(xml).toContain('7.50');
    expect(xml).toContain('30.00');
    expect(xml).toContain('<cac:ClassifiedTaxCategory>');
    expect(xml).toContain('<cbc:ID>S</cbc:ID>');
    expect(xml).toContain('<cbc:Percent>15</cbc:Percent>');
  });

  it('should include line-level TaxTotal (KSA-11/12, BR-KSA-50/51)', () => {
    const xml = builder.buildInvoiceXml(sampleInvoice);

    // Line 1: amount 50 + VAT 7.50 = 57.50
    expect(xml).toContain('<cbc:RoundingAmount currencyID="SAR">57.50</cbc:RoundingAmount>');
    // Line 2: amount 200 + VAT 30 = 230
    expect(xml).toContain('<cbc:RoundingAmount currencyID="SAR">230.00</cbc:RoundingAmount>');
  });

  it('should include TaxSubtotal in TaxTotal (BR-CO-18)', () => {
    const xml = builder.buildInvoiceXml(sampleInvoice);

    expect(xml).toContain('<cac:TaxSubtotal>');
    expect(xml).toContain('<cbc:TaxableAmount');
    expect(xml).toContain('250.00'); // taxable total
  });

  it('should include two TaxTotal elements (BR-53, BR-KSA-EN16931-09)', () => {
    const xml = builder.buildInvoiceXml(sampleInvoice);

    // Count TaxTotal occurrences - should be doc-level (with subtotals) + accounting currency
    const taxTotalCount = (xml.match(/<cac:TaxTotal>/g) || []).length;
    expect(taxTotalCount).toBeGreaterThanOrEqual(2); // doc-level + accounting + lines
  });

  it('should include monetary totals (BR-13..BR-15)', () => {
    const xml = builder.buildInvoiceXml(sampleInvoice);

    expect(xml).toContain('250.00'); // LineExtensionAmount
    expect(xml).toContain('37.50');  // total VAT
    expect(xml).toContain('287.50'); // TaxInclusiveAmount / PayableAmount
  });

  it('should use SAR as currency', () => {
    const xml = builder.buildInvoiceXml(sampleInvoice);

    expect(xml).toContain('currencyID="SAR"');
    expect(xml).toContain('<cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>');
  });

  it('should include buyer when provided', () => {
    const withBuyer: ZatcaInvoiceData = {
      ...sampleInvoice,
      buyer: { name: 'أحمد', vatNumber: '300000000000099' },
    };
    const xml = builder.buildInvoiceXml(withBuyer);

    expect(xml).toContain('AccountingCustomerParty');
    expect(xml).toContain('أحمد');
    expect(xml).toContain('300000000000099');
  });

  it('should exclude buyer for simplified invoices', () => {
    const xml = builder.buildInvoiceXml(sampleInvoice);

    expect(xml).not.toContain('AccountingCustomerParty');
  });

  it('should include BillingReference for credit notes', () => {
    const creditNote: ZatcaInvoiceData = {
      ...sampleInvoice,
      invoiceType: '381',
      billingReferenceId: 'INV-2026-000',
      debitCreditNoteReason: 'إلغاء خدمة',
    };
    const xml = builder.buildInvoiceXml(creditNote);

    expect(xml).toContain('<cac:BillingReference>');
    expect(xml).toContain('INV-2026-000');
    expect(xml).toContain('إلغاء خدمة');
  });

  it('should include delivery date when provided (BR-KSA-15)', () => {
    const withDelivery: ZatcaInvoiceData = {
      ...sampleInvoice,
      supplyDate: '2026-04-08',
    };
    const xml = builder.buildInvoiceXml(withDelivery);

    expect(xml).toContain('<cac:Delivery>');
    expect(xml).toContain('<cbc:ActualDeliveryDate>2026-04-08</cbc:ActualDeliveryDate>');
  });

  it('should include document-level allowances when provided', () => {
    const withDiscount: ZatcaInvoiceData = {
      ...sampleInvoice,
      discountTotal: 25,
    };
    const xml = builder.buildInvoiceXml(withDiscount);

    expect(xml).toContain('<cbc:ChargeIndicator>false</cbc:ChargeIndicator>');
    expect(xml).toContain('25.00');
    expect(xml).toContain('AllowanceTotalAmount');
  });

  it('should escape XML special characters', () => {
    const withSpecialChars: ZatcaInvoiceData = {
      ...sampleInvoice,
      seller: {
        ...sampleInvoice.seller,
        name: 'صالون "الجمال" & النعومة',
      },
    };
    const xml = builder.buildInvoiceXml(withSpecialChars);

    expect(xml).toContain('&amp;');
    expect(xml).toContain('&quot;');
    expect(xml).not.toContain('"الجمال"');
  });
});
