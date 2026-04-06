import { Injectable, Logger } from '@nestjs/common';
import { PlatformPrismaClient } from '../database/platform.client';
import { CacheService } from '../cache/cache.service';

const PLATFORM_SETTINGS_CACHE_KEY = 'servix:platform_settings';
const PLATFORM_SETTINGS_CACHE_TTL = 300; // 5 minutes

/**
 * Shared platform settings service.
 * Loads admin settings from platform_settings table with Redis caching.
 * All runtime consumers (guards, middleware, services) should inject this
 * instead of reading the database directly.
 */
@Injectable()
export class PlatformSettingsService {
  private readonly logger = new Logger(PlatformSettingsService.name);

  constructor(
    private readonly prisma: PlatformPrismaClient,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Get all platform settings as key-value map (cached for 5 minutes).
   */
  async getAll(): Promise<Record<string, string>> {
    // Try cache first
    const cached = await this.cacheService.getPlatformSettings();
    if (cached) return cached;

    // Load from DB
    try {
      const rows = await this.prisma.platformSetting.findMany();
      const result: Record<string, string> = {};
      for (const row of rows) {
        result[row.key] = row.value;
      }

      // Cache the result
      await this.cacheService.setPlatformSettings(result);
      return result;
    } catch (err) {
      this.logger.warn(`Failed to load platform settings: ${(err as Error).message}`);
      return {};
    }
  }

  /**
   * Get a single setting value with a default fallback.
   */
  async get(key: string, defaultValue: string = ''): Promise<string> {
    const all = await this.getAll();
    return all[key] ?? defaultValue;
  }

  /**
   * Get a numeric setting value.
   */
  async getNumber(key: string, defaultValue: number): Promise<number> {
    const val = await this.get(key, String(defaultValue));
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * Get a boolean setting value.
   */
  async getBoolean(key: string, defaultValue: boolean = false): Promise<boolean> {
    const val = await this.get(key, String(defaultValue));
    return val === 'true';
  }

  /**
   * Invalidate the cached settings (call after updateSettings).
   */
  async invalidateCache(): Promise<void> {
    await this.cacheService.invalidatePlatformSettings();
  }
}
