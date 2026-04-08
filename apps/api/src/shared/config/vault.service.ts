import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * VaultService provides centralized secrets management.
 *
 * In production: reads from HashiCorp Vault (VAULT_ADDR + VAULT_TOKEN).
 * In development: falls back to standard .env/ConfigService.
 *
 * This avoids a hard dependency on Vault — the app works everywhere.
 */
@Injectable()
export class VaultService implements OnModuleInit {
  private readonly logger = new Logger(VaultService.name);
  private secrets: Record<string, string> = {};
  private enabled = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const vaultAddr = this.configService.get<string>('VAULT_ADDR', '');
    const vaultToken = this.configService.get<string>('VAULT_TOKEN', '');

    if (!vaultAddr || !vaultToken) {
      this.logger.log('Vault not configured — using .env fallback');
      return;
    }

    try {
      const secretPath = this.configService.get<string>(
        'VAULT_SECRET_PATH',
        'secret/data/servix/production',
      );

      const response = await fetch(`${vaultAddr}/v1/${secretPath}`, {
        headers: {
          'X-Vault-Token': vaultToken,
        },
      });

      if (!response.ok) {
        throw new Error(`Vault returned ${response.status}`);
      }

      const body = (await response.json()) as {
        data?: { data?: Record<string, string> };
      };

      if (body?.data?.data) {
        this.secrets = body.data.data;
        this.enabled = true;
        this.logger.log(
          `Vault secrets loaded (${Object.keys(this.secrets).length} keys)`,
        );
      } else {
        this.logger.warn('Vault response missing data — using .env fallback');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Vault unavailable: ${msg} — using .env fallback`);
    }
  }

  /**
   * Get a secret value. Checks Vault first, then falls back to .env.
   */
  get(key: string, defaultValue?: string): string {
    // 1. Try Vault secrets
    if (this.enabled && this.secrets[key]) {
      return this.secrets[key];
    }

    // 2. Fall back to .env via ConfigService
    return this.configService.get<string>(key, defaultValue ?? '');
  }

  /**
   * Whether Vault integration is active.
   */
  get isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Number of secrets loaded from Vault.
   */
  get secretCount(): number {
    return Object.keys(this.secrets).length;
  }
}
