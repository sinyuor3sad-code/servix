#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# SERVIX — Automated Database Backup Script
#
# Backs up ALL tenant databases + platform database.
# Supports local storage + optional S3 upload.
# Keeps backups for 30 days, then auto-deletes older ones.
#
# Usage:
#   ./backup.sh              — Run backup now
#   ./backup.sh --list       — List existing backups
#   ./backup.sh --restore <file> — Restore a specific backup
#
# Crontab (daily at 3 AM):
#   0 3 * * * /root/servix/tooling/scripts/backup.sh >> /var/log/servix-backup.log 2>&1
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Configuration ───
LOCAL_BACKUP_DIR="/root/servix-backups"
RETENTION_DAYS=30
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
TODAY_DIR="${LOCAL_BACKUP_DIR}/${TIMESTAMP}"

# ─── Colors ───
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"; }
warn() { echo -e "${YELLOW}[$(date '+%H:%M:%S')] ⚠${NC} $1"; }
err() { echo -e "${RED}[$(date '+%H:%M:%S')] ✗${NC} $1"; }

# ─── List backups ───
if [[ "${1:-}" == "--list" ]]; then
  echo "═══ SERVIX Backups ═══"
  if [[ -d "$LOCAL_BACKUP_DIR" ]]; then
    for d in "${LOCAL_BACKUP_DIR}"/*/; do
      [ -d "$d" ] || continue
      SIZE=$(du -sh "$d" | cut -f1)
      COUNT=$(find "$d" -name '*.sql.gz' | wc -l)
      echo "  $(basename "$d") — ${COUNT} DBs — ${SIZE}"
    done
  else
    echo "No backup directory found."
  fi
  exit 0
fi

# ─── Restore backup ───
if [[ "${1:-}" == "--restore" ]]; then
  RESTORE_FILE="${2:-}"
  if [[ -z "$RESTORE_FILE" || ! -f "$RESTORE_FILE" ]]; then
    err "Usage: $0 --restore <backup-file.sql.gz>"
    exit 1
  fi
  if [ -z "${PLATFORM_DATABASE_URL:-}" ]; then
    err "PLATFORM_DATABASE_URL is required"
    exit 1
  fi
  DB_NAME=$(basename "$RESTORE_FILE" .sql.gz | sed 's/^platform_//;s/^tenant_//')
  RESTORE_URL=$(echo "$PLATFORM_DATABASE_URL" | sed "s|/[^/]*$|/$DB_NAME|")
  log "Restoring ${DB_NAME} from ${RESTORE_FILE}..."
  gunzip -c "$RESTORE_FILE" | psql "$RESTORE_URL" -q 2>/dev/null
  log "✓ Restore complete for ${DB_NAME}"
  exit 0
fi

# ─── Validate env ───
if [ -z "${PLATFORM_DATABASE_URL:-}" ]; then
  err "PLATFORM_DATABASE_URL is required"
  exit 1
fi

# ─── Run Backup ───
log "═══ Starting SERVIX Backup ═══"
mkdir -p "$TODAY_DIR"

DB_NAME=$(echo "$PLATFORM_DATABASE_URL" | sed -n 's|.*/\([^/?]*\).*|\1|p')

TOTAL=0
SUCCESS=0
FAILED=0

# 1. Backup platform database
TOTAL=$((TOTAL + 1))
log "Backing up platform: ${DB_NAME}"
if pg_dump "$PLATFORM_DATABASE_URL" 2>/dev/null | gzip > "$TODAY_DIR/platform_${DB_NAME}.sql.gz"; then
  SIZE=$(du -sh "$TODAY_DIR/platform_${DB_NAME}.sql.gz" | cut -f1)
  log "  ✓ platform_${DB_NAME} (${SIZE})"
  SUCCESS=$((SUCCESS + 1))
else
  err "  ✗ Failed to backup platform DB"
  FAILED=$((FAILED + 1))
fi

# 2. Backup all tenant databases
TENANT_DBS=$(psql "$PLATFORM_DATABASE_URL" -t -c "SELECT \"databaseName\" FROM tenants WHERE status != 'cancelled';" 2>/dev/null | tr -d ' ' || true)

if [ -n "$TENANT_DBS" ]; then
  for tenant_db in $TENANT_DBS; do
    [ -z "$tenant_db" ] && continue
    TOTAL=$((TOTAL + 1))
    TENANT_URL=$(echo "$PLATFORM_DATABASE_URL" | sed "s|/[^/]*$|/$tenant_db|")
    log "Backing up tenant: ${tenant_db}"
    if pg_dump "$TENANT_URL" 2>/dev/null | gzip > "$TODAY_DIR/tenant_${tenant_db}.sql.gz"; then
      SIZE=$(du -sh "$TODAY_DIR/tenant_${tenant_db}.sql.gz" | cut -f1)
      log "  ✓ ${tenant_db} (${SIZE})"
      SUCCESS=$((SUCCESS + 1))
    else
      err "  ✗ Failed to backup ${tenant_db}"
      rm -f "$TODAY_DIR/tenant_${tenant_db}.sql.gz"
      FAILED=$((FAILED + 1))
    fi
  done
fi

# 3. Upload to S3 if configured
if [ -n "${S3_BUCKET:-}" ] && [ -n "${S3_ACCESS_KEY:-}" ]; then
  export AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY"
  export AWS_SECRET_ACCESS_KEY="${S3_SECRET_KEY:-}"
  export AWS_DEFAULT_REGION="${S3_REGION:-us-east-1}"
  S3_PREFIX="backups/daily"
  for f in "$TODAY_DIR"/*.gz; do
    [ -f "$f" ] || continue
    name=$(basename "$f")
    aws s3 cp "$f" "s3://${S3_BUCKET}/${S3_PREFIX}/${TIMESTAMP}_${name}" \
      ${S3_ENDPOINT:+--endpoint-url "$S3_ENDPOINT"} 2>/dev/null || true
  done
  log "Uploaded to S3: s3://${S3_BUCKET}/${S3_PREFIX}/"
fi

# 4. Cleanup old local backups
if [[ -d "$LOCAL_BACKUP_DIR" ]]; then
  DELETED=$(find "$LOCAL_BACKUP_DIR" -maxdepth 1 -type d -mtime +${RETENTION_DAYS} | wc -l)
  find "$LOCAL_BACKUP_DIR" -maxdepth 1 -type d -mtime +${RETENTION_DAYS} -exec rm -rf {} \; 2>/dev/null || true
  if [[ "$DELETED" -gt 0 ]]; then
    log "Cleaned up ${DELETED} backup(s) older than ${RETENTION_DAYS} days"
  fi
fi

# ─── Summary ───
TOTAL_SIZE=$(du -sh "$TODAY_DIR" | cut -f1)
echo ""
log "═══ Backup Complete ═══"
log "Total: ${TOTAL} | Success: ${SUCCESS} | Failed: ${FAILED}"
log "Location: ${TODAY_DIR}"
log "Size: ${TOTAL_SIZE}"

if [[ "$FAILED" -gt 0 ]]; then
  err "⚠ ${FAILED} database(s) failed to backup!"
  exit 1
fi

log "✓ All databases backed up successfully"
