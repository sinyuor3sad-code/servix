/**
 * Chaos: Redis is unreachable.
 *
 * Puts every Redis method into "always throws" mode and exercises the full
 * public surface of CacheService. The contract under test is that NONE of
 * these should propagate the Redis error — cache is optional, not load-bearing.
 *
 * If this suite ever fails, a try/catch somewhere inside CacheService was
 * removed or replaced with `throw`, which would turn a Redis blip into a
 * platform-wide 500 storm. See tooling/chaos/scenarios.md §1–§3.
 */

const mockRedisInstance = {
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
  exists: jest.fn(),
  quit: jest.fn().mockResolvedValue('OK'),
  on: jest.fn(),
};

jest.mock('ioredis', () => {
  const Redis = jest.fn().mockImplementation(() => mockRedisInstance);
  return { __esModule: true, default: Redis };
});

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../src/shared/cache/cache.service';
import { PlatformPrismaClient } from '../../src/shared/database/platform.client';

const REDIS_DOWN = new Error('ECONNREFUSED 127.0.0.1:6379');

const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: unknown) => {
    const config: Record<string, unknown> = {
      REDIS_HOST: 'localhost',
      REDIS_PORT: 6379,
      REDIS_PASSWORD: '',
    };
    return config[key] ?? defaultValue;
  }),
};

const mockPlatformPrisma = {
  tokenBlacklist: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
  },
};

