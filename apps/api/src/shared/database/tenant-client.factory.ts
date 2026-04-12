import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '../../../generated/tenant';
import { LRUCache } from 'lru-cache';

const MAX_POOL_SIZE = parseInt(process.env.TENANT_POOL_SIZE || '100', 10);
const POOL_TTL = parseInt(process.env.TENANT_POOL_TTL || '3600000', 10); // 1 hour default

@Injectable()
export class TenantClientFactory implements OnModuleDestroy {
  private readonly logger = new Logger(TenantClientFactory.name);

  private readonly pool = new LRUCache<string, PrismaClient>({
    max: MAX_POOL_SIZE,
    ttl: POOL_TTL,
    dispose: (client: PrismaClient, key: string) => {
      this.logger.log(`Evicting tenant client: ${key}`);
      client.$disconnect().catch((err) => {
        this.logger.error(`Error disconnecting tenant ${key}: ${err}`);
      });
    },
    updateAgeOnGet: true,
    updateAgeOnHas: true,
  });

  getTenantClient(databaseName: string): PrismaClient {
    const existing = this.pool.get(databaseName);
    if (existing) {
      return existing;
    }

    const databaseUrl = this.buildDatabaseUrl(databaseName);
    const client = new PrismaClient({
      datasources: {
        db: { url: databaseUrl },
      },
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });

    this.pool.set(databaseName, client);
    this.logger.log(`Connected to tenant database: ${databaseName} (pool: ${this.pool.size}/${MAX_POOL_SIZE})`);

    return client;
  }

  async disconnectTenant(databaseName: string): Promise<void> {
    const client = this.pool.get(databaseName);
    if (client) {
      await client.$disconnect();
      this.pool.delete(databaseName);
      this.logger.log(`Disconnected from tenant database: ${databaseName}`);
    }
  }

  getPoolStats() {
    return {
      size: this.pool.size,
      maxSize: MAX_POOL_SIZE,
      ttl: POOL_TTL,
      utilization: ((this.pool.size / MAX_POOL_SIZE) * 100).toFixed(1) + '%',
    };
  }

  async onModuleDestroy(): Promise<void> {
    const entries = [...this.pool.entries()];
    const disconnectPromises = entries.map(async ([name, client]) => {
      await client.$disconnect();
      this.logger.log(`Disconnected from tenant database: ${name}`);
    });
    await Promise.all(disconnectPromises);
    this.pool.clear();
  }

  private buildDatabaseUrl(databaseName: string): string {
    const baseUrl = process.env.PLATFORM_DATABASE_URL || '';
    const url = new URL(baseUrl);
    url.pathname = `/${databaseName}`;
    // Limit connections per tenant to avoid exhausting PgBouncer
    url.searchParams.set('connection_limit', '5');
    url.searchParams.set('pool_timeout', '30');
    return url.toString();
  }
}
