import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { AdminService } from '../src/core/admin/admin.service';
import { PlatformPrismaClient } from '../src/shared/database/platform.client';
import { PlatformSettingsService } from '../src/shared/database/platform-settings.service';
import { CacheService } from '../src/shared/cache/cache.service';
import { EventsGateway } from '../src/shared/events/events.gateway';
import { TwoFactorService } from '../src/core/auth/two-factor.service';
import { TwoFactorBackupCodeService } from '../src/core/auth/two-factor-backup-code.service';

/**
 * V-43 — Admin login hardening: 2FA enforcement + IP allowlist + audit.
 *
 * Eight cases:
 *   1. 2FA disabled + correct password         → tokens + admin_login_success audit
 *   2. 2FA enabled  + correct password         → { requires2FA } + admin_login_2fa_required audit (NO tokens)
 *   3. 2FA enabled  + verify correct code      → tokens + admin_login_success audit
 *   4. 2FA enabled  + verify wrong code        → 401 + admin_login_2fa_failed audit
 *   5. IP not in allowlist (configured)        → 403, logger.warn, NO user lookup, NO audit row
 *   6. IP allowlist disabled (empty env)       → all IPs allowed (login proceeds)
 *   7. unknown email                           → bcrypt.compare runs (timing equalization), 401, NO audit
 *   8. bad password                            → 401 + admin_login_failed audit
 *
 * AdminService instantiated with mocked deps (pattern: V-25/V-41). bcrypt
 * spy via CJS require interception (V-41 pattern).
 */

const ADMIN_USER_ID = 'aaaaaaaa-1111-1111-1111-111111111111';
const SUPER_ADMIN_ROLE_ID = 'bbbbbbbb-2222-2222-2222-222222222222';
const TENANT_ID = 'cccccccc-3333-3333-3333-333333333333';
const ADMIN_EMAIL = 'admin@servi-x.com';
const CORRECT_PASSWORD = 'AdminPass1!';
const WRONG_PASSWORD = 'WrongPass!';
const TOTP_SECRET = 'JBSWY3DPEHPK3PXP';
const ALLOWED_IP = '203.0.113.10';
const BLOCKED_IP = '198.51.100.7';

async function adminUserRow(twoFactorEnabled: boolean): Promise<Record<string, unknown>> {
  const passwordHash = await bcrypt.hash(CORRECT_PASSWORD, 12);
  return {
    id: ADMIN_USER_ID,
    email: ADMIN_EMAIL,
    fullName: 'Platform Admin',
    passwordHash,
    twoFactorEnabled,
    twoFactorSecret: twoFactorEnabled ? TOTP_SECRET : null,
  };
}

