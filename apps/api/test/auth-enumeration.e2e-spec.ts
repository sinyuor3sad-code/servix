import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
// V-41: import the CJS module object so we can intercept compare()
// from outside auth.service.ts (which uses named-import `compare`).
// Both auth.service and this test ultimately resolve to the same
// underlying require('bcryptjs') singleton — patching the module
// object's `compare` property is observed by the service's already-
// bound named import via the V8 module-record indirection.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bcrypt = require('bcryptjs') as {
  compare: (a: string, b: string) => Promise<boolean>;
  hash: (a: string, n: number) => Promise<string>;
};
import { AuthService } from '../src/core/auth/auth.service';
import { PlatformPrismaClient } from '../src/shared/database/platform.client';
import { CacheService } from '../src/shared/cache/cache.service';
import { MailService } from '../src/shared/mail/mail.service';
import { SmsService } from '../src/shared/sms/sms.service';
import { TenantDatabaseService } from '../src/shared/database/tenant-database.service';
import { TwoFactorService } from '../src/core/auth/two-factor.service';
import { GoogleAuthService } from '../src/core/auth/google-auth.service';
import { AuditService } from '../src/core/audit/audit.service';
import { SentryService } from '../src/shared/sentry/sentry.service';

/**
 * V-41 — Email-enumeration hardening on login + verify2FALogin + forgotPassword.
 *
 * Six tests cover the two mitigation mechanisms:
 *
 *   Bcrypt timing equalization (login + verify2FALogin):
 *     1. login + unknown email → bcrypt.compare called (against DUMMY hash),
 *        UnauthorizedException with 'بيانات الدخول غير صحيحة'.
 *     2. login + known email + wrong password → bcrypt.compare called
 *        (against real hash), SAME message — parity proves enumeration
 *        can't distinguish via response timing OR message.
 *     3. verify2FALogin + unknown email → bcrypt.compare called, SAME
 *        message as login's unknown-email branch.
 *
 *   setTimeout jitter (forgotPassword):
 *     4. forgotPassword + unknown email → setTimeout called with a value
 *        in [800, 1500]ms (mimics mail+SMS network I/O latency).
 *     5. forgotPassword + known email → mail.send + sms.send fire (control
 *        test — confirms the found-user branch still works).
 *
 *   Regression guard:
 *     6. Message uniformity — login and verify2FALogin throw IDENTICAL
 *        error messages on user-not-found AND wrong-password paths.
 *        Drift in any of the 4 strings = test failure.
 *
 * Timing assertions are spy-based (bcrypt.compare and setTimeout) — NOT
 * wall-clock-based — to avoid CI flakiness.
 */

const JWT_ACCESS_SECRET = 'v41-test-access-secret-min-64-chars-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'aaaaaaaa-1111-1111-1111-111111111111';
const KNOWN_EMAIL = 'noura@example.com';
const UNKNOWN_EMAIL = 'attacker-probe@example.com';
const CORRECT_PASSWORD = 'CorrectPass1!';
const WRONG_PASSWORD = 'WrongPass!';
const IP = '10.0.0.42';

