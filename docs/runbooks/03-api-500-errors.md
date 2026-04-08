# Runbook: API 500 Errors

## Severity: 🔴 Critical

## Symptoms
- Users see "خطأ في الخادم" errors
- Monitoring shows spike in 5xx responses
- Sentry/logs show unhandled exceptions

## Diagnosis

### Step 1: Check error rate scope
```bash
# Check API logs for errors
docker logs servix-api --tail 200 2>&1 | grep -i "error\|exception\|fatal"

# Check if it's a specific endpoint or all endpoints
curl -s -o /dev/null -w "%{http_code}" https://api.servi-x.com/api/v1/health/live
curl -s -o /dev/null -w "%{http_code}" https://api.servi-x.com/api/v1/health/ready
```

### Step 2: Check container health
```bash
docker inspect servix-api --format='{{.State.Health.Status}}'
docker stats servix-api --no-stream
```

### Step 3: Check dependencies
```bash
# Database
docker exec servix-postgres pg_isready -U servix

# Redis
docker exec servix-redis redis-cli -a ${REDIS_PASSWORD} ping

# PgBouncer
docker exec servix-pgbouncer pgbouncer -d /etc/pgbouncer/pgbouncer.ini 2>/dev/null && echo "OK"
```

### Step 4: Check for OOM or resource exhaustion
```bash
docker inspect servix-api --format='{{.State.OOMKilled}}'
docker stats --no-stream --format "{{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}"
```

## Resolution

### A: Transient error — restart API
```bash
docker compose -f tooling/docker/docker-compose.prod.yml restart api
sleep 15
curl -s https://api.servi-x.com/api/v1/health/live
```

### B: Database-related — fix upstream
See [01-db-unresponsive.md](./01-db-unresponsive.md)

### C: Redis-related — fix upstream
See [02-redis-down.md](./02-redis-down.md)

### D: Code bug — rollback
```bash
# 1. Identify last working commit
git log --oneline -10

# 2. Rollback
git checkout <LAST_WORKING_COMMIT>

# 3. Rebuild and deploy
docker compose -f tooling/docker/docker-compose.prod.yml build api
docker compose -f tooling/docker/docker-compose.prod.yml up -d api
```

### E: Memory leak — emergency restart with increased limits
```bash
# Check memory trend
docker stats servix-api --no-stream

# Restart with max memory
docker update --memory=2g --memory-swap=4g servix-api
docker restart servix-api
```

## Common Error Patterns

| Error Message | Likely Cause | Fix |
|---|---|---|
| `ECONNREFUSED 5432` | DB down | Restart postgres |
| `ECONNREFUSED 6379` | Redis down | Restart redis |
| `PrismaClientKnownRequestError` | Schema mismatch | Run migrations |
| `JsonWebTokenError` | JWT secret changed | Check .env secrets |
| `ENOMEM` | Out of memory | Increase container limits |
| `P2025 Record not found` | Business logic | Check tenant data |

## Post-Incident
- [ ] Review error logs for root cause
- [ ] File bug report if code issue
- [ ] Update monitoring alerts
- [ ] Add regression test if applicable
