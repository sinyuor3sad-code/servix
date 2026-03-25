import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '../../../generated/tenant';

@Injectable()
export class TenantClientFactory implements OnModuleDestroy {
  private readonly logger = new Logger(TenantClientFactory.name);
  private readonly clients = new Map<string, PrismaClient>();
  private readonly MAX_POOL_SIZE = 50;

  getTenantClient(databaseName: string): PrismaClient {
    const existing = this.clients.get(databaseName);
    if (existing) {
      return existing;
    }

    if (this.clients.size >= this.MAX_POOL_SIZE) {
      this.evictOldestClient();
    }

    const databaseUrl = this.buildDatabaseUrl(databaseName);
    const client = new PrismaClient({
      datasources: {
        db: { url: databaseUrl },
      },
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });

    this.clients.set(databaseName, client);
    this.logger.log(`Connected to tenant database: ${databaseName}`);

    return client;
  }

  async disconnectTenant(databaseName: string): Promise<void> {
    const client = this.clients.get(databaseName);
    if (client) {
      await client.$disconnect();
      this.clients.delete(databaseName);
      this.logger.log(`Disconnected from tenant database: ${databaseName}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    const disconnectPromises = Array.from(this.clients.entries()).map(
      async ([name, client]) => {
        await client.$disconnect();
        this.logger.log(`Disconnected from tenant database: ${name}`);
      },
    );
    await Promise.all(disconnectPromises);
    this.clients.clear();
  }

  private buildDatabaseUrl(databaseName: string): string {
    const baseUrl = process.env.PLATFORM_DATABASE_URL || '';
    const url = new URL(baseUrl);
    url.pathname = `/${databaseName}`;
    return url.toString();
  }

  private evictOldestClient(): void {
    const firstKey = this.clients.keys().next().value;
    if (firstKey) {
      const client = this.clients.get(firstKey);
      client?.$disconnect().catch(() => {});
      this.clients.delete(firstKey);
      this.logger.warn(`Evicted tenant connection: ${firstKey} (pool full)`);
    }
  }
}
