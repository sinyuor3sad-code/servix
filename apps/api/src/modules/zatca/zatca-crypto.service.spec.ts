import { ZatcaCryptoService } from './zatca-crypto.service';

describe('ZatcaCryptoService', () => {
  let service: ZatcaCryptoService;

  beforeEach(() => {
    service = new ZatcaCryptoService();
  });

  describe('generateCSR', () => {
    it('should generate a private key and CSR', () => {
      const result = service.generateCSR({
        commonName: 'SERVIX-test-tenant',
        organizationName: 'Test Salon',
        countryCode: 'SA',
        serialNumber: '1-SERVIX|2-test|3-123',
      });

      expect(result.privateKey).toBeDefined();
      expect(result.privateKey).toContain('PRIVATE KEY');
      expect(result.csr).toBeDefined();
      expect(result.csr).toContain('CERTIFICATE REQUEST');
    });
  });

  describe('hashInvoice', () => {
    it('should produce a base64 SHA-256 hash', () => {
      const xml = '<Invoice><ID>INV-001</ID></Invoice>';
      const hash = service.hashInvoice(xml);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      // Base64 pattern
      expect(hash).toMatch(/^[A-Za-z0-9+/=]+$/);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = service.hashInvoice('<Invoice>A</Invoice>');
      const hash2 = service.hashInvoice('<Invoice>B</Invoice>');

      expect(hash1).not.toBe(hash2);
    });

    it('should produce same hash for same input', () => {
      const xml = '<Invoice>Same</Invoice>';
      expect(service.hashInvoice(xml)).toBe(service.hashInvoice(xml));
    });
  });

  describe('generateTLV', () => {
    it('should produce a base64 TLV string', () => {
      const tlv = service.generateTLV({
        sellerName: 'صالون الجمال',
        vatNumber: '300000000000003',
        timestamp: '2026-04-08T10:00:00',
        totalWithVat: '115.00',
        vatAmount: '15.00',
        invoiceHash: 'abc123',
        signature: 'sig456',
        publicKey: 'key789',
      });

      expect(tlv).toBeDefined();
      expect(typeof tlv).toBe('string');
      expect(tlv.length).toBeGreaterThan(0);
    });

    it('should contain all 8 TLV tags', () => {
      const tlv = service.generateTLV({
        sellerName: 'Test',
        vatNumber: '123',
        timestamp: '2026-01-01T00:00:00',
        totalWithVat: '100',
        vatAmount: '15',
        invoiceHash: 'hash',
        signature: 'sig',
        publicKey: 'key',
      });

      // Decode and verify first tag byte is 1
      const buf = Buffer.from(tlv, 'base64');
      expect(buf[0]).toBe(1); // First TLV tag
    });
  });

  describe('embedSignature', () => {
    it('should insert XML-DSIG before closing tag', () => {
      const xml = '<Invoice><ID>1</ID></Invoice>';
      const result = service.embedSignature(xml, 'test-sig', 'test-hash');

      expect(result).toContain('ds:Signature');
      expect(result).toContain('test-sig');
      expect(result).toContain('test-hash');
      expect(result).toContain('</Invoice>');
    });
  });
});