describe('V-43 — admin login hardening', () => {
  let service: AdminService;

  const userFindUnique = jest.fn();
  const userUpdate = jest.fn().mockResolvedValue({});
  const roleFindUnique = jest.fn();
  const tenantUserFindFirst = jest.fn();
  const platformAuditLogCreate = jest.fn().mockResolvedValue({});
  const configGet = jest.fn();
  const getNumber = jest.fn().mockResolvedValue(1440);
  const signAsync = jest.fn().mockResolvedValue('signed.jwt.token');
  const verifyToken = jest.fn();

  const mockPrisma = {
    user: { findUnique: userFindUnique, update: userUpdate },
    role: { findUnique: roleFindUnique },
    tenantUser: { findFirst: tenantUserFindFirst },
    platformAuditLog: { create: platformAuditLogCreate },
  };

  beforeEach(async () => {
    [
      userFindUnique, userUpdate, roleFindUnique, tenantUserFindFirst,
      platformAuditLogCreate, configGet, getNumber, signAsync, verifyToken,
    ].forEach((fn) => fn.mockReset());

    userUpdate.mockResolvedValue({});
    platformAuditLogCreate.mockResolvedValue({});
    getNumber.mockResolvedValue(1440);
    signAsync.mockResolvedValue('signed.jwt.token');
    roleFindUnique.mockResolvedValue({ id: SUPER_ADMIN_ROLE_ID });
    tenantUserFindFirst.mockResolvedValue({ tenantId: TENANT_ID });
    // Default: ADMIN_IP_ALLOWLIST empty (disabled), jwt secrets present.
    configGet.mockImplementation((key: string, def?: string) => {
      if (key === 'ADMIN_IP_ALLOWLIST') return '';
      if (key === 'jwt.accessSecret') return 'access-secret';
      if (key === 'jwt.refreshSecret') return 'refresh-secret';
      return def ?? '';
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PlatformPrismaClient, useValue: mockPrisma },
        { provide: JwtService, useValue: { signAsync } },
        { provide: ConfigService, useValue: { get: configGet } },
        { provide: PlatformSettingsService, useValue: { getNumber } },
        { provide: CacheService, useValue: {} },
        { provide: EventsGateway, useValue: {} },
        { provide: TwoFactorService, useValue: { verifyToken } },
        { provide: TwoFactorBackupCodeService, useValue: { store: jest.fn(), verifyAndConsume: jest.fn(), deleteAll: jest.fn(), countUnused: jest.fn() } },
      ],
    }).compile();
    service = module.get(AdminService);
  });

  function auditActions(): string[] {
    return platformAuditLogCreate.mock.calls.map((c) => c[0].data.action);
  }

  // ────────────────────────────────────────────────────────────────────

  it('1. 2FA disabled + correct password → tokens issued + admin_login_success audit', async () => {
    userFindUnique.mockResolvedValueOnce(await adminUserRow(false));

    const result = await service.login(ADMIN_EMAIL, CORRECT_PASSWORD, ALLOWED_IP);

    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    expect((result as { user: { role: string } }).user.role).toBe('super_admin');
    expect(auditActions()).toContain('admin_login_success');
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it('2. 2FA enabled + correct password → { requires2FA } (NO tokens) + admin_login_2fa_required audit', async () => {
    userFindUnique.mockResolvedValueOnce(await adminUserRow(true));

    const result = await service.login(ADMIN_EMAIL, CORRECT_PASSWORD, ALLOWED_IP);

    expect(result).toEqual({ requires2FA: true });
    expect(result).not.toHaveProperty('accessToken');
    expect(auditActions()).toContain('admin_login_2fa_required');
    // No tokens signed at this step.
    expect(signAsync).not.toHaveBeenCalled();
  });

  it('3. 2FA enabled + verify with correct code → tokens + admin_login_success audit', async () => {
    userFindUnique.mockResolvedValueOnce(await adminUserRow(true));
    verifyToken.mockReturnValueOnce(true);

    const result = await service.verify2FALogin(ADMIN_EMAIL, CORRECT_PASSWORD, '123456', ALLOWED_IP);

    expect(result).toHaveProperty('accessToken');
    expect(verifyToken).toHaveBeenCalledWith(TOTP_SECRET, '123456');
    expect(auditActions()).toContain('admin_login_success');
  });

  it('4. 2FA enabled + verify with wrong code → 401 + admin_login_2fa_failed audit', async () => {
    userFindUnique.mockResolvedValueOnce(await adminUserRow(true));
    verifyToken.mockReturnValueOnce(false);

    await expect(
      service.verify2FALogin(ADMIN_EMAIL, CORRECT_PASSWORD, '000000', ALLOWED_IP),
    ).rejects.toThrow(UnauthorizedException);

    expect(auditActions()).toContain('admin_login_2fa_failed');
    expect(signAsync).not.toHaveBeenCalled();
  });

  it('5. IP not in allowlist (configured) → 403, no user lookup, no audit row', async () => {
    configGet.mockImplementation((key: string, def?: string) => {
      if (key === 'ADMIN_IP_ALLOWLIST') return '203.0.113.0/24'; // BLOCKED_IP outside
      return def ?? '';
    });

    await expect(
      service.login(ADMIN_EMAIL, CORRECT_PASSWORD, BLOCKED_IP),
    ).rejects.toThrow(ForbiddenException);

    // Blocked BEFORE any user lookup or audit row.
    expect(userFindUnique).not.toHaveBeenCalled();
    expect(platformAuditLogCreate).not.toHaveBeenCalled();
  });

  it('6. IP allowlist disabled (empty env) → all IPs allowed', async () => {
    // configGet default returns '' for ADMIN_IP_ALLOWLIST.
    userFindUnique.mockResolvedValueOnce(await adminUserRow(false));

    const result = await service.login(ADMIN_EMAIL, CORRECT_PASSWORD, BLOCKED_IP);

    // Even the "blocked" IP succeeds because the allowlist is off.
    expect(result).toHaveProperty('accessToken');
  });

  it('6b. IP IN allowlist → login proceeds', async () => {
    configGet.mockImplementation((key: string, def?: string) => {
      if (key === 'ADMIN_IP_ALLOWLIST') return '203.0.113.0/24'; // ALLOWED_IP inside
      if (key === 'jwt.accessSecret') return 'access-secret';
      if (key === 'jwt.refreshSecret') return 'refresh-secret';
      return def ?? '';
    });
    userFindUnique.mockResolvedValueOnce(await adminUserRow(false));

    const result = await service.login(ADMIN_EMAIL, CORRECT_PASSWORD, ALLOWED_IP);
    expect(result).toHaveProperty('accessToken');
  });

  it('7. unknown email → bcrypt.compare runs (timing equalization) + 401 + no audit', async () => {
    const bcryptCompareSpy = jest.spyOn(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('bcryptjs') as { compare: (a: string, b: string) => Promise<boolean> },
      'compare',
    );
    userFindUnique.mockResolvedValueOnce(null);

    await expect(
      service.login('nobody@servi-x.com', WRONG_PASSWORD, ALLOWED_IP),
    ).rejects.toThrow(UnauthorizedException);

    // Dummy bcrypt ran (timing equalization) even on user-not-found.
    expect(bcryptCompareSpy).toHaveBeenCalled();
    expect(bcryptCompareSpy.mock.calls[0][1]).toMatch(/^\$2[aby]\$12\$/);
    // No audit row — no userId to attribute.
    expect(platformAuditLogCreate).not.toHaveBeenCalled();

    bcryptCompareSpy.mockRestore();
  });

  it('8. bad password → 401 + admin_login_failed audit', async () => {
    userFindUnique.mockResolvedValueOnce(await adminUserRow(false));

    await expect(
      service.login(ADMIN_EMAIL, WRONG_PASSWORD, ALLOWED_IP),
    ).rejects.toThrow(UnauthorizedException);

    expect(auditActions()).toContain('admin_login_failed');
    expect(signAsync).not.toHaveBeenCalled();
  });

  it('bonus: 2FA verify on a non-2FA account → 400 BadRequest', async () => {
    userFindUnique.mockResolvedValueOnce(await adminUserRow(false));

    await expect(
      service.verify2FALogin(ADMIN_EMAIL, CORRECT_PASSWORD, '123456', ALLOWED_IP),
    ).rejects.toThrow(BadRequestException);
  });
});
