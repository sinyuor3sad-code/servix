import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PlatformPrismaClient } from './platform.client';
import { TenantClientFactory } from './tenant-client.factory';

@Injectable()
export class TenantDatabaseService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TenantDatabaseService.name);

  constructor(
    private readonly platformPrisma: PlatformPrismaClient,
    private readonly tenantClientFactory: TenantClientFactory,
  ) {}

  /**
   * On app startup, sync tenant schema to all existing tenant databases.
   * Only runs when SYNC_TENANT_SCHEMAS=true env var is set.
   * Runs in background so it doesn't block the API from starting.
   */
  async onApplicationBootstrap(): Promise<void> {
    if (process.env.SYNC_TENANT_SCHEMAS !== 'true') {
      this.logger.log('Tenant schema sync skipped (set SYNC_TENANT_SCHEMAS=true to enable)');
      return;
    }
    // Run in background - don't block API startup
    this.syncAllTenantSchemas().catch((err) => {
      this.logger.error(`Tenant schema sync failed: ${err.message}`);
    });
  }

  /**
   * Deploy migrations to ALL existing tenant databases.
   * Called on startup to ensure all tenants have the latest schema.
   */
  async syncAllTenantSchemas(): Promise<void> {
    this.logger.log('🔄 Starting tenant schema sync (migrate deploy)...');

    try {
      const tenants = await this.platformPrisma.tenant.findMany({
        where: { status: { not: 'cancelled' } },
        select: { id: true, slug: true, databaseName: true },
      });

      // Filter out platform DB and template
      const tenantDbs = tenants
        .filter(t => t.databaseName !== 'servix_platform')
        .map(t => t.databaseName);

      if (tenantDbs.length === 0) {
        this.logger.log('No tenant databases to sync');
        return;
      }

      this.logger.log(`Found ${tenantDbs.length} tenant databases to sync`);

      let success = 0;
      let failed = 0;

      for (const dbName of tenantDbs) {
        try {
          await this.deployTenantMigrations(dbName);
          success++;
          this.logger.log(`✅ Migrations deployed: ${dbName} (${success}/${tenantDbs.length})`);
        } catch (error: unknown) {
          failed++;
          const msg = error instanceof Error ? error.message : String(error);
          this.logger.warn(`⚠️ Migration deploy failed for ${dbName}: ${msg}`);
        }
      }

      this.logger.log(`🎉 Tenant schema sync complete: ${success} success, ${failed} failed, ${tenantDbs.length} total`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to fetch tenants for sync: ${msg}`);
    }
  }

  /**
   * Creates a new PostgreSQL database for a tenant and runs migrations.
   * Called after tenant record is created in the platform database.
   */
  async createTenantDatabase(databaseName: string): Promise<void> {
    this.logger.log(`Creating tenant database: ${databaseName}`);

    // Step 1: Create the PostgreSQL database using raw SQL on platform connection
    try {
      const existing = await this.platformPrisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*) as count FROM pg_database WHERE datname = $1`,
        databaseName,
      );

      const count = Number(existing[0]?.count ?? 0);
      if (count > 0) {
        this.logger.warn(`Database ${databaseName} already exists, skipping creation`);
      } else {
        const safeName = databaseName.replace(/[^a-zA-Z0-9_]/g, '');
        await this.platformPrisma.$executeRawUnsafe(
          `CREATE DATABASE "${safeName}"`,
        );
        this.logger.log(`Database ${databaseName} created successfully`);
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (errMsg.includes('already exists')) {
        this.logger.warn(`Database ${databaseName} already exists`);
      } else {
        this.logger.error(`Failed to create database ${databaseName}: ${errMsg}`);
        throw error;
      }
    }

    // Step 2: Deploy migrations to the new database
    try {
      await this.deployTenantMigrations(databaseName);
      this.logger.log(`Tenant migrations deployed to ${databaseName}`);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to deploy migrations to ${databaseName}: ${errMsg}`);
      throw error;
    }
  }

  /**
   * Deploy tenant migrations using `prisma migrate deploy`.
   * Unlike `db push --accept-data-loss`, this refuses destructive changes.
   */
  private async deployTenantMigrations(databaseName: string): Promise<void> {
    const { execSync } = await import('child_process');
    const baseUrl = process.env.PLATFORM_DATABASE_URL || '';
    const url = new URL(baseUrl);
    url.pathname = `/${databaseName}`;
    const tenantUrl = url.toString();

    const env = { ...process.env, TENANT_DATABASE_URL: tenantUrl };
    const opts = { cwd: process.cwd(), timeout: 60000, env };

    // Try multiple prisma binary paths (pnpm deploy vs pnpm install have different structures)
    const prismaPaths = [
      'node_modules/.bin/prisma',
      'node_modules/.pnpm/node_modules/.bin/prisma',
      'npx prisma',
    ];

    for (const prismaCmd of prismaPaths) {
      try {
        execSync(
          `${prismaCmd} migrate deploy --schema=./prisma/tenant.prisma 2>&1`,
          opts,
        );
        return; // Success
      } catch (err: unknown) {
        // If prisma binary not found, try next path
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes('not found') || errMsg.includes('ENOENT')) {
          continue;
        }
        // If migration error (not binary issue), throw immediately
        throw err;
      }
    }

    this.logger.error(`Migration deploy failed for ${databaseName}: no working prisma binary found`);
    throw new Error(`Could not deploy migrations to ${databaseName}`);
  }

  /**
   * Drop a tenant database. Used for account deletion.
   */
  async dropTenantDatabase(databaseName: string): Promise<void> {
    this.logger.warn(`Dropping tenant database: ${databaseName}`);

    // Disconnect first
    await this.tenantClientFactory.disconnectTenant(databaseName);

    const safeName = databaseName.replace(/[^a-zA-Z0-9_]/g, '');

    // Terminate existing connections (parameterized query to prevent SQL injection)
    await this.platformPrisma.$queryRawUnsafe(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      safeName,
    );

    // DROP DATABASE cannot use parameterized queries, but safeName is sanitized above (alphanumeric + underscore only)
    await this.platformPrisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${safeName}"`);
    this.logger.log(`Database ${databaseName} dropped successfully`);
  }
}

