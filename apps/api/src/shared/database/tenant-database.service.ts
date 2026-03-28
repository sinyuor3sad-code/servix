import { Injectable, Logger } from '@nestjs/common';
import { PlatformPrismaClient } from './platform.client';
import { TenantClientFactory } from './tenant-client.factory';

@Injectable()
export class TenantDatabaseService {
  private readonly logger = new Logger(TenantDatabaseService.name);

  constructor(
    private readonly platformPrisma: PlatformPrismaClient,
    private readonly tenantClientFactory: TenantClientFactory,
  ) {}

  /**
   * Creates a new PostgreSQL database for a tenant and runs migrations.
   * Called after tenant record is created in the platform database.
   */
  async createTenantDatabase(databaseName: string): Promise<void> {
    this.logger.log(`Creating tenant database: ${databaseName}`);

    // Step 1: Create the PostgreSQL database using raw SQL on platform connection
    // We need to use $queryRawUnsafe because CREATE DATABASE cannot run inside a transaction
    try {
      // Check if database already exists
      const existing = await this.platformPrisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*) as count FROM pg_database WHERE datname = $1`,
        databaseName,
      );

      const count = Number(existing[0]?.count ?? 0);
      if (count > 0) {
        this.logger.warn(`Database ${databaseName} already exists, skipping creation`);
      } else {
        // CREATE DATABASE cannot use parameterized queries, so we sanitize manually
        const safeName = databaseName.replace(/[^a-zA-Z0-9_]/g, '');
        await this.platformPrisma.$executeRawUnsafe(
          `CREATE DATABASE "${safeName}"`,
        );
        this.logger.log(`Database ${databaseName} created successfully`);
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      // If database already exists, that's fine
      if (errMsg.includes('already exists')) {
        this.logger.warn(`Database ${databaseName} already exists`);
      } else {
        this.logger.error(`Failed to create database ${databaseName}: ${errMsg}`);
        throw error;
      }
    }

    // Step 2: Push the tenant schema to the new database using Prisma
    try {
      const tenantClient = this.tenantClientFactory.getTenantClient(databaseName);
      // This will create all tables defined in tenant.prisma
      // We use $executeRawUnsafe to create the schema via the tenant connection
      await this.pushTenantSchema(databaseName);
      this.logger.log(`Tenant schema pushed to ${databaseName}`);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to push schema to ${databaseName}: ${errMsg}`);
      throw error;
    }
  }

  /**
   * Push tenant schema by executing prisma db push via CLI.
   */
  private async pushTenantSchema(databaseName: string): Promise<void> {
    const { execSync } = await import('child_process');
    const baseUrl = process.env.PLATFORM_DATABASE_URL || '';
    const url = new URL(baseUrl);
    url.pathname = `/${databaseName}`;
    const tenantUrl = url.toString();

    const env = { ...process.env, TENANT_DATABASE_URL: tenantUrl };
    const opts = { cwd: process.cwd(), timeout: 30000, env };

    // Try multiple prisma binary paths (pnpm deploy vs pnpm install have different structures)
    const prismaPaths = [
      'node_modules/.bin/prisma',
      'node_modules/.pnpm/node_modules/.bin/prisma',
      'npx prisma',
    ];

    for (const prismaCmd of prismaPaths) {
      try {
        execSync(
          `${prismaCmd} db push --schema=./prisma/tenant.prisma --skip-generate --accept-data-loss 2>&1`,
          opts,
        );
        return; // Success
      } catch {
        continue; // Try next path
      }
    }

    this.logger.error(`Schema push failed for ${databaseName}: no working prisma binary found`);
    throw new Error(`Could not push schema to ${databaseName}`);
  }

  /**
   * Drop a tenant database. Used for account deletion.
   */
  async dropTenantDatabase(databaseName: string): Promise<void> {
    this.logger.warn(`Dropping tenant database: ${databaseName}`);

    // Disconnect first
    await this.tenantClientFactory.disconnectTenant(databaseName);

    const safeName = databaseName.replace(/[^a-zA-Z0-9_]/g, '');

    // Terminate existing connections
    await this.platformPrisma.$executeRawUnsafe(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${safeName}' AND pid <> pg_backend_pid()`,
    );

    await this.platformPrisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${safeName}"`);
    this.logger.log(`Database ${databaseName} dropped successfully`);
  }
}
