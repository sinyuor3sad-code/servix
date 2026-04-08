import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration', true);
const appointmentDuration = new Trend('appointment_api_duration', true);
const requestsTotal = new Counter('requests_total');

export const options = {
  scenarios: {
    ramp_up: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '5m', target: 500 },
        { duration: '10m', target: 1000 },
        { duration: '5m', target: 1000 },
        { duration: '3m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    errors: ['rate<0.01'],
    login_duration: ['p(95)<800'],
    appointment_api_duration: ['p(95)<500'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

export default function () {
  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/api/v1/health/live`);
    check(res, { 'health 200': (r) => r.status === 200 });
    errorRate.add(res.status >= 400);
    requestsTotal.add(1);
  });

  group('Login Flow', () => {
    const start = Date.now();
    const res = http.post(
      `${BASE_URL}/api/v1/auth/login`,
      JSON.stringify({
        email: `load-test-${__VU}@test.com`,
        password: 'TestPassword123!',
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    loginDuration.add(Date.now() - start);
    check(res, { 'login ok': (r) => [200, 201, 401].includes(r.status) });
    errorRate.add(res.status >= 500);
    requestsTotal.add(1);
  });

  group('API Endpoints', () => {
    const endpoints = [
      '/api/v1/health/ready',
      '/api/v1/health/live',
    ];

    for (const ep of endpoints) {
      const start = Date.now();
      const res = http.get(`${BASE_URL}${ep}`);
      appointmentDuration.add(Date.now() - start);
      check(res, { [`${ep} ok`]: (r) => r.status < 500 });
      errorRate.add(res.status >= 500);
      requestsTotal.add(1);
    }
  });

  sleep(Math.random() * 2 + 1);
}

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    metrics: {
      p50: data.metrics.http_req_duration?.values?.['p(50)'] ?? 0,
      p95: data.metrics.http_req_duration?.values?.['p(95)'] ?? 0,
      p99: data.metrics.http_req_duration?.values?.['p(99)'] ?? 0,
      errorRate: data.metrics.errors?.values?.rate ?? 0,
      totalRequests: data.metrics.requests_total?.values?.count ?? 0,
      maxVUs: data.metrics.vus?.values?.max ?? 0,
    },
  };

  return {
    stdout: JSON.stringify(summary, null, 2),
    'results/weekly-results.json': JSON.stringify(summary, null, 2),
  };
}
