# SERVIX Monitoring & Alerting

End-to-end stack: **Prometheus** (metrics + alert rules) → **Alertmanager**
(routing + dedup + paging) → **Slack / PagerDuty / email**, with **Grafana**
for dashboards and **Uptime Kuma** for synthetic checks.

## Components

| Service              | Container                      | Port (loopback)        | Purpose                                  |
| -------------------- | ------------------------------ | ---------------------- | ---------------------------------------- |
| Prometheus           | `servix-prometheus`            | `9090`                 | Scrape, store, evaluate alerts           |
| Alertmanager         | `servix-alertmanager`          | `9093`                 | Group/dedupe/route alerts                |
| Grafana              | `servix-grafana`               | `3100` → 3000          | Dashboards (admin / `$GRAFANA_PASSWORD`) |
| Uptime Kuma          | `servix-uptime-kuma`           | `3200` → 3001          | External synthetic monitoring            |
| Node exporter        | `servix-node-exporter`         | internal `9100`        | Host CPU / mem / disk / net              |
| Postgres exporter    | `servix-postgres-exporter`     | internal `9187`        | DB stats, replication, connections       |
| Redis exporter       | `servix-redis-exporter`        | internal `9121`        | Memory, hit rate, evictions, slowlog     |
| Nginx exporter       | `servix-nginx-exporter`        | internal `9113`        | Active connections, request rate         |

All web UIs are bound to `127.0.0.1` only — reach them via SSH tunnel:

```bash
ssh -L 9090:127.0.0.1:9090 -L 9093:127.0.0.1:9093 \
    -L 3100:127.0.0.1:3100 -L 3200:127.0.0.1:3200 \
    root@194.163.158.70
```

Then open <http://localhost:3100> for Grafana, etc.

## Alert routing

Routing tree lives in `tooling/alertmanager/alertmanager.yml`:

| Severity label | Channel(s)                              | Repeat |
| -------------- | --------------------------------------- | ------ |
| `P1`           | `#servix-incidents` + PagerDuty + email | 1h     |
| `P2`           | `#servix-alerts`                        | 6h     |
| `P3` / `info`  | `#servix-alerts-info` (digest)          | 24h    |

Inhibit rule: a firing P1 silences any P2/P3 with the same
`alertname + cluster + service`.

### Required env vars (in `tooling/docker/.env.prod`)

```bash
ALERT_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
ALERT_PAGERDUTY_ROUTING_KEY=...
ALERT_EMAIL_TO=oncall@servix.io
ALERT_EMAIL_FROM=alerts@servix.io
ALERT_SMTP_HOST=smtp.example.com:587
ALERT_SMTP_USER=...
ALERT_SMTP_PASS=...
```

The `alertmanager-config` init container renders
`alertmanager.yml.tmpl` → `alertmanager.yml` with `envsubst` before the
main alertmanager container starts. To rotate a webhook, update the env
file and `docker compose up -d alertmanager-config alertmanager`.

## Alert rule files

| File                                              | Groups                                                        |
| ------------------------------------------------- | ------------------------------------------------------------- |
| `tooling/prometheus/alerts/slo-alerts.yml`        | SLOs (availability, latency, error rate, error budget)        |
| `tooling/prometheus/alerts/infrastructure-alerts.yml` | Target health, Redis, Nginx, Postgres, host, BullMQ, business |

Reload after editing rules without restarting Prometheus:

```bash
curl -X POST http://localhost:9090/-/reload
```

(`--web.enable-lifecycle` is enabled in the compose command.)

## Dashboards

Provisioned automatically from `tooling/grafana/provisioning/dashboards/`:

- **servix-overview** — top-level production health
- **servix-api-performance** — per-route latency, slow routes, Apdex,
  event-loop lag, heap
- **servix-postgres** — connections, cache hit ratio, replication lag,
  slow queries, deadlocks
- **servix-redis** — memory, hit rate, evictions, queue depths,
  BullMQ job throughput
- **servix-business** — bookings/hour, daily revenue, payment success
  rate, active tenants/subscriptions

To add a dashboard, drop a `.json` file in that directory and Grafana
will pick it up within 30s.

## Verifying alerts end-to-end

```bash
# 1. Send a synthetic alert directly to Alertmanager
curl -XPOST http://localhost:9093/api/v2/alerts -H 'Content-Type: application/json' -d '[
  {"labels":{"alertname":"SyntheticTest","severity":"P2","service":"api"},
   "annotations":{"summary":"end-to-end alert pipeline test"}}]'

# 2. Confirm it appears in Slack within ~30s

# 3. Resolve it
curl -XPOST http://localhost:9093/api/v2/alerts -H 'Content-Type: application/json' -d '[
  {"labels":{"alertname":"SyntheticTest","severity":"P2","service":"api"},
   "endsAt":"'"$(date -u -d '+1 minute' +%Y-%m-%dT%H:%M:%S.000Z)"'"}]'
```

## Uptime Kuma (synthetic)

Configure manually at <http://localhost:3200> on first deploy:

- HTTP monitor → `https://servix.io/api/v1/health/live` (60s)
- HTTP monitor → `https://app.servix.io` (60s)
- Push notifications to the same Slack channels via webhook.
