import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

interface GoogleTokenPayload {
  sub: string;         // Google user ID
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
}

/**
 * Google OAuth2 Service
 * Verifies Google ID tokens LOCALLY against Google's JWKS (V-13a-verify) via
 * google-auth-library's OAuth2Client.verifyIdToken: it validates the JWT
 * SIGNATURE, audience, issuer and expiry in-process (JWKS keys fetched + cached
 * by the client). Replaces the prior per-call round-trip to the tokeninfo
 * endpoint — one fewer network hop, and we trust the token's cryptographic
 * signature rather than a remote endpoint's say-so.
 */
@Injectable()
export class GoogleAuthService {
  private readonly clientId: string;
  private readonly oauthClient: OAuth2Client;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('GOOGLE_CLIENT_ID', '');
    this.oauthClient = new OAuth2Client(this.clientId);
  }

  /**
   * Verify a Google ID token and extract user information.
   * @param idToken The ID token received from the frontend Google Sign-In.
   */
  async verifyIdToken(idToken: string): Promise<GoogleTokenPayload> {
    if (!this.clientId) {
      throw new UnauthorizedException('Google OAuth غير مُفعّل. تواصل مع المسؤول');
    }

    try {
      // verifyIdToken checks the signature (against cached JWKS), audience ===
      // clientId, issuer, and expiry — throwing on any failure. The explicit
      // aud/exp checks the tokeninfo path needed are now handled internally.
      const ticket = await this.oauthClient.verifyIdToken({
        idToken,
        audience: this.clientId,
      });
      const payload = ticket.getPayload();
      if (!payload?.sub) {
        throw new UnauthorizedException('رمز Google غير صالح');
      }

      return {
        sub: payload.sub,
        email: payload.email ?? '',
        email_verified: payload.email_verified === true,
        name: payload.name ?? '',
        picture: payload.picture || undefined,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('فشل التحقق من حساب Google');
    }
  }

  /**
   * Check if Google OAuth is configured.
   */
  isEnabled(): boolean {
    return !!this.clientId;
  }
}
