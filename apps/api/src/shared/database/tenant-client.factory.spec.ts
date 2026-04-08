import { TenantClientFactory } from './tenant-client.factory';

// Mock PrismaClient
jest.mock('../../../generated/tenant', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $connect: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('TenantClientFactory', () => {
  let factory: TenantClientFactory;

  beforeEach(() => {
    process.env.PLATFORM_DATABASE_URL = 'postgresql://user:pass@localhost:5432/servix_platform';
    factory = new TenantClientFactory();
  });

  afterEach(async () => {
    await factory.onModuleDestroy();
  });

  describe('getTenantClient', () => {
    it('should create a new client for unknown tenant', () => {
      const client = factory.getTenantClient('tenant_abc');
      expect(client).toBeDefined();
    });

    it('should return same client for same tenant (cache hit)', () => {
      const client1 = factory.getTenantClient('tenant_abc');
      const client2 = factory.getTenantClient('tenant_abc');
      expect(client1).toBe(client2);
    });

    it('should create different clients for different tenants', () => {
      const client1 = factory.getTenantClient('tenant_abc');
      const client2 = factory.getTenantClient('tenant_xyz');
      expect(client1).not.toBe(client2);
    });
  });

  describe('getPoolStats', () => {
    it('should return correct pool stats', () => {
      const stats = factory.getPoolStats();
      expect(stats.size).toBe(0);
      expect(stats.maxSize).toBeGreaterThan(0);
      expect(stats.utilization).toBe('0.0%');
    });

    it('should update stats after adding tenants', () => {
      factory.getTenantClient('tenant_1');
      factory.getTenantClient('tenant_2');

      const stats = factory.getPoolStats();
      expect(stats.size).toBe(2);
    });
  });

  describe('disconnectTenant', () => {
    it('should disconnect and remove from pool', async () => {
      factory.getTenantClient('tenant_abc');
      expect(factory.getPoolStats().size).toBe(1);

      await factory.disconnectTenant('tenant_abc');
      expect(factory.getPoolStats().size).toBe(0);
    });

    it('should handle disconnecting non-existent tenant', async () => {
      await expect(factory.disconnectTenant('unknown')).resolves.not.toThrow();
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect all tenants', async () => {
      factory.getTenantClient('t1');
      factory.getTenantClient('t2');
      factory.getTenantClient('t3');
      expect(factory.getPoolStats().size).toBe(3);

      await factory.onModuleDestroy();
      expect(factory.getPoolStats().size).toBe(0);
    });
  });
});
