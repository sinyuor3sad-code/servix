import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import {
  BadRequestException,
  ConflictException,
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
import { AUTH_PROVIDERS } from '../src/core/auth/auth.constants';

/**
 * V-13a — Google OAuth account-takeover prevention + /auth/google/link.
 *
 * Pattern follows V-13c: AuthService instantiated with mocked deps. The
 * googleAuthService.verifyIdToken is stubbed to return controlled
 * GoogleTokenPayload values; we don't talk to Google.
 *
 * Coverage = 7 cases (per Phase A decision 8):
 *   googleLogin path (3):
 *     1. brand-new email → user created + JWT + audit auth_google_login
 *     2. email match WITHOUT googleId → 401 + audit auth_google_takeover_blocked (NO link mutation)
 *     3. matched-by-googleId returning user → JWT + audit auth_google_login (isNewUser=false)
 *   linkGoogle path (4):
 *     4. email matches JWT user → user.googleId set, authProvider='both', audit
 *     5. email mismatches JWT user → 400 (BadRequest), no mutation
 *     6. googleId already linked to a different user → 409 (Conflict via P2002)
 *     7. user row disappeared between JWT issue and call → 401
 */

const JWT_ACCESS_SECRET = 'v13a-test-access-secret-min-64-chars-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'aaaaaaaa-1111-1111-1111-111111111111';
const EXISTING_USER_ID = 'bbbbbbbb-2222-2222-2222-222222222222';
const TENANT_ID = 'cccccccc-3333-3333-3333-333333333333';
const ROLE_ID = 'dddddddd-4444-4444-4444-444444444444';

function googleProfile(overrides: Partial<{
  sub: string; email: string; email_verified: boolean; name: string; picture?: string;
}> = {}) {
  return {
    sub: 'google-sub-9999',
    email: 'noura@example.com',
    email_verified: true,
    name: 'نورة أحمد',
    picture: undefined,
    ...overrides,
  };
}

function userRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: EXISTING_USER_ID,
    fullName: 'نورة أحمد',
    email: 'noura@example.com',
    phone: '0512345678',
    passwordHash: 'bcrypt-redacted',
    avatarUrl: null,
    isEmailVerified: true,
    twoFactorEnabled: false,
    twoFactorSecret: null,
    twoFactorSecretEncrypted: null,
    googleId: null,
    authProvider: AUTH_PROVIDERS.LOCAL,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as never;
}

