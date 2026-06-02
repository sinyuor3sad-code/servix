import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { AdminService } from '../src/core/admin/admin.service';
import { AuthService } from '../src/core/auth/auth.service';
import { PlatformPrismaClient } from '../src/shared/database/platform.client';
import { PlatformSettingsService } from '../src/shared/database/platform-settings.service';
import { CacheService } from '../src/shared/cache/cache.service';
import { EventsGateway } from '../src/shared/events/events.gateway';
import { MailService } from '../src/shared/mail/mail.service';
import { SmsService } from '../src/shared/sms/sms.service';
import { TenantDatabaseService } from '../src/shared/database/tenant-database.service';
import { TwoFactorService } from '../src/core/auth/two-factor.service';
import { TwoFactorBackupCodeService } from '../src/core/auth/two-factor-backup-code.service';
import { GoogleAuthService } from '../src/core/auth/google-auth.service';
import { AuditService } from '../src/core/audit/audit.service';
import { SentryService } from '../src/shared/sentry/sentry.service';

/**
 * V-24 — Admin password reset link is hash-at-rest.
 *
 * Pre-V-24 the admin path at admin.service.sendPasswordResetLink stored
 * the raw 32-byte token directly in password_resets.token and console.log'd
 * it. After V-24 the column persists sha256 hex (matching the self-serve
 * forgotPassword convention) and the raw value is returned in the response
 * body for manual delivery until MailService is wired (V-24-email follow-up).
 *
 * The 6 cases cover the V-24 contract end-to-end:
 *   1. sendPasswordResetLink stores HASH (not raw) + response surfaces raw
 *      + audit row carries tokenHashPrefix only (8 chars, never full hash).
 *   2. auth.service.resetPassword + admin-issued raw token → password set,
 *      usedAt marked. This also asserts the incidental "admin link is no
 *      longer un-redeemable" correctness fix.
 *   3. resetPassword + invalid token → BadRequest, no mutation.
 *   4. resetPassword + expired token → BadRequest, no mutation.
 *   5. resetPassword + already-used token → BadRequest, no mutation.
 *   6. console.log absence regression guard — grep over the production
 *      file confirming the V-24 fix did not regress (covered separately
 *      in the pre-push checklist; not an e2e assertion).
 *
 * Pattern follows V-13a/V-14: AdminService instantiated via Nest
 * TestingModule with mocked PlatformPrismaClient, no live Postgres needed.
 * The auth-side verifier is exercised via the real AuthService instance
 * sharing the same mocked prisma — proves the end-to-end contract.
 */

const ADMIN_ID = 'aaaaaaaa-1111-1111-1111-111111111111';
const TARGET_USER_ID = 'bbbbbbbb-2222-2222-2222-222222222222';
const RESET_ROW_ID = 'cccccccc-3333-3333-3333-333333333333';

function targetUserRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: TARGET_USER_ID,
    fullName: 'نورة أحمد',
    email: 'noura@example.com',
    phone: '0512345678',
    passwordHash: 'bcrypt-redacted',
    isEmailVerified: true,
    googleId: null,
    authProvider: 'local',
    ...overrides,
  } as never;
}

function resetRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: RESET_ROW_ID,
    userId: TARGET_USER_ID,
    tokenHash: 'placeholder-hash',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    usedAt: null,
    createdAt: new Date(),
    user: targetUserRow(),
    ...overrides,
  } as never;
}

