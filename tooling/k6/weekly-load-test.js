/**
 * Weekly load test — sized for current hardware (2 vCPU / 3.8GB RAM, 1 salon).
 *
 * Ramps 0 → 30 VUs over ~8 minutes and exercises the endpoints the dashboard
 * hits most often. Runs on schedule against BASE_URL; regressions block the
 * next release.
 *
 * Why 30 VU (not 1000): the production VPS is 2 vCPU / 3.8GB RAM hosting ONE
 * salon. 30 concurrent users = heavy day for one salon (staff + clients
 * booking simultaneously). When we upgrade the server and onboard more
 * salons, bump `PEAK_VUS` / budgets accordingly — don't remove, tune.
 *
 * Requires seeded credentials exposed via env:
 *   TEST_EMAIL     — owner email that can log in (e.g. servix@dev.local)
 *   TEST_PASSWORD  — owner password
 *   BASE_URL       — target environment root (e.g. https://staging.servix.com)
 *   PEAK_VUS       — override max VUs (default 30)
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration', true);
const appointmentsDuration = new Trend('appointments_duration', true);
const clientsDuration = new Trend('clients_duration', true);
const requestsTotal = new Counter('requests_total');

const PEAK_VUS = Number(__ENV.PEAK_VUS || 30);

export const options = {
  scenarios: {
    ramp_up: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: Math.round(PEAK_VUS / 3) }, // warm up
        { duration: '2m', target: PEAK_VUS },                  // climb
        { duration: '4m', target: PEAK_VUS },                  // sustain peak
        { duration: '1m', target: 0 },                         // cool down
      ],
    },
  },
  thresholds: {
    // Budgets tuned for 2 vCPU VPS. Tighten these as hardware improves —
    // a stale budget hides real regressions. See comments above `PEAK_VUS`.
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
    // Error budget — under 2% under load (VPS may throttle briefly)
    errors: ['rate<0.02'],
    // Per-endpoint SLOs
    login_duration: ['p(95)<2000'],
    appointments_duration: ['p(95)<1500'],
    clients_duration: ['p(95)<1500'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const TEST_EMAIL = __ENV.TEST_EMAIL || 'servix@dev.local';
const TEST_PASSWORD = __ENV.TEST_PASSWORD || 'adsf1324';

/**
 * Cache a single auth token per VU for the duration of the iteration.
 * We deliberately don't refresh — each iteration logs in once, then hits
 * business endpoints with that token, to mirror a real user session.
 */
function authenticate() {
  const start = Date.now();
  const res = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ emailOrPhone: TEST_EMAIL, password: TEST_PASSWORD }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'auth_login' },
    },
  );
  loginDuration.add(Date.now() - start);
  requestsTotal.add(1);

  const ok = check(res, {
    'login 200/201': (r) => r.status === 200 || r.status === 201,
  });
  errorRate.add(!ok);

  if (!ok) return null;

  try {
    const body = res.json();
    return body?.data?.accessToken ?? body?.accessToken ?? null;
  } catch (_) {
    return null;
  }
}

export default function () {
  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/api/v1/health/live`, {
      tags: { endpoint: 'health_live' },
    });
    check(res, { 'health 200': (r) => r.status === 200 });
    errorRate.add(res.status !== 200);
    requestsTotal.add(1);
  });

  const token = authenticate();
  if (!token) {
    sleep(1);
    return;
  }

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  group('Appointments', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/v1/appointments?page=1&limit=20`, {
      ...authHeaders,
      tags: { endpoint: 'appointments_list' },
    });
    appointmentsDuration.add(Date.now() - start);
    check(res, { 'appointments 2xx': (r) => r.status >= 200 && r.status < 300 });
    errorRate.add(res.status >= 500 || res.status === 401);
    requestsTotal.add(1);
  });

  group('Clients', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/v1/clients?page=1&limit=20`, {
      ...authHeaders,
      tags: { endpoint: 'clients_list' },
    });
    clientsDuration.add(Date.now() - start);
    check(res, { 'clients 2xx': (r) => r.status >= 200 && r.status < 300 });
    errorRate.add(res.status >= 500 || res.status === 401);
    requestsTotal.add(1);
  });

  group('Reports', () => {
    const res = http.get(`${BASE_URL}/api/v1/reports/dashboard`, {
      ...authHeaders,
      tags: { endpoint: 'reports_dashboard' },
    });
    check(res, { 'reports 2xx': (r) => r.status >= 200 && r.status < 300 });
    errorRate.add(res.status >= 500 || res.status === 401);
    requestsTotal.add(1);
  });

  // Think time — humans don't hammer endpoints back-to-back.
  sleep(Math.random() * 2 + 1);
}

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    metrics: {
      p50: data.metrics.http_req_duration?.values?.['p(50)'] ?? 0,
      p95: data.metrics.http_req_duration?.values?.['p(95)'] ?? 0,
      p99: data.metrics.http_req_duration?.values?.['p(99)'] ?? 0,
      errorRate: data.metrics.errors?.values?.rate ?? 0,
      totalRequests: data.metrics.requests_total?.values?.count ?? 0,
      maxVUs: data.metrics.vus?.values?.max ?? 0,
      loginP95: data.metrics.login_duration?.values?.['p(95)'] ?? 0,
      appointmentsP95: data.metrics.appointments_duration?.values?.['p(95)'] ?? 0,
      clientsP95: data.metrics.clients_duration?.values?.['p(95)'] ?? 0,
    },
    thresholdsPassed: Object.values(data.metrics)
      .every((m) => !m.thresholds || Object.values(m.thresholds).every((t) => t.ok !== false)),
  };

  return {
    stdout: JSON.stringify(summary, null, 2),
    'results/weekly-results.json': JSON.stringify(summary, null, 2),
  };
}
