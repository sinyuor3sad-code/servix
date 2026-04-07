// ═══════════════════════════════════════════════════════════
// SERVIX — Baseline Load Test (k6)
//
// Purpose: Establish performance baseline before any fixes.
// Target: Local dev or staging environment.
//
// Usage:
//   k6 run tooling/load-tests/baseline.js
//   k6 run --vus 50 --duration 2m tooling/load-tests/baseline.js
//
// Environment variables:
//   BASE_URL     — API base URL (default: http://localhost:4000)
//   TENANT_SLUG  — Tenant slug for testing (default: test-salon)
//   TEST_EMAIL   — Login email (default: owner@test.com)
//   TEST_PASSWORD — Login password (default: Test123456)
// ═══════════════════════════════════════════════════════════

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ─── Custom Metrics ───
const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration', true);
const appointmentsDuration = new Trend('appointments_duration', true);
const clientsDuration = new Trend('clients_duration', true);
const createAppointmentDuration = new Trend('create_appointment_duration', true);

// ─── Configuration ───
const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const TENANT_SLUG = __ENV.TENANT_SLUG || 'test-salon';
const TEST_EMAIL = __ENV.TEST_EMAIL || 'owner@test.com';
const TEST_PASSWORD = __ENV.TEST_PASSWORD || 'Test123456';

// ─── Test Options ───
export const options = {
  scenarios: {
    // Ramp up to 100 VUs over 5 minutes
    baseline: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },   // Warm-up
        { duration: '1m', target: 50 },    // Ramp to 50
        { duration: '2m', target: 100 },   // Hold at 100
        { duration: '1m', target: 50 },    // Scale down
        { duration: '30s', target: 0 },    // Cool down
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    // Performance thresholds
    http_req_duration: ['p(95)<3000', 'p(99)<5000'], // p95 < 3s, p99 < 5s
    http_req_failed: ['rate<0.05'],                   // Error rate < 5%
    errors: ['rate<0.1'],                              // Custom error rate < 10%
  },
};

// ─── Helpers ───
function getHeaders(token, tenantId) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (tenantId) {
    headers['x-tenant-id'] = tenantId;
  }
  return headers;
}

function checkResponse(res, name) {
  const success = check(res, {
    [`${name}: status is 2xx`]: (r) => r.status >= 200 && r.status < 300,
    [`${name}: response time < 3s`]: (r) => r.timings.duration < 3000,
  });
  errorRate.add(!success);
  return success;
}

