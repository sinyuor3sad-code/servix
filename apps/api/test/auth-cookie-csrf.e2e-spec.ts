import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AuthController } from '../src/core/auth/auth.controller';
import { AuthService } from '../src/core/auth/auth.service';
import { TwoFactorService } from '../src/core/auth/two-factor.service';
import { GoogleAuthService } from '../src/core/auth/google-auth.service';
import {
  AUTH_COOKIE_PATH,
  CSRF_COOKIE,
  CSRF_HEADER,
  REFRESH_COOKIE,
} from '../src/core/auth/auth-cookie.helper';

/**
 * V-39 + V-68 — httpOnly refresh cookie + CSRF double-submit, HTTP surface.
 *
 * Boots the real AuthController over supertest with a mocked AuthService —
 * the rotation state machine itself is covered by auth-refresh-rotation
 * (V-13c); here we prove the transport contract:
 *
 * - login/refresh set `servix_rt` + `servix_csrf` (httpOnly, SameSite=Strict,
 *   path-scoped to /api/v1/auth) and return the CSRF token in the body
 * - the 2FA half-login sets NO cookies
 * - refresh/logout authenticate cookie-first with body fallback; a request
 *   carrying the refresh cookie is rejected (403) without the matching
 *   x-csrf-token header; a dead refresh family clears the cookie session
 *
 * App setup mirrors main.ts: cookieParser + global prefix + URI versioning +
 * strict ValidationPipe (which also proves the V-39 DTO change — an empty
 * body must pass validation and reach the controller's own 401).
 */

const USER = {
  id: 'aaaaaaaa-1111-1111-1111-111111111111',
  fullName: 'مستخدمة الاختبار',
  email: 'v39@test.local',
  phone: null,
  avatarUrl: null,
};

const RT1 = 'a'.repeat(64);
const RT2 = 'b'.repeat(64);
const BODY_RT = 'c'.repeat(64);

interface ParsedCookie {
  value: string;
  raw: string;
}

/** Parse a Set-Cookie array into { name → { value, raw } }. */
function parseSetCookies(res: request.Response): Record<string, ParsedCookie> {
  const headers = (res.headers['set-cookie'] ?? []) as unknown as string[];
  const out: Record<string, ParsedCookie> = {};
  for (const raw of headers) {
    const [pair] = raw.split(';');
    const eq = pair.indexOf('=');
    out[pair.slice(0, eq).trim()] = { value: pair.slice(eq + 1), raw };
  }
  return out;
}

