#!/bin/sh
# ═══════════════════════════════════════════════════════════════
# SERVIX — Off-site backup mirror
#
# Copies the latest day of MinIO backups to an off-site S3 bucket
# (e.g. Backblaze B2, Wasabi, AWS S3). Without this, all backup
# copies live on the same physical VM as the primary database, so
# any catastrophic loss (disk failure, ransomware, account
# suspension) wipes both production data and recovery copies.
#
# Conforms to the 3-2-1 backup rule:
#   3 copies (primary DB + MinIO + off-site)
#   2 media (local block storage + remote object storage)
#   1 off-site (this script)
#
# Cron (inside the backup container): `0 2 * * *`
# ═══════════════════════════════════════════════════════════════

set -eu

LOG_FILE="/backups/mirror.log"
MINIO_BUCKET="servix-backups"
MINIO_ALIAS="servix"
OFFSITE_ALIAS="offsite"

MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://minio:9000}"
MINIO_ACCESS_KEY="${MINIO_ROOT_USER:-}"
MINIO_SECRET_KEY="${MINIO_ROOT_PASSWORD:-}"

OFFSITE_ENDPOINT="${OFFSITE_S3_ENDPOINT:-}"
OFFSITE_BUCKET="${OFFSITE_S3_BUCKET:-}"
OFFSITE_ACCESS_KEY="${OFFSITE_S3_ACCESS_KEY:-}"
OFFSITE_SECRET_KEY="${OFFSITE_S3_SECRET_KEY:-}"

METRICS_DIR="/var/lib/node_exporter/textfile_collector"
METRICS_FILE="${METRICS_DIR}/servix_offsite_mirror.prom"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"; }

write_metric() {
  # arg1: timestamp of last successful mirror (0 = never/failed)
  # arg2: bytes transferred in last run
  mkdir -p "$METRICS_DIR"
  cat > "${METRICS_FILE}.tmp" <<EOF
# HELP servix_offsite_mirror_last_success_timestamp Unix time of last successful off-site mirror.
# TYPE servix_offsite_mirror_last_success_timestamp gauge
servix_offsite_mirror_last_success_timestamp ${1}
# HELP servix_offsite_mirror_bytes_transferred Total bytes pushed off-site in the last run.
# TYPE servix_offsite_mirror_bytes_transferred gauge
servix_offsite_mirror_bytes_transferred ${2}
EOF
  mv "${METRICS_FILE}.tmp" "$METRICS_FILE"
}

# ─── Preconditions ───
if [ -z "$OFFSITE_ENDPOINT" ] || [ -z "$OFFSITE_BUCKET" ] \
   || [ -z "$OFFSITE_ACCESS_KEY" ] || [ -z "$OFFSITE_SECRET_KEY" ]; then
  log "Off-site env not configured (OFFSITE_S3_*) — skipping mirror"
  # Don't write metric — alert will fire and force operator to configure it.
  exit 0
fi

log "════════════════════════════════════════"
log "Off-site mirror starting"

# Configure both aliases
mc alias set "$MINIO_ALIAS" "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" --api S3v4 >/dev/null 2>&1
mc alias set "$OFFSITE_ALIAS" "$OFFSITE_ENDPOINT" "$OFFSITE_ACCESS_KEY" "$OFFSITE_SECRET_KEY" --api S3v4 >/dev/null 2>&1

# Ensure off-site bucket exists with versioning + object-lock for ransomware protection.
if ! mc ls "$OFFSITE_ALIAS/$OFFSITE_BUCKET" >/dev/null 2>&1; then
  log "Creating off-site bucket: $OFFSITE_BUCKET"
  mc mb --with-lock "$OFFSITE_ALIAS/$OFFSITE_BUCKET" >/dev/null 2>&1 \
    || mc mb "$OFFSITE_ALIAS/$OFFSITE_BUCKET" >/dev/null 2>&1
fi
mc version enable "$OFFSITE_ALIAS/$OFFSITE_BUCKET" >/dev/null 2>&1 || true
# Compliance/governance: 30-day immutable retention.
mc retention set --default COMPLIANCE 30d "$OFFSITE_ALIAS/$OFFSITE_BUCKET" >/dev/null 2>&1 || true

# Find all backup folders from today (UTC).
TODAY="$(date -u +%Y%m%d)"
FOLDERS=$(mc ls "$MINIO_ALIAS/$MINIO_BUCKET/" 2>/dev/null \
  | awk '{print $NF}' | tr -d '/' | grep "^${TODAY}_" || true)

if [ -z "$FOLDERS" ]; then
  log "No backups from today (${TODAY}) to mirror"
  write_metric 0 0
  exit 1
fi

TOTAL_BYTES=0
for f in $FOLDERS; do
  log "  → mirroring $f"
  if mc mirror --overwrite --remove \
        "$MINIO_ALIAS/$MINIO_BUCKET/$f/" \
        "$OFFSITE_ALIAS/$OFFSITE_BUCKET/$f/" >/dev/null 2>&1; then
    sz=$(mc du "$OFFSITE_ALIAS/$OFFSITE_BUCKET/$f/" 2>/dev/null | awk '{print $1}')
    log "  ✓ $f ($sz)"
    bytes=$(mc du --json "$OFFSITE_ALIAS/$OFFSITE_BUCKET/$f/" 2>/dev/null \
      | grep -o '"size":[0-9]*' | head -1 | cut -d: -f2)
    TOTAL_BYTES=$((TOTAL_BYTES + ${bytes:-0}))
  else
    log "  ✗ failed: $f"
    write_metric 0 0
    exit 1
  fi
done

# Apply lifecycle: keep 30 daily, then transition older to glacier-equivalent
# (provider-specific; configured once in the off-site bucket settings).

write_metric "$(date +%s)" "$TOTAL_BYTES"
log "✓ Off-site mirror complete: $(numfmt --to=iec "$TOTAL_BYTES" 2>/dev/null || echo "${TOTAL_BYTES}B")"
