/**
 * We mock opossum to avoid CJS/ESM import issues in Jest.
 * The mock implements the minimum CircuitBreaker API needed by our service.
 */

import { MetricsService } from '../metrics/metrics.service';

// Mock opossum CircuitBreaker
class MockCircuitBreaker {
  private listeners = new Map<string, ((...args: unknown[]) => void)[]>();
  private _opened = false;
  private _halfOpen = false;
  private _name: string;
  private _fn: (...args: unknown[]) => Promise<unknown>;
  private _stats = { successes: 0, failures: 0, timeouts: 0, fallbacks: 0 };

  constructor(fn: (...args: unknown[]) => Promise<unknown>, options: Record<string, unknown>) {
    this._fn = fn;
    this._name = (options.name as string) || 'unknown';
  }

  get name() { return this._name; }
  get opened() { return this._opened; }
  get halfOpen() { return this._halfOpen; }
  get stats() { return this._stats; }

  on(event: string, cb: (...args: unknown[]) => void) {
    const existing = this.listeners.get(event) || [];
    existing.push(cb);
    this.listeners.set(event, existing);
    return this;
  }

  async fire(...args: unknown[]) {
    try {
      const result = await this._fn(...args);
      this._stats.successes++;
      return result;
    } catch (err) {
      this._stats.failures++;
      throw err;
    }
  }

  fallback(_fn: (...args: unknown[]) => unknown) { return this; }
}

jest.mock('opossum', () => ({
  __esModule: true,
  default: MockCircuitBreaker,
}));

import { CircuitBreakerService } from './circuit-breaker.service';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;

  const mockMetrics = {
    circuitState: { set: jest.fn() },
    circuitFallbacks: { inc: jest.fn() },
  } as unknown as MetricsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CircuitBreakerService(mockMetrics);
    service.onModuleInit();
  });

  describe('createBreaker', () => {
    it('should create a named circuit breaker', () => {
      const fn = jest.fn().mockResolvedValue('ok');
      const breaker = service.createBreaker('test-svc', fn, {
        timeout: 5000,
        volumeThreshold: 1,
      });

      expect(breaker).toBeDefined();
    });

    it('should return existing breaker for same name', () => {
      const fn = jest.fn().mockResolvedValue('ok');
      const breaker1 = service.createBreaker('dup-svc', fn);
      const breaker2 = service.createBreaker('dup-svc', fn);

      expect(breaker1).toBe(breaker2);
    });

    it('should fire the wrapped function on call', async () => {
      const fn = jest.fn().mockResolvedValue('result');
      const breaker = service.createBreaker('fire-svc', fn, {
        volumeThreshold: 1,
        timeout: 5000,
      });

      const result = await breaker.fire();
      expect(result).toBe('result');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should track failures in stats', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('boom'));
      const breaker = service.createBreaker('fail-svc', fn);

      try { await breaker.fire(); } catch { /* expected */ }

      const states = service.getAllStates();
      const state = states.find(s => s.name === 'fail-svc');
      expect(state?.stats.failures).toBe(1);
    });
  });

  describe('getAllStates', () => {
    it('should return empty array when no breakers exist', () => {
      const freshService = new CircuitBreakerService(mockMetrics);
      freshService.onModuleInit();
      const states = freshService.getAllStates();
      expect(states).toEqual([]);
    });

    it('should return state for all created breakers', () => {
      service.createBreaker('svc-a', async () => 'a');
      service.createBreaker('svc-b', async () => 'b');

      const states = service.getAllStates();
      expect(states).toHaveLength(2);
      expect(states.map(s => s.name).sort()).toEqual(['svc-a', 'svc-b']);
      expect(states[0].state).toBe('closed');
    });
  });

  describe('getBreaker', () => {
    it('should return undefined for unknown breaker', () => {
      expect(service.getBreaker('unknown')).toBeUndefined();
    });

    it('should return breaker by name', () => {
      service.createBreaker('known-svc', async () => 'x');
      expect(service.getBreaker('known-svc')).toBeDefined();
    });
  });
});
