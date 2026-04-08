import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

/**
 * Feature Flag strategies
 */
export type FlagStrategy = 'ALL' | 'PERCENTAGE' | 'TENANT_LIST' | 'USER_LIST' | 'DISABLED';

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  strategy: FlagStrategy;
  percentage?: number;
  allowedTenants?: string[];
  allowedUsers?: string[];
  description?: string;
}

export interface FlagContext {
  tenantId?: string;
  userId?: string;
}

/**
 * Feature Flag Service
 * Provides runtime feature toggling with multiple rollout strategies.
 * Flags are stored in-memory with optional Redis cache (production: use database).
 */
@Injectable()
export class FeatureFlagService {
  private readonly logger = new Logger(FeatureFlagService.name);
  private readonly flags = new Map<string, FeatureFlag>();

  constructor(private readonly configService: ConfigService) {
    this.initDefaultFlags();
  }

  /**
   * Check if a feature is enabled for a given context
   */
  isEnabled(flagKey: string, context: FlagContext = {}): boolean {
    const flag = this.flags.get(flagKey);
    if (!flag || !flag.enabled) return false;

    switch (flag.strategy) {
      case 'ALL':
        return true;

      case 'DISABLED':
        return false;

      case 'PERCENTAGE': {
        const identifier = context.tenantId || context.userId || 'anonymous';
        const hash = createHash('md5')
          .update(`${flagKey}:${identifier}`)
          .digest('hex');
        const bucket = parseInt(hash.slice(0, 8), 16) % 100;
        return bucket < (flag.percentage ?? 0);
      }

      case 'TENANT_LIST':
        return flag.allowedTenants?.includes(context.tenantId ?? '') ?? false;

      case 'USER_LIST':
        return flag.allowedUsers?.includes(context.userId ?? '') ?? false;

      default:
        return false;
    }
  }

  /**
   * Get all feature flags
   */
  getAll(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  /**
   * Get a specific feature flag
   */
  getFlag(key: string): FeatureFlag | undefined {
    return this.flags.get(key);
  }

  /**
   * Create or update a feature flag
   */
  upsertFlag(flag: FeatureFlag): FeatureFlag {
    this.flags.set(flag.key, flag);
    this.logger.log(`Flag "${flag.key}" updated: ${flag.enabled ? 'enabled' : 'disabled'} (${flag.strategy})`);
    return flag;
  }

  /**
   * Toggle a flag on/off
   */
  toggleFlag(key: string, enabled: boolean): FeatureFlag | null {
    const flag = this.flags.get(key);
    if (!flag) return null;
    flag.enabled = enabled;
    this.flags.set(key, flag);
    this.logger.log(`Flag "${key}" toggled to ${enabled}`);
    return flag;
  }

  /**
   * Update rollout percentage
   */
  setPercentage(key: string, percentage: number): FeatureFlag | null {
    const flag = this.flags.get(key);
    if (!flag) return null;
    flag.percentage = Math.max(0, Math.min(100, percentage));
    flag.strategy = 'PERCENTAGE';
    this.flags.set(key, flag);
    this.logger.log(`Flag "${key}" percentage set to ${flag.percentage}%`);
    return flag;
  }

  /**
   * Delete a feature flag
   */
  deleteFlag(key: string): boolean {
    return this.flags.delete(key);
  }

  /**
   * Initialize default flags
   */
  private initDefaultFlags(): void {
    const defaults: FeatureFlag[] = [
      {
        key: 'new-booking-flow',
        enabled: false,
        strategy: 'PERCENTAGE',
        percentage: 0,
        description: 'New appointment booking flow with timeline view',
      },
      {
        key: 'zatca-phase2',
        enabled: true,
        strategy: 'TENANT_LIST',
        allowedTenants: [],
        description: 'ZATCA Phase 2 electronic invoicing',
      },
      {
        key: 'ai-recommendations',
        enabled: false,
        strategy: 'DISABLED',
        description: 'AI-powered service recommendations',
      },
      {
        key: 'mobile-push',
        enabled: true,
        strategy: 'ALL',
        description: 'Push notifications via Firebase',
      },
      {
        key: 'advanced-analytics',
        enabled: true,
        strategy: 'PERCENTAGE',
        percentage: 100,
        description: 'Advanced business analytics (LTV, churn)',
      },
      {
        key: 'loyalty-program',
        enabled: false,
        strategy: 'PERCENTAGE',
        percentage: 0,
        description: 'Customer loyalty points system',
      },
    ];

    defaults.forEach((f) => this.flags.set(f.key, f));
    this.logger.log(`Loaded ${defaults.length} default feature flags`);
  }
}
