#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# SERVIX — Automated Database Backup Script
# Runs via cron every 6 hours. Backs up ALL databases.
# Storage: MinIO (S3-compatible) bucket "servix-backups"
# Retention: 7 days (older backups are deleted automatically)
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# ── Config ──
BACKUP_DIR="/tmp/backups"
RETENTION_DAYS=7
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_PATH="${BACKUP_DIR}/${TIMESTAMP}"
LOG_FILE="/backups/backup.log"
MINIO_BUCKET="servix-backups"
MINIO_ALIAS="servix"

# ── Database connection (from environment) ──
PGHOST="${PGHOST:-postgres}"
PGPORT="${PGPORT:-5432}"
PGUSER="${POSTGRES_USER:-servix}"
export PGPASSWORD="${POSTGRES_PASSWORD:-servix_secret}"

# ── MinIO connection (from environment) ──
MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://minio:9000}"
MINIO_ACCESS_KEY="${MINIO_ROOT_USER:-servix_minio}"
MINIO_SECRET_KEY="${MINIO_ROOT_PASSWORD:-}"

# ── Functions ──
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

setup_minio() {
  # Configure mc alias
  mc alias set "$MINIO_ALIAS" "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" --api S3v4 >/dev/null 2>&1

  # Create bucket if it doesn't exist
  if ! mc ls "$MINIO_ALIAS/$MINIO_BUCKET" >/dev/null 2>&1; then
    log "Creating MinIO bucket: $MINIO_BUCKET"
    mc mb "$MINIO_ALIAS/$MINIO_BUCKET" >/dev/null 2>&1
  fi
}

upload_to_minio() {
  local LOCAL_PATH="$1"
  local REMOTE_PATH="$2"

  if mc cp --recursive "$LOCAL_PATH/" "$MINIO_ALIAS/$MINIO_BUCKET/$REMOTE_PATH/" >/dev/null 2>&1; then
    return 0
  else
    return 1
  fi
}

cleanup_old_minio_backups() {
  log "Cleaning MinIO backups older than ${RETENTION_DAYS} days..."
  local CUTOFF_DATE
  CUTOFF_DATE=$(date -d "-${RETENTION_DAYS} days" +"%Y%m%d" 2>/dev/null || date -v-${RETENTION_DAYS}d +"%Y%m%d" 2>/dev/null || echo "")

  if [ -z "$CUTOFF_DATE" ]; then
    log "  Could not compute cutoff date, skipping MinIO cleanup"
    return
  fi

  local DELETED=0
  for FOLDER in $(mc ls "$MINIO_ALIAS/$MINIO_BUCKET/" 2>/dev/null | awk '{print $NF}' | tr -d '/'); do
    # Extract date part (YYYYMMDD) from folder name like 20260410_120000
    local FOLDER_DATE="${FOLDER%%_*}"
    if [ -n "$FOLDER_DATE" ] && [ "$FOLDER_DATE" -lt "$CUTOFF_DATE" ] 2>/dev/null; then
      log "  Deleting old backup: $FOLDER"
      mc rm --recursive --force "$MINIO_ALIAS/$MINIO_BUCKET/$FOLDER/" >/dev/null 2>&1
      DELETED=$((DELETED + 1))
    fi
  done
  log "  Deleted ${DELETED} old backup(s) from MinIO"
}

# ── Start ──
log "════════════════════════════════════════"
log "Starting SERVIX backup..."
mkdir -p "$BACKUP_PATH" /backups

# ── 0. Setup MinIO ──
MINIO_OK=false
if [ -n "$MINIO_SECRET_KEY" ]; then
  if setup_minio; then
    MINIO_OK=true
    log "MinIO connected: $MINIO_ENDPOINT"
  else
    log "WARNING: MinIO setup failed — backup will be local only"
  fi
else
  log "WARNING: MINIO_ROOT_PASSWORD not set — backup will be local only"
fi

# ── 1. Get all databases ──
DATABASES=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -t -A -c \
  "SELECT datname FROM pg_database WHERE datistemplate = false AND datname != 'postgres';")

if [ -z "$DATABASES" ]; then
  log "No databases found!"
  exit 1
fi

DB_COUNT=$(echo "$DATABASES" | wc -l)
log "Found ${DB_COUNT} databases to backup"

# ── 2. Backup each database ──
SUCCESS=0
FAILED=0

for DB in $DATABASES; do
  DUMP_FILE="${BACKUP_PATH}/${DB}.sql.gz"
  log "  Backing up: ${DB}..."

  if pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$DB" \
    --no-owner --no-privileges --clean --if-exists \
    | gzip > "$DUMP_FILE" 2>>"$LOG_FILE"; then

    SIZE=$(du -sh "$DUMP_FILE" | cut -f1)
    log "  OK ${DB} (${SIZE})"
    SUCCESS=$((SUCCESS + 1))
  else
    log "  FAILED: ${DB}"
    FAILED=$((FAILED + 1))
    rm -f "$DUMP_FILE"
  fi
done

# ── 3. Create manifest ──
cat > "${BACKUP_PATH}/manifest.json" <<EOF
{
  "timestamp": "${TIMESTAMP}",
  "date": "$(date -Iseconds)",
  "databases": ${DB_COUNT},
  "success": ${SUCCESS},
  "failed": ${FAILED},
  "host": "${PGHOST}",
  "retention_days": ${RETENTION_DAYS},
  "storage": "$([ "$MINIO_OK" = true ] && echo 'minio' || echo 'local')"
}
EOF

# ── 4. Upload to MinIO ──
if [ "$MINIO_OK" = true ]; then
  log "Uploading to MinIO: ${MINIO_BUCKET}/${TIMESTAMP}/..."
  if upload_to_minio "$BACKUP_PATH" "$TIMESTAMP"; then
    log "  Upload complete"
  else
    log "  WARNING: Upload failed — backup kept locally"
  fi

  # ── 5. Cleanup old MinIO backups ──
  cleanup_old_minio_backups
fi

# ── 6. Cleanup local temp ──
rm -rf "$BACKUP_PATH"

# Also keep a local fallback copy (latest only) in /backups/latest
rm -rf /backups/latest
mkdir -p /backups/latest
# Re-dump platform DB as local fallback
pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "servix_platform" \
  --no-owner --no-privileges --clean --if-exists \
  | gzip > /backups/latest/servix_platform.sql.gz 2>/dev/null || true

# ── 7. Summary ──
log "════════════════════════════════════════"
log "Backup complete!"
log "  Databases: ${SUCCESS} success, ${FAILED} failed, ${DB_COUNT} total"
log "  Storage: $([ "$MINIO_OK" = true ] && echo "MinIO ($MINIO_BUCKET/$TIMESTAMP)" || echo 'local only')"
log "════════════════════════════════════════"

# Exit with error if any database failed
[ "$FAILED" -eq 0 ] || exit 1
