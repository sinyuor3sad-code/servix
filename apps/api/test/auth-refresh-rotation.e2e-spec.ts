import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
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
 * V-13c — refresh-token rotation + reuse detection.
 *
 * We exercise AuthService directly with mocked dependencies. Booting
 * the full Nest app would require live Postgres + Redis; the call-shape
 * assertions are enough to prove the rotation/reuse state machine
 * behaves as designed. Pattern follows V-14a/14b/14c.
 *
 * The test surface is the V-13c happy path (single rotation), the
 * reuse cascade (cascade-revoke + pwChangedAt + audit + Sentry), the
 * V-14a pwChangedAt parity gate, the fail-CLOSED DB-unreachable path,
 * and the family-of-N cascade. See docs/migrations/v13c-apply.md for
 * the runbook this test suite shadows.
 */

const JWT_ACCESS_SECRET = 'v13c-test-access-secret-min-64-chars-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'aaaaaaaa-1111-1111-1111-111111111111';
const TENANT_ID = 'bbbbbbbb-2222-2222-2222-222222222222';
const ROLE_ID = 'cccccccc-3333-3333-3333-333333333333';

function makeRow(overrides: Partial<Record<string, unknown>> = {}): {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  issuedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
  replacedByTokenId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
} {
  return {
    id: 'dddddddd-4444-4444-4444-444444444444',
    userId: USER_ID,
    tokenHash: 'placeholder',
    familyId: 'eeeeeeee-5555-5555-5555-555555555555',
    issuedAt: new Date(Date.now() - 60_000),
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    revokedAt: null,
    revokedReason: null,
    replacedByTokenId: null,
    ipAddress: null,
    userAgent: null,
    ...overrides,
  } as never;
}

