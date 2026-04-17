/**
 * PR-triggered smoke load test — sized for CI runner + 2 vCPU VPS reality.
 *
 * Runs against a freshly-booted CI stack (API + Dashboard + Postgres + Redis)
 * whenever a PR is labelled `perf-test`. Catches obvious perf regressions
 * before merge — not a full soak or ramp-up.
 *
 * Design goals:
 *   • Finish in ~2 minutes so PR feedback stays fast
 *   • Cap VUs at 20 — CI runner is single-node, prod is 2 vCPU / 3.8GB
 *   • Fail the build if p95 crosses the budget so the label has teeth
 *
 * Why 20 VU (not 100): CI runner has limited CPU and prod VPS is 2 vCPU.
 * 20 concurrent users is a realistic burst for one salon. When we upgrade
 * the server, bump these — don't remove, tune.
 *
 * Expected env:
 *   BASE_URL       — http://localhost:4000 (CI default)
 *   TEST_EMAIL     — servix@dev.local (seeded by db:seed:e2e)
 *   TEST_PASSWORD  — adsf1324
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration', true);
const listDuration = new Trend('list_duration', true);

export const options = {
  scenarios: {
    pr_smoke: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },  // warm up
        { duration: '1m', target: 20 },    // peak
        { duration: '30s', target: 0 },    // cool down
      ],
    },
  },
  thresholds: {
    // Budgets tuned for CI runner + 2 vCPU VPS. Tighten as hardware improves.
    http_req_duration: ['p(95)<1500'],
    errors: ['rate<0.02'],
    login_duration: ['p(95)<2000'],
    list_duration: ['p(95)<1500'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const TEST_EMAIL = __ENV.TEST_EMAIL || 'servix@dev.local';
const TEST_PASSWORD = __ENV.TEST_PASSWORD || 'adsf1324';

function authenticate() {
  const start = Date.now();
  const res = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ emailOrPhone: TEST_EMAIL, password: TEST_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  loginDuration.add(Date.now() - start);

  const ok = check(res, { 'login ok': (r) => r.status === 200 || r.status === 201 });
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
  const token = authenticate();
  if (!token) {
    sleep(1);
    return;
  }
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  group('Core lists', () => {
    for (const path of ['/api/v1/appointments?limit=20', '/api/v1/clients?limit=20', '/api/v1/services']) {
      const start = Date.now();
      const res = http.get(`${BASE_URL}${path}`, { headers });
      listDuration.add(Date.now() - start);
      check(res, { [`${path} ok`]: (r) => r.status >= 200 && r.status < 300 });
      errorRate.add(res.status >= 500 || res.status === 401);
    }
  });

  sleep(Math.random() + 0.5);
}

export function handleSummary(data) {
  const summary = {
    p95: data.metrics.http_req_duration?.values?.['p(95)'] ?? 0,
    p99: data.metrics.http_req_duration?.values?.['p(99)'] ?? 0,
    errorRate: data.metrics.errors?.values?.rate ?? 0,
    loginP95: data.metrics.login_duration?.values?.['p(95)'] ?? 0,
    listP95: data.metrics.list_duration?.values?.['p(95)'] ?? 0,
    totalRequests: data.metrics.http_reqs?.values?.count ?? 0,
  };
  return {
    stdout: `PR smoke results:\n${JSON.stringify(summary, null, 2)}\n`,
    'results/pr-smoke.json': JSON.stringify(summary, null, 2),
  };
}
