#!/bin/sh
# ═══════════════════════════════════════════════════════════════
# SERVIX — Postgres physical base backup (for PITR)
#
# Logical dumps (backup.sh) give us per-database recovery, but PITR
# requires a *physical* base backup against which WAL segments are
# replayed. Run this weekly; combined with continuous WAL archiving
# from postgresql.conf's archive_command, it gives us:
#   - RPO ≈ 60s (archive_timeout)
#   - RTO ≈ 30min (restore base + replay WAL up to target time)
#
# Schedule (in backup container's crontab — see docker-compose):
#   0 5 * * 0    /bin/sh /scripts/base-backup.sh
# ═══════════════════════════════════════════════════════════════

set -eu

LOG_FILE="/backups/base-backup.log"
TIMESTAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
WORK_DIR="/tmp/base-${TIMESTAMP}"
MINIO_BUCKET="servix-base-backups"
MINIO_ALIAS="servix"

PGHOST="${PGHOST:-postgres}"
PGPORT="${PGPORT:-5432}"
PGUSER="${POSTGRES_USER:-servix}"
export PGPASSWORD="${POSTGRES_PASSWORD:-}"

MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://minio:9000}"
MINIO_ACCESS_KEY="${MINIO_ROOT_USER:-}"
MINIO_SECRET_KEY="${MINIO_ROOT_PASSWORD:-}"

PASSPHRASE="${BACKUP_ENCRYPTION_PASSPHRASE:-}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"; }

[ -z "$PASSPHRASE" ]  && { log "FATAL: BACKUP_ENCRYPTION_PASSPHRASE unset"; exit 1; }
[ -z "$PGPASSWORD" ] && { log "FATAL: POSTGRES_PASSWORD unset"; exit 1; }

log "════════════════════════════════════════"
log "Starting base backup ${TIMESTAMP}"

mkdir -p "$WORK_DIR"
mc alias set "$MINIO_ALIAS" "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" --api S3v4 >/dev/null 2>&1
mc ls "$MINIO_ALIAS/$MINIO_BUCKET" >/dev/null 2>&1 || mc mb "$MINIO_ALIAS/$MINIO_BUCKET" >/dev/null

# pg_basebackup writes a tar.gz of the entire data dir + the WAL needed to
# bring it consistent. -X stream guarantees zero gap.
if pg_basebackup \
     -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" \
     -D "$WORK_DIR" -F tar -z -X stream -P -v 2>>"$LOG_FILE"; then
  log "✓ pg_basebackup complete"
else
  log "✗ pg_basebackup failed"
  rm -rf "$WORK_DIR"
  exit 1
fi

# Encrypt each tar before upload.
for f in "$WORK_DIR"/*.tar.gz; do
  log "  encrypting $(basename "$f")"
  gpg --batch --yes --quiet --cipher-algo AES256 \
      --passphrase "$PASSPHRASE" \
      --symmetric --output "${f}.gpg" "$f"
  shred -u "$f" 2>/dev/null || rm -f "$f"
done

# Upload.
log "Uploading to MinIO: $MINIO_BUCKET/$TIMESTAMP/"
if mc cp --recursive "$WORK_DIR/" "$MINIO_ALIAS/$MINIO_BUCKET/$TIMESTAMP/" >/dev/null 2>&1; then
  log "✓ Upload complete"
else
  log "✗ Upload failed"
  rm -rf "$WORK_DIR"
  exit 1
fi

rm -rf "$WORK_DIR"

# Retention: keep 4 weekly base backups (~1 month).
KEEP=4
COUNT=0
for folder in $(mc ls "$MINIO_ALIAS/$MINIO_BUCKET/" 2>/dev/null \
                  | awk '{print $NF}' | tr -d '/' | sort -r); do
  COUNT=$((COUNT + 1))
  [ "$COUNT" -le "$KEEP" ] && continue
  log "  pruning old base: $folder"
  mc rm --recursive --force "$MINIO_ALIAS/$MINIO_BUCKET/$folder/" >/dev/null 2>&1 || true
done

log "✓ Base backup ${TIMESTAMP} complete"
