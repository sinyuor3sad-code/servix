import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface GoogleTokenPayload {
  sub: string;         // Google user ID
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
}

/**
 * Google OAuth2 Service
 * Handles Google ID Token verification and user data extraction.
 * Uses Google's tokeninfo endpoint (no SDK dependency).
 */
@Injectable()
export class GoogleAuthService {
  private readonly clientId: string;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('GOOGLE_CLIENT_ID', '');
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
      // Verify token using Google's tokeninfo endpoint
      const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
      
      if (!res.ok) {
        throw new UnauthorizedException('رمز Google غير صالح');
      }

      const payload = await res.json() as Record<string, string>;

      // Verify the token was issued for our app
      if (payload.aud !== this.clientId) {
        throw new UnauthorizedException('رمز Google غير صالح لهذا التطبيق');
      }

      // Check token expiry
      const expiry = parseInt(payload.exp, 10) * 1000;
      if (Date.now() > expiry) {
        throw new UnauthorizedException('انتهت صلاحية رمز Google');
      }

      return {
        sub: payload.sub,
        email: payload.email,
        email_verified: payload.email_verified === 'true',
        name: payload.name,
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
