import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import {
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { WsAuthGuard } from '../src/shared/events/ws-auth.guard';
import { CacheService } from '../src/shared/cache/cache.service';
import { PlatformPrismaClient } from '../src/shared/database/platform.client';

/**
 * V-01 — WebSocket handshake gate.
 *
 * 7 cases per pre-flight plan:
 *   1. no token                                   → reject
 *   2. invalid / malformed token                  → reject
 *   3. expired token (exp in the past)            → reject
 *   4. valid token + matching tenant + active TU  → ACCEPT
 *   5. valid token + query.tenantId mismatch      → reject
 *   6. valid token but pwChangedAt > iat          → reject (revoked)
 *   7. flag WS_AUTH_ENFORCE=false + no token      → ACCEPT (with warn)
 *
 * Uses Test.createTestingModule to build a real JwtService + a stub
 * Socket so we exercise the guard logic end-to-end without booting
 * the full Nest app. This is the same pattern the codebase uses
 * elsewhere (tenant-isolation.e2e-spec.ts mocks providers and skips
 * the HTTP server when not needed).
 */

const JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-chars-long-for-hs256';
const USER_ID = 'aaaaaaaa-1111-1111-1111-111111111111';
const TENANT_ID = 'bbbbbbbb-2222-2222-2222-222222222222';
const OTHER_TENANT_ID = 'cccccccc-3333-3333-3333-333333333333';

const mockCacheService = {
  getPasswordChangedAt: jest.fn().mockResolvedValue(null),
};

const activeTenantUser = {
  id: 'tu-1',
  tenantId: TENANT_ID,
  userId: USER_ID,
  roleId: 'role-owner',
  isOwner: true,
  status: 'active',
};

const mockPrisma = {
  tenantUser: {
    findUnique: jest.fn().mockResolvedValue(activeTenantUser),
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fakeSocket(opts: { auth?: any; headers?: any; query?: any } = {}): any {
  return {
    id: `sock-${Math.random().toString(36).slice(2, 8)}`,
    data: {},
    handshake: {
      auth: opts.auth ?? {},
      headers: opts.headers ?? {},
      query: opts.query ?? {},
    },
  };
}

async function buildGuard(enforce: boolean): Promise<WsAuthGuard> {
  const module: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        ignoreEnvFile: true,
        load: [() => ({ WS_AUTH_ENFORCE: enforce })],
      }),
      JwtModule.register({ secret: JWT_SECRET }),
    ],
    providers: [
      WsAuthGuard,
      { provide: CacheService, useValue: mockCacheService },
      { provide: PlatformPrismaClient, useValue: mockPrisma },
    ],
  }).compile();

  return module.get(WsAuthGuard);
}

function signValidToken(jwt: JwtService, overrides: Record<string, unknown> = {}): string {
  return jwt.sign(
    {
      sub: USER_ID,
      email: 'test@example.com',
      tenantId: TENANT_ID,
      roleId: 'role-owner',
      ...overrides,
    },
    { secret: JWT_SECRET, expiresIn: '15m' },
  );
}

describe('WS Auth Guard (V-01)', () => {
  let guard: WsAuthGuard;
  let jwt: JwtService;

  beforeEach(async () => {
    mockCacheService.getPasswordChangedAt.mockResolvedValue(null);
    mockPrisma.tenantUser.findUnique.mockResolvedValue(activeTenantUser);
    guard = await buildGuard(true);
    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: JWT_SECRET })],
    }).compile();
    jwt = module.get(JwtService);
  });

  // ─── (1) no token ────────────────────────────────────────────────
  it('rejects a handshake with no token when enforce=true', async () => {
    const client = fakeSocket();
    await expect(guard.validateConnection(client)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  // ─── (2) invalid token ───────────────────────────────────────────
  it('rejects a handshake with an invalid token', async () => {
    const client = fakeSocket({ auth: { token: 'definitely.not.a.jwt' } });
    await expect(guard.validateConnection(client)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  // ─── (3) expired token ───────────────────────────────────────────
  it('rejects an expired token', async () => {
    const expired = jwt.sign(
      { sub: USER_ID, email: 'test@example.com', tenantId: TENANT_ID },
      { secret: JWT_SECRET, expiresIn: -10 },
    );
    const client = fakeSocket({ auth: { token: expired } });
    await expect(guard.validateConnection(client)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  // ─── (4) valid token + matching tenant + active TU ──────────────
  it('accepts a valid handshake and pins client.data from the JWT', async () => {
    const token = signValidToken(jwt);
    const client = fakeSocket({ auth: { token }, query: { tenantId: TENANT_ID } });
    const validated = await guard.validateConnection(client);
    expect(validated).not.toBeNull();
    expect(validated!.userId).toBe(USER_ID);
    expect(validated!.tenantId).toBe(TENANT_ID);
    expect(client.data.tenantId).toBe(TENANT_ID);
    expect(client.data.user.sub).toBe(USER_ID);
    expect(mockPrisma.tenantUser.findUnique).toHaveBeenCalled();
  });

  // ─── (5) query.tenantId mismatch ─────────────────────────────────
  it('rejects when query.tenantId does not match the JWT tenantId', async () => {
    const token = signValidToken(jwt);
    const client = fakeSocket({
      auth: { token },
      query: { tenantId: OTHER_TENANT_ID },
    });
    await expect(guard.validateConnection(client)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  // ─── (6) revoked via pwChangedAt ─────────────────────────────────
  it('rejects when pwChangedAt is newer than the token iat', async () => {
    const token = signValidToken(jwt);
    // 5 minutes in the future, in ms — guaranteed after iat
    mockCacheService.getPasswordChangedAt.mockResolvedValueOnce(
      Date.now() + 5 * 60 * 1000,
    );
    const client = fakeSocket({ auth: { token } });
    await expect(guard.validateConnection(client)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  // ─── (7) flag off + no token ─────────────────────────────────────
  it('accepts an un-authenticated handshake when WS_AUTH_ENFORCE=false', async () => {
    const guardOff = await buildGuard(false);
    const client = fakeSocket();
    const validated = await guardOff.validateConnection(client);
    expect(validated).toBeNull();
    expect(client.data.user).toBeUndefined();
  });

  // ─── bonus: TenantUser inactive → reject ─────────────────────────
  it('rejects when TenantUser exists but status != active', async () => {
    mockPrisma.tenantUser.findUnique.mockResolvedValueOnce({
      ...activeTenantUser,
      status: 'inactive',
    });
    const token = signValidToken(jwt);
    const client = fakeSocket({ auth: { token } });
    await expect(guard.validateConnection(client)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  // ─── bonus: Authorization: Bearer header fallback ────────────────
  it('accepts a Bearer token from the Authorization header', async () => {
    const token = signValidToken(jwt);
    const client = fakeSocket({
      headers: { authorization: `Bearer ${token}` },
    });
    const validated = await guard.validateConnection(client);
    expect(validated).not.toBeNull();
    expect(validated!.userId).toBe(USER_ID);
  });
});