async function userRow(): Promise<Record<string, unknown>> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const passwordHash = await (require('bcryptjs') as typeof bcrypt).hash(CORRECT_PASSWORD, 12);
  return {
    id: USER_ID,
    fullName: 'نورة أحمد',
    email: KNOWN_EMAIL,
    phone: '+966512345678',
    passwordHash,
    isEmailVerified: true,
    twoFactorEnabled: true,
    twoFactorSecret: 'JBSWY3DPEHPK3PXP',
    twoFactorSecretEncrypted: null,
    avatarUrl: null,
    googleId: null,
    authProvider: 'local',
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('V-41 — email enumeration hardening', () => {
  let service: AuthService;
  let bcryptCompareSpy: jest.SpyInstance;

  const userFindFirst = jest.fn();
  const userFindUnique = jest.fn();
  const tenantUserFindMany = jest.fn().mockResolvedValue([]);
  const refreshTokenCreate = jest.fn().mockResolvedValue({ id: 'rt-id' });
  const passwordResetCreate = jest.fn().mockResolvedValue({ id: 'pr-id' });

  const checkLoginIpBlock = jest.fn().mockResolvedValue(0);
  const isAccountLocked = jest.fn().mockResolvedValue(false);
  const incrementLoginFailIp = jest.fn().mockResolvedValue({ count: 1, blockSeconds: 0 });
  const incrementLoginFailAccount = jest.fn().mockResolvedValue({ count: 1, locked: false });
  const resetLoginFailIp = jest.fn().mockResolvedValue(undefined);
  const resetLoginFailAccount = jest.fn().mockResolvedValue(undefined);
  const checkForgotPasswordRateLimit = jest.fn().mockResolvedValue(true);
  const incrementForgotPasswordAttempt = jest.fn().mockResolvedValue(undefined);

  const smsSend = jest.fn().mockResolvedValue(undefined);
  const mailSend = jest.fn().mockResolvedValue(undefined);
  const auditLog = jest.fn().mockResolvedValue(undefined);
  const verifyToken = jest.fn();

  const mockPrisma = {
    user: { findFirst: userFindFirst, findUnique: userFindUnique },
    tenantUser: { findMany: tenantUserFindMany },
    refreshToken: { create: refreshTokenCreate },
    passwordReset: { create: passwordResetCreate },
  };

  beforeEach(async () => {
    [
      userFindFirst, userFindUnique, tenantUserFindMany, refreshTokenCreate, passwordResetCreate,
      checkLoginIpBlock, isAccountLocked, incrementLoginFailIp, incrementLoginFailAccount,
      resetLoginFailIp, resetLoginFailAccount, checkForgotPasswordRateLimit, incrementForgotPasswordAttempt,
      smsSend, mailSend, auditLog, verifyToken,
    ].forEach((fn) => fn.mockReset());

    checkLoginIpBlock.mockResolvedValue(0);
    isAccountLocked.mockResolvedValue(false);
    incrementLoginFailIp.mockResolvedValue({ count: 1, blockSeconds: 0 });
    incrementLoginFailAccount.mockResolvedValue({ count: 1, locked: false });
    resetLoginFailIp.mockResolvedValue(undefined);
    resetLoginFailAccount.mockResolvedValue(undefined);
    checkForgotPasswordRateLimit.mockResolvedValue(true);
    incrementForgotPasswordAttempt.mockResolvedValue(undefined);
    smsSend.mockResolvedValue(undefined);
    mailSend.mockResolvedValue(undefined);
    auditLog.mockResolvedValue(undefined);
    tenantUserFindMany.mockResolvedValue([]);
    refreshTokenCreate.mockResolvedValue({ id: 'rt-id' });
    passwordResetCreate.mockResolvedValue({ id: 'pr-id' });

    // Re-spy bcrypt.compare each test so call-count starts at 0. We pass
    // through to the real implementation so the V-41 dummy-hash compare
    // actually executes (proving the timing-equalization side effect).
    bcryptCompareSpy = jest.spyOn(bcrypt, 'compare');

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          load: [() => ({
            jwt: { accessSecret: JWT_ACCESS_SECRET, accessExpiration: '15m', refreshExpiration: '7d' },
            APP_URL: 'http://localhost:3000',
          })],
        }),
        JwtModule.register({ secret: JWT_ACCESS_SECRET }),
      ],
      providers: [
        AuthService,
        { provide: PlatformPrismaClient, useValue: mockPrisma },
        { provide: CacheService, useValue: {
            checkLoginIpBlock, isAccountLocked,
            incrementLoginFailIp, incrementLoginFailAccount,
            resetLoginFailIp, resetLoginFailAccount,
            checkForgotPasswordRateLimit, incrementForgotPasswordAttempt,
            getPasswordChangedAt: jest.fn().mockResolvedValue(null),
            setPasswordChangedAt: jest.fn().mockResolvedValue(undefined),
            blacklistRefreshToken: jest.fn().mockResolvedValue(undefined),
        }},
        { provide: MailService, useValue: { send: mailSend } },
        { provide: SmsService, useValue: { send: smsSend } },
        { provide: TenantDatabaseService, useValue: {} },
        { provide: TwoFactorService, useValue: { verifyToken } },
        { provide: GoogleAuthService, useValue: {} },
        { provide: AuditService, useValue: { log: auditLog } },
        { provide: SentryService, useValue: { captureMessage: jest.fn(), captureException: jest.fn() } },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  afterEach(() => {
    bcryptCompareSpy.mockRestore();
  });

  // ────────────────────────────────────────────────────────────────────

  it('1. login + unknown email → bcrypt.compare runs against DUMMY hash (timing equalized)', async () => {
    userFindFirst.mockResolvedValueOnce(null);

    await expect(
      service.login({ emailOrPhone: UNKNOWN_EMAIL, password: WRONG_PASSWORD }, IP),
    ).rejects.toThrow(UnauthorizedException);

    // The critical V-41 assertion: bcrypt.compare WAS called even though
    // user lookup returned null — equalizes ~150ms against the wrong-
    // password branch.
    expect(bcryptCompareSpy).toHaveBeenCalledTimes(1);
    // First arg is the attacker's password attempt; second is the
    // DUMMY hash (which is a real $2b$12$… so compare actually runs).
    expect(bcryptCompareSpy.mock.calls[0][0]).toBe(WRONG_PASSWORD);
    expect(bcryptCompareSpy.mock.calls[0][1]).toMatch(/^\$2[aby]\$12\$/);
    // IP counter incremented (existing behavior).
    expect(incrementLoginFailIp).toHaveBeenCalledWith(IP);
  });

  it('2. login + known email + wrong password → bcrypt.compare runs against real hash (parity)', async () => {
    userFindFirst.mockResolvedValueOnce(await userRow());

    await expect(
      service.login({ emailOrPhone: KNOWN_EMAIL, password: WRONG_PASSWORD }, IP),
    ).rejects.toThrow(UnauthorizedException);

    expect(bcryptCompareSpy).toHaveBeenCalledTimes(1);
    expect(bcryptCompareSpy.mock.calls[0][0]).toBe(WRONG_PASSWORD);
    // Real user's bcrypt hash, also $2b$12$…
    expect(bcryptCompareSpy.mock.calls[0][1]).toMatch(/^\$2[aby]\$12\$/);
  });

  it('3. verify2FALogin + unknown email → bcrypt.compare runs (parity with login)', async () => {
    userFindFirst.mockResolvedValueOnce(null);

    await expect(
      service.verify2FALogin(UNKNOWN_EMAIL, WRONG_PASSWORD, '123456', IP),
    ).rejects.toThrow(UnauthorizedException);

    expect(bcryptCompareSpy).toHaveBeenCalledTimes(1);
    expect(bcryptCompareSpy.mock.calls[0][0]).toBe(WRONG_PASSWORD);
    expect(bcryptCompareSpy.mock.calls[0][1]).toMatch(/^\$2[aby]\$12\$/);
  });

  it('4. forgotPassword + unknown email → setTimeout fired with 800-1500ms jitter (no mail/SMS)', async () => {
    // Spy on real setTimeout (NO fake timers — fake timers + the await-
    // setTimeout-Promise pattern in the service deadlocks because the
    // microtask queue doesn't drain mid-timer-advancement under jest's
    // legacy timer model). The real setTimeout fires for 800-1500ms,
    // which is fine — we accept the wall-clock cost for the assertion.
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    userFindUnique.mockResolvedValueOnce(null);

    const result = await service.forgotPassword(UNKNOWN_EMAIL);

    // V-41 assertion: setTimeout was called with a value in [800, 1500].
    const jitterCalls = setTimeoutSpy.mock.calls.filter(
      (call) => typeof call[1] === 'number' && call[1] >= 800 && call[1] <= 1500,
    );
    expect(jitterCalls.length).toBeGreaterThanOrEqual(1);

    // The found-user branch's I/O never fires for unknown emails.
    expect(passwordResetCreate).not.toHaveBeenCalled();
    expect(mailSend).not.toHaveBeenCalled();
    expect(smsSend).not.toHaveBeenCalled();

    // Generic message returned (no enumeration via response body).
    expect(result.message).toMatch(/إذا كان البريد الإلكتروني مسجلاً/);

    setTimeoutSpy.mockRestore();
  }, 5000);

  it('5. forgotPassword + known email → mail.send + sms.send fire (control: found-user branch intact)', async () => {
    userFindUnique.mockResolvedValueOnce({
      id: USER_ID, email: KNOWN_EMAIL, fullName: 'نورة', phone: '+966512345678',
    });

    const result = await service.forgotPassword(KNOWN_EMAIL);

    expect(passwordResetCreate).toHaveBeenCalledTimes(1);
    expect(mailSend).toHaveBeenCalledTimes(1);
    expect(mailSend.mock.calls[0][0].to).toBe(KNOWN_EMAIL);
    expect(smsSend).toHaveBeenCalledTimes(1);
    expect(smsSend.mock.calls[0][0].to).toBe('+966512345678');
    // Same generic message — no enumeration via body.
    expect(result.message).toMatch(/إذا كان البريد الإلكتروني مسجلاً/);
  });

  it('6. Message uniformity — login + verify2FALogin throw IDENTICAL messages on unknown vs wrong-password (regression guard)', async () => {
    // login + unknown
    userFindFirst.mockResolvedValueOnce(null);
    let unknownLoginMsg: string | undefined;
    try { await service.login({ emailOrPhone: UNKNOWN_EMAIL, password: WRONG_PASSWORD }, IP); }
    catch (e) { unknownLoginMsg = (e as Error).message; }

    // login + wrong password
    userFindFirst.mockResolvedValueOnce(await userRow());
    let wrongPwLoginMsg: string | undefined;
    try { await service.login({ emailOrPhone: KNOWN_EMAIL, password: WRONG_PASSWORD }, IP); }
    catch (e) { wrongPwLoginMsg = (e as Error).message; }

    // verify2FALogin + unknown
    userFindFirst.mockResolvedValueOnce(null);
    let unknown2FAMsg: string | undefined;
    try { await service.verify2FALogin(UNKNOWN_EMAIL, WRONG_PASSWORD, '123456', IP); }
    catch (e) { unknown2FAMsg = (e as Error).message; }

    // verify2FALogin + wrong password
    userFindFirst.mockResolvedValueOnce(await userRow());
    let wrongPw2FAMsg: string | undefined;
    try { await service.verify2FALogin(KNOWN_EMAIL, WRONG_PASSWORD, '123456', IP); }
    catch (e) { wrongPw2FAMsg = (e as Error).message; }

    // The single source of truth.
    const EXPECTED = 'بيانات الدخول غير صحيحة';
    expect(unknownLoginMsg).toBe(EXPECTED);
    expect(wrongPwLoginMsg).toBe(EXPECTED);
    expect(unknown2FAMsg).toBe(EXPECTED);
    expect(wrongPw2FAMsg).toBe(EXPECTED);
    // Cross-check (drift guard).
    expect(unknownLoginMsg).toBe(wrongPwLoginMsg);
    expect(unknown2FAMsg).toBe(wrongPw2FAMsg);
    expect(unknownLoginMsg).toBe(unknown2FAMsg);
  });
});
