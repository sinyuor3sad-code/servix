import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AuthController } from '../src/core/auth/auth.controller';
import { AuthService } from '../src/core/auth/auth.service';
import { TwoFactorService } from '../src/core/auth/two-factor.service';
import { TwoFactorBackupCodeService } from '../src/core/auth/two-factor-backup-code.service';
import { GoogleAuthService } from '../src/core/auth/google-auth.service';

/**
 * V-60 — class-validator DTO enforcement on 7 previously-inline-body auth endpoints.
 *
 * For each DTO we assert 3 cases:
 *   1. happy path → reaches the service (mock returns a fixture).
 *   2. missing required field → 400 BadRequest (Joi-equivalent at HTTP layer).
 *   3. extra field present → 400 (forbidNonWhitelisted from global ValidationPipe).
 *
 * Type-mismatch cases are deliberately skipped (Phase A decision 5) — class-
 * validator's own test suite covers them and we'd just duplicate.
 *
 * The global ValidationPipe config is replicated in beforeAll exactly as
 * main.ts:103-110 sets it: whitelist + forbidNonWhitelisted + transform +
 * enableImplicitConversion. Without forbidNonWhitelisted the extra-field
 * cases would silently pass (the field is stripped, service runs); we
 * explicitly rely on the rejection behaviour.
 */

const PUBLIC_DECORATOR_KEY = 'isPublic';

const mockAuthService = {
  verify2FALogin: jest.fn().mockResolvedValue({ user: {}, tokens: { accessToken: 't', refreshToken: 'r' } }),
  verifyResetToken: jest.fn().mockResolvedValue({ valid: true }),
  verifyEmailOtp: jest.fn().mockResolvedValue({ user: {}, tenants: [], tokens: { accessToken: 't', refreshToken: 'r' } }),
  resendEmailOtp: jest.fn().mockResolvedValue({ message: 'ok' }),
  verify2FA: jest.fn().mockResolvedValue({ message: 'ok' }),
  disable2FA: jest.fn().mockResolvedValue({ message: 'ok' }),
  googleLogin: jest.fn().mockResolvedValue({ user: {}, tenants: [], tokens: { accessToken: 't', refreshToken: 'r' } }),
  // Stubs so AuthController's dep-tree resolves; not invoked by these tests.
  register: jest.fn(), login: jest.fn(),
  refreshTokens: jest.fn(), logout: jest.fn(),
  forgotPassword: jest.fn(), resetPassword: jest.fn(),
  changePassword: jest.fn(), getMe: jest.fn(), updateMe: jest.fn(),
  setup2FA: jest.fn(), get2FAStatus: jest.fn(),
  linkGoogle: jest.fn(),
};

