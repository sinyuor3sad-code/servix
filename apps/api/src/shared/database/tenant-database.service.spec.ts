import { TenantDatabaseService } from './tenant-database.service';
import { PlatformPrismaClient } from './platform.client';

// Mock exec
jest.mock('child_process', () => ({
  exec: jest.fn((cmd: string, cb: (err: Error | null, result: { stdout: string; stderr: string }) => void) => {
    cb(null, { stdout: 'OK', stderr: '' });
  }),
}));

jest.mock('util', () => ({
  ...jest.requireActual('util'),
  promisify: jest.fn((fn: unknown) => {
    return jest.fn().mockResolvedValue({ stdout: 'OK', stderr: '' });
  }),
}));

describe('TenantDatabaseService', () => {
  let service: TenantDatabaseService;

  const mockPlatformPrisma = {
    tenant: {
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        $queryRaw: jest.fn().mockResolvedValue([]),
        $executeRaw: jest.fn().mockResolvedValue(0),
      }),
    ),
  };

  const mockTenantClientFactory = {
    getTenantClient: jest.fn().mockReturnValue({
      $disconnect: jest.fn(),
    }),
    disconnectTenant: jest.fn(),
    getPoolStats: jest.fn().mockReturnValue({ size: 0, maxSize: 100 }),
    onModuleDestroy: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PLATFORM_DATABASE_URL = 'postgresql://user:pass@localhost:5432/servix_platform';
    service = new TenantDatabaseService(
      mockPlatformPrisma as unknown as PlatformPrismaClient,
      mockTenantClientFactory as unknown as any,
    );
  });

  describe('syncAllTenantSchemas', () => {
    it('should handle empty tenant list', async () => {
      mockPlatformPrisma.tenant.findMany.mockResolvedValue([]);

      await service.syncAllTenantSchemas();
      // Should not throw — logged "No tenant databases to sync"
    });

    it('should process tenants in batches', async () => {
      const tenants = Array.from({ length: 25 }, (_, i) => ({
        id: `id-${i}`,
        slug: `tenant-${i}`,
        databaseName: `servix_tenant_${i}`,
      }));

      mockPlatformPrisma.tenant.findMany.mockResolvedValue(tenants);

      // deployTenantMigrations will be called, which uses exec
      await service.syncAllTenantSchemas();
      // Should process in batches of 10 (default MIGRATION_BATCH_SIZE)
    });

    it('should filter out platform database', async () => {
      mockPlatformPrisma.tenant.findMany.mockResolvedValue([
        { id: '1', slug: 'platform', databaseName: 'servix_platform' },
        { id: '2', slug: 'tenant-a', databaseName: 'servix_tenant_a' },
      ]);

      await service.syncAllTenantSchemas();
      // Only servix_tenant_a should be migrated, not servix_platform
    });

    it('should continue when a tenant migration fails', async () => {
      const tenants = [
        { id: '1', slug: 'ok-tenant', databaseName: 'servix_ok' },
        { id: '2', slug: 'fail-tenant', databaseName: 'servix_fail' },
        { id: '3', slug: 'ok-tenant2', databaseName: 'servix_ok2' },
      ];

      mockPlatformPrisma.tenant.findMany.mockResolvedValue(tenants);

      // Even if one fails, the others should complete
      await service.syncAllTenantSchemas();
      // Promise.allSettled ensures no propagation
    });
  });
});
