import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';
import {
  CSRF_COOKIE,
  CSRF_HEADER,
  REFRESH_COOKIE,
} from './auth-cookie.helper';

/**
 * V-68 — CSRF protection for the cookie-authenticated auth endpoints
 * (refresh/logout), double-submit variant: the `x-csrf-token` header must
 * equal the `servix_csrf` cookie issued alongside the refresh cookie.
 *
 * Only requests that actually carry the `servix_rt` cookie are checked — a
 * body-token request has no ambient credential, so CSRF does not apply (and
 * the legacy/non-browser flow keeps working). SameSite=Strict on the cookies
 * is the first layer; this guard is the second, for legacy browsers and
 * defense in depth.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly logger = new Logger(CsrfGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const cookies = request.cookies as Record<string, string> | undefined;

    // No refresh cookie → no ambient credential → CSRF not applicable.
    if (!cookies?.[REFRESH_COOKIE]) {
      return true;
    }

    const cookieToken = cookies[CSRF_COOKIE];
    const headerToken = request.headers[CSRF_HEADER];

    if (
      typeof cookieToken === 'string' &&
      typeof headerToken === 'string' &&
      cookieToken.length === 64 && // 32 random bytes, hex
      headerToken.length === cookieToken.length &&
      timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))
    ) {
      return true;
    }

    this.logger.warn(
      `[CsrfGuard] BLOCKED: csrf header/cookie mismatch, path=${request.path}`,
    );
    throw new ForbiddenException('رمز CSRF غير صالح');
  }
}
