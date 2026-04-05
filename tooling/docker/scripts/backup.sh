#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# SERVIX — Automated Database Backup Script
# Runs via cron every 6 hours. Backs up ALL databases.
# Retention: 7 days (older backups are deleted automatically)
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# ── Config ──
BACKUP_DIR="/backups"
RETENTION_DAYS=7
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_PATH="${BACKUP_DIR}/${TIMESTAMP}"
LOG_FILE="${BACKUP_DIR}/backup.log"

# ── Database connection (from environment) ──
PGHOST="${PGHOST:-postgres}"
PGPORT="${PGPORT:-5432}"
PGUSER="${POSTGRES_USER:-servix}"
export PGPASSWORD="${POSTGRES_PASSWORD:-servix_secret}"

# ── Functions ──
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# ── Start ──
log "════════════════════════════════════════"
log "🔄 Starting SERVIX backup..."
mkdir -p "$BACKUP_PATH"

# ── 1. Get all databases ──
DATABASES=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -t -A -c \
  "SELECT datname FROM pg_database WHERE datistemplate = false AND datname != 'postgres';")

if [ -z "$DATABASES" ]; then
  log "❌ No databases found!"
  exit 1
fi

DB_COUNT=$(echo "$DATABASES" | wc -l)
log "📊 Found ${DB_COUNT} databases to backup"

# ── 2. Backup each database ──
SUCCESS=0
FAILED=0

for DB in $DATABASES; do
  DUMP_FILE="${BACKUP_PATH}/${DB}.sql.gz"
  log "  📦 Backing up: ${DB}..."
  
  if pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$DB" \
    --no-owner --no-privileges --clean --if-exists \
    | gzip > "$DUMP_FILE" 2>>"$LOG_FILE"; then
    
    SIZE=$(du -sh "$DUMP_FILE" | cut -f1)
    log "  ✅ ${DB} → ${SIZE}"
    SUCCESS=$((SUCCESS + 1))
  else
    log "  ❌ FAILED: ${DB}"
    FAILED=$((FAILED + 1))
    rm -f "$DUMP_FILE"
  fi
done

# ── 3. Create a manifest ──
cat > "${BACKUP_PATH}/manifest.json" <<EOF
{
  "timestamp": "${TIMESTAMP}",
  "date": "$(date -Iseconds)",
  "databases": ${DB_COUNT},
  "success": ${SUCCESS},
  "failed": ${FAILED},
  "host": "${PGHOST}",
  "retention_days": ${RETENTION_DAYS}
}
EOF

# ── 4. Cleanup old backups ──
log "🧹 Cleaning backups older than ${RETENTION_DAYS} days..."
DELETED=0
for OLD_BACKUP in $(find "$BACKUP_DIR" -maxdepth 1 -type d -mtime +${RETENTION_DAYS} -not -path "$BACKUP_DIR"); do
  log "  🗑️  Deleting: $(basename $OLD_BACKUP)"
  rm -rf "$OLD_BACKUP"
  DELETED=$((DELETED + 1))
done
log "  Deleted ${DELETED} old backup(s)"

# ── 5. Summary ──
TOTAL_SIZE=$(du -sh "$BACKUP_PATH" | cut -f1)
log "════════════════════════════════════════"
log "✅ Backup complete!"
log "  📁 Path: ${BACKUP_PATH}"
log "  📊 Databases: ${SUCCESS} success, ${FAILED} failed, ${DB_COUNT} total"
log "  💾 Size: ${TOTAL_SIZE}"
log "════════════════════════════════════════"

# Exit with error if any database failed
[ "$FAILED" -eq 0 ] || exit 1
