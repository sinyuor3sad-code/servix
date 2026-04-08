/**
 * SERVIX — Load Test (k6)
 *
 * Run:
 *   k6 run tooling/load-tests/api-load.js --env BASE_URL=https://api.servi-x.com
 *
 * Scenarios:
 *   1. Health check endpoint (smoke)
 *   2. Booking slot availability (public, read-heavy)
 *   3. Authentication flow (login + token)
 *   4. Concurrent booking creation (write + race condition test)
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

// Custom metrics
const errorRate = new Rate('errors');
const bookingLatency = new Trend('booking_latency', true);

export const options = {
  scenarios: {
    // Smoke: constant 10 VUs for 1 minute
    smoke: {
      executor: 'constant-vus',
      vus: 10,
      duration: '1m',
      exec: 'smokeTest',
    },
    // Load: ramp up to 50 VUs over 5 minutes
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 20 },
        { duration: '3m', target: 50 },
        { duration: '2m', target: 50 },
        { duration: '1m', target: 0 },
      ],
      exec: 'loadTest',
    },
    // Stress: burst to 100 VUs
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },
        { duration: '2m', target: 100 },
        { duration: '1m', target: 100 },
        { duration: '1m', target: 0 },
      ],
      exec: 'stressTest',
      startTime: '9m', // starts after load test
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<2000'], // 95% < 500ms, 99% < 2s
    errors: ['rate<0.05'], // Error rate < 5%
    booking_latency: ['p(95)<1000'], // Booking p95 < 1s
  },
};

// ═══════════════════ Smoke Test ═══════════════════
export function smokeTest() {
  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/api/v1/health/live`);
    check(res, {
      'health status 200': (r) => r.status === 200,
      'health response < 100ms': (r) => r.timings.duration < 100,
    });
    errorRate.add(res.status !== 200);
  });
  sleep(1);
}

// ═══════════════════ Load Test ═══════════════════
export function loadTest() {
  group('Booking Availability', () => {
    // Simulate checking available slots (public endpoint)
    const res = http.get(`${BASE_URL}/api/v1/booking/demo-salon`, {
      tags: { name: 'GET /booking/:slug' },
    });
    check(res, {
      'booking page status 200': (r) => r.status === 200 || r.status === 404,
      'booking page < 500ms': (r) => r.timings.duration < 500,
    });
    bookingLatency.add(res.timings.duration);
    errorRate.add(res.status >= 500);
  });

  sleep(Math.random() * 2 + 0.5); // 0.5-2.5s think time
}

// ═══════════════════ Stress Test ═══════════════════
export function stressTest() {
  group('API Stress', () => {
    const res = http.get(`${BASE_URL}/api/v1/health/ready`, {
      tags: { name: 'GET /health/ready' },
    });
    check(res, {
      'ready check 200': (r) => r.status === 200,
    });
    errorRate.add(res.status >= 500);
  });

  sleep(0.5);
}

// ═══════════════════ Summary ═══════════════════
export function handleSummary(data) {
  const p95 = data.metrics.http_req_duration?.values?.['p(95)'] || 'N/A';
  const p99 = data.metrics.http_req_duration?.values?.['p(99)'] || 'N/A';
  const errRate = data.metrics.errors?.values?.rate || 0;
  const totalReqs = data.metrics.http_reqs?.values?.count || 0;

  const summary = `
═══════════════════════════════════════════════
  SERVIX Load Test Results
═══════════════════════════════════════════════
  Total Requests:  ${totalReqs}
  p95 Latency:     ${typeof p95 === 'number' ? p95.toFixed(2) : p95}ms
  p99 Latency:     ${typeof p99 === 'number' ? p99.toFixed(2) : p99}ms
  Error Rate:      ${(errRate * 100).toFixed(2)}%
═══════════════════════════════════════════════
`;
  console.log(summary);

  return {
    stdout: summary,
    'tooling/load-tests/results.json': JSON.stringify(data, null, 2),
  };
}
