import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import CircuitBreaker from 'opossum';
import { MetricsService } from '../metrics/metrics.service';

export interface BreakerOptions {
  /** Timeout in ms before a request is considered failed (default: 10000) */
  timeout?: number;
  /** Error percentage threshold to open the circuit (default: 50) */
  errorThresholdPercentage?: number;
  /** Time in ms to wait before attempting a half-open request (default: 30000) */
  resetTimeout?: number;
  /** Minimum number of requests before threshold is evaluated (default: 5) */
  volumeThreshold?: number;
  /** Fallback function to execute when circuit is open */
  fallback?: (...args: unknown[]) => unknown;
}

interface BreakerState {
  name: string;
  state: 'closed' | 'open' | 'halfOpen';
  stats: {
    successes: number;
    failures: number;
    timeouts: number;
    fallbacks: number;
  };
}

@Injectable()
export class CircuitBreakerService implements OnModuleInit {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly breakers = new Map<string, CircuitBreaker>();

  constructor(private readonly metrics: MetricsService) {}

  onModuleInit() {
    this.logger.log('Circuit breaker service initialized');
  }

  /**
   * Create a named circuit breaker wrapping an async function.
   * State changes are logged and emitted as Prometheus metrics.
   */
  createBreaker<TArgs extends unknown[], TResult>(
    name: string,
    fn: (...args: TArgs) => Promise<TResult>,
    options: BreakerOptions = {},
  ): CircuitBreaker<TArgs, TResult> {
    if (this.breakers.has(name)) {
      return this.breakers.get(name) as CircuitBreaker<TArgs, TResult>;
    }

    const breaker = new CircuitBreaker(fn, {
      timeout: options.timeout ?? 10000,
      errorThresholdPercentage: options.errorThresholdPercentage ?? 50,
      resetTimeout: options.resetTimeout ?? 30000,
      volumeThreshold: options.volumeThreshold ?? 5,
      name,
    });

    // ── State change logging + metrics ──
    breaker.on('open', () => {
      this.logger.warn(`🔴 Circuit OPEN: ${name} — requests will be rejected`);
      this.metrics.circuitState.set({ service: name }, 0);
    });

    breaker.on('halfOpen', () => {
      this.logger.log(`🟡 Circuit HALF-OPEN: ${name} — testing with one request`);
      this.metrics.circuitState.set({ service: name }, 0.5);
    });

    breaker.on('close', () => {
      this.logger.log(`🟢 Circuit CLOSED: ${name} — back to normal`);
      this.metrics.circuitState.set({ service: name }, 1);
    });

    breaker.on('fallback', () => {
      this.metrics.circuitFallbacks.inc({ service: name });
    });

    breaker.on('timeout', () => {
      this.logger.warn(`⏱ Circuit TIMEOUT: ${name}`);
    });

    // Register fallback if provided
    if (options.fallback) {
      breaker.fallback(options.fallback);
    }

    this.breakers.set(name, breaker);
    this.logger.log(`Circuit breaker created: ${name} (timeout=${options.timeout ?? 10000}ms, threshold=${options.errorThresholdPercentage ?? 50}%)`);

    return breaker;
  }

  /**
   * Get the current state of all circuit breakers.
   * Useful for admin status endpoint.
   */
  getAllStates(): BreakerState[] {
    const states: BreakerState[] = [];
    for (const [name, breaker] of this.breakers) {
      const stats = breaker.stats;
      states.push({
        name,
        state: breaker.opened ? 'open' : breaker.halfOpen ? 'halfOpen' : 'closed',
        stats: {
          successes: stats.successes,
          failures: stats.failures,
          timeouts: stats.timeouts,
          fallbacks: stats.fallbacks,
        },
      });
    }
    return states;
  }

  /**
   * Get a specific breaker by name.
   */
  getBreaker(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }
}
