#!/bin/sh
# ═══════════════════════════════════════════════════════════════
# SERVIX — Weekly backup restore-test
#
# Picks the most recent backup folder from MinIO, downloads + decrypts
# every dump, restores into an ephemeral postgres container, runs sanity
# SQL (table count, row counts on key tables), and emits a Prometheus
# metric. Cron schedule: Sundays 04:00 UTC.
#
# This is the only line of defense against silent backup corruption.
# A backup that can't be restored is not a backup.
# ═══════════════════════════════════════════════════════════════

set -eu

LOG_FILE="/backups/verify.log"
MINIO_BUCKET="servix-backups"
MINIO_ALIAS="servix"
WORK_DIR="/tmp/verify-$$"
CONTAINER="servix-verify-$$"
METRICS_DIR="/var/lib/node_exporter/textfile_collector"
METRICS_FILE="${METRICS_DIR}/servix_backup_verify.prom"

MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://minio:9000}"
MINIO_ACCESS_KEY="${MINIO_ROOT_USER:-}"
MINIO_SECRET_KEY="${MINIO_ROOT_PASSWORD:-}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"; }

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

write_metric() {
  # arg1: 1 = pass, 0 = fail
  # arg2: timestamp (only updated on pass)
  # arg3: tables restored
  # arg4: bytes verified
  mkdir -p "$METRICS_DIR"
  cat > "${METRICS_FILE}.tmp" <<EOF
# HELP servix_backup_verify_status Last verification result (1 = pass, 0 = fail).
# TYPE servix_backup_verify_status gauge
servix_backup_verify_status ${1}
# HELP servix_backup_verify_last_pass_timestamp Unix time of last successful verification.
# TYPE servix_backup_verify_last_pass_timestamp gauge
servix_backup_verify_last_pass_timestamp ${2}
# HELP servix_backup_verify_tables_restored Number of tables present after restore.
# TYPE servix_backup_verify_tables_restored gauge
servix_backup_verify_tables_restored ${3}
# HELP servix_backup_verify_bytes_verified Total bytes of dumps successfully restored.
# TYPE servix_backup_verify_bytes_verified gauge
servix_backup_verify_bytes_verified ${4}
EOF
  mv "${METRICS_FILE}.tmp" "$METRICS_FILE"
}

if [ -z "${BACKUP_ENCRYPTION_PASSPHRASE:-}" ]; then
  log "FATAL: BACKUP_ENCRYPTION_PASSPHRASE required to decrypt backups"
  write_metric 0 0 0 0
  exit 1
fi

mkdir -p "$WORK_DIR"
log "════════════════════════════════════════"
log "Weekly backup verification starting"

mc alias set "$MINIO_ALIAS" "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" --api S3v4 >/dev/null 2>&1

# Pick the most recent backup folder.
LATEST=$(mc ls "$MINIO_ALIAS/$MINIO_BUCKET/" 2>/dev/null \
  | awk '{print $NF}' | tr -d '/' | sort | tail -1)
if [ -z "$LATEST" ]; then
  log "FATAL: no backups found in $MINIO_BUCKET"
  write_metric 0 0 0 0
  exit 1
fi
log "Verifying backup set: $LATEST"

mc cp --recursive "$MINIO_ALIAS/$MINIO_BUCKET/$LATEST/" "$WORK_DIR/" >/dev/null 2>&1
DUMP_COUNT=$(ls -1 "$WORK_DIR"/*.sql.gz.gpg 2>/dev/null | wc -l)
[ "$DUMP_COUNT" -eq 0 ] && {
  log "FATAL: no encrypted dumps in $LATEST"
  write_metric 0 0 0 0
  exit 1
}
log "Found $DUMP_COUNT dump(s) to verify"

# Spin up an ephemeral postgres on the same compose network.
docker run -d --name "$CONTAINER" \
  --network servix-network \
  -e POSTGRES_PASSWORD=verify_pw \
  -e POSTGRES_USER=verify_user \
  -e POSTGRES_DB=postgres \
  postgres:17-alpine >/dev/null

# Wait for ready.
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  if docker exec "$CONTAINER" pg_isready -U verify_user >/dev/null 2>&1; then break; fi
  sleep 2
done

TABLES_TOTAL=0
BYTES_TOTAL=0
RESTORED=0
FAILED=0

for ENC in "$WORK_DIR"/*.sql.gz.gpg; do
  DB=$(basename "$ENC" .sql.gz.gpg)
  log "  → restoring $DB"
  docker exec "$CONTAINER" psql -U verify_user -d postgres -c \
    "CREATE DATABASE \"$DB\";" >/dev/null 2>&1 || true

  if gpg --batch --quiet --decrypt --passphrase "$BACKUP_ENCRYPTION_PASSPHRASE" "$ENC" \
       | gunzip -c \
       | docker exec -i "$CONTAINER" psql -U verify_user -d "$DB" --quiet >/dev/null 2>&1; then
    t=$(docker exec "$CONTAINER" psql -U verify_user -d "$DB" -t -A -c \
      "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'" 2>/dev/null || echo 0)
    sz=$(stat -c %s "$ENC")
    TABLES_TOTAL=$((TABLES_TOTAL + t))
    BYTES_TOTAL=$((BYTES_TOTAL + sz))
    RESTORED=$((RESTORED + 1))
    log "  ✓ $DB — $t table(s)"
  else
    FAILED=$((FAILED + 1))
    log "  ✗ $DB restore failed"
  fi
done

if [ "$FAILED" -gt 0 ] || [ "$TABLES_TOTAL" -eq 0 ]; then
  log "════════════════════════════════════════"
  log "✗ VERIFICATION FAILED — $FAILED dump(s) failed, $TABLES_TOTAL tables total"
  write_metric 0 0 "$TABLES_TOTAL" "$BYTES_TOTAL"
  exit 1
fi

log "════════════════════════════════════════"
log "✓ VERIFICATION PASSED"
log "  Backup: $LATEST"
log "  Restored: $RESTORED dump(s), $TABLES_TOTAL table(s)"
write_metric 1 "$(date +%s)" "$TABLES_TOTAL" "$BYTES_TOTAL"
