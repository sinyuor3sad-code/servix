#!/bin/sh
# ═══════════════════════════════════════════════════════════════
# SERVIX — WAL shipper (A8-IV-019b sidecar)
#
# Polls a shared volume that postgres' archive_command writes into,
# encrypts each completed WAL segment with GPG (AES-256-CFB, same
# passphrase as the logical-backup pipeline), uploads to MinIO, and
# removes the source segment from the shared volume.
#
# Architecture intent:
#   - postgres image stays vanilla (no mc/gpg installed inside it).
#   - archive_command is a fast local cp + fsync — back-pressure
#     applies only when the shared volume fills up, not when MinIO
#     or GPG misbehaves.
#   - this script runs as uid 70 (postgres) so it can read what the
#     postgres archive_command wrote.
#   - emits node-exporter textfile metrics every cycle:
#       servix_wal_shipped_total
#       servix_wal_shipper_errors_total
#       servix_wal_shipper_last_success_timestamp
#       servix_wal_shipper_lag_bytes  (sum of bytes still on disk)
#
# Recovery: see docs/principal-audit/execution/iv-019b-recovery.md
# (Phase 4 of session 5).
# ═══════════════════════════════════════════════════════════════

set -eu

WAL_STAGING="${WAL_STAGING:-/var/lib/postgresql/wal-archive}"
MINIO_BUCKET="${WAL_MINIO_BUCKET:-servix-wal}"
MINIO_ALIAS="${WAL_MINIO_ALIAS:-walship}"
MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://minio:9000}"
MINIO_ACCESS_KEY="${MINIO_ROOT_USER:-}"
MINIO_SECRET_KEY="${MINIO_ROOT_PASSWORD:-}"
RETENTION_DAYS="${WAL_RETENTION_DAYS:-14}"
POLL_INTERVAL="${WAL_POLL_INTERVAL:-15}"
METRICS_DIR="${METRICS_DIR:-/var/lib/node_exporter/textfile_collector}"
METRICS_FILE="${METRICS_FILE:-${METRICS_DIR}/servix_wal_shipper.prom}"
LOG_FILE="${LOG_FILE:-/var/log/wal-shipper.log}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"; }

# Fast-fail on misconfig. Better than silently shipping nothing.
if [ -z "${BACKUP_ENCRYPTION_PASSPHRASE:-}" ]; then
  log "FATAL: BACKUP_ENCRYPTION_PASSPHRASE not set"
  exit 1
fi
if [ -z "$MINIO_ACCESS_KEY" ] || [ -z "$MINIO_SECRET_KEY" ]; then
  log "FATAL: MINIO_ROOT_USER / MINIO_ROOT_PASSWORD not set"
  exit 1
fi

mkdir -p "$WAL_STAGING" "$METRICS_DIR" "$(dirname "$LOG_FILE")"

mc alias set "$MINIO_ALIAS" "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" --api S3v4 >/dev/null 2>&1
mc mb --ignore-existing "$MINIO_ALIAS/$MINIO_BUCKET" >/dev/null 2>&1 || {
  log "FATAL: failed to ensure bucket $MINIO_BUCKET"
  exit 1
}

log "════════════════════════════════════════"
log "wal-shipper starting (poll=${POLL_INTERVAL}s, retention=${RETENTION_DAYS}d, staging=$WAL_STAGING)"

# Counter state (in-memory only; node-exporter re-reads textfile each scrape).
SHIPPED_TOTAL=0
ERRORS_TOTAL=0
LAST_SUCCESS_TS=0

write_metrics() {
  lag_bytes=$(du -sb "$WAL_STAGING" 2>/dev/null | awk '{print $1+0}')
  cat > "${METRICS_FILE}.tmp" <<EOF
# HELP servix_wal_shipped_total Number of WAL segments successfully shipped.
# TYPE servix_wal_shipped_total counter
servix_wal_shipped_total ${SHIPPED_TOTAL}
# HELP servix_wal_shipper_errors_total Number of shipping errors (encrypt/upload/cleanup).
# TYPE servix_wal_shipper_errors_total counter
servix_wal_shipper_errors_total ${ERRORS_TOTAL}
# HELP servix_wal_shipper_last_success_timestamp Unix time of last successful ship.
# TYPE servix_wal_shipper_last_success_timestamp gauge
servix_wal_shipper_last_success_timestamp ${LAST_SUCCESS_TS}
# HELP servix_wal_shipper_lag_bytes Bytes of WAL staged but not yet shipped.
# TYPE servix_wal_shipper_lag_bytes gauge
servix_wal_shipper_lag_bytes ${lag_bytes}
EOF
  mv "${METRICS_FILE}.tmp" "$METRICS_FILE"
}

ship_one() {
  src="$1"
  name=$(basename "$src")
  # Skip partials (postgres writes *.partial first, then renames atomically).
  case "$name" in *.partial|*.history|.*) return 1 ;; esac
  # Encrypt + upload in one stream. mc pipe avoids landing the .gpg on disk.
  if printf '%s' "$BACKUP_ENCRYPTION_PASSPHRASE" \
       | gpg --batch --quiet --symmetric --cipher-algo AES256 --passphrase-fd 0 \
             -o - "$src" 2>>"$LOG_FILE" \
       | mc pipe "$MINIO_ALIAS/$MINIO_BUCKET/${name}.gpg" >/dev/null 2>>"$LOG_FILE"; then
    rm -f "$src"
    SHIPPED_TOTAL=$((SHIPPED_TOTAL + 1))
    LAST_SUCCESS_TS=$(date +%s)
    return 0
  else
    ERRORS_TOTAL=$((ERRORS_TOTAL + 1))
    log "  ✗ ship failed: $name (segment retained on disk for retry)"
    return 1
  fi
}

prune_old() {
  cutoff_iso=$(date -u -d "${RETENTION_DAYS} days ago" '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null \
            || date -u -v-${RETENTION_DAYS}d '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null \
            || echo "")
  [ -z "$cutoff_iso" ] && return 0
  # `mc rm --older-than` accepts duration strings — simpler.
  mc rm --recursive --force --older-than "${RETENTION_DAYS}d" \
     "$MINIO_ALIAS/$MINIO_BUCKET/" >/dev/null 2>>"$LOG_FILE" || true
}

# Main loop.
last_prune=0
while :; do
  # Iterate stable filenames (skip in-flight partials).
  for f in "$WAL_STAGING"/*; do
    [ -e "$f" ] || continue
    case "$(basename "$f")" in *.partial|*.history|.*) continue ;; esac
    ship_one "$f" || true
  done

  # Prune once an hour, not every poll.
  now=$(date +%s)
  if [ $((now - last_prune)) -gt 3600 ]; then
    prune_old
    last_prune=$now
  fi

  write_metrics
  sleep "$POLL_INTERVAL"
done
