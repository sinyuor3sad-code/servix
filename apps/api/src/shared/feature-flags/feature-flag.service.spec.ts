import { FeatureFlagService } from './feature-flag.service';

describe('FeatureFlagService', () => {
  let service: FeatureFlagService;

  beforeEach(() => {
    service = new FeatureFlagService({ get: () => undefined } as any);
  });

  describe('isEnabled', () => {
    it('should return false for unknown flag', () => {
      expect(service.isEnabled('nonexistent')).toBe(false);
    });

    it('should return true for ALL strategy', () => {
      service.upsertFlag({
        key: 'test-all',
        enabled: true,
        strategy: 'ALL',
      });
      expect(service.isEnabled('test-all')).toBe(true);
    });

    it('should return false for DISABLED strategy', () => {
      service.upsertFlag({
        key: 'test-disabled',
        enabled: true,
        strategy: 'DISABLED',
      });
      expect(service.isEnabled('test-disabled')).toBe(false);
    });

    it('should return false when flag is not enabled', () => {
      service.upsertFlag({
        key: 'test-off',
        enabled: false,
        strategy: 'ALL',
      });
      expect(service.isEnabled('test-off')).toBe(false);
    });

    it('should check TENANT_LIST correctly', () => {
      service.upsertFlag({
        key: 'test-tenants',
        enabled: true,
        strategy: 'TENANT_LIST',
        allowedTenants: ['tenant-1', 'tenant-2'],
      });

      expect(service.isEnabled('test-tenants', { tenantId: 'tenant-1' })).toBe(true);
      expect(service.isEnabled('test-tenants', { tenantId: 'tenant-3' })).toBe(false);
    });

    it('should check USER_LIST correctly', () => {
      service.upsertFlag({
        key: 'test-users',
        enabled: true,
        strategy: 'USER_LIST',
        allowedUsers: ['user-1'],
      });

      expect(service.isEnabled('test-users', { userId: 'user-1' })).toBe(true);
      expect(service.isEnabled('test-users', { userId: 'user-2' })).toBe(false);
    });

    it('should handle PERCENTAGE strategy deterministically', () => {
      service.upsertFlag({
        key: 'test-pct',
        enabled: true,
        strategy: 'PERCENTAGE',
        percentage: 50,
      });

      // Same user should always get same result
      const result1 = service.isEnabled('test-pct', { tenantId: 'tenant-a' });
      const result2 = service.isEnabled('test-pct', { tenantId: 'tenant-a' });
      expect(result1).toBe(result2);
    });

    it('should include all users at 100%', () => {
      service.upsertFlag({
        key: 'test-100',
        enabled: true,
        strategy: 'PERCENTAGE',
        percentage: 100,
      });

      expect(service.isEnabled('test-100', { tenantId: 'any' })).toBe(true);
    });

    it('should exclude all users at 0%', () => {
      service.upsertFlag({
        key: 'test-0',
        enabled: true,
        strategy: 'PERCENTAGE',
        percentage: 0,
      });

      expect(service.isEnabled('test-0', { tenantId: 'any' })).toBe(false);
    });
  });

  describe('CRUD operations', () => {
    it('should create and retrieve flags', () => {
      service.upsertFlag({
        key: 'new-flag',
        enabled: true,
        strategy: 'ALL',
        description: 'Test flag',
      });

      const flag = service.getFlag('new-flag');
      expect(flag).toBeDefined();
      expect(flag!.description).toBe('Test flag');
    });

    it('should toggle flag', () => {
      service.upsertFlag({
        key: 'toggle-me',
        enabled: true,
        strategy: 'ALL',
      });

      service.toggleFlag('toggle-me', false);
      expect(service.isEnabled('toggle-me')).toBe(false);

      service.toggleFlag('toggle-me', true);
      expect(service.isEnabled('toggle-me')).toBe(true);
    });

    it('should set percentage', () => {
      service.upsertFlag({
        key: 'pct-flag',
        enabled: true,
        strategy: 'PERCENTAGE',
        percentage: 10,
      });

      service.setPercentage('pct-flag', 50);
      const flag = service.getFlag('pct-flag');
      expect(flag!.percentage).toBe(50);
    });

    it('should clamp percentage to 0-100', () => {
      service.upsertFlag({
        key: 'clamp-flag',
        enabled: true,
        strategy: 'PERCENTAGE',
        percentage: 50,
      });

      service.setPercentage('clamp-flag', 150);
      expect(service.getFlag('clamp-flag')!.percentage).toBe(100);

      service.setPercentage('clamp-flag', -10);
      expect(service.getFlag('clamp-flag')!.percentage).toBe(0);
    });

    it('should delete flag', () => {
      service.upsertFlag({ key: 'delete-me', enabled: true, strategy: 'ALL' });
      expect(service.deleteFlag('delete-me')).toBe(true);
      expect(service.getFlag('delete-me')).toBeUndefined();
    });

    it('should list all flags', () => {
      const allFlags = service.getAll();
      expect(allFlags.length).toBeGreaterThan(0);
    });
  });

  describe('default flags', () => {
    it('should have default flags loaded', () => {
      const defaults = service.getAll();
      const keys = defaults.map((f) => f.key);
      expect(keys).toContain('mobile-push');
      expect(keys).toContain('zatca-phase2');
    });
  });
});
