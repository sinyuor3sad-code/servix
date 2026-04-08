import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  scenarios: {
    soak: {
      executor: 'constant-vus',
      vus: 50,
      duration: '48h',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    errors: ['rate<0.005'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

const endpoints = [
  '/api/v1/health/live',
  '/api/v1/health/ready',
];

export default function () {
  const ep = endpoints[Math.floor(Math.random() * endpoints.length)];
  const res = http.get(`${BASE_URL}${ep}`);

  check(res, {
    'status 2xx': (r) => r.status >= 200 && r.status < 300,
    'response < 1s': (r) => r.timings.duration < 1000,
  });

  errorRate.add(res.status >= 400);
  sleep(Math.random() * 3 + 2); // 2-5s between requests
}
