# Runbook: Backup & Restore

## Severity: ⚪ Operational

---

## Automated Backups

SERVIX runs automated backups every 6 hours via the `backup` container using `pg_dump`.

### Check backup status
```bash
docker logs servix-backup --tail 20
docker exec servix-backup ls -lhrt /backups/ | tail -10
```

### Verify backup integrity
```bash
# List latest backup
LATEST=$(docker exec servix-backup ls -t /backups/*.sql.gz | head -1)
echo "Latest: $LATEST"

# Test restore to temp database
docker exec servix-postgres createdb -U servix test_restore
docker exec servix-backup sh -c "gunzip -c $LATEST | psql -U servix -d test_restore"
docker exec servix-postgres dropdb -U servix test_restore
echo "✅ Backup is valid"
```

---

## Manual Backup

### Platform database only
```bash
docker exec servix-postgres pg_dump \
  -U servix \
  -Fc \
  --compress=9 \
  servix_platform > servix_platform_$(date +%Y%m%d_%H%M%S).dump
```

### All databases (platform + all tenants)
```bash
#!/bin/bash
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Platform
docker exec servix-postgres pg_dump -U servix -Fc servix_platform > "$BACKUP_DIR/platform.dump"

# All tenants
for db in $(docker exec servix-postgres psql -U servix -tAc \
  "SELECT datname FROM pg_database WHERE datname LIKE 'servix_tenant_%'"); do
  echo "Backing up $db..."
  docker exec servix-postgres pg_dump -U servix -Fc "$db" > "$BACKUP_DIR/${db}.dump"
done

echo "✅ Backup complete: $BACKUP_DIR"
ls -lh "$BACKUP_DIR"
```

### Pre-migration backup (REQUIRED before any deploy with migrations)
```bash
docker exec servix-postgres pg_dump \
  -U servix \
  -Fc \
  servix_platform > pre_migration_$(date +%Y%m%d_%H%M%S).dump

echo "⚠️ Save this file before running migrations!"
```

---

## Restore Procedures

### Restore platform database
```bash
# 1. Stop API to prevent writes
docker compose -f tooling/docker/docker-compose.prod.yml stop api

# 2. Restore
docker exec -i servix-postgres pg_restore \
  -U servix \
  -d servix_platform \
  --clean --if-exists \
  --no-owner \
  < servix_platform_backup.dump

# 3. Restart API
docker compose -f tooling/docker/docker-compose.prod.yml up -d api
```

### Restore single tenant
```bash
TENANT_DB="servix_tenant_abc123"

docker exec -i servix-postgres pg_restore \
  -U servix \
  -d "$TENANT_DB" \
  --clean --if-exists \
  --no-owner \
  < "${TENANT_DB}_backup.dump"
```

### Point-in-time recovery (if WAL archiving enabled)
```bash
# This requires WAL archiving configured in postgresql.conf
# Not enabled by default in Docker setup

# 1. Stop postgres
docker compose -f tooling/docker/docker-compose.prod.yml stop postgres

# 2. Replace data directory with base backup
# 3. Create recovery.conf with recovery_target_time
# 4. Start postgres — it will replay WAL until target time
```

---

## Offsite Backup

### Copy to external server
```bash
# Compress and send to S3/MinIO
docker exec servix-backup sh -c "ls /backups/*.sql.gz" | while read f; do
  aws s3 cp "$f" s3://servix-backups/$(date +%Y/%m)/$(basename "$f")
done
```

### Copy to local machine
```bash
# Download latest backup
docker cp servix-backup:/backups/ ./local-backups/
```

---

## Checklist

### Daily (automated)
- [x] Backup runs every 6 hours (cron in backup container)
- [x] Backup log checked for errors

### Weekly (manual)
- [ ] Verify at least one backup can be restored
- [ ] Check backup storage usage
- [ ] Ensure offsite copy exists

### Monthly
- [ ] Test full disaster recovery procedure
- [ ] Review backup retention policy
- [ ] Audit backup access permissions
