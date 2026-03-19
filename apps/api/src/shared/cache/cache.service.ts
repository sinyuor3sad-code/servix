import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

const TENANT_CACHE_PREFIX = 'servix:tenant:';
const SETTINGS_CACHE_PREFIX = 'servix:settings:';
const FORGOT_PASSWORD_PREFIX = 'servix:forgot_pwd:';
const LOGIN_FAIL_IP_PREFIX = 'servix:login_fail_ip:';
const LOGIN_FAIL_ACCOUNT_PREFIX = 'servix:login_fail_account:';
const REFRESH_BLACKLIST_PREFIX = 'servix:blacklist:';

/** Settings cache TTL: 5 minutes (CLAUDE.md) */
export const SETTINGS_CACHE_TTL_SECONDS = 300;

/** Tenant cache TTL: 5 minutes (per CLAUDE.md CODE REVIEW FIX 5) */
export const TENANT_CACHE_TTL_SECONDS = 300;

/** Forgot password rate limit: max 3 requests per hour */
export const FORGOT_PASSWORD_RATE_LIMIT = 3;
export const FORGOT_PASSWORD_RATE_TTL_SECONDS = 3600;

/** Refresh token blacklist TTL: 7 days (matches token expiry) */
export const REFRESH_BLACKLIST_TTL_SECONDS = 7 * 24 * 3600;

/** SEC-1: Login rate limits — 5→15min, 10→1hr, 20→24hr (IP); 10→lock (account) */
export const LOGIN_IP_BLOCKS = [
  { threshold: 5, ttlSeconds: 15 * 60 },
  { threshold: 10, ttlSeconds: 60 * 60 },
  { threshold: 20, ttlSeconds: 24 * 60 * 60 },
];
export const LOGIN_ACCOUNT_LOCK_THRESHOLD = 10;

