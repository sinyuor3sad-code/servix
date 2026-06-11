import { QuotaGuard, PLAN_LIMITS_CACHE_PREFIX } from './quota.guard';
import { ForbiddenException } from '@nestjs/common';

/**
 * V-37-wire unit spec. The guard now resolves plan limits itself
 * (platform DB + Redis cache — request.tenant does NOT carry the plan) and
 * detects the resource via @QuotaResource metadata (V-37c), not controller
 * names. The reflector is mocked per-test; PlatformPrismaClient/CacheService
 * are stubs.
 */
describe('QuotaGuard', () => {
  let guard: QuotaGuard;

  const reflector = { getAllAndOverride: jest.fn() };
  const prisma = { subscription: { findFirst: jest.fn() } };
  const cache = {
    getJson: jest.fn().mockResolvedValue(null),
    setJson: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    cache.getJson.mockResolvedValue(null);
    guard = new QuotaGuard(
      reflector as never,
      prisma as never,
      cache as never,
    );
  });

  const planWith = (limits: Partial<{ maxEmployees: number; maxClients: number; maxAppointmentsMonth: number | null }>) =>
    prisma.subscription.findFirst.mockResolvedValue({
      plan: { maxEmployees: 5, maxClients: 100, maxAppointmentsMonth: null, ...limits },
    });

  const createContext = (
    method: string,
    resource: string | undefined,
    overrides: Record<string, unknown> = {},
  ) => {
    reflector.getAllAndOverride.mockReturnValue(resource);
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          method,
          // V-37: header is ignored — JWT-only. Keep an empty headers object
          // in the fixture to mirror Express's real request shape.
          headers: {},
          user: { tenantId: 'tenant-1' },
          ...overrides,
        }),
      }),
      getClass: () => ({ name: 'EmployeesController' }),
      getHandler: () => ({}),
    } as never;
  };

  it('allows GET requests without checking', async () => {
    const ctx = createContext('GET', 'employees');
    expect(await guard.canActivate(ctx)).toBe(true);
    expect(prisma.subscription.findFirst).not.toHaveBeenCalled();
  });

  it('V-37c: allows POST on routes WITHOUT @QuotaResource metadata (no name matching)', async () => {
    const ctx = createContext('POST', undefined);
    expect(await guard.canActivate(ctx)).toBe(true);
    expect(prisma.subscription.findFirst).not.toHaveBeenCalled();
  });

  it('allows POST when no tenant context in JWT', async () => {
    const ctx = createContext('POST', 'employees', { user: {} });
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('allows POST when no subscription/plan resolves (fail-open, V-37d)', async () => {
    prisma.subscription.findFirst.mockResolvedValue(null);
    const ctx = createContext('POST', 'employees', { tenantDb: {} });
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('allows POST when the plan limit is -1 (unlimited)', async () => {
    planWith({ maxEmployees: -1 });
    const ctx = createContext('POST', 'employees', {
      tenantDb: { employee: { count: jest.fn().mockResolvedValue(999) } },
    });
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('treats NULL maxAppointmentsMonth as unlimited', async () => {
    planWith({ maxAppointmentsMonth: null });
    const ctx = createContext('POST', 'appointments', {
      tenantDb: { appointment: { count: jest.fn().mockResolvedValue(99999) } },
    });
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('services/invoices are unlimited (Plan has no max columns — by design)', async () => {
    planWith({});
    for (const resource of ['services', 'invoices']) {
      const ctx = createContext('POST', resource, { tenantDb: {} });
      expect(await guard.canActivate(ctx)).toBe(true);
    }
  });

  it('allows POST when under the DB-backed limit', async () => {
    planWith({ maxEmployees: 5 });
    const ctx = createContext('POST', 'employees', {
      tenantDb: { employee: { count: jest.fn().mockResolvedValue(4) } },
    });
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('blocks POST with QUOTA_EXCEEDED when usage >= DB-backed limit', async () => {
    planWith({ maxEmployees: 5 });
    const ctx = createContext('POST', 'employees', {
      tenantDb: { employee: { count: jest.fn().mockResolvedValue(5) } },
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('caches plan limits (TTL 300) and serves the cached value without a DB hit', async () => {
    cache.getJson.mockResolvedValue({ maxEmployees: 5, maxClients: 100, maxAppointmentsMonth: null });
    const ctx = createContext('POST', 'employees', {
      tenantDb: { employee: { count: jest.fn().mockResolvedValue(5) } },
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    expect(cache.getJson).toHaveBeenCalledWith(`${PLAN_LIMITS_CACHE_PREFIX}tenant-1`);
    expect(prisma.subscription.findFirst).not.toHaveBeenCalled();
  });

  it('on cache miss, reads the plan from the platform DB and repopulates the cache', async () => {
    planWith({ maxEmployees: 5 });
    const ctx = createContext('POST', 'employees', {
      tenantDb: { employee: { count: jest.fn().mockResolvedValue(0) } },
    });
    expect(await guard.canActivate(ctx)).toBe(true);
    expect(prisma.subscription.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1', status: { in: ['active', 'trial', 'expired'] } },
        include: { plan: true },
      }),
    );
    expect(cache.setJson).toHaveBeenCalledWith(
      `${PLAN_LIMITS_CACHE_PREFIX}tenant-1`,
      { maxEmployees: 5, maxClients: 100, maxAppointmentsMonth: null },
      300,
    );
  });

  it('fails open (allow) when the platform DB errors during plan resolution (V-37d)', async () => {
    prisma.subscription.findFirst.mockRejectedValue(new Error('db down'));
    const ctx = createContext('POST', 'employees', { tenantDb: {} });
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('fails open (usage=0) when the tenant DB errors during counting (V-37d)', async () => {
    planWith({ maxEmployees: 5 });
    const ctx = createContext('POST', 'employees', {
      tenantDb: { employee: { count: jest.fn().mockRejectedValue(new Error('tenant db down')) } },
    });
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  // V-37 — header trust removal (preserved from the pre-wire spec)
  it('V-37: ignores spoofed x-tenant-id header when JWT carries tenantId (spoofed value does NOT enter the warn log)', async () => {
    const warnSpy = jest.spyOn((guard as never as { logger: { warn: (m: string) => void } }).logger, 'warn').mockImplementation(() => undefined);
    planWith({ maxEmployees: 5 });
    reflector.getAllAndOverride.mockReturnValue('employees');
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          // 🚨 Attacker spoofs a different tenantId in the header.
          headers: { 'x-tenant-id': 'attacker-spoofed-tenant' },
          user: { tenantId: 'real-tenant-from-jwt' },
          tenantDb: { employee: { count: jest.fn().mockResolvedValue(10) } },
        }),
      }),
      getClass: () => ({ name: 'EmployeesController' }),
      getHandler: () => ({}),
    } as never;

    // Quota still triggers (real tenant is over its limit of 5).
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);

    // Warn log received the JWT tenantId, NOT the spoofed header value.
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const logged = warnSpy.mock.calls[0][0] as string;
    expect(logged).toContain('real-tenant-from-jwt');
    expect(logged).not.toContain('attacker-spoofed-tenant');
    warnSpy.mockRestore();
  });

  it('V-37: empty JWT tenantId short-circuits to allow (admin / pre-tenant signup), even with header set', async () => {
    reflector.getAllAndOverride.mockReturnValue('employees');
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
      getHandler: () => ({}),
    } as never;

    expect(await guard.canActivate(ctx)).toBe(true);
    expect(prisma.subscription.findFirst).not.toHaveBeenCalled();
  });
});
