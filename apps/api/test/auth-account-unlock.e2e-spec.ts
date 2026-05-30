import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { hash } from 'bcryptjs';
import { BadRequestException } from '@nestjs/common';
import { AuthService } from '../src/core/auth/auth.service';
import { TwoFactorBackupCodeService } from '../src/core/auth/two-factor-backup-code.service';
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
 * V-40a — account self-unlock (post-V-25-lockout recovery via email).
 *
 * Uses the REAL AuthService against a stateful in-memory account_unlocks fake
 * so request→unlock flows genuinely (token created on request, looked up by
 * hash + atomically consumed on unlock). Covers the acceptance scenarios:
 *   (a) locked → request → unlock → lock cleared (resetLoginFailAccount)
 *   (b) uniform response + no email when not-found OR not-locked (V-41)
 *   (c) single-use — second unlock of the same token fails
 *   (d) expired token → 400 + failed audit, lock NOT cleared
 *   (e) rate-limit on request
 */

const JWT_ACCESS_SECRET = 'v40a-test-access-secret-min-64-chars-aaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'aaaaaaaa-4040-4040-4040-404040404040';
const EMAIL = 'huda@example.com';

async function userRow(): Promise<Record<string, unknown>> {
  return {
    id: USER_ID,
    fullName: 'هدى سالم',
    email: EMAIL,
    phone: '+966500000040',
    passwordHash: await hash('CorrectPass1!', 12),
    twoFactorEnabled: false,
    twoFactorSecret: null,
    isEmailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// Stateful in-memory account_unlocks fake — honours the usedAt single-use guard.
function makeUnlockFake() {
  let rows: { id: string; userId: string; tokenHash: string; expiresAt: Date; usedAt: Date | null }[] = [];
  let seq = 0;
  return {
    reset() { rows = []; seq = 0; },
    model: {
      create: jest.fn(({ data }: { data: { userId: string; tokenHash: string; expiresAt: Date } }) => {
        const r = { id: `au-${seq++}`, usedAt: null, ...data };
        rows.push(r);
        return Promise.resolve(r);
      }),
      findUnique: jest.fn(({ where }: { where: { tokenHash: string } }) =>
        Promise.resolve(rows.find((r) => r.tokenHash === where.tokenHash) ?? null),
      ),
      updateMany: jest.fn(({ where, data }: { where: { id: string; usedAt: null }; data: { usedAt: Date } }) => {
        const r = rows.find((x) => x.id === where.id && x.usedAt === null);
        if (!r) return Promise.resolve({ count: 0 });
        r.usedAt = data.usedAt;
        return Promise.resolve({ count: 1 });
      }),
    },
  };
}

function tokenFromMail(call: { body: string; html: string }): string {
  const m = (call.body + call.html).match(/token=([a-f0-9-]+)/);
  if (!m) throw new Error('no unlock token in mail');
  return m[1];
}

describe('V-40a — account self-unlock', () => {
  let auth: AuthService;

  const userFindUnique = jest.fn();
  const isAccountLocked = jest.fn();
  const resetLoginFailAccount = jest.fn().mockResolvedValue(undefined);
  const checkAccountUnlockRateLimit = jest.fn().mockResolvedValue(true);
  const incrementAccountUnlockAttempt = jest.fn().mockResolvedValue(1);
  const mailSend = jest.fn().mockResolvedValue(undefined);
  const auditLog = jest.fn().mockResolvedValue(undefined);
  const unlockFake = makeUnlockFake();

  const mockPrisma = {
    user: { findUnique: userFindUnique },
    accountUnlock: unlockFake.model,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    unlockFake.reset();
    isAccountLocked.mockResolvedValue(true);
    checkAccountUnlockRateLimit.mockResolvedValue(true);
    mailSend.mockResolvedValue(undefined);
    auditLog.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ ignoreEnvFile: true, load: [() => ({ jwt: { accessSecret: JWT_ACCESS_SECRET, accessExpiration: '15m', refreshExpiration: '7d' }, APP_URL: 'http://localhost:3000' })] }),
        JwtModule.register({ secret: JWT_ACCESS_SECRET }),
      ],
      providers: [
        AuthService,
        TwoFactorBackupCodeService,
        { provide: PlatformPrismaClient, useValue: mockPrisma },
        { provide: CacheService, useValue: { isAccountLocked, resetLoginFailAccount, checkAccountUnlockRateLimit, incrementAccountUnlockAttempt } },
        { provide: MailService, useValue: { send: mailSend } },
        { provide: SmsService, useValue: { send: jest.fn().mockResolvedValue(undefined) } },
        { provide: TenantDatabaseService, useValue: {} },
        { provide: TwoFactorService, useValue: { verifyToken: jest.fn(), generateBackupCodes: jest.fn() } },
        { provide: GoogleAuthService, useValue: {} },
        { provide: AuditService, useValue: { log: auditLog } },
        { provide: SentryService, useValue: { captureMessage: jest.fn(), captureException: jest.fn() } },
      ],
    }).compile();
    auth = module.get(AuthService);
  });

  // (a) locked → request → unlock → lock cleared
  it('locked account: request emails a token, unlock clears the lock (resetLoginFailAccount)', async () => {
    userFindUnique.mockResolvedValue(await userRow());

    await auth.requestAccountUnlock(EMAIL);
    expect(mailSend).toHaveBeenCalledTimes(1);
    expect(auditLog.mock.calls.map((c) => c[0].action)).toContain('account_unlock_requested');

    const rawToken = tokenFromMail(mailSend.mock.calls[0][0]);
    const res = await auth.unlockAccount(rawToken);
    expect(res.message).toMatch(/فك قفل الحساب/);
    expect(resetLoginFailAccount).toHaveBeenCalledWith(USER_ID);
    expect(auditLog.mock.calls.map((c) => c[0].action)).toContain('account_unlock_completed');
  });

  // (b) uniform + no email for not-found OR not-locked (V-41)
  it('does not email (but returns uniform message) when the user does not exist', async () => {
    userFindUnique.mockResolvedValue(null);
    const res = await auth.requestAccountUnlock('nobody@example.com');
    expect(mailSend).not.toHaveBeenCalled();
    expect(res.message).toMatch(/إذا كان الحساب/);
    expect(auditLog.mock.calls.map((c) => c[0].action)).not.toContain('account_unlock_requested');
  });

  it('does not email when the account exists but is NOT locked', async () => {
    userFindUnique.mockResolvedValue(await userRow());
    isAccountLocked.mockResolvedValue(false);
    const res = await auth.requestAccountUnlock(EMAIL);
    expect(mailSend).not.toHaveBeenCalled();
    expect(res.message).toMatch(/إذا كان الحساب/);
  });

  // (c) single-use
  it('a token is single-use: the second unlock fails', async () => {
    userFindUnique.mockResolvedValue(await userRow());
    await auth.requestAccountUnlock(EMAIL);
    const rawToken = tokenFromMail(mailSend.mock.calls[0][0]);

    await auth.unlockAccount(rawToken); // first: ok
    await expect(auth.unlockAccount(rawToken)).rejects.toThrow(BadRequestException);
  });

  // (d) expired token
  it('rejects an expired token (400 + failed audit, lock NOT cleared)', async () => {
    userFindUnique.mockResolvedValue(await userRow());
    await auth.requestAccountUnlock(EMAIL);
    const rawToken = tokenFromMail(mailSend.mock.calls[0][0]);
    // force the stored row to be expired
    (unlockFake.model.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'au-0', userId: USER_ID, tokenHash: 'x', expiresAt: new Date(Date.now() - 1000), usedAt: null,
    });

    await expect(auth.unlockAccount(rawToken)).rejects.toThrow(BadRequestException);
    expect(resetLoginFailAccount).not.toHaveBeenCalled();
    expect(auditLog.mock.calls.map((c) => c[0].action)).toContain('account_unlock_failed');
  });

  // (e) rate-limit on request
  it('rate-limits unlock requests', async () => {
    checkAccountUnlockRateLimit.mockResolvedValue(false);
    await expect(auth.requestAccountUnlock(EMAIL)).rejects.toThrow(BadRequestException);
    expect(mailSend).not.toHaveBeenCalled();
  });
});