describe('V-39/V-68 — auth cookie + CSRF (e2e)', () => {
  let app: INestApplication;

  const login = jest.fn();
  const refreshTokens = jest.fn();
  const logout = jest.fn();

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: { login, refreshTokens, logout } },
        { provide: TwoFactorService, useValue: {} },
        { provide: GoogleAuthService, useValue: {} },
      ],
    }).compile();

    app = module.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    [login, refreshTokens, logout].forEach((fn) => fn.mockReset());
    login.mockResolvedValue({
      user: USER,
      tenants: [],
      tokens: { accessToken: 'jwt.access.token', refreshToken: RT1 },
      requires2FA: false,
    });
    refreshTokens.mockResolvedValue({
      accessToken: 'jwt.access.token2',
      refreshToken: RT2,
    });
    logout.mockResolvedValue({ message: 'تم تسجيل الخروج بنجاح' });
  });

  // ── login ───────────────────────────────────────────────────────────

  it('login sets httpOnly servix_rt + servix_csrf scoped to the auth path, and echoes csrfToken in the body', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ emailOrPhone: 'v39@test.local', password: 'Sup3r-secret-pass' })
      .expect(200);

    const cookies = parseSetCookies(res);
    expect(cookies[REFRESH_COOKIE].value).toBe(RT1);
    expect(cookies[REFRESH_COOKIE].raw).toContain('HttpOnly');
    expect(cookies[REFRESH_COOKIE].raw).toContain('SameSite=Strict');
    expect(cookies[REFRESH_COOKIE].raw).toContain(`Path=${AUTH_COOKIE_PATH}`);
    expect(cookies[REFRESH_COOKIE].raw).toContain('Max-Age=');
    expect(cookies[CSRF_COOKIE].raw).toContain('HttpOnly');

    // Double-submit: body copy === cookie copy, 32 random bytes hex.
    expect(res.body.csrfToken).toBe(cookies[CSRF_COOKIE].value);
    expect(res.body.csrfToken).toMatch(/^[0-9a-f]{64}$/);

    // Body keeps the refresh token for non-browser clients (compat).
    expect(res.body.tokens.refreshToken).toBe(RT1);
  });

  it('login requiring 2FA (half-login) sets NO cookies', async () => {
    login.mockResolvedValueOnce({
      user: USER,
      tenants: [],
      tokens: null,
      requires2FA: true,
    });

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ emailOrPhone: 'v39@test.local', password: 'Sup3r-secret-pass' })
      .expect(200);

    expect(res.headers['set-cookie']).toBeUndefined();
    expect(res.body.csrfToken).toBeUndefined();
  });

  // ── refresh: cookie channel + CSRF ──────────────────────────────────

  it('refresh via cookie + matching x-csrf-token rotates the cookie pair', async () => {
    const csrf = 'd'.repeat(64);
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE}=${RT1}`, `${CSRF_COOKIE}=${csrf}`])
      .set(CSRF_HEADER, csrf)
      .send({})
      .expect(200);

    expect(refreshTokens).toHaveBeenCalledTimes(1);
    expect(refreshTokens.mock.calls[0][0]).toBe(RT1); // cookie token used

    const cookies = parseSetCookies(res);
    expect(cookies[REFRESH_COOKIE].value).toBe(RT2); // rotated
    expect(res.body.csrfToken).toBe(cookies[CSRF_COOKIE].value);
    expect(res.body.csrfToken).not.toBe(csrf); // CSRF rotated too
  });

  it('refresh carrying the cookie WITHOUT the CSRF header → 403, service untouched', async () => {
    const csrf = 'd'.repeat(64);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE}=${RT1}`, `${CSRF_COOKIE}=${csrf}`])
      .send({})
      .expect(403);

    expect(refreshTokens).not.toHaveBeenCalled();
  });

  it('refresh with a mismatched CSRF header → 403, service untouched', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', [
        `${REFRESH_COOKIE}=${RT1}`,
        `${CSRF_COOKIE}=${'d'.repeat(64)}`,
      ])
      .set(CSRF_HEADER, 'e'.repeat(64))
      .send({})
      .expect(403);

    expect(refreshTokens).not.toHaveBeenCalled();
  });

  it('cookie token wins over a body token when both are present', async () => {
    const csrf = 'd'.repeat(64);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE}=${RT1}`, `${CSRF_COOKIE}=${csrf}`])
      .set(CSRF_HEADER, csrf)
      .send({ refreshToken: BODY_RT })
      .expect(200);

    expect(refreshTokens.mock.calls[0][0]).toBe(RT1);
  });

  it('refresh rejected by the service (dead family) → 401 AND the cookie session is cleared', async () => {
    refreshTokens.mockRejectedValueOnce(
      new UnauthorizedException('رمز التحديث غير صالح'),
    );
    const csrf = 'd'.repeat(64);
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE}=${RT1}`, `${CSRF_COOKIE}=${csrf}`])
      .set(CSRF_HEADER, csrf)
      .send({})
      .expect(401);

    const cookies = parseSetCookies(res);
    expect(cookies[REFRESH_COOKIE].value).toBe(''); // cleared
    expect(cookies[CSRF_COOKIE].value).toBe('');
  });

  // ── refresh: body fallback (non-browser clients) ────────────────────

  it('body-token refresh without any cookie needs no CSRF header (no ambient credential)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: BODY_RT })
      .expect(200);

    expect(refreshTokens.mock.calls[0][0]).toBe(BODY_RT);
  });

  it('refresh with neither cookie nor body token → 401 (empty body passes DTO validation)', async () => {
    // 401 — not a 400 — proves the V-39 @IsOptional() DTO change.
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({})
      .expect(401);

    expect(refreshTokens).not.toHaveBeenCalled();
  });

  // ── logout ──────────────────────────────────────────────────────────

  it('logout via cookie + CSRF revokes the cookie token and clears both cookies', async () => {
    const csrf = 'd'.repeat(64);
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', [`${REFRESH_COOKIE}=${RT1}`, `${CSRF_COOKIE}=${csrf}`])
      .set(CSRF_HEADER, csrf)
      .send({})
      .expect(200);

    expect(logout).toHaveBeenCalledWith(RT1);
    const cookies = parseSetCookies(res);
    expect(cookies[REFRESH_COOKIE].value).toBe('');
    expect(cookies[CSRF_COOKIE].value).toBe('');
  });

  it('logout carrying the cookie WITHOUT the CSRF header → 403 (CSRF logout protection)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', [
        `${REFRESH_COOKIE}=${RT1}`,
        `${CSRF_COOKIE}=${'d'.repeat(64)}`,
      ])
      .send({})
      .expect(403);

    expect(logout).not.toHaveBeenCalled();
  });

  it('legacy body-token logout (no cookies) still works without CSRF', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ refreshToken: BODY_RT })
      .expect(200);

    expect(logout).toHaveBeenCalledWith(BODY_RT);
  });
});
