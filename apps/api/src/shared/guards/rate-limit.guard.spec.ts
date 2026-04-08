import { RateLimitGuard, RATE_LIMIT_KEY } from './rate-limit.guard';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let mockCacheService: any;
  let mockReflector: any;
  let mockPlatformSettings: any;

  const createMockContext = (url = '/api/v1/clients', ip = '192.168.1.1'): ExecutionContext => {
    const mockResponse = { setHeader: jest.fn() };
    const mockRequest = {
      url,
      ip,
      headers: {},
      connection: { remoteAddress: ip },
    };

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
      getHandler: () => ({}),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    mockCacheService = {
      incrementRateLimit: jest.fn().mockResolvedValue(1),
    };
    mockReflector = {
      get: jest.fn().mockReturnValue(null),
    };
    mockPlatformSettings = {
      getNumber: jest.fn().mockResolvedValue(100),
    };

    guard = new RateLimitGuard(mockCacheService, mockReflector, mockPlatformSettings);
  });

  it('should allow request under rate limit', async () => {
    mockCacheService.incrementRateLimit.mockResolvedValue(5);

    const result = await guard.canActivate(createMockContext());

    expect(result).toBe(true);
  });

  it('should skip rate limiting for health checks', async () => {
    const result = await guard.canActivate(createMockContext('/api/v1/health'));

    expect(result).toBe(true);
    expect(mockCacheService.incrementRateLimit).not.toHaveBeenCalled();
  });

  it('should throw 429 when rate limit exceeded', async () => {
    mockCacheService.incrementRateLimit.mockResolvedValue(101);

    await expect(guard.canActivate(createMockContext())).rejects.toThrow(HttpException);
    
    try {
      await guard.canActivate(createMockContext());
    } catch (err) {
      expect((err as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });

  it('should set rate limit headers', async () => {
    mockCacheService.incrementRateLimit.mockResolvedValue(50);
    const ctx = createMockContext();

    await guard.canActivate(ctx);

    const res = ctx.switchToHttp().getResponse();
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 100);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 50);
  });

  it('should gracefully degrade when Redis is down', async () => {
    mockCacheService.incrementRateLimit.mockRejectedValue(new Error('Redis down'));

    const result = await guard.canActivate(createMockContext());

    expect(result).toBe(true); // Allow request
  });

  it('should use custom rate limit from decorator', async () => {
    mockReflector.get.mockReturnValue({ limit: 10, windowSeconds: 30 });
    mockCacheService.incrementRateLimit.mockResolvedValue(11);

    await expect(guard.canActivate(createMockContext())).rejects.toThrow(HttpException);
  });

  it('should extract IP from x-forwarded-for header', async () => {
    const ctx = createMockContext();
    const req = ctx.switchToHttp().getRequest();
    req.headers['x-forwarded-for'] = '10.0.0.1, 192.168.1.1';
    mockCacheService.incrementRateLimit.mockResolvedValue(1);

    await guard.canActivate(ctx);

    expect(mockCacheService.incrementRateLimit).toHaveBeenCalledWith(
      expect.stringContaining('10.0.0.1'),
      60,
    );
  });
});
