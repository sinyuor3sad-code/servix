#!/bin/sh
# ═══════════════════════════════════════════════════════════════
# SERVIX — In-container scheduled backup
#
# Runs every 6h via cron. For every Postgres database (excluding
# `postgres` and templates):
#   1. pg_dump | gzip → encrypt with gpg (AES-256, symmetric)
#   2. Upload to MinIO bucket `servix-backups/<TS>/<db>.sql.gz.gpg`
#   3. Write a manifest with sha256 of every dump
#   4. Cleanup local temp; retain 7d on MinIO
#   5. Write last-success + db count + total bytes to a node-exporter
#      textfile so Prometheus can alert on stale backups.
#
# A separate cron mirrors the latest day off-site (mirror-to-offsite.sh)
# and verifies it weekly (verify-backup.sh).
# ═══════════════════════════════════════════════════════════════

set -eu

# ─── Config ───
BACKUP_DIR="/tmp/backups"
RETENTION_DAYS=7
TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
BACKUP_PATH="${BACKUP_DIR}/${TIMESTAMP}"
LOG_FILE="/backups/backup.log"
MINIO_BUCKET="servix-backups"
MINIO_ALIAS="servix"
METRICS_DIR="/var/lib/node_exporter/textfile_collector"
METRICS_FILE="${METRICS_DIR}/servix_backup.prom"

# ─── DB connection ───
PGHOST="${PGHOST:-postgres}"
PGPORT="${PGPORT:-5432}"
PGUSER="${POSTGRES_USER:-servix}"
export PGPASSWORD="${POSTGRES_PASSWORD:-}"

# ─── MinIO ───
MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://minio:9000}"
MINIO_ACCESS_KEY="${MINIO_ROOT_USER:-}"
MINIO_SECRET_KEY="${MINIO_ROOT_PASSWORD:-}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"; }

# ─── Hard preconditions ───
if [ -z "${BACKUP_ENCRYPTION_PASSPHRASE:-}" ]; then
  log "FATAL: BACKUP_ENCRYPTION_PASSPHRASE is required (PDPL)"
  exit 1
fi
if [ -z "$PGPASSWORD" ]; then
  log "FATAL: POSTGRES_PASSWORD is required"
  exit 1
fi

write_metrics() {
  # arg1: status (0|1) — 0 = success
  # arg2: db_count
  # arg3: success_count
  # arg4: failed_count
  # arg5: total_bytes
  mkdir -p "$METRICS_DIR"
  cat > "${METRICS_FILE}.tmp" <<EOF
# HELP servix_backup_last_success_timestamp Unix time of last successful backup run.
# TYPE servix_backup_last_success_timestamp gauge
servix_backup_last_success_timestamp ${1}
# HELP servix_backup_databases_total Number of databases targeted by the last run.
# TYPE servix_backup_databases_total gauge
servix_backup_databases_total ${2}
# HELP servix_backup_success_total Number of databases successfully backed up in the last run.
# TYPE servix_backup_success_total gauge
servix_backup_success_total ${3}
# HELP servix_backup_failed_total Number of databases that failed in the last run.
# TYPE servix_backup_failed_total gauge
servix_backup_failed_total ${4}
# HELP servix_backup_size_bytes Total size of the last successful backup batch.
# TYPE servix_backup_size_bytes gauge
servix_backup_size_bytes ${5}
EOF
  mv "${METRICS_FILE}.tmp" "$METRICS_FILE"
}

setup_minio() {
  mc alias set "$MINIO_ALIAS" "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" --api S3v4 >/dev/null 2>&1
  mc ls "$MINIO_ALIAS/$MINIO_BUCKET" >/dev/null 2>&1 || mc mb "$MINIO_ALIAS/$MINIO_BUCKET" >/dev/null
  # Versioning protects against ransomware that overwrites an existing object.
  mc version enable "$MINIO_ALIAS/$MINIO_BUCKET" >/dev/null 2>&1 || true
}

encrypt_file() {
  # in-place: foo.sql.gz → foo.sql.gz.gpg, removes plaintext
  src="$1"
  gpg --batch --yes --quiet --cipher-algo AES256 \
      --passphrase "$BACKUP_ENCRYPTION_PASSPHRASE" \
      --symmetric --output "${src}.gpg" "$src"
  shred -u "$src" 2>/dev/null || rm -f "$src"
}

