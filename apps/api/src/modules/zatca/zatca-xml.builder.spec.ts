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
      address: {
        street: 'شارع الملك فهد',
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
        vatRate: 15,
        vatAmount: 7.5,
      },
      {
        lineNumber: 2,
        serviceName: 'صبغة شعر',
        quantity: 1,
        unitPrice: 200,
        amount: 200,
        vatRate: 15,
        vatAmount: 30,
      },
    ],
    totalBeforeVat: 250,
    totalVat: 37.5,
    totalWithVat: 287.5,
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

  it('should include invoice metadata', () => {
    const xml = builder.buildInvoiceXml(sampleInvoice);

    expect(xml).toContain('INV-2026-001');
    expect(xml).toContain('test-uuid-123');
    expect(xml).toContain('2026-04-08');
    expect(xml).toContain('14:30:00');
    expect(xml).toContain('388'); // Invoice type
  });

  it('should include seller information', () => {
    const xml = builder.buildInvoiceXml(sampleInvoice);

    expect(xml).toContain('300000000000003'); // VAT number
    expect(xml).toContain('1010000000'); // CR number
  });

  it('should include all invoice lines', () => {
    const xml = builder.buildInvoiceXml(sampleInvoice);

    expect(xml).toContain('50.00');  // line 1 amount
    expect(xml).toContain('200.00'); // line 2 amount
    expect(xml).toContain('7.50');   // line 1 VAT
    expect(xml).toContain('30.00');  // line 2 VAT
  });

  it('should include tax totals', () => {
    const xml = builder.buildInvoiceXml(sampleInvoice);

    expect(xml).toContain('250.00'); // total before VAT
    expect(xml).toContain('37.50');  // total VAT
    expect(xml).toContain('287.50'); // total with VAT
  });

  it('should use SAR as currency', () => {
    const xml = builder.buildInvoiceXml(sampleInvoice);

    expect(xml).toContain('currencyID="SAR"');
    expect(xml).toContain('<cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>');
  });

  it('should include buyer when provided', () => {
    const withBuyer = {
      ...sampleInvoice,
      buyer: { name: 'أحمد', vatNumber: '300000000000099' },
    };
    const xml = builder.buildInvoiceXml(withBuyer);

    expect(xml).toContain('AccountingCustomerParty');
    expect(xml).toContain('أحمد');
  });

  it('should exclude buyer for simplified invoices', () => {
    const xml = builder.buildInvoiceXml(sampleInvoice);

    expect(xml).not.toContain('AccountingCustomerParty');
  });

  it('should escape XML special characters', () => {
    const withSpecialChars = {
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