describe('V-24 — admin reset link hash-at-rest', () => {
  let admin: AdminService;
  let auth: AuthService;

  const userFindUnique = jest.fn();
  const passwordResetCreate = jest.fn();
  const passwordResetFindUnique = jest.fn();
  const passwordResetUpdate = jest.fn();
  const userUpdate = jest.fn();
  const platformAuditLogCreate = jest.fn();
  const txFn = jest.fn().mockImplementation(async (ops: unknown[]) => Promise.all(ops));
  const setPasswordChangedAt = jest.fn().mockResolvedValue(undefined);
  const mailSend = jest.fn().mockResolvedValue(undefined);

  const mockPrisma = {
    user: { findUnique: userFindUnique, update: userUpdate },
    passwordReset: {
      create: passwordResetCreate,
      findUnique: passwordResetFindUnique,
      update: passwordResetUpdate,
    },
    platformAuditLog: { create: platformAuditLogCreate },
    refreshToken: { create: jest.fn().mockResolvedValue({ id: 'rt-id' }) },
    $transaction: txFn,
  };

  beforeEach(async () => {
    [
      userFindUnique, passwordResetCreate, passwordResetFindUnique,
      passwordResetUpdate, userUpdate, platformAuditLogCreate, setPasswordChangedAt,
      mailSend,
    ].forEach((fn) => fn.mockReset());
    setPasswordChangedAt.mockResolvedValue(undefined);
    mailSend.mockResolvedValue(undefined);
    txFn.mockImplementation(async (ops: unknown[]) => Promise.all(ops));

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          load: [() => ({
            jwt: { accessSecret: 'v24-test-access-secret-min-64-chars-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', accessExpiration: '15m', refreshExpiration: '7d' },
          })],
        }),
        JwtModule.register({ secret: 'v24-test-access-secret-min-64-chars-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }),
      ],
      providers: [
        AdminService,
        AuthService,
        { provide: PlatformPrismaClient, useValue: mockPrisma },
        { provide: PlatformSettingsService, useValue: { get: jest.fn(), set: jest.fn() } },
        { provide: CacheService, useValue: { setPasswordChangedAt, getPasswordChangedAt: jest.fn().mockResolvedValue(null), blacklistRefreshToken: jest.fn().mockResolvedValue(undefined) } },
        { provide: EventsGateway, useValue: { disconnectUserClients: jest.fn(), disconnectTenantClients: jest.fn() } },
        { provide: MailService, useValue: { send: mailSend } },
        { provide: SmsService, useValue: { send: jest.fn().mockResolvedValue(undefined) } },
        { provide: TenantDatabaseService, useValue: {} },
        { provide: TwoFactorService, useValue: {} },
        { provide: TwoFactorBackupCodeService, useValue: { store: jest.fn(), verifyAndConsume: jest.fn(), deleteAll: jest.fn(), countUnused: jest.fn() } },
        { provide: GoogleAuthService, useValue: {} },
        { provide: AuditService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
        { provide: SentryService, useValue: { captureMessage: jest.fn(), captureException: jest.fn() } },
      ],
    }).compile();
    admin = module.get(AdminService);
    auth = module.get(AuthService);
  });

  // ────────────────────────────────────────────────────────────────────

  it('sendPasswordResetLink: stores HASH in DB, returns RAW in response, audit carries 8-char prefix only', async () => {
    userFindUnique.mockResolvedValueOnce(targetUserRow());
    passwordResetCreate.mockResolvedValueOnce(resetRow());
    platformAuditLogCreate.mockResolvedValueOnce({});

    const result = await admin.sendPasswordResetLink(TARGET_USER_ID, ADMIN_ID);

    // Response: raw token + expiry surfaced as a manual-delivery fallback;
    // V-24-email dispatched the link so emailDispatched=true + success message.
    expect(result.token).toMatch(/^[0-9a-f]{64}$/); // 32 bytes hex
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.emailDispatched).toBe(true);
    expect(result.message).toMatch(/تم إرسال/);
    // The reset email carried the raw token in the link URL.
    expect(mailSend).toHaveBeenCalledTimes(1);
    expect((mailSend.mock.calls[0][0] as { to: string }).to).toBe('noura@example.com');
    expect((mailSend.mock.calls[0][0] as { html: string }).html).toContain(result.token);

    // DB write: column receives the HASH, never the raw.
    expect(passwordResetCreate).toHaveBeenCalledTimes(1);
    const createArgs = passwordResetCreate.mock.calls[0][0].data;
    const expectedHash = createHash('sha256').update(result.token).digest('hex');
    expect(createArgs.tokenHash).toBe(expectedHash);
    expect(createArgs.tokenHash).not.toBe(result.token); // hash !== raw
    expect(createArgs.tokenHash).toHaveLength(64);
    expect(createArgs.userId).toBe(TARGET_USER_ID);

    // Audit row: contains 8-char prefix, never the full hash, never the raw.
    expect(platformAuditLogCreate).toHaveBeenCalledTimes(1);
    const auditArgs = platformAuditLogCreate.mock.calls[0][0].data;
    expect(auditArgs.action).toBe('admin_password_reset_link_sent');
    expect(auditArgs.userId).toBe(ADMIN_ID);
    expect(auditArgs.entityId).toBe(TARGET_USER_ID);
    expect(auditArgs.newValues.tokenHashPrefix).toBe(expectedHash.slice(0, 8));
    expect(auditArgs.newValues.tokenHashPrefix).toHaveLength(8);
    expect(auditArgs.newValues.sentTo).toBe('noura@example.com');
    expect(auditArgs.newValues.expiresAt).toBe(result.expiresAt.toISOString());
    expect(auditArgs.newValues.emailDispatched).toBe(true);
    // Regression-proof — full hash and raw token must NEVER appear.
    const auditJson = JSON.stringify(auditArgs.newValues);
    expect(auditJson).not.toContain(expectedHash);          // full hash absent
    expect(auditJson).not.toContain(result.token);          // raw absent
  });

  it('V-24-email: mail dispatch failure → emailDispatched=false, raw token still returned for manual delivery', async () => {
    userFindUnique.mockResolvedValueOnce(targetUserRow());
    passwordResetCreate.mockResolvedValueOnce(resetRow());
    platformAuditLogCreate.mockResolvedValueOnce({});
    mailSend.mockRejectedValueOnce(new Error('SMTP down'));

    const result = await admin.sendPasswordResetLink(TARGET_USER_ID, ADMIN_ID);

    // Graceful degradation: token still surfaced + flagged not-dispatched.
    expect(result.emailDispatched).toBe(false);
    expect(result.token).toMatch(/^[0-9a-f]{64}$/);
    expect(result.message).toMatch(/يدوياً/);
    // The reset-token row was still persisted (the only critical write).
    expect(passwordResetCreate).toHaveBeenCalledTimes(1);
    // Audit records the failure so ops can correlate "row present, mail failed".
    const auditArgs = platformAuditLogCreate.mock.calls[0][0].data;
    expect(auditArgs.newValues.emailDispatched).toBe(false);
  });

  it('end-to-end: admin-issued raw token redeems via auth.resetPassword (incidental V-24 correctness fix)', async () => {
    // Admin issues a link.
    userFindUnique.mockResolvedValueOnce(targetUserRow());
    const createCaptured: { data?: { tokenHash: string; userId: string; expiresAt: Date } } = {};
    passwordResetCreate.mockImplementationOnce((args: { data: { tokenHash: string; userId: string; expiresAt: Date } }) => {
      createCaptured.data = args.data;
      return Promise.resolve(resetRow({ tokenHash: args.data.tokenHash }));
    });
    platformAuditLogCreate.mockResolvedValueOnce({});

    const issued = await admin.sendPasswordResetLink(TARGET_USER_ID, ADMIN_ID);
    const persistedHash = createCaptured.data!.tokenHash;

    // User submits the raw token (as they would from the email URL).
    // The verifier hashes it and looks up — POST-V-24 this MUST succeed.
    passwordResetFindUnique.mockResolvedValueOnce(resetRow({
      tokenHash: persistedHash,
      user: targetUserRow(),
    }));
    userUpdate.mockResolvedValueOnce({});
    passwordResetUpdate.mockResolvedValueOnce({});

    await auth.resetPassword({ token: issued.token, password: 'NewStrongPass1!' });

    // Verifier hashed the submitted raw and found the row.
    expect(passwordResetFindUnique).toHaveBeenCalledTimes(1);
    const findArgs = passwordResetFindUnique.mock.calls[0][0];
    expect(findArgs.where.tokenHash).toBe(persistedHash);
    // Password was updated, row marked used.
    expect(userUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: TARGET_USER_ID },
    }));
    expect(passwordResetUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: RESET_ROW_ID },
      data: expect.objectContaining({ usedAt: expect.any(Date) }),
    }));
    // V-14a parity: pwChangedAt set on completion.
    expect(setPasswordChangedAt).toHaveBeenCalledWith(TARGET_USER_ID);
  });

  it('resetPassword + invalid token → BadRequest, no mutation', async () => {
    passwordResetFindUnique.mockResolvedValueOnce(null);

    await expect(
      auth.resetPassword({ token: 'a'.repeat(64), password: 'NewStrongPass1!' }),
    ).rejects.toThrow(BadRequestException);

    expect(userUpdate).not.toHaveBeenCalled();
    expect(passwordResetUpdate).not.toHaveBeenCalled();
    expect(setPasswordChangedAt).not.toHaveBeenCalled();
  });

  it('resetPassword + expired token → BadRequest, no mutation', async () => {
    passwordResetFindUnique.mockResolvedValueOnce(resetRow({
      expiresAt: new Date(Date.now() - 1000), // expired 1s ago
    }));

    await expect(
      auth.resetPassword({ token: 'b'.repeat(64), password: 'NewStrongPass1!' }),
    ).rejects.toThrow(/انتهت صلاحية/);

    expect(userUpdate).not.toHaveBeenCalled();
    expect(passwordResetUpdate).not.toHaveBeenCalled();
  });

  it('resetPassword + already-used token → BadRequest (idempotency: can\'t reuse a used token)', async () => {
    passwordResetFindUnique.mockResolvedValueOnce(resetRow({
      usedAt: new Date(Date.now() - 60_000),
    }));

    await expect(
      auth.resetPassword({ token: 'c'.repeat(64), password: 'NewStrongPass1!' }),
    ).rejects.toThrow(/استخدام رمز إعادة التعيين مسبقاً/);

    expect(userUpdate).not.toHaveBeenCalled();
    expect(passwordResetUpdate).not.toHaveBeenCalled();
  });

  it('sendPasswordResetLink: user not found → NotFoundException, no DB writes', async () => {
    userFindUnique.mockResolvedValueOnce(null);

    await expect(
      admin.sendPasswordResetLink(TARGET_USER_ID, ADMIN_ID),
    ).rejects.toThrow(NotFoundException);

    expect(passwordResetCreate).not.toHaveBeenCalled();
    expect(platformAuditLogCreate).not.toHaveBeenCalled();
  });
});
