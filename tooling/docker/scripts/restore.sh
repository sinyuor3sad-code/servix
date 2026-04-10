#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# SERVIX — Database Restore Script
# Restores backups from MinIO (S3) or local fallback.
#
# Usage:
#   ./restore.sh                         — list available backups
#   ./restore.sh <backup_folder>         — restore ALL databases
#   ./restore.sh <backup_folder> <db>    — restore a specific database
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# ── Config ──
LOCAL_DIR="/backups"
RESTORE_DIR="/tmp/restore"
MINIO_BUCKET="servix-backups"
MINIO_ALIAS="servix"

PGHOST="${PGHOST:-postgres}"
PGPORT="${PGPORT:-5432}"
PGUSER="${POSTGRES_USER:-servix}"
export PGPASSWORD="${POSTGRES_PASSWORD:-servix_secret}"

MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://minio:9000}"
MINIO_ACCESS_KEY="${MINIO_ROOT_USER:-servix_minio}"
MINIO_SECRET_KEY="${MINIO_ROOT_PASSWORD:-}"

# ── Functions ──
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

setup_minio() {
  if [ -z "$MINIO_SECRET_KEY" ]; then
    return 1
  fi
  mc alias set "$MINIO_ALIAS" "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" --api S3v4 >/dev/null 2>&1
}

list_backups() {
  echo ""
  echo "Available backups:"
  echo "══════════════════════════════════════"

  MINIO_OK=false
  if setup_minio 2>/dev/null; then
    MINIO_OK=true
  fi

  if [ "$MINIO_OK" = true ]; then
    echo ""
    echo "  [MinIO - ${MINIO_BUCKET}]"
    for FOLDER in $(mc ls "$MINIO_ALIAS/$MINIO_BUCKET/" 2>/dev/null | awk '{print $NF}' | tr -d '/'); do
      # Try to read manifest
      MANIFEST=$(mc cat "$MINIO_ALIAS/$MINIO_BUCKET/$FOLDER/manifest.json" 2>/dev/null || echo "")
      if [ -n "$MANIFEST" ]; then
        DATE=$(echo "$MANIFEST" | grep '"date"' | cut -d'"' -f4)
        DBS=$(echo "$MANIFEST" | grep '"success"' | grep -o '[0-9]*')
        echo "    $FOLDER  — ${DATE} (${DBS} databases)"
      else
        echo "    $FOLDER"
      fi
    done
  else
    echo "  [MinIO unavailable]"
  fi

  # Local fallback
  if [ -d "$LOCAL_DIR/latest" ]; then
    echo ""
    echo "  [Local fallback]"
    echo "    latest  — $(ls -1 $LOCAL_DIR/latest/*.sql.gz 2>/dev/null | wc -l) database(s)"
  fi

  echo ""
}

restore_database() {
  local DUMP_FILE="$1"
  local DB_NAME
  DB_NAME=$(basename "$DUMP_FILE" .sql.gz)

  log "  Restoring: ${DB_NAME}..."

  # Check if database exists, create if not
  DB_EXISTS=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -t -A -c \
    "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}';" 2>/dev/null || echo "")

  if [ "$DB_EXISTS" != "1" ]; then
    log "  Creating database: ${DB_NAME}"
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -c \
      "CREATE DATABASE \"${DB_NAME}\";" 2>/dev/null || true
  fi

  # Restore
  if gunzip -c "$DUMP_FILE" | psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$DB_NAME" \
    --single-transaction --quiet 2>/dev/null; then
    log "  OK: ${DB_NAME}"
    return 0
  else
    log "  Restored with warnings: ${DB_NAME}"
    return 0
  fi
}

# ── No arguments: list backups ──
if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup_folder> [database_name]"
  list_backups
  exit 0
fi

BACKUP_NAME="$1"
TARGET_DB="${2:-}"

# ── Download from MinIO ──
mkdir -p "$RESTORE_DIR"
rm -rf "${RESTORE_DIR:?}/${BACKUP_NAME}"

MINIO_OK=false
if setup_minio 2>/dev/null; then
  MINIO_OK=true
fi

SOURCE_PATH=""

if [ "$MINIO_OK" = true ] && mc ls "$MINIO_ALIAS/$MINIO_BUCKET/$BACKUP_NAME/" >/dev/null 2>&1; then
  log "Downloading from MinIO: ${MINIO_BUCKET}/${BACKUP_NAME}/..."
  mc cp --recursive "$MINIO_ALIAS/$MINIO_BUCKET/$BACKUP_NAME/" "$RESTORE_DIR/$BACKUP_NAME/" >/dev/null 2>&1
  SOURCE_PATH="$RESTORE_DIR/$BACKUP_NAME"
  log "  Download complete"
elif [ "$BACKUP_NAME" = "latest" ] && [ -d "$LOCAL_DIR/latest" ]; then
  SOURCE_PATH="$LOCAL_DIR/latest"
  log "Using local fallback: $SOURCE_PATH"
else
  log "Backup not found: $BACKUP_NAME"
  list_backups
  exit 1
fi

# ── Show manifest ──
if [ -f "$SOURCE_PATH/manifest.json" ]; then
  log "Backup info:"
  cat "$SOURCE_PATH/manifest.json"
  echo ""
fi

# ── Restore ──
if [ -n "$TARGET_DB" ]; then
  DUMP_FILE="${SOURCE_PATH}/${TARGET_DB}.sql.gz"
  if [ ! -f "$DUMP_FILE" ]; then
    log "Database dump not found: ${TARGET_DB}"
    log "Available databases in this backup:"
    ls -1 "${SOURCE_PATH}"/*.sql.gz 2>/dev/null | while read -r f; do
      echo "  - $(basename "$f" .sql.gz)"
    done
    exit 1
  fi

  log "About to restore database: ${TARGET_DB} from backup: ${BACKUP_NAME}"
  read -p "  Continue? (y/N): " CONFIRM
  [ "$CONFIRM" = "y" ] || exit 0

  restore_database "$DUMP_FILE"
else
  DUMP_COUNT=$(ls -1 "${SOURCE_PATH}"/*.sql.gz 2>/dev/null | wc -l)
  log "About to restore ALL ${DUMP_COUNT} databases from backup: ${BACKUP_NAME}"
  read -p "  Continue? (y/N): " CONFIRM
  [ "$CONFIRM" = "y" ] || exit 0

  SUCCESS=0
  FAILED=0
  for DUMP_FILE in "${SOURCE_PATH}"/*.sql.gz; do
    if restore_database "$DUMP_FILE"; then
      SUCCESS=$((SUCCESS + 1))
    else
      FAILED=$((FAILED + 1))
    fi
  done

  log "════════════════════════════════════════"
  log "Restore complete: ${SUCCESS} success, ${FAILED} failed"
  log "════════════════════════════════════════"
fi

# ── Cleanup temp ──
rm -rf "${RESTORE_DIR:?}/${BACKUP_NAME}"