describe('Chaos: Redis unreachable', () => {
  let service: CacheService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Make every Redis operation throw.
    mockRedisInstance.get.mockRejectedValue(REDIS_DOWN);
    mockRedisInstance.set.mockRejectedValue(REDIS_DOWN);
    mockRedisInstance.setex.mockRejectedValue(REDIS_DOWN);
    mockRedisInstance.del.mockRejectedValue(REDIS_DOWN);
    mockRedisInstance.incr.mockRejectedValue(REDIS_DOWN);
    mockRedisInstance.expire.mockRejectedValue(REDIS_DOWN);
    mockRedisInstance.ttl.mockRejectedValue(REDIS_DOWN);
    mockRedisInstance.exists.mockRejectedValue(REDIS_DOWN);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PlatformPrismaClient, useValue: mockPlatformPrisma },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
  });

  describe('tenant lookup miss path', () => {
    it('getTenant returns null instead of throwing', async () => {
      await expect(service.getTenant('tenant-1')).resolves.toBeNull();
    });

    it('setTenant swallows the write error', async () => {
      await expect(service.setTenant('tenant-1', {} as never)).resolves.toBeUndefined();
    });

    it('invalidateTenant swallows the delete error', async () => {
      await expect(service.invalidateTenant('tenant-1')).resolves.toBeUndefined();
    });
  });

  describe('settings lookup miss path', () => {
    it('getSettings returns null', async () => {
      await expect(service.getSettings('tenant-1')).resolves.toBeNull();
    });

    it('setSettings swallows the write error', async () => {
      await expect(service.setSettings('tenant-1', { a: '1' })).resolves.toBeUndefined();
    });

    it('invalidateSettings swallows the delete error', async () => {
      await expect(service.invalidateSettings('tenant-1')).resolves.toBeUndefined();
    });

    it('getPlatformSettings returns null', async () => {
      await expect(service.getPlatformSettings()).resolves.toBeNull();
    });

    it('setPlatformSettings swallows the write error', async () => {
      await expect(service.setPlatformSettings({ a: '1' })).resolves.toBeUndefined();
    });
  });

  describe('rate limiting — fails OPEN (locking out users is worse than a bypass)', () => {
    it('checkForgotPasswordRateLimit allows the request', async () => {
      await expect(service.checkForgotPasswordRateLimit('a@b.com')).resolves.toBe(true);
    });

    it('incrementForgotPasswordAttempt returns 0', async () => {
      await expect(service.incrementForgotPasswordAttempt('a@b.com')).resolves.toBe(0);
    });

    it('checkLoginIpBlock reports unblocked', async () => {
      await expect(service.checkLoginIpBlock('1.2.3.4')).resolves.toBe(0);
    });

    it('incrementLoginFailIp records no block', async () => {
      await expect(service.incrementLoginFailIp('1.2.3.4')).resolves.toEqual({
        count: 0,
        blockSeconds: 0,
      });
    });

    it('resetLoginFailIp swallows the delete error', async () => {
      await expect(service.resetLoginFailIp('1.2.3.4')).resolves.toBeUndefined();
    });

    it('isAccountLocked reports NOT locked', async () => {
      await expect(service.isAccountLocked('user-1')).resolves.toBe(false);
    });

    it('incrementLoginFailAccount records no lock', async () => {
      await expect(service.incrementLoginFailAccount('user-1')).resolves.toEqual({
        count: 0,
        locked: false,
      });
    });

    it('resetLoginFailAccount swallows the delete error', async () => {
      await expect(service.resetLoginFailAccount('user-1')).resolves.toBeUndefined();
    });

    it('incrementRateLimit returns 0', async () => {
      await expect(service.incrementRateLimit('k', 60)).resolves.toBe(0);
    });
  });

  describe('refresh-token blacklist falls through to DB', () => {
    it('isRefreshTokenBlacklisted hits DB when Redis is down — returns true if DB entry exists', async () => {
      mockPlatformPrisma.tokenBlacklist.findUnique.mockResolvedValue({
        tokenHash: 'h',
        expiresAt: new Date(Date.now() + 60_000),
      });

      await expect(service.isRefreshTokenBlacklisted('h')).resolves.toBe(true);
      expect(mockPlatformPrisma.tokenBlacklist.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: 'h' },
      });
    });

    it('isRefreshTokenBlacklisted returns false if DB has no entry', async () => {
      mockPlatformPrisma.tokenBlacklist.findUnique.mockResolvedValue(null);
      await expect(service.isRefreshTokenBlacklisted('h')).resolves.toBe(false);
    });

    it('isRefreshTokenBlacklisted fails OPEN when both Redis AND DB are down', async () => {
      // Auth outage is worse than a rotated token being reused for a few seconds.
      mockPlatformPrisma.tokenBlacklist.findUnique.mockRejectedValue(new Error('db down'));
      await expect(service.isRefreshTokenBlacklisted('h')).resolves.toBe(false);
    });

    it('blacklistRefreshToken still writes to DB even with Redis down', async () => {
      mockPlatformPrisma.tokenBlacklist.upsert.mockResolvedValue({});
      await expect(service.blacklistRefreshToken('h', 'u')).resolves.toBeUndefined();
      expect(mockPlatformPrisma.tokenBlacklist.upsert).toHaveBeenCalled();
    });
  });

  describe('password change timestamp', () => {
    it('setPasswordChangedAt swallows the write error', async () => {
      await expect(service.setPasswordChangedAt('user-1')).resolves.toBeUndefined();
    });

    it('getPasswordChangedAt returns null', async () => {
      await expect(service.getPasswordChangedAt('user-1')).resolves.toBeNull();
    });
  });

  describe('booking OTP — fails OPEN (so offline salons still work)', () => {
    it('setBookingOtp swallows the write error', async () => {
      await expect(service.setBookingOtp('+966500000000', '1234')).resolves.toBeUndefined();
    });

    it('verifyBookingOtp returns true (legit user should not be blocked by Redis outage)', async () => {
      await expect(service.verifyBookingOtp('+966500000000', '1234')).resolves.toBe(true);
    });

    it('canSendBookingOtp returns true', async () => {
      await expect(service.canSendBookingOtp('+966500000000')).resolves.toBe(true);
    });

    it('markBookingOtpSent swallows the write error', async () => {
      await expect(service.markBookingOtpSent('+966500000000')).resolves.toBeUndefined();
    });
  });

  describe('email OTP — fails OPEN', () => {
    it('setEmailOtp swallows the write error', async () => {
      await expect(service.setEmailOtp('a@b.com', '1234')).resolves.toBeUndefined();
    });

    it('verifyEmailOtp returns true', async () => {
      await expect(service.verifyEmailOtp('a@b.com', '1234')).resolves.toBe(true);
    });

    it('canSendEmailOtp returns true', async () => {
      await expect(service.canSendEmailOtp('a@b.com')).resolves.toBe(true);
    });

    it('markEmailOtpSent swallows the write error', async () => {
      await expect(service.markEmailOtpSent('a@b.com')).resolves.toBeUndefined();
    });
  });

  describe('lifecycle', () => {
    it('onModuleDestroy does not throw even if quit fails — SIGTERM drain must complete', async () => {
      mockRedisInstance.quit.mockRejectedValueOnce(REDIS_DOWN);
      await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    });
  });
});