describe('V-13a — Google OAuth takeover prevention + linkGoogle', () => {
  let service: AuthService;

  const userFindUnique = jest.fn();
  const userCreate = jest.fn();
  const userUpdate = jest.fn();
  const tenantUserFindMany = jest.fn().mockResolvedValue([]);
  const refreshTokenCreate = jest.fn().mockResolvedValue({ id: 'rt-id' });

  const verifyIdToken = jest.fn();
  const auditLog = jest.fn().mockResolvedValue(undefined);

  const mockPrisma = {
    user: { findUnique: userFindUnique, create: userCreate, update: userUpdate },
    tenantUser: { findMany: tenantUserFindMany },
    refreshToken: { create: refreshTokenCreate },
  };

  beforeEach(async () => {
    [
      userFindUnique, userCreate, userUpdate, tenantUserFindMany, refreshTokenCreate,
      verifyIdToken, auditLog,
    ].forEach((fn) => fn.mockReset());
    tenantUserFindMany.mockResolvedValue([]);
    refreshTokenCreate.mockResolvedValue({ id: 'rt-id' });
    auditLog.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          load: [
            () => ({
              jwt: {
                accessSecret: JWT_ACCESS_SECRET,
                accessExpiration: '15m',
                refreshExpiration: '7d',
              },
            }),
          ],
        }),
        JwtModule.register({ secret: JWT_ACCESS_SECRET }),
      ],
      providers: [
        AuthService,
        { provide: PlatformPrismaClient, useValue: mockPrisma },
        { provide: CacheService, useValue: { getPasswordChangedAt: jest.fn().mockResolvedValue(null), setPasswordChangedAt: jest.fn().mockResolvedValue(undefined), blacklistRefreshToken: jest.fn().mockResolvedValue(undefined) } },
        { provide: MailService, useValue: {} },
        { provide: SmsService, useValue: {} },
        { provide: TenantDatabaseService, useValue: {} },
        { provide: TwoFactorService, useValue: {} },
        { provide: TwoFactorBackupCodeService, useValue: { store: jest.fn(), verifyAndConsume: jest.fn(), deleteAll: jest.fn(), countUnused: jest.fn() } },
        { provide: GoogleAuthService, useValue: { verifyIdToken } },
        { provide: AuditService, useValue: { log: auditLog } },
        { provide: SentryService, useValue: { captureMessage: jest.fn() } },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  // ────────────────────────── googleLogin path ──────────────────────────

  it('googleLogin: brand-new email → user created + JWT + audit auth_google_login (isNewUser=true)', async () => {
    verifyIdToken.mockResolvedValueOnce(googleProfile());
    userFindUnique
      .mockResolvedValueOnce(null)  // by googleId
      .mockResolvedValueOnce(null); // by email
    const created = userRow({ id: USER_ID, googleId: 'google-sub-9999', authProvider: AUTH_PROVIDERS.GOOGLE });
    userCreate.mockResolvedValueOnce(created);

    const result = await service.googleLogin('valid-id-token');

    expect(result.tokens.accessToken.split('.').length).toBe(3);
    expect(userCreate).toHaveBeenCalledTimes(1);
    const createData = userCreate.mock.calls[0][0].data;
    expect(createData.email).toBe('noura@example.com');
    expect(createData.googleId).toBe('google-sub-9999');
    expect(createData.authProvider).toBe(AUTH_PROVIDERS.GOOGLE);
    expect(createData.isEmailVerified).toBe(true);

    // Audit: auth_google_login with isNewUser=true + email/authProvider snapshot
    // (defense-in-depth against future email-change paths mutating users.email).
    const auditCalls = auditLog.mock.calls.map((c) => c[0]);
    const loginAudit = auditCalls.find((a) => a.action === 'auth_google_login');
    expect(loginAudit).toBeDefined();
    expect(loginAudit.userId).toBe(USER_ID);
    expect(loginAudit.newValues.isNewUser).toBe(true);
    expect(loginAudit.newValues.googleSub).toBe('google-sub-9999');
    expect(loginAudit.newValues.email).toBe('noura@example.com');
    expect(loginAudit.newValues.authProvider).toBe(AUTH_PROVIDERS.GOOGLE);

    // No takeover-block audit.
    expect(auditCalls.find((a) => a.action === 'auth_google_takeover_blocked')).toBeUndefined();
  });

  it('googleLogin: email match WITHOUT googleId → 401 + auth_google_takeover_blocked audit (no link mutation)', async () => {
    verifyIdToken.mockResolvedValueOnce(googleProfile());
    userFindUnique
      .mockResolvedValueOnce(null)                                       // by googleId — miss
      .mockResolvedValueOnce(userRow({ authProvider: AUTH_PROVIDERS.LOCAL })); // by email — hit, no googleId

    // Capture the thrown error once — calling googleLogin twice would re-consume
    // the verifyIdToken mock (which is .mockResolvedValueOnce'd) and the second
    // call would crash on undefined.googleUser.sub instead of hitting our gate.
    let caught: unknown;
    try {
      await service.googleLogin('valid-id-token');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(UnauthorizedException);
    expect((caught as Error).message).toMatch(/يوجد حساب مسجَّل بهذا البريد/);

    // CRITICAL: no row mutation — the legacy silent-link path is dead.
    expect(userUpdate).not.toHaveBeenCalled();
    expect(userCreate).not.toHaveBeenCalled();

    // Forensic audit with the full breadcrumb the V-13a spec requires.
    const takeoverAudits = auditLog.mock.calls
      .map((c) => c[0])
      .filter((a) => a.action === 'auth_google_takeover_blocked');
    expect(takeoverAudits.length).toBeGreaterThanOrEqual(1);
    const a = takeoverAudits[0];
    expect(a.userId).toBe(EXISTING_USER_ID); // victim's id, not attacker's
    expect(a.entityType).toBe('User');
    expect(a.newValues.attemptedEmail).toBe('noura@example.com');
    expect(a.newValues.googleSub).toBe('google-sub-9999');
    expect(a.newValues.existingUserAuthProvider).toBe(AUTH_PROVIDERS.LOCAL);
    expect(a.newValues.existingUserHasGoogleId).toBe(false);
    expect(a.newValues.reason).toBe('email_match_without_googleId');
  });

  it('googleLogin: returning user (matched by googleId) → JWT + audit auth_google_login (isNewUser=false)', async () => {
    verifyIdToken.mockResolvedValueOnce(googleProfile());
    const existing = userRow({
      id: USER_ID, googleId: 'google-sub-9999', authProvider: AUTH_PROVIDERS.GOOGLE,
    });
    userFindUnique.mockResolvedValueOnce(existing); // matched by googleId on first lookup

    const result = await service.googleLogin('valid-id-token');

    expect(result.tokens.accessToken.split('.').length).toBe(3);
    // No second lookup (by email) — short-circuited by the googleId match.
    expect(userFindUnique).toHaveBeenCalledTimes(1);
    // No create, no update — pure read-then-issue path.
    expect(userCreate).not.toHaveBeenCalled();
    expect(userUpdate).not.toHaveBeenCalled();

    const loginAudit = auditLog.mock.calls
      .map((c) => c[0])
      .find((a) => a.action === 'auth_google_login');
    expect(loginAudit).toBeDefined();
    expect(loginAudit.newValues.isNewUser).toBe(false);
    expect(loginAudit.newValues.email).toBe('noura@example.com');
    expect(loginAudit.newValues.authProvider).toBe(AUTH_PROVIDERS.GOOGLE);
  });

  // ───────────────────────── linkGoogle path ─────────────────────────

  it('linkGoogle: email matches JWT user → googleId set + authProvider=both + audit auth_google_linked', async () => {
    verifyIdToken.mockResolvedValueOnce(googleProfile());
    userFindUnique.mockResolvedValueOnce(userRow({ id: USER_ID, googleId: null, authProvider: AUTH_PROVIDERS.LOCAL }));
    userUpdate.mockResolvedValueOnce({});

    const result = await service.linkGoogle(USER_ID, 'valid-id-token');

    expect(result.message).toMatch(/تم ربط حساب Google بنجاح/);
    expect(userUpdate).toHaveBeenCalledTimes(1);
    const updateArgs = userUpdate.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: USER_ID });
    expect(updateArgs.data.googleId).toBe('google-sub-9999');
    expect(updateArgs.data.authProvider).toBe(AUTH_PROVIDERS.BOTH);

    const linkAudit = auditLog.mock.calls
      .map((c) => c[0])
      .find((a) => a.action === 'auth_google_linked');
    expect(linkAudit).toBeDefined();
    expect(linkAudit.userId).toBe(USER_ID);
    expect(linkAudit.newValues.googleSub).toBe('google-sub-9999');
    expect(linkAudit.newValues.previousAuthProvider).toBe(AUTH_PROVIDERS.LOCAL);
    expect(linkAudit.newValues.newAuthProvider).toBe(AUTH_PROVIDERS.BOTH);
  });

  it('linkGoogle: email in idToken does NOT match JWT user.email → 400 + no mutation', async () => {
    verifyIdToken.mockResolvedValueOnce(googleProfile({ email: 'attacker@example.com' }));
    userFindUnique.mockResolvedValueOnce(userRow({ id: USER_ID, email: 'noura@example.com' }));

    await expect(service.linkGoogle(USER_ID, 'valid-id-token')).rejects.toThrow(BadRequestException);

    expect(userUpdate).not.toHaveBeenCalled();
    // No success or link audit emitted on the rejection path.
    const linkAudits = auditLog.mock.calls
      .map((c) => c[0])
      .filter((a) => a.action === 'auth_google_linked');
    expect(linkAudits).toEqual([]);
  });

  it('linkGoogle: googleId already linked to another user → 409 (P2002 caught)', async () => {
    verifyIdToken.mockResolvedValueOnce(googleProfile());
    userFindUnique.mockResolvedValueOnce(userRow({ id: USER_ID, googleId: null, email: 'noura@example.com' }));
    // Simulate Prisma's unique-constraint violation on the googleId @unique.
    const p2002 = Object.assign(new Error('Unique constraint failed on the fields: (`google_id`)'), {
      code: 'P2002',
    });
    userUpdate.mockRejectedValueOnce(p2002);

    await expect(service.linkGoogle(USER_ID, 'valid-id-token')).rejects.toThrow(ConflictException);

    // No success audit on the conflict path.
    const linkAudits = auditLog.mock.calls
      .map((c) => c[0])
      .filter((a) => a.action === 'auth_google_linked');
    expect(linkAudits).toEqual([]);
  });

  it('linkGoogle: user row was deleted between JWT issue and call → 401 (no audit, no update)', async () => {
    verifyIdToken.mockResolvedValueOnce(googleProfile());
    userFindUnique.mockResolvedValueOnce(null);

    await expect(service.linkGoogle(USER_ID, 'valid-id-token')).rejects.toThrow(UnauthorizedException);

    expect(userUpdate).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
  });

  // ───────────────────────── unlinkGoogle (V-13a-unlink) ─────────────────

  it('unlinkGoogle: BOTH account → googleId cleared, authProvider LOCAL, audit auth_google_unlinked', async () => {
    userFindUnique.mockResolvedValueOnce(
      userRow({ id: USER_ID, googleId: 'google-sub-9999', authProvider: AUTH_PROVIDERS.BOTH }),
    );
    userUpdate.mockResolvedValueOnce({});

    const result = await service.unlinkGoogle(USER_ID);

    expect(result.message).toMatch(/تم إلغاء ربط/);
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: USER_ID },
        data: { googleId: null, authProvider: AUTH_PROVIDERS.LOCAL },
      }),
    );
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth_google_unlinked', userId: USER_ID }),
    );
  });

  it('unlinkGoogle: Google-only account (no usable password) → 400, refuses (no mutation)', async () => {
    userFindUnique.mockResolvedValueOnce(
      userRow({ id: USER_ID, googleId: 'google-sub-9999', authProvider: AUTH_PROVIDERS.GOOGLE }),
    );

    await expect(service.unlinkGoogle(USER_ID)).rejects.toThrow(BadRequestException);

    expect(userUpdate).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
  });

  it('unlinkGoogle: no Google linked → idempotent no-op message, no mutation', async () => {
    userFindUnique.mockResolvedValueOnce(
      userRow({ id: USER_ID, googleId: null, authProvider: AUTH_PROVIDERS.LOCAL }),
    );

    const result = await service.unlinkGoogle(USER_ID);

    expect(result.message).toMatch(/لا يوجد حساب Google/);
    expect(userUpdate).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
  });

  it('unlinkGoogle: user row missing → 401', async () => {
    userFindUnique.mockResolvedValueOnce(null);

    await expect(service.unlinkGoogle(USER_ID)).rejects.toThrow(UnauthorizedException);

    expect(userUpdate).not.toHaveBeenCalled();
  });
});
