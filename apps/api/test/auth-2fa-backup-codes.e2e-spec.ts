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
 * V-42 — 2FA backup (recovery) codes.
 *
 * Exercises the REAL TwoFactorBackupCodeService (bcrypt + atomic single-use)
 * through verify2FALogin / regenerateBackupCodes, backed by a small stateful
 * in-memory `two_factor_backup_codes` fake that honours `usedAt`. Covers the 5
 * acceptance scenarios:
 *   (a) backup code logs in, then is single-use (reuse fails)
 *   (b) exhaustion — every code works once
 *   (c) regenerate invalidates the old set
 *   (d) backup-code failure goes through the SAME V-25 lockout (no bypass)
 *   (e) format routing — 6 digits → TOTP, otherwise → backup
 */

const JWT_ACCESS_SECRET = 'v42-test-access-secret-min-64-chars-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'aaaaaaaa-2222-2222-2222-222222222222';
const IP = '10.0.0.99';
const TOTP_SECRET = 'JBSWY3DPEHPK3PXP';
const PASSWORD = 'CorrectPass1!';
const EMAIL = 'reem@example.com';

async function userRow(): Promise<Record<string, unknown>> {
  return {
    id: USER_ID,
    fullName: 'ريم خالد',
    email: EMAIL,
    phone: '+966500000042',
    passwordHash: await hash(PASSWORD, 12),
    twoFactorEnabled: true,
    twoFactorSecret: TOTP_SECRET,
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

// Stateful in-memory fake for the two_factor_backup_codes table — honours the
// usedAt single-use guard so the REAL service logic is exercised end-to-end.
function makeBackupTableFake() {
  let rows: { id: string; userId: string; codeHash: string; usedAt: Date | null }[] = [];
  let seq = 0;
  return {
    reset() {
      rows = [];
      seq = 0;
    },
    model: {
      deleteMany: jest.fn(({ where }: { where: { userId: string } }) => {
        rows = rows.filter((r) => r.userId !== where.userId);
        return Promise.resolve({ count: 0 });
      }),
      createMany: jest.fn(({ data }: { data: { userId: string; codeHash: string }[] }) => {
        data.forEach((d) => rows.push({ id: `bc-${seq++}`, userId: d.userId, codeHash: d.codeHash, usedAt: null }));
        return Promise.resolve({ count: data.length });
      }),
      findMany: jest.fn(({ where }: { where: { userId: string; usedAt: null } }) =>
        Promise.resolve(
          rows
            .filter((r) => r.userId === where.userId && r.usedAt === null)
            .map((r) => ({ id: r.id, codeHash: r.codeHash })),
        ),
      ),
      updateMany: jest.fn(({ where, data }: { where: { id: string; usedAt: null }; data: { usedAt: Date } }) => {
        const row = rows.find((r) => r.id === where.id && r.usedAt === null);
        if (!row) return Promise.resolve({ count: 0 });
        row.usedAt = data.usedAt;
        return Promise.resolve({ count: 1 });
      }),
      count: jest.fn(({ where }: { where: { userId: string; usedAt: null } }) =>
        Promise.resolve(rows.filter((r) => r.userId === where.userId && r.usedAt === null).length),
      ),
    },
  };
}

describe('V-42 — 2FA backup codes', () => {
  let auth: AuthService;
  let backupCodes: TwoFactorBackupCodeService;

  const userFindFirst = jest.fn();
  const userFindUnique = jest.fn();
  const verifyToken = jest.fn();
  const generateBackupCodes = jest.fn();
  const incrementLoginFailAccount = jest.fn();
  const auditLog = jest.fn().mockResolvedValue(undefined);
  const backupTable = makeBackupTableFake();

  const mockPrisma = {
    user: { findFirst: userFindFirst, findUnique: userFindUnique },
    tenantUser: { findMany: jest.fn().mockResolvedValue([]) },
    refreshToken: { create: jest.fn().mockResolvedValue({ id: 'rt' }) },
    twoFactorBackupCode: backupTable.model,
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    backupTable.reset();
    auditLog.mockResolvedValue(undefined);
    incrementLoginFailAccount.mockResolvedValue({ count: 1, locked: false });

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          load: [() => ({ jwt: { accessSecret: JWT_ACCESS_SECRET, accessExpiration: '15m', refreshExpiration: '7d' } })],
        }),
        JwtModule.register({ secret: JWT_ACCESS_SECRET }),
      ],
      providers: [
        AuthService,
        TwoFactorBackupCodeService, // REAL — injected with mockPrisma below
        { provide: PlatformPrismaClient, useValue: mockPrisma },
        { provide: CacheService, useValue: {
            checkLoginIpBlock: jest.fn().mockResolvedValue(0),
            isAccountLocked: jest.fn().mockResolvedValue(false),
            incrementLoginFailIp: jest.fn().mockResolvedValue({ count: 1, blockSeconds: 0 }),
            incrementLoginFailAccount,
            resetLoginFailIp: jest.fn().mockResolvedValue(undefined),
            resetLoginFailAccount: jest.fn().mockResolvedValue(undefined),
            getPasswordChangedAt: jest.fn().mockResolvedValue(null),
            setPasswordChangedAt: jest.fn().mockResolvedValue(undefined),
            blacklistRefreshToken: jest.fn().mockResolvedValue(undefined),
        }},
        { provide: MailService, useValue: {} },
        { provide: SmsService, useValue: { send: jest.fn().mockResolvedValue(undefined) } },
        { provide: TenantDatabaseService, useValue: {} },
        { provide: TwoFactorService, useValue: { verifyToken, generateBackupCodes } },
        { provide: GoogleAuthService, useValue: {} },
        { provide: AuditService, useValue: { log: auditLog } },
        { provide: SentryService, useValue: { captureMessage: jest.fn(), captureException: jest.fn() } },
      ],
    }).compile();

    auth = module.get(AuthService);
    backupCodes = module.get(TwoFactorBackupCodeService);
  });

  const CODES = ['AAAA-1111', 'BBBB-2222', 'CCCC-3333', 'DDDD-4444'];
  const seed = () => backupCodes.store(USER_ID, CODES);

  // (a) backup code logs in + single-use
  it('a backup code logs in, then is rejected on reuse (single-use)', async () => {
    await seed();
    userFindFirst.mockResolvedValue(await userRow());

    const result = await auth.verify2FALogin(EMAIL, PASSWORD, CODES[0], IP);
    expect(result.tokens.accessToken.split('.').length).toBe(3);
    expect(verifyToken).not.toHaveBeenCalled(); // routed to backup, not TOTP
    const usedAudit = auditLog.mock.calls.map((c) => c[0]).find((a) => a.action === 'auth_2fa_backup_code_used');
    expect(usedAudit).toBeDefined();
    expect(usedAudit.newValues.remainingCodes).toBe(3);

    // reuse → rejected
    userFindFirst.mockResolvedValue(await userRow());
    await expect(auth.verify2FALogin(EMAIL, PASSWORD, CODES[0], IP)).rejects.toThrow(BadRequestException);
  });

  // (b) exhaustion — every code works exactly once
  it('every code works exactly once (exhaustion)', async () => {
    await seed();
    for (const code of CODES) {
      userFindFirst.mockResolvedValue(await userRow());
      const r = await auth.verify2FALogin(EMAIL, PASSWORD, code, IP);
      expect(r.tokens.accessToken.split('.').length).toBe(3);
    }
    expect(await backupCodes.countUnused(USER_ID)).toBe(0);
    // a now-used code fails
    userFindFirst.mockResolvedValue(await userRow());
    await expect(auth.verify2FALogin(EMAIL, PASSWORD, CODES[0], IP)).rejects.toThrow(BadRequestException);
  });

  // (c) regenerate invalidates the old set
  it('regenerate (with valid TOTP) invalidates the old codes and issues new ones', async () => {
    await seed();
    verifyToken.mockReturnValue(true); // current TOTP valid for regenerate
    generateBackupCodes.mockReturnValue(['NEW1-AAAA', 'NEW2-BBBB', 'NEW3-CCCC']);
    userFindUnique.mockResolvedValue(await userRow());

    const { backupCodes: fresh } = await auth.regenerateBackupCodes(USER_ID, '123456');
    expect(fresh).not.toHaveLength(0);
    // old code no longer works
    userFindFirst.mockResolvedValue(await userRow());
    await expect(auth.verify2FALogin(EMAIL, PASSWORD, CODES[0], IP)).rejects.toThrow(BadRequestException);
    const regenAudit = auditLog.mock.calls.map((c) => c[0]).find((a) => a.action === 'auth_2fa_backup_codes_regenerated');
    expect(regenAudit).toBeDefined();
  });

  // (d) backup-code failure → SAME V-25 lockout path (no bypass)
  it('a failed backup code increments the V-25 lockout counter (reason=backup_code_invalid)', async () => {
    await seed();
    userFindFirst.mockResolvedValue(await userRow());

    await expect(auth.verify2FALogin(EMAIL, PASSWORD, 'ZZZZ-9999', IP)).rejects.toThrow(BadRequestException);

    expect(incrementLoginFailAccount).toHaveBeenCalledWith(USER_ID);
    const failAudit = auditLog.mock.calls.map((c) => c[0]).find((a) => a.action === 'auth_2fa_verify_failed');
    expect(failAudit).toBeDefined();
    expect(failAudit.newValues.reason).toBe('backup_code_invalid');
  });

  // (e) format routing — 6 digits → TOTP, otherwise → backup
  it('routes a 6-digit code to TOTP (not backup) and a dashed code to backup', async () => {
    await seed();
    verifyToken.mockReturnValue(true);

    // 6-digit → TOTP path
    userFindFirst.mockResolvedValue(await userRow());
    await auth.verify2FALogin(EMAIL, PASSWORD, '123456', IP);
    expect(verifyToken).toHaveBeenCalledWith(TOTP_SECRET, '123456');
    expect(await backupCodes.countUnused(USER_ID)).toBe(CODES.length); // no backup consumed

    // dashed → backup path (TOTP verifier not consulted for it)
    verifyToken.mockClear();
    userFindFirst.mockResolvedValue(await userRow());
    await auth.verify2FALogin(EMAIL, PASSWORD, CODES[0], IP);
    expect(verifyToken).not.toHaveBeenCalled();
    expect(await backupCodes.countUnused(USER_ID)).toBe(CODES.length - 1);
  });
});
