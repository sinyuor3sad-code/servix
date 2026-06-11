import { randomBytes } from 'crypto';
import { CookieOptions, Request, Response } from 'express';

/**
 * V-39 — httpOnly-cookie channel for the refresh token.
 *
 * The refresh token (an opaque 256-bit secret, DB-hashed) used to live in the
 * dashboard's localStorage (zustand persist) — readable by any XSS. It now
 * travels in an httpOnly cookie scoped to the auth endpoints only, and the
 * SPA keeps the access token in memory.
 *
 * Cookie design:
 * - `servix_rt` (httpOnly): the refresh token itself. Path-scoped to
 *   /api/v1/auth so it is never attached to ordinary API traffic.
 * - `servix_csrf` (httpOnly): the CSRF double-submit reference (V-68). The
 *   SAME value is returned in the response body (`csrfToken`); the SPA holds
 *   it and echoes it in the `x-csrf-token` header, and CsrfGuard compares
 *   header vs cookie. Both copies stay httpOnly server-side — no JS cookie
 *   reading, which would break across subdomains (cookies are host-scoped to
 *   the API host, the SPA runs on another subdomain).
 * - SameSite=Strict: the API is same-site with all SERVIX frontends
 *   (*.servi-x.com in prod, localhost in dev), and Strict blocks any
 *   cross-site send outright — first CSRF layer before the guard.
 *
 * Body-channel compatibility: refresh/logout still accept the token in the
 * request body (non-browser clients + the existing e2e suite). Cookie wins
 * when present.
 */
export const REFRESH_COOKIE = 'servix_rt';
export const CSRF_COOKIE = 'servix_csrf';
export const CSRF_HEADER = 'x-csrf-token';
/** Mirrors global prefix 'api' + URI version '1' + controller path 'auth'. */
export const AUTH_COOKIE_PATH = '/api/v1/auth';

/** Mirrors JWT_REFRESH_EXPIRATION (default 7d). Supports s/m/h/d suffixes. */
function refreshMaxAgeMs(): number {
  const raw = process.env.JWT_REFRESH_EXPIRATION ?? '7d';
  const match = /^(\d+)([smhd])$/.exec(raw.trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const value = Number(match[1]);
  const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[
    match[2] as 's' | 'm' | 'h' | 'd'
  ];
  return value * unit;
}

function baseOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: AUTH_COOKIE_PATH,
  };
}

/**
 * Set the refresh + CSRF cookies for a freshly issued token pair and return
 * the CSRF token for the response body.
 */
export function setAuthCookies(res: Response, refreshToken: string): string {
  const csrfToken = randomBytes(32).toString('hex');
  const maxAge = refreshMaxAgeMs();
  res.cookie(REFRESH_COOKIE, refreshToken, { ...baseOptions(), maxAge });
  res.cookie(CSRF_COOKIE, csrfToken, { ...baseOptions(), maxAge });
  return csrfToken;
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, baseOptions());
  res.clearCookie(CSRF_COOKIE, baseOptions());
}

/** Cookie-first refresh-token extraction with body fallback. */
export function refreshTokenFromRequest(
  req: Request,
  bodyToken?: string,
): string | undefined {
  const cookieToken = (req.cookies as Record<string, string> | undefined)?.[
    REFRESH_COOKIE
  ];
  return cookieToken || bodyToken;
}
