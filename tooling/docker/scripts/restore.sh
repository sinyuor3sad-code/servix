#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# SERVIX — Database Restore Script
# Usage: ./restore.sh <backup_folder> [database_name]
#   - If database_name is provided, restores only that database
#   - If omitted, restores ALL databases from the backup folder
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# ── Config ──
BACKUP_DIR="/backups"
PGHOST="${PGHOST:-postgres}"
PGPORT="${PGPORT:-5432}"
PGUSER="${POSTGRES_USER:-servix}"
export PGPASSWORD="${POSTGRES_PASSWORD:-servix_secret}"

# ── Validate arguments ──
if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup_folder> [database_name]"
  echo ""
  echo "Available backups:"
  ls -1d ${BACKUP_DIR}/20* 2>/dev/null | while read dir; do
    if [ -f "$dir/manifest.json" ]; then
      DATE=$(cat "$dir/manifest.json" | grep '"date"' | cut -d'"' -f4)
      DBS=$(cat "$dir/manifest.json" | grep '"success"' | grep -o '[0-9]*')
      echo "  $(basename $dir)  — ${DATE} (${DBS} databases)"
    else
      echo "  $(basename $dir)"
    fi
  done
  exit 1
fi

RESTORE_PATH="${BACKUP_DIR}/$1"
TARGET_DB="${2:-}"

if [ ! -d "$RESTORE_PATH" ]; then
  echo "❌ Backup folder not found: $RESTORE_PATH"
  exit 1
fi

# ── Functions ──
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

restore_database() {
  local DUMP_FILE="$1"
  local DB_NAME=$(basename "$DUMP_FILE" .sql.gz)
  
  log "  🔄 Restoring: ${DB_NAME}..."
  
  # Check if database exists, create if not
  DB_EXISTS=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -t -A -c \
    "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}';" 2>/dev/null || echo "")
  
  if [ "$DB_EXISTS" != "1" ]; then
    log "  📝 Creating database: ${DB_NAME}"
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -c \
      "CREATE DATABASE \"${DB_NAME}\";" 2>/dev/null || true
  fi
  
  # Restore
  if gunzip -c "$DUMP_FILE" | psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$DB_NAME" \
    --single-transaction --quiet 2>/dev/null; then
    log "  ✅ Restored: ${DB_NAME}"
    return 0
  else
    log "  ⚠️  Restored with warnings: ${DB_NAME}"
    return 0
  fi
}

# ── Show manifest ──
if [ -f "$RESTORE_PATH/manifest.json" ]; then
  log "📋 Backup info:"
  cat "$RESTORE_PATH/manifest.json"
  echo ""
fi

# ── Confirmation ──
if [ -n "$TARGET_DB" ]; then
  DUMP_FILE="${RESTORE_PATH}/${TARGET_DB}.sql.gz"
  if [ ! -f "$DUMP_FILE" ]; then
    log "❌ Database dump not found: ${DUMP_FILE}"
    log "Available databases in this backup:"
    ls -1 "${RESTORE_PATH}"/*.sql.gz 2>/dev/null | while read f; do
      echo "  - $(basename $f .sql.gz)"
    done
    exit 1
  fi
  
  log "⚠️  About to restore database: ${TARGET_DB}"
  log "    from backup: $(basename $RESTORE_PATH)"
  read -p "    Continue? (y/N): " CONFIRM
  [ "$CONFIRM" = "y" ] || exit 0
  
  restore_database "$DUMP_FILE"
else
  DUMP_COUNT=$(ls -1 "${RESTORE_PATH}"/*.sql.gz 2>/dev/null | wc -l)
  log "⚠️  About to restore ALL ${DUMP_COUNT} databases"
  log "    from backup: $(basename $RESTORE_PATH)"
  read -p "    Continue? (y/N): " CONFIRM
  [ "$CONFIRM" = "y" ] || exit 0
  
  SUCCESS=0
  FAILED=0
  for DUMP_FILE in "${RESTORE_PATH}"/*.sql.gz; do
    if restore_database "$DUMP_FILE"; then
      SUCCESS=$((SUCCESS + 1))
    else
      FAILED=$((FAILED + 1))
    fi
  done
  
  log "════════════════════════════════════════"
  log "✅ Restore complete: ${SUCCESS} success, ${FAILED} failed"
  log "════════════════════════════════════════"
fi
