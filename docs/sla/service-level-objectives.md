# SERVIX Service Level Objectives (SLOs)

## Overview

This document defines the Service Level Objectives for the SERVIX platform.
These are internal engineering targets — NOT customer-facing SLAs.

---

## SLO Definitions

| # | SLI (What We Measure) | SLO (Target) | Error Budget (30d) | Owner |
|---|----------------------|-------------|-------------------|-------|
| 1 | **Availability** — % of non-5xx responses | 99.9% | 43 minutes | Platform |
| 2 | **API Latency p95** — 95th percentile response time | < 500ms | — | Backend |
| 3 | **API Latency p99** — 99th percentile response time | < 2000ms | — | Backend |
| 4 | **Error Rate** — % of 5xx responses | < 0.1% | — | Backend |
| 5 | **Payment Success** — % of successful payment transactions | 99.5% | — | Payments |

---

## Measurement

### Availability SLO (99.9%)

```promql
# Current availability (30-day rolling)
1 - (
  sum(rate(http_requests_total{status_code=~"5.."}[30d]))
  / sum(rate(http_requests_total[30d]))
)

# Error budget remaining (0 = exhausted, 1 = full)
1 - (
  (1 - availability_30d) / (1 - 0.999)
)
```

### Latency SLO

```promql
# p95 latency
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))

# p99 latency
histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))
```

---

## Incident Response by Severity

| Severity | Trigger | Channel | Response Time |
|----------|---------|---------|--------------|
| **P1** | Error budget exhausted, availability < 99.9% | SMS immediate | 15 minutes |
| **P2** | Latency p95 > 500ms for 10min, error rate spike | Email within 5min | 1 hour |
| **P3** | Single component degraded, non-critical | Slack/ticket | Next business day |

---

## Error Budget Policy

When error budget is **exhausted** (0% remaining):
1. 🔴 **FREEZE** all non-critical deployments
2. 🔴 Redirect engineering effort to reliability work
3. After 50% budget recovery → resume normal deployments

When error budget is **burning fast** (> 2x normal consumption rate):
1. ⚠️ Investigate root cause immediately (P2)
2. ⚠️ Consider rollback of recent changes
3. Enable extra monitoring/alerting