describe('V-13c — refresh-token rotation', () => {
  let service: AuthService;

  // Spies — reset per test.
  const refreshTokenCreate = jest.fn();
  const refreshTokenFindUnique = jest.fn();
  const refreshTokenUpdate = jest.fn();
  const refreshTokenUpdateMany = jest.fn();
  const userFindUnique = jest.fn();

  const setPasswordChangedAt = jest.fn().mockResolvedValue(undefined);
  const getPasswordChangedAt = jest.fn().mockResolvedValue(null);
  const blacklistRefreshToken = jest.fn().mockResolvedValue(undefined);

  const auditLog = jest.fn().mockResolvedValue(undefined);
  const sentryCaptureMessage = jest.fn();

  const mockPrisma = {
    refreshToken: {
      create: refreshTokenCreate,
      findUnique: refreshTokenFindUnique,
      update: refreshTokenUpdate,
      updateMany: refreshTokenUpdateMany,
    },
    user: { findUnique: userFindUnique },
  };

  beforeEach(async () => {
    // Reset spies between tests so call counts are per-scenario.
    [
      refreshTokenCreate,
      refreshTokenFindUnique,
      refreshTokenUpdate,
      refreshTokenUpdateMany,
      userFindUnique,
      setPasswordChangedAt,
      getPasswordChangedAt,
      blacklistRefreshToken,
      auditLog,
      sentryCaptureMessage,
    ].forEach((fn) => fn.mockReset());

    setPasswordChangedAt.mockResolvedValue(undefined);
    getPasswordChangedAt.mockResolvedValue(null);
    blacklistRefreshToken.mockResolvedValue(undefined);
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
        { provide: CacheService, useValue: { getPasswordChangedAt, setPasswordChangedAt, blacklistRefreshToken } },
        { provide: MailService, useValue: {} },
        { provide: SmsService, useValue: {} },
        { provide: TenantDatabaseService, useValue: {} },
        { provide: TwoFactorService, useValue: {} },
        { provide: GoogleAuthService, useValue: {} },
        { provide: AuditService, useValue: { log: auditLog } },
        { provide: SentryService, useValue: { captureMessage: sentryCaptureMessage } },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  // ──────────────────────────────────────────────────────────────────

  it('generateTokens issues opaque refresh + persists a fresh family row', async () => {
    refreshTokenCreate.mockResolvedValueOnce(makeRow());
    const tokens = await service.generateTokens({
      sub: USER_ID, email: 'v13c@test.local', tenantId: TENANT_ID, roleId: ROLE_ID,
    });

    expect(tokens.refreshToken).toMatch(/^[0-9a-f]{64}$/); // 32 bytes = 64 hex
    expect(tokens.accessToken.split('.').length).toBe(3);   // JWT header.payload.sig

    expect(refreshTokenCreate).toHaveBeenCalledTimes(1);
    const data = refreshTokenCreate.mock.calls[0][0].data;
    expect(data.userId).toBe(USER_ID);
    expect(data.tokenHash).toHaveLength(64);
    expect(typeof data.familyId).toBe('string');
    expect(data.familyId).toMatch(/^[0-9a-f-]{36}$/); // UUID v4 shape
    expect(data.expiresAt).toBeInstanceOf(Date);
    expect(data.ipAddress).toBeNull();
    expect(data.userAgent).toBeNull();
  });

  it('refresh once rotates: old row marked revoked=rotated + new row linked via replacedByTokenId', async () => {
    const rawOld = randomBytes(32).toString('hex');
    const oldHash = createHash('sha256').update(rawOld).digest('hex');
    const oldRow = makeRow({ tokenHash: oldHash });
    const newRow = makeRow({ id: 'newrow-id-9999-9999-9999-999999999999', tokenHash: 'will-be-set' });

    refreshTokenFindUnique
      .mockResolvedValueOnce(oldRow)       // initial lookup
      .mockResolvedValueOnce(newRow);      // post-issuance lookup for replacedByTokenId
    userFindUnique.mockResolvedValueOnce({
      id: USER_ID, email: 'v13c@test.local',
      tenantUsers: [{ tenantId: TENANT_ID, roleId: ROLE_ID, status: 'active' }],
    });
    refreshTokenCreate.mockResolvedValueOnce(newRow);
    refreshTokenUpdate.mockResolvedValueOnce({ ...oldRow, revokedAt: new Date() });

    const tokens = await service.refreshTokens(rawOld, { ipAddress: '1.2.3.4', userAgent: 'jest' });

    expect(tokens.refreshToken).toMatch(/^[0-9a-f]{64}$/);

    // Predecessor row was marked rotated, with the successor linked.
    expect(refreshTokenUpdate).toHaveBeenCalledTimes(1);
    const updateArgs = refreshTokenUpdate.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: oldRow.id });
    expect(updateArgs.data.revokedReason).toBe('rotated');
    expect(updateArgs.data.revokedAt).toBeInstanceOf(Date);
    expect(updateArgs.data.replacedByTokenId).toBe(newRow.id);

    // Successor was persisted in the same family with the ip/UA we passed.
    expect(refreshTokenCreate).toHaveBeenCalledTimes(1);
    const createArgs = refreshTokenCreate.mock.calls[0][0].data;
    expect(createArgs.familyId).toBe(oldRow.familyId);
    expect(createArgs.ipAddress).toBe('1.2.3.4');
    expect(createArgs.userAgent).toBe('jest');

    // No reuse-cascade side effects.
    expect(refreshTokenUpdateMany).not.toHaveBeenCalled();
    expect(setPasswordChangedAt).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
    expect(sentryCaptureMessage).not.toHaveBeenCalled();
  });

  it('refresh same token twice → second call triggers reuse cascade + 401', async () => {
    const rawToken = randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(rawToken).digest('hex');
    // Second presentation: row exists but is already revoked (rotated).
    const reusedRow = makeRow({
      tokenHash: hash,
      revokedAt: new Date(Date.now() - 1000),
      revokedReason: 'rotated',
    });
    refreshTokenFindUnique.mockResolvedValueOnce(reusedRow);
    refreshTokenUpdateMany.mockResolvedValueOnce({ count: 4 }); // 4 siblings to nuke

    await expect(
      service.refreshTokens(rawToken, { ipAddress: '9.9.9.9' }),
    ).rejects.toThrow(UnauthorizedException);

    // Family-wide cascade fired with the right predicate.
    expect(refreshTokenUpdateMany).toHaveBeenCalledTimes(1);
    const where = refreshTokenUpdateMany.mock.calls[0][0].where;
    expect(where.familyId).toBe(reusedRow.familyId);
    expect(where.revokedAt).toBeNull();
    expect(refreshTokenUpdateMany.mock.calls[0][0].data.revokedReason).toBe('reuse_detected');

    // V-14a cascade: pwChangedAt set → kills outstanding access JWTs.
    expect(setPasswordChangedAt).toHaveBeenCalledWith(USER_ID);

    // Belt-and-braces blacklist for the legacy short-circuit.
    expect(blacklistRefreshToken).toHaveBeenCalledWith(hash, USER_ID);

    // Audit row with forensic breadcrumb.
    expect(auditLog).toHaveBeenCalledTimes(1);
    const auditArgs = auditLog.mock.calls[0][0];
    expect(auditArgs.action).toBe('auth_refresh_reuse_detected');
    expect(auditArgs.entityType).toBe('RefreshToken');
    expect(auditArgs.entityId).toBe(reusedRow.id);
    expect(auditArgs.userId).toBe(USER_ID);
    expect(auditArgs.newValues.familyId).toBe(reusedRow.familyId);
    expect(auditArgs.newValues.cascadeRevokedCount).toBe(4);
    expect(auditArgs.newValues.ipAddress).toBe('9.9.9.9');
    expect(auditArgs.newValues.reusedTokenRevokedReason).toBe('rotated');

    // Sentry warning, not exception.
    expect(sentryCaptureMessage).toHaveBeenCalledWith('Refresh token reuse detected', 'warning');
  });

  it('refresh expired token → 401 + row marked revokedReason=expired (no cascade)', async () => {
    const rawToken = randomBytes(32).toString('hex');
    const row = makeRow({
      tokenHash: createHash('sha256').update(rawToken).digest('hex'),
      expiresAt: new Date(Date.now() - 1000),
    });
    refreshTokenFindUnique.mockResolvedValueOnce(row);
    refreshTokenUpdate.mockResolvedValueOnce(row);

    await expect(service.refreshTokens(rawToken)).rejects.toThrow(UnauthorizedException);

    expect(refreshTokenUpdate).toHaveBeenCalledTimes(1);
    expect(refreshTokenUpdate.mock.calls[0][0].data.revokedReason).toBe('expired');
    expect(refreshTokenUpdateMany).not.toHaveBeenCalled(); // no family cascade for natural expiry
    expect(setPasswordChangedAt).not.toHaveBeenCalled();
    expect(sentryCaptureMessage).not.toHaveBeenCalled();
  });

  it('refresh with pwChangedAt > issuedAt → 401 (V-14a parity, revokedReason=pwd_changed)', async () => {
    const rawToken = randomBytes(32).toString('hex');
    const issuedAt = new Date(Date.now() - 10_000);
    const row = makeRow({
      tokenHash: createHash('sha256').update(rawToken).digest('hex'),
      issuedAt,
    });
    refreshTokenFindUnique.mockResolvedValueOnce(row);
    getPasswordChangedAt.mockResolvedValueOnce(issuedAt.getTime() + 5000); // changed AFTER issuance
    refreshTokenUpdate.mockResolvedValueOnce(row);

    await expect(service.refreshTokens(rawToken)).rejects.toThrow(UnauthorizedException);

    expect(refreshTokenUpdate.mock.calls[0][0].data.revokedReason).toBe('pwd_changed');
    expect(refreshTokenUpdateMany).not.toHaveBeenCalled();
    expect(setPasswordChangedAt).not.toHaveBeenCalled(); // V-14a already set it; no re-cascade
    expect(sentryCaptureMessage).not.toHaveBeenCalled();
  });

  it('refresh unknown token → 401 (no row, no cascade, no Sentry)', async () => {
    refreshTokenFindUnique.mockResolvedValueOnce(null);

    await expect(
      service.refreshTokens('deadbeef'.repeat(8)),
    ).rejects.toThrow(UnauthorizedException);

    expect(refreshTokenUpdate).not.toHaveBeenCalled();
    expect(refreshTokenUpdateMany).not.toHaveBeenCalled();
    expect(setPasswordChangedAt).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
    expect(sentryCaptureMessage).not.toHaveBeenCalled();
  });

  it('logout revokes the token row by hash + writes legacy blacklist (coexistence)', async () => {
    const rawToken = randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(rawToken).digest('hex');
    refreshTokenUpdateMany.mockResolvedValueOnce({ count: 1 });

    const result = await service.logout(rawToken);
    expect(result.message).toBeTruthy();

    expect(refreshTokenUpdateMany).toHaveBeenCalledTimes(1);
    expect(refreshTokenUpdateMany.mock.calls[0][0].where.tokenHash).toBe(hash);
    expect(refreshTokenUpdateMany.mock.calls[0][0].where.revokedAt).toBeNull();
    expect(refreshTokenUpdateMany.mock.calls[0][0].data.revokedReason).toBe('logout');

    expect(blacklistRefreshToken).toHaveBeenCalledWith(hash);
  });

  it('DB unreachable during reuse-detect → 503 ServiceUnavailable (FAIL CLOSED)', async () => {
    refreshTokenFindUnique.mockRejectedValueOnce(
      new Error('connection refused: Postgres at 10.0.0.5:5432'),
    );

    await expect(
      service.refreshTokens(randomBytes(32).toString('hex')),
    ).rejects.toThrow(ServiceUnavailableException);

    // Confirm we did NOT fall through to issuing new tokens.
    expect(refreshTokenCreate).not.toHaveBeenCalled();
    expect(refreshTokenUpdate).not.toHaveBeenCalled();
    expect(refreshTokenUpdateMany).not.toHaveBeenCalled();
  });

  it('family-of-N cascade: reuse on one member revokes every still-unrevoked sibling', async () => {
    const rawToken = randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(rawToken).digest('hex');
    const reusedRow = makeRow({
      tokenHash: hash,
      revokedAt: new Date(Date.now() - 1000),
      revokedReason: 'rotated',
    });
    refreshTokenFindUnique.mockResolvedValueOnce(reusedRow);
    refreshTokenUpdateMany.mockResolvedValueOnce({ count: 7 }); // 7 unrevoked siblings

    await expect(service.refreshTokens(rawToken)).rejects.toThrow(UnauthorizedException);

    // updateMany predicate scopes the cascade to the family with revokedAt IS NULL.
    expect(refreshTokenUpdateMany).toHaveBeenCalledWith({
      where: { familyId: reusedRow.familyId, revokedAt: null },
      data: expect.objectContaining({
        revokedAt: expect.any(Date),
        revokedReason: 'reuse_detected',
      }),
    });

    // Forensic count threads through to the audit row.
    expect(auditLog.mock.calls[0][0].newValues.cascadeRevokedCount).toBe(7);
  });

  it('reuse cascade is best-effort: audit/Sentry failures do not surface as 500', async () => {
    const rawToken = randomBytes(32).toString('hex');
    const reusedRow = makeRow({
      tokenHash: createHash('sha256').update(rawToken).digest('hex'),
      revokedAt: new Date(Date.now() - 1000),
      revokedReason: 'rotated',
    });
    refreshTokenFindUnique.mockResolvedValueOnce(reusedRow);
    refreshTokenUpdateMany.mockResolvedValueOnce({ count: 2 });
    auditLog.mockRejectedValueOnce(new Error('audit insert blew up'));
    sentryCaptureMessage.mockImplementationOnce(() => {
      throw new Error('sentry transport down');
    });

    // Still 401 — the attacker must not learn that the cascade failed.
    await expect(service.refreshTokens(rawToken)).rejects.toThrow(UnauthorizedException);

    // Critical side effects DID land before the audit/Sentry failures.
    expect(refreshTokenUpdateMany).toHaveBeenCalled();
    expect(setPasswordChangedAt).toHaveBeenCalled();
    expect(blacklistRefreshToken).toHaveBeenCalled();
  });
});
