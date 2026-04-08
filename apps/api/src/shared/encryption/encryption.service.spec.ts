import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'test-encryption-key-at-least-32-chars!';
    service = new EncryptionService();
  });

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  describe('encrypt / decrypt', () => {
    it('should encrypt and decrypt a phone number', () => {
      const phone = '0512345678';
      const encrypted = service.encrypt(phone);

      expect(encrypted).not.toBe(phone);
      expect(encrypted).toContain(':'); // iv:authTag:ciphertext format
      expect(encrypted.split(':')).toHaveLength(3);

      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(phone);
    });

    it('should encrypt and decrypt an email', () => {
      const email = 'client@example.com';
      const encrypted = service.encrypt(email);
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(email);
    });

    it('should produce different ciphertexts for same plaintext (random IV)', () => {
      const phone = '0512345678';
      const enc1 = service.encrypt(phone);
      const enc2 = service.encrypt(phone);

      expect(enc1).not.toBe(enc2); // Different IVs = different output
      expect(service.decrypt(enc1)).toBe(phone);
      expect(service.decrypt(enc2)).toBe(phone);
    });

    it('should handle empty string', () => {
      const encrypted = service.encrypt('');
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe('');
    });

    it('should handle unicode (Arabic text)', () => {
      const arabic = 'أحمد محمد السعود';
      const encrypted = service.encrypt(arabic);
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(arabic);
    });
  });

  describe('hash', () => {
    it('should produce consistent hash for same value', () => {
      const phone = '0512345678';
      const hash1 = service.hash(phone);
      const hash2 = service.hash(phone);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different values', () => {
      const hash1 = service.hash('0512345678');
      const hash2 = service.hash('0598765432');
      expect(hash1).not.toBe(hash2);
    });

    it('should return hex string 64 chars (SHA-256)', () => {
      const hash = service.hash('test');
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('disabled mode', () => {
    it('should pass through plaintext when ENCRYPTION_KEY is not set', () => {
      delete process.env.ENCRYPTION_KEY;
      const noKeyService = new EncryptionService();

      expect(noKeyService.isEnabled).toBe(false);

      const phone = '0512345678';
      expect(noKeyService.encrypt(phone)).toBe(phone);
      expect(noKeyService.decrypt(phone)).toBe(phone);
    });
  });

  describe('tamper detection', () => {
    it('should handle non-encrypted data gracefully in decrypt', () => {
      const plain = 'not-encrypted-data';
      const result = service.decrypt(plain);
      expect(result).toBe(plain); // Returns as-is
    });

    it('should handle corrupted ciphertext gracefully', () => {
      const corrupted = 'aabbcc:ddeeff:gghhii';
      const result = service.decrypt(corrupted);
      expect(result).toBe(corrupted); // Returns as-is on failure
    });
  });
});
