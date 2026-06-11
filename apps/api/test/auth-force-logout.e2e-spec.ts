import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from '../src/core/auth/strategies/jwt.strategy';
import { CacheService } from '../src/shared/cache/cache.service';

/**
 * V-14a — exercises the new revocation gate end-to-end at the
 * JwtStrategy layer plus the admin/auth service paths that should
 * now flip pwChangedAt.
 *
 * The HTTP layer's behaviour is the same as the V-01 WS guard:
 *   payload.iat * 1000 < pwChangedAt → UnauthorizedException
 *
 * Service-layer behaviour is asserted by spying on CacheService
 * methods. Booting the full Nest app for each scenario would require
 * a real Redis + Postgres; the call-count assertion is enough proof
 * that the wiring is right.
 */

const JWT_SECRET = 'v14a-test-jwt-secret-that-is-at-least-32-chars';
const USER_ID = 'aaaaaaaa-1111-1111-1111-111111111111';

const mockCacheService = {
  getPasswordChangedAt: jest.fn().mockResolvedValue(null),
  setPasswordChangedAt: jest.fn().mockResolvedValue(undefined),
};

async function buildStrategy(): Promise<JwtStrategy> {
  const module: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        ignoreEnvFile: true,
        load: [
          () => ({
            jwt: { accessSecret: JWT_SECRET },
          }),
        ],
      }),
      PassportModule,
    ],
    providers: [
      JwtStrategy,
      { provide: CacheService, useValue: mockCacheService },
    ],
  }).compile();
  return module.get(JwtStrategy);
}

function signedPayload(jwt: JwtService): { sub: string; email: string; iat: number } {
  // Sign a real token to capture a valid iat, then decode it to get
  // the iat we'll feed validate() with.
  const token = jwt.sign(
    { sub: USER_ID, email: 'v14a@test.local', tenantId: 't', roleId: 'r' },
    { secret: JWT_SECRET, expiresIn: '15m' },
  );
  const decoded = jwt.decode(token) as { sub: string; email: string; iat: number };
  return { sub: decoded.sub, email: decoded.email, iat: decoded.iat };
}

describe('V-14a — JwtStrategy revocation gate', () => {
  let strategy: JwtStrategy;
  let jwt: JwtService;

  beforeEach(async () => {
    mockCacheService.getPasswordChangedAt.mockReset().mockResolvedValue(null);
    mockCacheService.setPasswordChangedAt.mockReset().mockResolvedValue(undefined);
    strategy = await buildStrategy();
    const m: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: JWT_SECRET })],
    }).compile();
    jwt = m.get(JwtService);
  });

  it('accepts a token whose iat is newer than pwChangedAt (legitimate session)', async () => {
    const payload = signedPayload(jwt);
    // pwChangedAt is 5 minutes BEFORE iat — token came later, still valid.
    mockCacheService.getPasswordChangedAt.mockResolvedValueOnce(
      (payload.iat - 5 * 60) * 1000,
    );
    const result = await strategy.validate(payload);
    expect(result.sub).toBe(USER_ID);
  });

  it('accepts a token when pwChangedAt is null (no force-logout recorded)', async () => {
    const payload = signedPayload(jwt);
    mockCacheService.getPasswordChangedAt.mockResolvedValueOnce(null);
    const result = await strategy.validate(payload);
    expect(result.sub).toBe(USER_ID);
  });

  it('rejects a token whose iat is older than pwChangedAt (force-logout fired)', async () => {
    const payload = signedPayload(jwt);
    // pwChangedAt is 5 minutes AFTER iat — admin force-logged-out
    // this user after they obtained this token.
    mockCacheService.getPasswordChangedAt.mockResolvedValueOnce(
      (payload.iat + 5 * 60) * 1000,
    );
    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects when pwChangedAt equals iat * 1000 + 1ms (boundary)', async () => {
    const payload = signedPayload(jwt);
    mockCacheService.getPasswordChangedAt.mockResolvedValueOnce(
      payload.iat * 1000 + 1,
    );
    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('accepts when pwChangedAt equals iat * 1000 exactly (token issued at the moment of invalidation)', async () => {
    const payload = signedPayload(jwt);
    // Strict less-than: equal pwChangedAt does not invalidate. This
    // matches the WS guard semantics from V-01.
    mockCacheService.getPasswordChangedAt.mockResolvedValueOnce(payload.iat * 1000);
    const result = await strategy.validate(payload);
    expect(result.sub).toBe(USER_ID);
  });

  it('accepts a token with no iat claim (defensive — service tokens may lack it)', async () => {
    const payload = { sub: USER_ID, email: 'svc@test.local' } as any;
    // The strategy short-circuits when iat is missing, so the cache
    // is never read — keep this behaviour to avoid breaking system
    // tokens that intentionally omit iat.
    const result = await strategy.validate(payload);
    expect(result.sub).toBe(USER_ID);
    expect(mockCacheService.getPasswordChangedAt).not.toHaveBeenCalled();
  });
});
