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
          // V-37: header is now ignored — JWT-only. Keep an empty headers
          // object in the fixture to mirror Express's real request shape.
          headers: {},
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
          // V-37: header is now ignored — JWT-only. Keep an empty headers
          // object in the fixture to mirror Express's real request shape.
          headers: {},
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
          headers: {},
          tenant,
          user: { tenantId: 't1' },
          tenantDb: { employee: { count: jest.fn().mockResolvedValue(10) } },
        }),
      }),
      getClass: () => ({ name: 'EmployeesController' }),
    } as any;
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  // V-37 — header trust removal
  it('V-37: ignores spoofed x-tenant-id header when JWT carries tenantId (spoofed value does NOT enter the warn log)', async () => {
    const warnSpy = jest.spyOn((guard as any).logger, 'warn').mockImplementation(() => undefined);
    const tenant = { subscription: { plan: { slug: 'basic' } } };
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          // 🚨 Attacker spoofs a different tenantId in the header.
          headers: { 'x-tenant-id': 'attacker-spoofed-tenant' },
          tenant,
          user: { tenantId: 'real-tenant-from-jwt' },
          tenantDb: { employee: { count: jest.fn().mockResolvedValue(10) } },
        }),
      }),
      getClass: () => ({ name: 'EmployeesController' }),
    } as any;

    // Quota still triggers (real-tenant is over the basic limit of 5).
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);

    // Warn log received the JWT tenantId, NOT the spoofed header value.
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const logged = warnSpy.mock.calls[0][0] as string;
    expect(logged).toContain('real-tenant-from-jwt');
    expect(logged).not.toContain('attacker-spoofed-tenant');
    warnSpy.mockRestore();
  });

  it('V-37: empty JWT tenantId short-circuits to allow (admin / pre-tenant signup), even with header set', async () => {
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          // Header tries to inject a tenantId, but post-V-37 it's ignored.
          headers: { 'x-tenant-id': 'header-only-tenant' },
          // Real JWT has no active tenant (admin route / pre-tenant signup).
          user: { tenantId: '' },
        }),
      }),
      getClass: () => ({ name: 'EmployeesController' }),
    } as any;

    // Guard short-circuits at the `if (!tenantId) return true` line —
    // empty string from JWT is falsy, header doesn't get a vote.
    expect(await guard.canActivate(ctx)).toBe(true);
  });
});
