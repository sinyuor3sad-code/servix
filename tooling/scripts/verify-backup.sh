#!/bin/sh
# ═══════════════════════════════════════════════════════════════
# SERVIX — Weekly backup restore-test
#
# Picks the most recent backup folder from MinIO, downloads + decrypts
# every dump, restores into an ephemeral postgres container, runs sanity
# SQL (table count), and emits a Prometheus metric. Cron: Sundays 04:00.
#
# A8-IV-040 (V2): the original implementation used `docker exec -i <verify>
# psql` to stream the decompressed dump into the verify DB. That stops
# working as soon as ANY socket-proxy sits between the calling container
# and the docker daemon — tecnativa/docker-socket-proxy (V-11) rejects
# the HTTP Upgrade that every `docker exec` (including non-interactive)
# requires.
#
# V2 sidesteps the issue by talking to the verify postgres OVER THE WIRE.
# The verify container is on docker_servix-network, so the backup
# container can reach it by name (e.g. `servix-verify-<ts>:5432`). All
# DDL/restore traffic is plain TCP/SCRAM psql — no docker exec at all.
#
# A8-IV-039: spawn-network read from $DOCKER_NETWORK env, default
# `docker_servix-network` (was hard-coded wrong-value `servix-network`).
# ═══════════════════════════════════════════════════════════════

set -eu

LOG_FILE="/backups/verify.log"
MINIO_BUCKET="servix-backups"
MINIO_ALIAS="servix"
TS_RUN=$(date +%Y%m%d_%H%M%S)
STAGING="/backups/verify-staging/${TS_RUN}"
WORK_DIR="/tmp/verify-$$"
CONTAINER="servix-verify-${TS_RUN}-$$"
METRICS_DIR="/var/lib/node_exporter/textfile_collector"
METRICS_FILE="${METRICS_DIR}/servix_backup_verify.prom"

MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://minio:9000}"
MINIO_ACCESS_KEY="${MINIO_ROOT_USER:-}"
MINIO_SECRET_KEY="${MINIO_ROOT_PASSWORD:-}"

DOCKER_NETWORK="${DOCKER_NETWORK:-docker_servix-network}"
BACKUP_VOLUME="${BACKUP_VOLUME:-docker_backup_data}"

# Ephemeral postgres super-password — random per run, dies with the
# container in cleanup. Never written to disk, never logged.
VERIFY_PW=$(openssl rand -base64 24 2>/dev/null || dd if=/dev/urandom bs=1 count=18 2>/dev/null | base64)

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"; }

# A8-IV-040: PII-safe cleanup — fires on success, error, signal.
# The staging dir may hold decrypted tenant data (PDPL-relevant).
cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$WORK_DIR" "$STAGING" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

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

# A8-IV-040: clean leftover staging dirs from any crashed prior run.
rm -rf /backups/verify-staging
mkdir -p "$STAGING" "$WORK_DIR"

log "════════════════════════════════════════"
log "Weekly backup verification starting (staging=$STAGING, network=$DOCKER_NETWORK)"

mc alias set "$MINIO_ALIAS" "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" --api S3v4 >/dev/null 2>&1

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

# Decrypt + decompress every dump into the staging dir BEFORE the verify
# container exists. We still keep the .sql files on disk because the
# verify container reads them via the bind-mount — but they're rm'd by
# the trap on script exit.
for ENC in "$WORK_DIR"/*.sql.gz.gpg; do
  DB=$(basename "$ENC" .sql.gz.gpg)
  if ! gpg --batch --quiet --decrypt --passphrase "$BACKUP_ENCRYPTION_PASSPHRASE" "$ENC" 2>/dev/null \
       | gunzip -c > "$STAGING/$DB.sql" 2>/dev/null; then
    log "  ✗ $DB decrypt/gunzip failed"
    rm -f "$STAGING/$DB.sql"
  fi
done

STAGED=$(ls -1 "$STAGING"/*.sql 2>/dev/null | wc -l)
if [ "$STAGED" -eq 0 ]; then
  log "FATAL: no dumps staged successfully"
  write_metric 0 0 0 0
  exit 1
fi
log "Staged $STAGED dump(s) for restore"

# Spin up an ephemeral postgres. Volume mount lets psql -f read the
# staged files from inside the container. Random per-run password,
# dies with the container.
# Mount the backup volume at the SAME path the calling backup container
# uses (/backups), so the staging path is identical in both containers
# and the script doesn't have to translate between them.
docker run -d --name "$CONTAINER" \
  --network "$DOCKER_NETWORK" \
  -v "${BACKUP_VOLUME}:/backups:ro" \
  -e POSTGRES_PASSWORD="$VERIFY_PW" \
  -e POSTGRES_USER=verify_user \
  -e POSTGRES_DB=postgres \
  postgres:17-alpine >/dev/null

# Wait for postgres to accept TCP connections — with a hard 60s ceiling
# so a stuck verify container can't lock the cron.
READY_TIMEOUT=60
READY_START=$(date +%s)
while :; do
  if PGPASSWORD="$VERIFY_PW" psql -h "$CONTAINER" -p 5432 -U verify_user -d postgres -c '\q' >/dev/null 2>&1; then
    break
  fi
  if [ "$(( $(date +%s) - READY_START ))" -gt "$READY_TIMEOUT" ]; then
    log "FATAL: verify container failed to become ready in ${READY_TIMEOUT}s"
    docker logs "$CONTAINER" 2>&1 | tail -10 | sed 's/^/  /'
    write_metric 0 0 0 0
    exit 1
  fi
  sleep 2
done
log "Verify postgres ready"

TABLES_TOTAL=0
BYTES_TOTAL=0
RESTORED=0
FAILED=0

for SQL in "$STAGING"/*.sql; do
  DB=$(basename "$SQL" .sql)
  log "  → restoring $DB"

  # CREATE DATABASE (idempotent — ignore "already exists")
  PGPASSWORD="$VERIFY_PW" psql -h "$CONTAINER" -U verify_user -d postgres \
    -c "CREATE DATABASE \"$DB\";" >/dev/null 2>&1 || true

  # Restore via psql -f reading the bind-mounted file. Both backup and
  # verify containers see the staging dir at the same path (/backups/...).
  CONTAINER_PATH="${STAGING}/${DB}.sql"
  PSQL_ERR=$(mktemp)
  if PGPASSWORD="$VERIFY_PW" psql -h "$CONTAINER" -U verify_user -d "$DB" \
       --quiet -v ON_ERROR_STOP=0 -f "$CONTAINER_PATH" >/dev/null 2>"$PSQL_ERR"; then
    t=$(PGPASSWORD="$VERIFY_PW" psql -h "$CONTAINER" -U verify_user -d "$DB" -t -A -c \
      "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'" 2>/dev/null || echo 0)
    sz=$(stat -c %s "$SQL")
    TABLES_TOTAL=$((TABLES_TOTAL + t))
    BYTES_TOTAL=$((BYTES_TOTAL + sz))
    RESTORED=$((RESTORED + 1))
    log "  ✓ $DB — $t table(s)"
  else
    FAILED=$((FAILED + 1))
    log "  ✗ $DB restore failed: $(head -3 "$PSQL_ERR" | tr '\n' ' ' | head -c 200)"
  fi
  rm -f "$PSQL_ERR"
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
