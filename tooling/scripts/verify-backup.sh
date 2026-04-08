#!/bin/bash
# ═══════════════════════════════════════════════════════════
# SERVIX — Weekly Backup Verification
# Restores latest backup to temp DB and validates integrity
# Schedule: cron — 0 4 * * 0 (Sundays at 4 AM)
# ═══════════════════════════════════════════════════════════
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/servix/backups}"
LOG_FILE="/var/log/servix/backup-verify.csv"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M')

echo "═══ Weekly Backup Verification — $TIMESTAMP ═══"

# Find latest backup
LATEST=$(ls -t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | head -1)
if [ -z "$LATEST" ]; then
  echo "❌ No backup files found in $BACKUP_DIR"
  echo "$TIMESTAMP,FAIL,no_backup_found,0,0" >> "$LOG_FILE"
  exit 1
fi
echo "📦 Testing: $(basename "$LATEST")"

# Start temp PostgreSQL container
CONTAINER="servix-backup-verify-$$"
echo "🐘 Starting temp database..."
docker run -d --name "$CONTAINER" \
  -e POSTGRES_PASSWORD=verify_test \
  -e POSTGRES_USER=servix \
  -e POSTGRES_DB=servix_verify \
  postgres:17-alpine >/dev/null

# Wait for PG to be ready
for i in $(seq 1 20); do
  docker exec "$CONTAINER" pg_isready -U servix >/dev/null 2>&1 && break
  sleep 1
done

# Restore backup
echo "📥 Restoring backup..."
gunzip -c "$LATEST" | docker exec -i "$CONTAINER" psql -U servix -d servix_verify >/dev/null 2>&1

# Verify data
TABLES=$(docker exec "$CONTAINER" psql -U servix -d servix_verify -t -c \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'" 2>/dev/null | tr -d ' ')
TENANTS=$(docker exec "$CONTAINER" psql -U servix -d servix_verify -t -c \
  "SELECT count(*) FROM \"Tenant\"" 2>/dev/null | tr -d ' ' || echo "0")
USERS=$(docker exec "$CONTAINER" psql -U servix -d servix_verify -t -c \
  "SELECT count(*) FROM \"User\"" 2>/dev/null | tr -d ' ' || echo "0")

# Cleanup
echo "🧹 Cleaning up..."
docker rm -f "$CONTAINER" >/dev/null

# Report
echo ""
if [ "${TABLES:-0}" -gt 0 ]; then
  echo "═══ ✅ Backup Verification PASSED ═══"
  echo "  Tables: $TABLES"
  echo "  Tenants: $TENANTS"
  echo "  Users: $USERS"
  echo "  Backup: $(basename "$LATEST")"
  echo "$TIMESTAMP,PASS,$(basename "$LATEST"),$TABLES,$TENANTS,$USERS" >> "$LOG_FILE"
else
  echo "═══ ❌ Backup Verification FAILED ═══"
  echo "  No tables found after restore"
  echo "$TIMESTAMP,FAIL,$(basename "$LATEST"),0,0,0" >> "$LOG_FILE"
  # Send alert (integrate with your alerting system)
  exit 1
fi
