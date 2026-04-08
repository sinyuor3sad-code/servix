# Runbook: Database Unresponsive

## Severity: 🔴 Critical

## Symptoms
- API returns 500 errors on all database queries
- `servix-postgres` container exits or restarts repeatedly
- PgBouncer reports `server_login_retry` errors
- Dashboard shows "خطأ في الخادم" on all pages

## Diagnosis

### Step 1: Check container status
```bash
docker ps -a --filter name=servix-postgres
docker logs servix-postgres --tail 50
```

### Step 2: Check disk space
```bash
df -h
docker system df
```

### Step 3: Check connection count
```bash
docker exec servix-postgres psql -U servix -c \
  "SELECT count(*), state FROM pg_stat_activity GROUP BY state"
```

### Step 4: Check for locks
```bash
docker exec servix-postgres psql -U servix -c \
  "SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
   FROM pg_stat_activity
   WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes'
   ORDER BY duration DESC LIMIT 10"
```

## Resolution

### A: Container crashed — restart
```bash
docker compose -f tooling/docker/docker-compose.prod.yml restart postgres
sleep 10
# Verify
docker exec servix-postgres pg_isready -U servix
```

### B: Disk full — cleanup
```bash
# Remove old WAL files
docker exec servix-postgres psql -U servix -c "CHECKPOINT"

# Check and vacuum
docker exec servix-postgres vacuumdb -U servix --all --analyze

# Emergency: expand volume or remove old backups
docker exec servix-backup rm /backups/servix_*.sql.gz  # old backups
```

### C: Connection exhaustion — kill idle
```bash
docker exec servix-postgres psql -U servix -c \
  "SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE state = 'idle' AND query_start < now() - interval '30 minutes'"

# Restart PgBouncer
docker compose -f tooling/docker/docker-compose.prod.yml restart pgbouncer
```

### D: Data corruption — restore from backup
```bash
# 1. Stop API
docker compose -f tooling/docker/docker-compose.prod.yml stop api

# 2. Find latest backup
docker exec servix-backup ls -lt /backups/ | head -5

# 3. Restore
docker exec servix-backup /bin/sh /scripts/restore.sh /backups/LATEST_FILE

# 4. Restart
docker compose -f tooling/docker/docker-compose.prod.yml up -d api
```

## Post-Incident
- [ ] Verify all tenants accessible
- [ ] Check data integrity via admin dashboard
- [ ] Review disk space alerts
- [ ] Update backup frequency if needed