describe('V-60 — auth DTO validation enforcement', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: TwoFactorService, useValue: {} },
        { provide: TwoFactorBackupCodeService, useValue: { store: jest.fn(), verifyAndConsume: jest.fn(), deleteAll: jest.fn(), countUnused: jest.fn() } },
        { provide: GoogleAuthService, useValue: { isEnabled: () => true } },
        // Stub global JwtAuthGuard reflection lookup so @Public endpoints work
        // without the real APP_GUARD chain. @CurrentUser decorator on protected
        // endpoints reads req.user; we set it via a synthetic middleware below.
        { provide: 'APP_GUARD', useValue: {} },
        { provide: 'RolesGuard', useValue: {} },
        { provide: 'JwtAuthGuard', useValue: {} },
      ],
    })
      // Override the global Reflector so all controller routes behave as @Public
      // (we're testing payload validation, not auth — that's other suites).
      .overrideProvider('Reflector').useValue({
        getAllAndOverride: (key: string) => key === PUBLIC_DECORATOR_KEY ? true : undefined,
        get: () => undefined,
      })
      .compile();

    app = moduleRef.createNestApplication({ bodyParser: true });
    // Mirror main.ts:100-101 — without these the @Controller({version:'1'}) routes
    // resolve to /auth/... not /api/v1/auth/... and every test sees 404.
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
    // Inject a fake authenticated user on protected routes — bypasses the
    // global JwtAuthGuard which we didn't wire in this isolated test module.
    app.use((req: { user?: unknown }, _res: unknown, next: () => void) => {
      req.user = { sub: 'test-user-id', email: 'test@x.com' };
      next();
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    Object.values(mockAuthService).forEach((fn) => {
      if (typeof fn === 'function' && 'mockReset' in fn) (fn as jest.Mock).mockReset();
    });
    // Re-arm the 7 fixtures used in happy-path cases.
    mockAuthService.verify2FALogin.mockResolvedValue({ user: {}, tokens: { accessToken: 't', refreshToken: 'r' } });
    mockAuthService.verifyResetToken.mockResolvedValue({ valid: true });
    mockAuthService.verifyEmailOtp.mockResolvedValue({ user: {}, tenants: [], tokens: { accessToken: 't', refreshToken: 'r' } });
    mockAuthService.resendEmailOtp.mockResolvedValue({ message: 'ok' });
    mockAuthService.verify2FA.mockResolvedValue({ message: 'ok' });
    mockAuthService.disable2FA.mockResolvedValue({ message: 'ok' });
    mockAuthService.googleLogin.mockResolvedValue({ user: {}, tenants: [], tokens: { accessToken: 't', refreshToken: 'r' } });
  });

  // ────────────────────────── 1. Verify2FALoginDto ──────────────────────────

  describe('Verify2FALoginDto · POST /auth/2fa/verify-login', () => {
    const path = '/api/v1/auth/2fa/verify-login';
    const valid = { emailOrPhone: 'noura@x.com', password: 'CorrectPass1!', code: '123456' };

    it('happy: valid payload → 200 + service invoked', async () => {
      const res = await request(app.getHttpServer()).post(path).send(valid);
      expect(res.status).toBe(200);
      expect(mockAuthService.verify2FALogin).toHaveBeenCalledWith(valid.emailOrPhone, valid.password, valid.code, expect.any(String));
    });
    it('missing required (no code) → 400', async () => {
      const res = await request(app.getHttpServer()).post(path).send({ emailOrPhone: valid.emailOrPhone, password: valid.password });
      expect(res.status).toBe(400);
      expect(mockAuthService.verify2FALogin).not.toHaveBeenCalled();
    });
    it('extra field rejected (forbidNonWhitelisted) → 400', async () => {
      const res = await request(app.getHttpServer()).post(path).send({ ...valid, extraEvilField: 'attacker' });
      expect(res.status).toBe(400);
      expect(mockAuthService.verify2FALogin).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────── 2. VerifyResetTokenDto ──────────────────────────

  describe('VerifyResetTokenDto · POST /auth/verify-reset-token', () => {
    const path = '/api/v1/auth/verify-reset-token';
    const valid = { token: 'a'.repeat(64) };

    it('happy: valid payload → 200', async () => {
      const res = await request(app.getHttpServer()).post(path).send(valid);
      expect(res.status).toBe(200);
      expect(mockAuthService.verifyResetToken).toHaveBeenCalledWith(valid.token);
    });
    it('missing required (no token) → 400', async () => {
      const res = await request(app.getHttpServer()).post(path).send({});
      expect(res.status).toBe(400);
      expect(mockAuthService.verifyResetToken).not.toHaveBeenCalled();
    });
    it('extra field rejected → 400', async () => {
      const res = await request(app.getHttpServer()).post(path).send({ ...valid, password: 'sneaky' });
      expect(res.status).toBe(400);
      expect(mockAuthService.verifyResetToken).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────── 3. VerifyOtpDto ──────────────────────────

  describe('VerifyOtpDto · POST /auth/verify-otp', () => {
    const path = '/api/v1/auth/verify-otp';
    const valid = { email: 'noura@x.com', code: '654321' };

    it('happy: valid payload → 200', async () => {
      const res = await request(app.getHttpServer()).post(path).send(valid);
      expect(res.status).toBe(200);
      expect(mockAuthService.verifyEmailOtp).toHaveBeenCalledWith(valid.email, valid.code);
    });
    it('missing required (no code) → 400', async () => {
      const res = await request(app.getHttpServer()).post(path).send({ email: valid.email });
      expect(res.status).toBe(400);
      expect(mockAuthService.verifyEmailOtp).not.toHaveBeenCalled();
    });
    it('extra field rejected → 400', async () => {
      const res = await request(app.getHttpServer()).post(path).send({ ...valid, role: 'admin' });
      expect(res.status).toBe(400);
      expect(mockAuthService.verifyEmailOtp).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────── 4. ResendOtpDto ──────────────────────────

  describe('ResendOtpDto · POST /auth/resend-otp', () => {
    const path = '/api/v1/auth/resend-otp';
    const valid = { email: 'noura@x.com' };

    it('happy: valid payload → 200', async () => {
      const res = await request(app.getHttpServer()).post(path).send(valid);
      expect(res.status).toBe(200);
      expect(mockAuthService.resendEmailOtp).toHaveBeenCalledWith(valid.email);
    });
    it('missing required (no email) → 400', async () => {
      const res = await request(app.getHttpServer()).post(path).send({});
      expect(res.status).toBe(400);
      expect(mockAuthService.resendEmailOtp).not.toHaveBeenCalled();
    });
    it('extra field rejected → 400', async () => {
      const res = await request(app.getHttpServer()).post(path).send({ ...valid, bypassRateLimit: true });
      expect(res.status).toBe(400);
      expect(mockAuthService.resendEmailOtp).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────── 5. Verify2FADto ──────────────────────────

  describe('Verify2FADto · POST /auth/2fa/verify', () => {
    const path = '/api/v1/auth/2fa/verify';
    const valid = { code: '987654' };

    it('happy: valid payload → 200', async () => {
      const res = await request(app.getHttpServer()).post(path).send(valid);
      expect(res.status).toBe(200);
      expect(mockAuthService.verify2FA).toHaveBeenCalledWith('test-user-id', valid.code);
    });
    it('missing required (no code) → 400', async () => {
      const res = await request(app.getHttpServer()).post(path).send({});
      expect(res.status).toBe(400);
      expect(mockAuthService.verify2FA).not.toHaveBeenCalled();
    });
    it('extra field rejected → 400', async () => {
      const res = await request(app.getHttpServer()).post(path).send({ ...valid, userId: 'attacker' });
      expect(res.status).toBe(400);
      expect(mockAuthService.verify2FA).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────── 6. Disable2FADto ──────────────────────────

  describe('Disable2FADto · DELETE /auth/2fa', () => {
    const path = '/api/v1/auth/2fa';
    const valid = { password: 'CurrentPass1!' };

    it('happy: valid payload → 200', async () => {
      const res = await request(app.getHttpServer()).delete(path).send(valid);
      expect(res.status).toBe(200);
      expect(mockAuthService.disable2FA).toHaveBeenCalledWith('test-user-id', valid.password);
    });
    it('missing required (no password) → 400', async () => {
      const res = await request(app.getHttpServer()).delete(path).send({});
      expect(res.status).toBe(400);
      expect(mockAuthService.disable2FA).not.toHaveBeenCalled();
    });
    it('extra field rejected → 400', async () => {
      const res = await request(app.getHttpServer()).delete(path).send({ ...valid, force: true });
      expect(res.status).toBe(400);
      expect(mockAuthService.disable2FA).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────── 7. GoogleLoginDto ──────────────────────────

  describe('GoogleLoginDto · POST /auth/google', () => {
    const path = '/api/v1/auth/google';
    const valid = { idToken: 'ya29.a0AfH6SMD-google-id-token-mock' };

    it('happy: valid payload → 200', async () => {
      const res = await request(app.getHttpServer()).post(path).send(valid);
      expect(res.status).toBe(200);
      expect(mockAuthService.googleLogin).toHaveBeenCalledWith(valid.idToken);
    });
    it('missing required (no idToken) → 400', async () => {
      const res = await request(app.getHttpServer()).post(path).send({});
      expect(res.status).toBe(400);
      expect(mockAuthService.googleLogin).not.toHaveBeenCalled();
    });
    it('extra field rejected → 400', async () => {
      const res = await request(app.getHttpServer()).post(path).send({ ...valid, sub: 'attacker-google-id' });
      expect(res.status).toBe(400);
      expect(mockAuthService.googleLogin).not.toHaveBeenCalled();
    });
  });
});
