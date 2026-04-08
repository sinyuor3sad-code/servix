import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

/**
 * Redis-based distributed lock using SET NX PX + Lua release.
 * Ensures only one API instance executes a given task at a time.
 *
 * Usage:
 *   const lockId = await this.lockService.acquireLock('my-job', 60000);
 *   if (!lockId) return; // another instance holds it
 *   try { await doWork(); }
 *   finally { await this.lockService.releaseLock('my-job', lockId); }
 */
@Injectable()
export class DistributedLockService {
  private readonly logger = new Logger(DistributedLockService.name);
  private readonly redis: Redis;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    const password = this.configService.get<string>('REDIS_PASSWORD', '');

    this.redis = new Redis({
      host,
      port,
      password: password || undefined,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      keyPrefix: 'servix:lock:',
    });

    this.redis.on('error', (err) => {
      this.logger.warn(`Lock Redis error: ${err.message}`);
    });
  }

  /**
   * Try to acquire a distributed lock.
   * @returns Lock ID string if acquired, null if another holder exists.
   */
  async acquireLock(key: string, ttlMs: number = 60000): Promise<string | null> {
    const lockId = randomUUID();
    try {
      const result = await this.redis.set(key, lockId, 'PX', ttlMs, 'NX');
      if (result === 'OK') {
        this.logger.debug(`Lock acquired: ${key} (${lockId})`);
        return lockId;
      }
      return null;
    } catch (err) {
      this.logger.warn(`Failed to acquire lock ${key}: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Release a lock only if we still own it (Lua atomic check-and-delete).
   */
  async releaseLock(key: string, lockId: string): Promise<boolean> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    try {
      const result = await this.redis.eval(script, 1, key, lockId);
      const released = result === 1;
      if (released) {
        this.logger.debug(`Lock released: ${key}`);
      }
      return released;
    } catch (err) {
      this.logger.warn(`Failed to release lock ${key}: ${(err as Error).message}`);
      return false;
    }
  }

  /**
   * Execute a function with a distributed lock.
   * Returns null if lock not acquired.
   */
  async withLock<T>(
    key: string,
    fn: () => Promise<T>,
    ttlMs: number = 60000,
  ): Promise<T | null> {
    const lockId = await this.acquireLock(key, ttlMs);
    if (!lockId) {
      this.logger.debug(`Skipping ${key} — another instance holds the lock`);
      return null;
    }
    try {
      return await fn();
    } finally {
      await this.releaseLock(key, lockId);
    }
  }
}