// ─── Main Test Function ───
export default function () {
  let accessToken = null;
  let tenantId = null;

  // ═══ Scenario A: Health Check (no auth required) ═══
  group('Health Check', function () {
    const res = http.get(`${BASE_URL}/api/v1/health`, {
      headers: getHeaders(),
      tags: { name: 'health_check' },
    });
    checkResponse(res, 'Health');
  });

  sleep(0.5);

  // ═══ Scenario B: Login ═══
  group('Authentication', function () {
    const loginPayload = JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    const start = Date.now();
    const res = http.post(`${BASE_URL}/api/v1/auth/login`, loginPayload, {
      headers: getHeaders(),
      tags: { name: 'login' },
    });
    loginDuration.add(Date.now() - start);

    const success = checkResponse(res, 'Login');

    if (success && res.status === 200 || res.status === 201) {
      try {
        const body = JSON.parse(res.body);
        // Handle different response structures
        const data = body.data || body;
        accessToken = data.accessToken || data.access_token;
        tenantId = data.tenantId || data.tenant_id || data.defaultTenantId;

        check(res, {
          'Login: has access token': () => !!accessToken,
          'Login: has tenant ID': () => !!tenantId,
        });
      } catch (e) {
        console.error(`Login parse error: ${e.message}`);
        errorRate.add(true);
      }
    }
  });

  // If login failed, skip authenticated requests
  if (!accessToken || !tenantId) {
    sleep(1);
    return;
  }

  sleep(0.3);

  // ═══ Scenario C: Get Today's Appointments ═══
  group('Appointments - Today', function () {
    const today = new Date().toISOString().split('T')[0];
    const start = Date.now();
    const res = http.get(
      `${BASE_URL}/api/v1/appointments?date=${today}&page=1&limit=20`,
      {
        headers: getHeaders(accessToken, tenantId),
        tags: { name: 'appointments_today' },
      }
    );
    appointmentsDuration.add(Date.now() - start);
    checkResponse(res, 'Appointments Today');
  });

  sleep(0.3);

  // ═══ Scenario D: Get Clients (paginated) ═══
  group('Clients - List', function () {
    const start = Date.now();
    const res = http.get(
      `${BASE_URL}/api/v1/clients?page=1&limit=20`,
      {
        headers: getHeaders(accessToken, tenantId),
        tags: { name: 'clients_list' },
      }
    );
    clientsDuration.add(Date.now() - start);
    checkResponse(res, 'Clients List');
  });

  sleep(0.3);

  // ═══ Scenario E: Create Appointment (write operation) ═══
  group('Appointments - Create', function () {
    // Only 10% of VUs attempt to create (to avoid overwhelming)
    if (Math.random() > 0.1) {
      return;
    }

    // Generate random future time to avoid conflicts
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1 + Math.floor(Math.random() * 7));
    const date = tomorrow.toISOString().split('T')[0];
    const hour = 9 + Math.floor(Math.random() * 10); // 9:00 - 18:00
    const startTime = `${hour.toString().padStart(2, '0')}:00`;
    const endTime = `${(hour + 1).toString().padStart(2, '0')}:00`;

    const payload = JSON.stringify({
      clientId: null, // Will fail gracefully — that's OK for load testing
      employeeId: null,
      date: date,
      startTime: startTime,
      endTime: endTime,
      services: [],
      notes: `k6 load test - ${Date.now()}`,
    });

    const start = Date.now();
    const res = http.post(
      `${BASE_URL}/api/v1/appointments`,
      payload,
      {
        headers: getHeaders(accessToken, tenantId),
        tags: { name: 'create_appointment' },
      }
    );
    createAppointmentDuration.add(Date.now() - start);

    // For creates, we accept 400 (validation error) as "handled correctly"
    check(res, {
      'Create Appointment: not 500': (r) => r.status !== 500,
      'Create Appointment: response time < 3s': (r) => r.timings.duration < 3000,
    });
  });

  sleep(0.5);

  // ═══ Additional Reads (common patterns) ═══
  group('Additional Reads', function () {
    // Get services (common read)
    const servicesRes = http.get(
      `${BASE_URL}/api/v1/services`,
      {
        headers: getHeaders(accessToken, tenantId),
        tags: { name: 'services_list' },
      }
    );
    checkResponse(servicesRes, 'Services');

    sleep(0.2);

    // Get employees (common read)
    const employeesRes = http.get(
      `${BASE_URL}/api/v1/employees`,
      {
        headers: getHeaders(accessToken, tenantId),
        tags: { name: 'employees_list' },
      }
    );
    checkResponse(employeesRes, 'Employees');

    sleep(0.2);

    // Get notifications (frequent poll)
    const notifsRes = http.get(
      `${BASE_URL}/api/v1/notifications?isRead=false&limit=10`,
      {
        headers: getHeaders(accessToken, tenantId),
        tags: { name: 'notifications_unread' },
      }
    );
    checkResponse(notifsRes, 'Notifications');
  });

  sleep(1);
}

// ─── Summary handler ───
export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    totalRequests: data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0,
    rps: data.metrics.http_reqs ? data.metrics.http_reqs.values.rate : 0,
    p50: data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(50)'] : 0,
    p95: data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(95)'] : 0,
    p99: data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(99)'] : 0,
    errorRate: data.metrics.http_req_failed ? data.metrics.http_req_failed.values.rate : 0,
    maxVUs: data.metrics.vus_max ? data.metrics.vus_max.values.value : 0,
  };

  console.log('\n═══ SERVIX Load Test Summary ═══');
  console.log(`Total Requests: ${summary.totalRequests}`);
  console.log(`RPS: ${summary.rps.toFixed(2)}`);
  console.log(`p50 Latency: ${summary.p50.toFixed(2)}ms`);
  console.log(`p95 Latency: ${summary.p95.toFixed(2)}ms`);
  console.log(`p99 Latency: ${summary.p99.toFixed(2)}ms`);
  console.log(`Error Rate: ${(summary.errorRate * 100).toFixed(2)}%`);
  console.log(`Max VUs: ${summary.maxVUs}`);
  console.log('════════════════════════════════\n');

  return {
    'docs/audit/k6-results.json': JSON.stringify(summary, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

// k6 built-in text summary (if available)
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
