import { Injectable, OnModuleInit } from '@nestjs/common';
import * as client from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  // ── HTTP Metrics ──
  readonly httpRequestsTotal: client.Counter;
  readonly httpRequestDuration: client.Histogram;

  // ── Cache Metrics ──
  readonly cacheHitsTotal: client.Counter;
  readonly cacheMissesTotal: client.Counter;
  readonly cachedTenantsTotal: client.Gauge;

  // ── BullMQ Metrics ──
  readonly bullmqWaitingTotal: client.Gauge;
  readonly bullmqActiveTotal: client.Gauge;
  readonly bullmqFailedTotal: client.Gauge;

  // ── DB Metrics ──
  readonly dbQueryDuration: client.Histogram;

  // ── Circuit Breaker Metrics ──
  readonly circuitState: client.Gauge;
  readonly circuitFallbacks: client.Counter;

  // ── Business Metrics (6.5) ──
  readonly dailyRevenue: client.Gauge;
  readonly bookingsPerHour: client.Gauge;
  readonly activeSubscriptions: client.Gauge;
  readonly activeTenants: client.Gauge;
  readonly paymentSuccessRate: client.Gauge;

  constructor() {
    // Collect default Node.js metrics (memory, CPU, event loop)
    client.collectDefaultMetrics({ prefix: '' });

    this.httpRequestsTotal = new client.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
    });

    this.httpRequestDuration = new client.Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    });

    this.cacheHitsTotal = new client.Counter({
      name: 'servix_cache_hits_total',
      help: 'Total cache hits',
    });

    this.cacheMissesTotal = new client.Counter({
      name: 'servix_cache_misses_total',
      help: 'Total cache misses',
    });

    this.cachedTenantsTotal = new client.Gauge({
      name: 'servix_cached_tenants_total',
      help: 'Number of tenants currently in cache',
    });

    this.bullmqWaitingTotal = new client.Gauge({
      name: 'servix_bullmq_waiting_total',
      help: 'BullMQ jobs waiting in queue',
    });

    this.bullmqActiveTotal = new client.Gauge({
      name: 'servix_bullmq_active_total',
      help: 'BullMQ jobs currently being processed',
    });

    this.bullmqFailedTotal = new client.Gauge({
      name: 'servix_bullmq_failed_total',
      help: 'BullMQ jobs in DLQ',
    });

    this.dbQueryDuration = new client.Histogram({
      name: 'servix_db_query_duration_seconds',
      help: 'Database query duration in seconds',
      labelNames: ['operation'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
    });

    // ── Circuit Breaker Metrics ──
    this.circuitState = new client.Gauge({
      name: 'servix_circuit_state',
      help: 'Circuit breaker state (1=closed, 0.5=halfOpen, 0=open)',
      labelNames: ['service'],
    });

    this.circuitFallbacks = new client.Counter({
      name: 'servix_circuit_fallbacks_total',
      help: 'Circuit breaker fallback invocations',
      labelNames: ['service'],
    });

    // ── Business Metrics (6.5) ──
    this.dailyRevenue = new client.Gauge({
      name: 'servix_daily_revenue_sar',
      help: 'Daily revenue in SAR',
    });

    this.bookingsPerHour = new client.Gauge({
      name: 'servix_bookings_per_hour',
      help: 'Appointments created per hour',
    });

    this.activeSubscriptions = new client.Gauge({
      name: 'servix_active_subscriptions',
      help: 'Currently active paid subscriptions',
      labelNames: ['plan'],
    });

    this.activeTenants = new client.Gauge({
      name: 'servix_active_tenants_total',
      help: 'Total active tenants on the platform',
    });

    this.paymentSuccessRate = new client.Gauge({
      name: 'servix_payment_success_rate',
      help: 'Payment success rate (0-1)',
    });
  }

  onModuleInit() {
    // Metrics are initialized in constructor; nothing else needed
  }

  /**
   * Get all metrics in Prometheus exposition format.
   */
  async getMetrics(): Promise<string> {
    return client.register.metrics();
  }

  /**
   * Get content type for /metrics response.
   */
  getContentType(): string {
    return client.register.contentType;
  }
}
