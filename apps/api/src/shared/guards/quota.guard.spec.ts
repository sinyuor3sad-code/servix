import { QuotaGuard } from './quota.guard';
import { ForbiddenException } from '@nestjs/common';

describe('QuotaGuard', () => {
  let guard: QuotaGuard;

  beforeEach(() => {
    guard = new QuotaGuard();
  });

  const createContext = (method: string, controllerName: string, tenant: any) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          method,
          headers: { 'x-tenant-id': 'tenant-1' },
          tenant,
          user: { tenantId: 'tenant-1' },
          quotaUsage: {},
        }),
      }),
      getClass: () => ({ name: controllerName }),
      getHandler: () => ({}),
    }) as any;

  it('should allow GET requests without checking', async () => {
    const ctx = createContext('GET', 'EmployeesController', null);
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('should allow POST when no tenant context', async () => {
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'POST', headers: {}, user: {} }),
      }),
      getClass: () => ({ name: 'EmployeesController' }),
    } as any;
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('should allow POST for non-quota resources', async () => {
    const ctx = createContext('POST', 'SettingsController', {});
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('should allow POST when tenant has no plan', async () => {
    const ctx = createContext('POST', 'EmployeesController', { subscription: null });
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('should allow POST for premium plan (unlimited)', async () => {
    const tenant = { subscription: { plan: { slug: 'premium' } } };
    const ctx = createContext('POST', 'EmployeesController', tenant);
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('should allow POST when under limit', async () => {
    const tenant = { subscription: { plan: { slug: 'basic' } } };
    const ctx = createContext('POST', 'EmployeesController', tenant);
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('should block POST when over basic employee limit', async () => {
    const tenant = { subscription: { plan: { slug: 'basic' } } };
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          headers: { 'x-tenant-id': 'tenant-1' },
          tenant,
          user: { tenantId: 'tenant-1' },
          tenantDb: { employee: { count: jest.fn().mockResolvedValue(5) } },
        }),
      }),
      getClass: () => ({ name: 'EmployeesController' }),
    } as any;

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should detect employee resource from controller name', async () => {
    const tenant = { subscription: { plan: { slug: 'basic' } } };
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          headers: { 'x-tenant-id': 't1' },
          tenant,
          user: { tenantId: 't1' },
          tenantDb: { employee: { count: jest.fn().mockResolvedValue(10) } },
        }),
      }),
      getClass: () => ({ name: 'EmployeesController' }),
    } as any;
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });
});
