import { Injectable, BadRequestException } from '@nestjs/common';
import { createHmac, randomBytes } from 'crypto';

/**
 * TOTP-based Two-Factor Authentication Service
 * Implements RFC 6238 (TOTP) without external dependencies.
 */
@Injectable()
export class TwoFactorService {
  private readonly PERIOD = 30; // seconds
  private readonly DIGITS = 6;
  private readonly ALGORITHM = 'sha1';

  /**
   * Generate a random base32-encoded secret for the user.
   */
  generateSecret(): string {
    const buffer = randomBytes(20);
    return this.base32Encode(buffer);
  }

  /**
   * Generate an otpauth:// URI for QR code generation.
   */
  generateOtpAuthUrl(email: string, secret: string, issuer = 'SERVIX'): string {
    const encodedIssuer = encodeURIComponent(issuer);
    const encodedEmail = encodeURIComponent(email);
    return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=${this.DIGITS}&period=${this.PERIOD}`;
  }

  /**
   * Verify a TOTP code against the secret.
   * Allows a window of ±1 period for clock skew.
   */
  verifyToken(secret: string, token: string): boolean {
    if (!token || token.length !== this.DIGITS) return false;
    const now = Math.floor(Date.now() / 1000);

    // Check current period and ±1 for clock drift
    for (let i = -1; i <= 1; i++) {
      const counter = Math.floor((now + i * this.PERIOD) / this.PERIOD);
      const expected = this.generateTOTP(secret, counter);
      if (expected === token) return true;
    }
    return false;
  }

  /**
   * Generate backup codes (one-time use).
   */
  generateBackupCodes(count = 8): string[] {
    return Array.from({ length: count }, () => {
      const code = randomBytes(4).toString('hex').toUpperCase();
      return `${code.slice(0, 4)}-${code.slice(4, 8)}`;
    });
  }

  // ── Internal TOTP Implementation ────────────────────────

  private generateTOTP(secret: string, counter: number): string {
    const decodedSecret = this.base32Decode(secret);
    const buffer = Buffer.alloc(8);
    let tmp = counter;
    for (let i = 7; i >= 0; i--) {
      buffer[i] = tmp & 0xff;
      tmp >>= 8;
    }

    const hmac = createHmac(this.ALGORITHM, decodedSecret);
    hmac.update(buffer);
    const hmacResult = hmac.digest();

    const offset = hmacResult[hmacResult.length - 1] & 0x0f;
    const binary =
      ((hmacResult[offset] & 0x7f) << 24) |
      ((hmacResult[offset + 1] & 0xff) << 16) |
      ((hmacResult[offset + 2] & 0xff) << 8) |
      (hmacResult[offset + 3] & 0xff);

    const otp = binary % Math.pow(10, this.DIGITS);
    return otp.toString().padStart(this.DIGITS, '0');
  }

  private base32Encode(buffer: Buffer): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let result = '';
    let bits = 0;
    let value = 0;

    for (const byte of buffer) {
      value = (value << 8) | byte;
      bits += 8;
      while (bits >= 5) {
        result += alphabet[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) {
      result += alphabet[(value << (5 - bits)) & 31];
    }
    return result;
  }

  private base32Decode(encoded: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const lookup: Record<string, number> = {};
    for (let i = 0; i < alphabet.length; i++) {
      lookup[alphabet[i]] = i;
    }

    const cleanInput = encoded.replace(/=+$/, '').toUpperCase();
    let bits = 0;
    let value = 0;
    const output: number[] = [];

    for (const char of cleanInput) {
      const idx = lookup[char];
      if (idx === undefined) throw new BadRequestException('Invalid base32 character');
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        output.push((value >>> (bits - 8)) & 0xff);
        bits -= 8;
      }
    }

    return Buffer.from(output);
  }
}
