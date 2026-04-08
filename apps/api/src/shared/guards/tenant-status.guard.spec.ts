import { TenantStatusGuard } from './tenant-status.guard';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';

describe('TenantStatusGuard', () => {
  let guard: TenantStatusGuard;

  beforeEach(() => {
    guard = new TenantStatusGuard();
  });

  const createContext = (tenant: any): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ tenant }),
      }),
    }) as any;

  it('should allow active tenants', () => {
    const ctx = createContext({ status: 'active' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow trial tenants', () => {
    const ctx = createContext({ status: 'trial' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow when no tenant context (admin routes)', () => {
    const ctx = createContext(undefined);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should block suspended tenants', () => {
    const ctx = createContext({ status: 'suspended', suspendReason: 'Non-payment' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should block deleted tenants', () => {
    const ctx = createContext({ status: 'deleted' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should include reason in suspended error', () => {
    const ctx = createContext({ status: 'suspended', suspendReason: 'Payment issue' });
    try {
      guard.canActivate(ctx);
    } catch (e: any) {
      expect(e.response.code).toBe('TENANT_SUSPENDED');
      expect(e.response.reason).toBe('Payment issue');
    }
  });
});