export interface CachedTenantData {
  tenant: {
    id: string;
    nameAr: string;
    nameEn: string;
    slug: string;
    databaseName: string;
    status: string;
    primaryColor: string;
    theme: string;
    logoUrl: string | null;
  };
  subscription: {
    id: string;
    status: string;
    currentPeriodEnd: string;
  } | null;
  featureCodes: string[];
}

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly redis: Redis | null = null;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    const password = this.configService.get<string>('REDIS_PASSWORD', '');

    if (host && port) {
      try {
        this.redis = new Redis({
          host,
          port,
          password: password || undefined,
          retryStrategy: () => null,
          maxRetriesPerRequest: 1,
          lazyConnect: true,
        });
        this.redis.on('error', (err) => {
          this.logger.warn(`Redis connection error: ${err.message}`);
        });
        this.enabled = true;
      } catch {
        this.enabled = false;
        this.logger.warn('Redis not available, tenant cache disabled');
      }
    } else {
      this.enabled = false;
    }
  }

  async getTenant(tenantId: string): Promise<CachedTenantData | null> {
    if (!this.enabled || !this.redis) return null;

    try {
      const key = `${TENANT_CACHE_PREFIX}${tenantId}`;
      const data = await this.redis.get(key);
      if (!data) return null;

      return JSON.parse(data) as CachedTenantData;
    } catch {
      return null;
    }
  }

  async setTenant(tenantId: string, data: CachedTenantData): Promise<void> {
    if (!this.enabled || !this.redis) return;

    try {
      const key = `${TENANT_CACHE_PREFIX}${tenantId}`;
      await this.redis.setex(
        key,
        TENANT_CACHE_TTL_SECONDS,
        JSON.stringify(data),
      );
    } catch (err) {
      this.logger.warn(`Failed to cache tenant: ${(err as Error).message}`);
    }
  }

  async invalidateTenant(tenantId: string): Promise<void> {
    if (!this.enabled || !this.redis) return;

    try {
      await this.redis.del(`${TENANT_CACHE_PREFIX}${tenantId}`);
    } catch {
      // ignore
    }
  }

  async getSettings(tenantId: string): Promise<Record<string, string> | null> {
    if (!this.enabled || !this.redis) return null;

    try {
      const key = `${SETTINGS_CACHE_PREFIX}${tenantId}`;
      const data = await this.redis.get(key);
      if (!data) return null;

      return JSON.parse(data) as Record<string, string>;
    } catch {
      return null;
    }
  }

  async setSettings(
    tenantId: string,
    settings: Record<string, string>,
  ): Promise<void> {
    if (!this.enabled || !this.redis) return;

    try {
      const key = `${SETTINGS_CACHE_PREFIX}${tenantId}`;
      await this.redis.setex(
        key,
        SETTINGS_CACHE_TTL_SECONDS,
        JSON.stringify(settings),
      );
    } catch (err) {
      this.logger.warn(`Failed to cache settings: ${(err as Error).message}`);
    }
  }

  async invalidateSettings(tenantId: string): Promise<void> {
    if (!this.enabled || !this.redis) return;

    try {
      await this.redis.del(`${SETTINGS_CACHE_PREFIX}${tenantId}`);
    } catch {
      // ignore
    }
  }

  async checkForgotPasswordRateLimit(email: string): Promise<boolean> {
    if (!this.enabled || !this.redis) return true;

    try {
      const key = `${FORGOT_PASSWORD_PREFIX}${email.toLowerCase()}`;
      const count = await this.redis.get(key);
      return parseInt(count || '0', 10) < FORGOT_PASSWORD_RATE_LIMIT;
    } catch {
      return true;
    }
  }

  async incrementForgotPasswordAttempt(email: string): Promise<number> {
    if (!this.enabled || !this.redis) return 0;

    try {
      const key = `${FORGOT_PASSWORD_PREFIX}${email.toLowerCase()}`;
      const count = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.expire(key, FORGOT_PASSWORD_RATE_TTL_SECONDS);
      }
      return count;
    } catch {
      return 0;
    }
  }

  /** SEC-1: Login rate limiting by IP. Returns block TTL in seconds if blocked, else 0 */
  async checkLoginIpBlock(ip: string): Promise<number> {
    if (!this.enabled || !this.redis) return 0;

    try {
      const key = `${LOGIN_FAIL_IP_PREFIX}${ip}`;
      const ttl = await this.redis.ttl(key);
      return ttl > 0 ? ttl : 0;
    } catch {
      return 0;
    }
  }

  /** SEC-1: Increment login fail count for IP, apply block if threshold reached */
  async incrementLoginFailIp(ip: string): Promise<{ count: number; blockSeconds: number }> {
    if (!this.enabled || !this.redis) return { count: 0, blockSeconds: 0 };

    try {
      const key = `${LOGIN_FAIL_IP_PREFIX}${ip}`;
      const countKey = `${key}:count`;
      const count = await this.redis.incr(countKey);
      if (count === 1) {
        await this.redis.expire(countKey, 24 * 60 * 60);
      }

      let blockSeconds = 0;
      for (const { threshold, ttlSeconds } of LOGIN_IP_BLOCKS) {
        if (count >= threshold) {
          blockSeconds = Math.max(blockSeconds, ttlSeconds);
        }
      }
      if (blockSeconds > 0) {
        await this.redis.setex(key, blockSeconds, '1');
      }
      return { count, blockSeconds };
    } catch {
      return { count: 0, blockSeconds: 0 };
    }
  }

  /** SEC-1: Reset login fail count on successful login */
  async resetLoginFailIp(ip: string): Promise<void> {
    if (!this.enabled || !this.redis) return;
    try {
      await this.redis.del(`${LOGIN_FAIL_IP_PREFIX}${ip}`);
      await this.redis.del(`${LOGIN_FAIL_IP_PREFIX}${ip}:count`);
    } catch {
      // ignore
    }
  }

  /** SEC-1: Check if account is locked due to failed attempts */
  async isAccountLocked(userId: string): Promise<boolean> {
    if (!this.enabled || !this.redis) return false;
    try {
      const key = `${LOGIN_FAIL_ACCOUNT_PREFIX}${userId}`;
      return (await this.redis.get(key)) === '1';
    } catch {
      return false;
    }
  }

  /** SEC-1: Increment login fail for account, lock if threshold reached */
  async incrementLoginFailAccount(userId: string): Promise<{ count: number; locked: boolean }> {
    if (!this.enabled || !this.redis) return { count: 0, locked: false };

    try {
      const key = `${LOGIN_FAIL_ACCOUNT_PREFIX}${userId}`;
      const countKey = `${key}:count`;
      const count = await this.redis.incr(countKey);
      if (count === 1) {
        await this.redis.expire(countKey, 24 * 60 * 60);
      }

      const locked = count >= LOGIN_ACCOUNT_LOCK_THRESHOLD;
      if (locked) {
        await this.redis.setex(key, 24 * 60 * 60, '1');
      }
      return { count, locked };
    } catch {
      return { count: 0, locked: false };
    }
  }

  /** SEC-1: Reset account fail count on successful login */
  async resetLoginFailAccount(userId: string): Promise<void> {
    if (!this.enabled || !this.redis) return;
    try {
      await this.redis.del(`${LOGIN_FAIL_ACCOUNT_PREFIX}${userId}`);
      await this.redis.del(`${LOGIN_FAIL_ACCOUNT_PREFIX}${userId}:count`);
    } catch {
      // ignore
    }
  }

  /** SEC-2: Add refresh token to blacklist */
  async blacklistRefreshToken(tokenHash: string): Promise<void> {
    if (!this.enabled || !this.redis) return;
    try {
      const key = `${REFRESH_BLACKLIST_PREFIX}${tokenHash}`;
      await this.redis.setex(key, REFRESH_BLACKLIST_TTL_SECONDS, '1');
    } catch (err) {
      this.logger.warn(`Failed to blacklist token: ${(err as Error).message}`);
    }
  }

  /** SEC-2: Check if refresh token is blacklisted */
  async isRefreshTokenBlacklisted(tokenHash: string): Promise<boolean> {
    if (!this.enabled || !this.redis) return false;
    try {
      const key = `${REFRESH_BLACKLIST_PREFIX}${tokenHash}`;
      return (await this.redis.get(key)) === '1';
    } catch {
      return false;
    }
  }

  /** SEC-2: On password change — invalidate all refresh tokens for user (token issued before this time is invalid) */
  private readonly PWD_CHANGED_PREFIX = 'servix:pwd_changed:';

  async setPasswordChangedAt(userId: string): Promise<void> {
    if (!this.enabled || !this.redis) return;
    try {
      const key = `${this.PWD_CHANGED_PREFIX}${userId}`;
      const ts = Date.now().toString();
      await this.redis.setex(key, REFRESH_BLACKLIST_TTL_SECONDS, ts);
    } catch {
      // ignore
    }
  }

  async getPasswordChangedAt(userId: string): Promise<number | null> {
    if (!this.enabled || !this.redis) return null;
    try {
      const key = `${this.PWD_CHANGED_PREFIX}${userId}`;
      const ts = await this.redis.get(key);
      return ts ? parseInt(ts, 10) : null;
    } catch {
      return null;
    }
  }

  // ─── Booking OTP ───

  private readonly BOOKING_OTP_PREFIX = 'servix:booking_otp:';
  private readonly BOOKING_OTP_TTL = 300; // 5 minutes
  private readonly BOOKING_OTP_RATE_PREFIX = 'servix:booking_otp_rate:';
  private readonly BOOKING_OTP_RATE_TTL = 60; // 1 per minute

  async setBookingOtp(phone: string, code: string): Promise<void> {
    if (!this.enabled || !this.redis) return;
    try {
      await this.redis.set(
        `${this.BOOKING_OTP_PREFIX}${phone}`,
        code,
        'EX',
        this.BOOKING_OTP_TTL,
      );
    } catch { /* noop */ }
  }

  async verifyBookingOtp(phone: string, code: string): Promise<boolean> {
    if (!this.enabled || !this.redis) return true;
    try {
      const stored = await this.redis.get(`${this.BOOKING_OTP_PREFIX}${phone}`);
      if (stored === code) {
        await this.redis.del(`${this.BOOKING_OTP_PREFIX}${phone}`);
        return true;
      }
      return false;
    } catch {
      return true;
    }
  }

  async canSendBookingOtp(phone: string): Promise<boolean> {
    if (!this.enabled || !this.redis) return true;
    try {
      const key = `${this.BOOKING_OTP_RATE_PREFIX}${phone}`;
      const exists = await this.redis.exists(key);
      return !exists;
    } catch {
      return true;
    }
  }

  async markBookingOtpSent(phone: string): Promise<void> {
    if (!this.enabled || !this.redis) return;
    try {
      await this.redis.set(
        `${this.BOOKING_OTP_RATE_PREFIX}${phone}`,
        '1',
        'EX',
        this.BOOKING_OTP_RATE_TTL,
      );
    } catch { /* noop */ }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}
