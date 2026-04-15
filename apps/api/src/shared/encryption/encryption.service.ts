import { Injectable, Logger } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
} from 'crypto';

/**
 * Application-level encryption service using AES-256-GCM.
 * Encrypts sensitive data (phone numbers, emails) before DB storage.
 *
 * Format: iv:authTag:ciphertext (all hex-encoded)
 *
 * CRITICAL: If ENCRYPTION_KEY is lost, all encrypted data is unrecoverable.
 * Store ENCRYPTION_KEY in Vault (5.4) or a secure secrets manager.
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm' as const;
  private readonly key: Buffer;
  private readonly enabled: boolean;

  constructor() {
    const secret = process.env.ENCRYPTION_KEY;
    const isProduction = process.env.NODE_ENV === 'production';

    if (!secret || secret.length < 32) {
      if (isProduction) {
        throw new Error(
          'FATAL: ENCRYPTION_KEY is not set or too short (<32 chars). ' +
          'Production requires ENCRYPTION_KEY for PDPL compliance. ' +
          'Set ENCRYPTION_KEY in your environment or secrets manager.',
        );
      }
      this.logger.warn(
        'ENCRYPTION_KEY not set or too short (<32 chars) — encryption DISABLED. Set ENCRYPTION_KEY to enable.',
      );
      this.key = Buffer.alloc(32);
      this.enabled = false;
    } else {
      this.key = scryptSync(secret, 'servix-encryption-salt-v1', 32);
      this.enabled = true;
      this.logger.log('Encryption service initialized (AES-256-GCM)');
    }
  }

  /**
   * Whether encryption is enabled (ENCRYPTION_KEY is configured).
   */
  get isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Encrypt plaintext → "iv:authTag:ciphertext" (hex)
   * Returns plaintext unchanged if encryption is disabled.
   */
  encrypt(plaintext: string): string {
    if (!this.enabled) return plaintext;

    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypt "iv:authTag:ciphertext" → plaintext
   * Returns input unchanged if encryption is disabled or input is not encrypted.
   */
  decrypt(ciphertext: string): string {
    if (!this.enabled) return ciphertext;

    // Not encrypted (no colons = plain text)
    if (!ciphertext.includes(':')) return ciphertext;

    try {
      const parts = ciphertext.split(':');
      if (parts.length !== 3) return ciphertext;

      const [ivHex, authTagHex, encrypted] = parts;

      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch {
      this.logger.warn('Failed to decrypt value — returning as-is');
      return ciphertext;
    }
  }

  /**
   * One-way hash for searchable encrypted fields.
   * Use for looking up clients by phone/email without decrypting all records.
   */
  hash(value: string): string {
    return createHash('sha256')
      .update(value + (process.env.ENCRYPTION_KEY || ''))
      .digest('hex');
  }
}