cleanup_old_minio() {
  cutoff="$(date -d "@$(( $(date +%s) - RETENTION_DAYS * 86400 ))" +"%Y%m%d" 2>/dev/null || echo "")"
  [ -z "$cutoff" ] && return 0
  for folder in $(mc ls "$MINIO_ALIAS/$MINIO_BUCKET/" 2>/dev/null | awk '{print $NF}' | tr -d '/'); do
    fdate="${folder%%_*}"
    [ -z "$fdate" ] && continue
    if [ "$fdate" -lt "$cutoff" ] 2>/dev/null; then
      log "  Removing stale: $folder"
      mc rm --recursive --force "$MINIO_ALIAS/$MINIO_BUCKET/$folder/" >/dev/null 2>&1 || true
    fi
  done
}

# ─── Run ───
log "════════════════════════════════════════"
log "Starting SERVIX backup ${TIMESTAMP}"
mkdir -p "$BACKUP_PATH" /backups

setup_minio
log "MinIO ready: $MINIO_ENDPOINT"

DATABASES="$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -t -A -c \
  "SELECT datname FROM pg_database WHERE datistemplate = false AND datname != 'postgres';")"

if [ -z "$DATABASES" ]; then
  log "FATAL: no databases discovered"
  write_metrics 0 0 0 1 0
  exit 1
fi

DB_COUNT=$(echo "$DATABASES" | wc -l)
log "Backing up $DB_COUNT database(s)"

SUCCESS=0; FAILED=0
MANIFEST="${BACKUP_PATH}/manifest.json"
echo '{ "timestamp": "'"${TIMESTAMP}"'", "databases": [' > "$MANIFEST"
first=1

for DB in $DATABASES; do
  DUMP="${BACKUP_PATH}/${DB}.sql.gz"
  log "  → ${DB}"
  if pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$DB" \
       --no-owner --no-privileges --clean --if-exists \
       | gzip > "$DUMP" 2>>"$LOG_FILE"; then
    encrypt_file "$DUMP"
    enc="${DUMP}.gpg"
    sha="$(sha256sum "$enc" | awk '{print $1}')"
    sz="$(stat -c %s "$enc")"
    [ "$first" = "1" ] || echo ',' >> "$MANIFEST"
    first=0
    printf '  {"db":"%s","file":"%s","sha256":"%s","bytes":%s}' \
      "$DB" "$(basename "$enc")" "$sha" "$sz" >> "$MANIFEST"
    log "  ✓ ${DB} ($(numfmt --to=iec "$sz" 2>/dev/null || echo "${sz}B"))"
    SUCCESS=$((SUCCESS + 1))
  else
    log "  ✗ ${DB} dump failed"
    rm -f "$DUMP"
    FAILED=$((FAILED + 1))
  fi
done

echo "" >> "$MANIFEST"
echo '], "success": '"$SUCCESS"', "failed": '"$FAILED"', "encrypted": true }' >> "$MANIFEST"

# Upload (encrypted dumps + manifest)
log "Uploading to MinIO: ${MINIO_BUCKET}/${TIMESTAMP}/"
if ! mc cp --recursive "$BACKUP_PATH/" "$MINIO_ALIAS/$MINIO_BUCKET/$TIMESTAMP/" >/dev/null 2>&1; then
  log "✗ Upload failed — keeping local copy in /backups/failed-uploads/"
  mkdir -p /backups/failed-uploads
  mv "$BACKUP_PATH" "/backups/failed-uploads/$TIMESTAMP"
  write_metrics 0 "$DB_COUNT" "$SUCCESS" "$FAILED" 0
  exit 1
fi
log "✓ Upload complete"

cleanup_old_minio

TOTAL_BYTES=$(du -sb "$BACKUP_PATH" 2>/dev/null | awk '{print $1}')
rm -rf "$BACKUP_PATH"

# Write metrics for Prometheus alerting
NOW=$(date +%s)
if [ "$FAILED" -eq 0 ]; then
  write_metrics "$NOW" "$DB_COUNT" "$SUCCESS" "$FAILED" "${TOTAL_BYTES:-0}"
  log "════════════════════════════════════════"
  log "✓ Backup complete: $SUCCESS/$DB_COUNT, $(numfmt --to=iec "${TOTAL_BYTES:-0}" 2>/dev/null || echo "${TOTAL_BYTES:-0}B")"
  exit 0
else
  # Don't bump last_success_timestamp on partial failure — alert will fire.
  log "✗ Backup partial: $SUCCESS ok, $FAILED failed"
  exit 1
fi
