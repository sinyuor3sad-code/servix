import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { hash } from 'bcryptjs';
import {
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../src/core/auth/auth.service';
import { PlatformPrismaClient } from '../src/shared/database/platform.client';
import { CacheService } from '../src/shared/cache/cache.service';
import { MailService } from '../src/shared/mail/mail.service';
import { SmsService } from '../src/shared/sms/sms.service';
import { TenantDatabaseService } from '../src/shared/database/tenant-database.service';
import { TwoFactorService } from '../src/core/auth/two-factor.service';
import { TwoFactorBackupCodeService } from '../src/core/auth/two-factor-backup-code.service';
import { GoogleAuthService } from '../src/core/auth/google-auth.service';
import { AuditService } from '../src/core/audit/audit.service';
import { SentryService } from '../src/shared/sentry/sentry.service';

/**
 * V-25 — 2FA verify lockout parity.
 *
 * Pre-V-25 verify2FALogin had no IP-block check, no account-lock check,
 * and no fail counters — only the controller's @RateLimit(10, 60).
 * After V-25 it mirrors login (auth.service.ts:212-271) exactly: IP gate
 * → user lookup → account-lock gate (before bcrypt) → password compare →
 * 2FA-enabled check → TOTP verify → counter reset on success.
 *
 * Counters are SHARED with login (same Redis keyspace). Both password-
 * fail and code-fail paths inside verify2FALogin increment them via the
 * private handle2FAFailure helper.
 *
 * 7 cases (per Phase A decision 8):
 *   1. valid password + valid code → tokens + counters reset
 *   2. valid password + invalid code → 401 + counter incremented + audit reason='code_invalid'
 *   3. invalid password (single) → 401 + counter incremented + audit reason='password_invalid'
 *   4. 10 invalid attempts → account locked + auth_2fa_lockout_triggered audit + SMS spy fires ONCE
 *   5. locked account + valid credentials → 401 (lockout precedes success)
 *   6. IP blocked → 401 before any user lookup (bcrypt short-circuit verified)
 *   7. success path resets both IP + account counters
 */

const JWT_ACCESS_SECRET = 'v25-test-access-secret-min-64-chars-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'aaaaaaaa-1111-1111-1111-111111111111';
const IP = '10.0.0.42';
const VALID_CODE = '123456';
const VALID_TOTP_SECRET = 'JBSWY3DPEHPK3PXP'; // base32 dummy

async function userRow(): Promise<Record<string, unknown>> {
  const passwordHash = await hash('CorrectPass1!', 12);
  return {
    id: USER_ID,
    fullName: 'نورة أحمد',
    email: 'noura@example.com',
    phone: '+966512345678',
    passwordHash,
    twoFactorEnabled: true,
    twoFactorSecret: VALID_TOTP_SECRET,
    twoFactorSecretEncrypted: null,
    isEmailVerified: true,
    avatarUrl: null,
    googleId: null,
    authProvider: 'local',
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('V-25 — 2FA verify lockout parity', () => {
  let service: AuthService;

  const userFindFirst = jest.fn();
  const tenantUserFindMany = jest.fn().mockResolvedValue([]);
  const refreshTokenCreate = jest.fn().mockResolvedValue({ id: 'rt-id' });

  const checkLoginIpBlock = jest.fn();
  const isAccountLocked = jest.fn();
  const incrementLoginFailIp = jest.fn();
  const incrementLoginFailAccount = jest.fn();
  const resetLoginFailIp = jest.fn().mockResolvedValue(undefined);
  const resetLoginFailAccount = jest.fn().mockResolvedValue(undefined);

  const verifyToken = jest.fn();
  const smsSend = jest.fn().mockResolvedValue(undefined);
  const auditLog = jest.fn().mockResolvedValue(undefined);

  const mockPrisma = {
    user: { findFirst: userFindFirst, findUnique: jest.fn() },
    tenantUser: { findMany: tenantUserFindMany },
    refreshToken: { create: refreshTokenCreate },
  };

  beforeEach(async () => {
    [
      userFindFirst, tenantUserFindMany,
      checkLoginIpBlock, isAccountLocked,
      incrementLoginFailIp, incrementLoginFailAccount,
      resetLoginFailIp, resetLoginFailAccount,
      verifyToken, smsSend, auditLog,
    ].forEach((fn) => fn.mockReset());

    checkLoginIpBlock.mockResolvedValue(0);                    // not blocked
    isAccountLocked.mockResolvedValue(false);                  // not locked
    incrementLoginFailIp.mockResolvedValue({ count: 1, blockSeconds: 0 });
    incrementLoginFailAccount.mockResolvedValue({ count: 1, locked: false });
    resetLoginFailIp.mockResolvedValue(undefined);
    resetLoginFailAccount.mockResolvedValue(undefined);
    tenantUserFindMany.mockResolvedValue([]);
    refreshTokenCreate.mockResolvedValue({ id: 'rt-id' });
    smsSend.mockResolvedValue(undefined);
    auditLog.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          load: [() => ({
            jwt: { accessSecret: JWT_ACCESS_SECRET, accessExpiration: '15m', refreshExpiration: '7d' },
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
            getPasswordChangedAt: jest.fn().mockResolvedValue(null),
            setPasswordChangedAt: jest.fn().mockResolvedValue(undefined),
            blacklistRefreshToken: jest.fn().mockResolvedValue(undefined),
        }},
        { provide: MailService, useValue: {} },
        { provide: SmsService, useValue: { send: smsSend } },
        { provide: TenantDatabaseService, useValue: {} },
        { provide: TwoFactorService, useValue: { verifyToken } },
        { provide: TwoFactorBackupCodeService, useValue: { store: jest.fn(), verifyAndConsume: jest.fn(), deleteAll: jest.fn(), countUnused: jest.fn() } },
        { provide: GoogleAuthService, useValue: {} },
        { provide: AuditService, useValue: { log: auditLog } },
        { provide: SentryService, useValue: { captureMessage: jest.fn(), captureException: jest.fn() } },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  // ────────────────────────────────────────────────────────────────────

  it('valid password + valid code → tokens issued + counters reset', async () => {
    userFindFirst.mockResolvedValueOnce(await userRow());
    verifyToken.mockReturnValueOnce(true);

    const result = await service.verify2FALogin(
      'noura@example.com', 'CorrectPass1!', VALID_CODE, IP,
    );

    expect(result.tokens.accessToken.split('.').length).toBe(3);
    expect(resetLoginFailIp).toHaveBeenCalledWith(IP);
    expect(resetLoginFailAccount).toHaveBeenCalledWith(USER_ID);

    // No fail increments on success path.
    expect(incrementLoginFailIp).not.toHaveBeenCalled();
    expect(incrementLoginFailAccount).not.toHaveBeenCalled();

    // Success audit row emitted.
    const successAudit = auditLog.mock.calls
      .map((c) => c[0])
      .find((a) => a.action === 'auth_2fa_verify_success');
    expect(successAudit).toBeDefined();
    expect(successAudit.userId).toBe(USER_ID);
  });

  it('valid password + invalid code → 401 + counter incremented + audit reason=code_invalid', async () => {
    userFindFirst.mockResolvedValueOnce(await userRow());
    verifyToken.mockReturnValueOnce(false);
    incrementLoginFailIp.mockResolvedValueOnce({ count: 1, blockSeconds: 0 });
    incrementLoginFailAccount.mockResolvedValueOnce({ count: 1, locked: false });

    await expect(
      service.verify2FALogin('noura@example.com', 'CorrectPass1!', '000000', IP),
    ).rejects.toThrow(BadRequestException);

    expect(incrementLoginFailIp).toHaveBeenCalledWith(IP);
    expect(incrementLoginFailAccount).toHaveBeenCalledWith(USER_ID);
    // No SMS, no lockout audit on this single non-transition fail.
    expect(smsSend).not.toHaveBeenCalled();

    const failAudit = auditLog.mock.calls
      .map((c) => c[0])
      .find((a) => a.action === 'auth_2fa_verify_failed');
    expect(failAudit).toBeDefined();
    expect(failAudit.newValues.reason).toBe('code_invalid');
    expect(failAudit.newValues.accountLocked).toBe(false);
    expect(failAudit.newValues.accountFailCount).toBe(1);
  });

  it('invalid password (single) → 401 + counter incremented + audit reason=password_invalid (BONUS)', async () => {
    userFindFirst.mockResolvedValueOnce(await userRow());
    incrementLoginFailIp.mockResolvedValueOnce({ count: 1, blockSeconds: 0 });
    incrementLoginFailAccount.mockResolvedValueOnce({ count: 1, locked: false });

    await expect(
      service.verify2FALogin('noura@example.com', 'WrongPass!', VALID_CODE, IP),
    ).rejects.toThrow(UnauthorizedException);

    expect(incrementLoginFailIp).toHaveBeenCalledWith(IP);
    expect(incrementLoginFailAccount).toHaveBeenCalledWith(USER_ID);

    // TOTP verifier was NEVER called — password fail short-circuits before code path.
    expect(verifyToken).not.toHaveBeenCalled();

    const failAudit = auditLog.mock.calls
      .map((c) => c[0])
      .find((a) => a.action === 'auth_2fa_verify_failed');
    expect(failAudit).toBeDefined();
    expect(failAudit.newValues.reason).toBe('password_invalid');
  });

  it('account lockout transition → SMS fires ONCE + auth_2fa_lockout_triggered audit emitted', async () => {
    userFindFirst.mockResolvedValueOnce(await userRow());
    verifyToken.mockReturnValueOnce(false);
    incrementLoginFailIp.mockResolvedValueOnce({ count: 10, blockSeconds: 0 });
    incrementLoginFailAccount.mockResolvedValueOnce({ count: 10, locked: true });  // ← transition

    await expect(
      service.verify2FALogin('noura@example.com', 'CorrectPass1!', '000000', IP),
    ).rejects.toThrow(BadRequestException);

    // SMS sent exactly once (transition-only).
    expect(smsSend).toHaveBeenCalledTimes(1);
    expect(smsSend.mock.calls[0][0].to).toBe('+966512345678');
    expect(smsSend.mock.calls[0][0].message).toMatch(/تم قفل حسابك/);

    // Both audit rows present: the verify-failed row AND the lockout-triggered row.
    const actions = auditLog.mock.calls.map((c) => c[0].action);
    expect(actions).toContain('auth_2fa_verify_failed');
    expect(actions).toContain('auth_2fa_lockout_triggered');

    const lockoutAudit = auditLog.mock.calls
      .map((c) => c[0])
      .find((a) => a.action === 'auth_2fa_lockout_triggered');
    expect(lockoutAudit.newValues.triggeringReason).toBe('code_invalid');
    expect(lockoutAudit.newValues.accountFailCount).toBe(10);
    expect(lockoutAudit.newValues.lockoutTtlSeconds).toBe(24 * 60 * 60);
  });

  it('locked account + valid credentials → 401 (lockout precedes success, bcrypt skipped)', async () => {
    userFindFirst.mockResolvedValueOnce(await userRow());
    isAccountLocked.mockResolvedValueOnce(true);

    await expect(
      service.verify2FALogin('noura@example.com', 'CorrectPass1!', VALID_CODE, IP),
    ).rejects.toThrow(UnauthorizedException);

    // bcrypt + TOTP verify were NEVER called — fast-reject for locked account.
    expect(verifyToken).not.toHaveBeenCalled();
    // No counter increments (account is already locked; no new fail to record).
    expect(incrementLoginFailIp).not.toHaveBeenCalled();
    expect(incrementLoginFailAccount).not.toHaveBeenCalled();

    // Audit row indicates the gate that fired.
    const failAudit = auditLog.mock.calls
      .map((c) => c[0])
      .find((a) => a.action === 'auth_2fa_verify_failed');
    expect(failAudit).toBeDefined();
    expect(failAudit.newValues.reason).toBe('account_locked');
  });

  it('IP blocked → 401 before any user lookup (DB short-circuit verified)', async () => {
    checkLoginIpBlock.mockResolvedValueOnce(900); // 15min block

    await expect(
      service.verify2FALogin('noura@example.com', 'CorrectPass1!', VALID_CODE, IP),
    ).rejects.toThrow(/15 دقيقة|محاولات الدخول/);

    // DB lookup, bcrypt, and TOTP all skipped.
    expect(userFindFirst).not.toHaveBeenCalled();
    expect(verifyToken).not.toHaveBeenCalled();
    // No audit per-attempt on IP block (block itself was audited at trigger).
    expect(auditLog).not.toHaveBeenCalled();
  });

  it('success path resets BOTH counters (parity with login)', async () => {
    userFindFirst.mockResolvedValueOnce(await userRow());
    verifyToken.mockReturnValueOnce(true);

    await service.verify2FALogin('noura@example.com', 'CorrectPass1!', VALID_CODE, IP);

    expect(resetLoginFailIp).toHaveBeenCalledTimes(1);
    expect(resetLoginFailIp).toHaveBeenCalledWith(IP);
    expect(resetLoginFailAccount).toHaveBeenCalledTimes(1);
    expect(resetLoginFailAccount).toHaveBeenCalledWith(USER_ID);
  });
});
