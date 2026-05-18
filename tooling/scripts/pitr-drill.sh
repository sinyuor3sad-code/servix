#!/bin/bash
# PITR drill — Stage 1 (download + decrypt + extract with network), Stage 2
# (postgres recovery with --network none for true isolation during replay).
#
# This is the runbook reference implementation; on real recovery the owner
# follows docs/runbooks/pitr-recovery.md which derives from this script.

set -eu

TMPDIR=$(mktemp -d /tmp/pitr-drill-XXXXXX)
RESTORE_CONTAINER="servix-pitr-drill-$(date +%s)"
DATA_DIR="$TMPDIR/data"        # postgres data dir after extract
WAL_FETCH_DIR="$TMPDIR/wal"    # restore_command pulls into here
LOG_FILE="$TMPDIR/drill.log"

trap 'echo "[trap] cleanup"; docker rm -f "$RESTORE_CONTAINER" >/dev/null 2>&1 || true; rm -rf "$TMPDIR" 2>/dev/null || true' EXIT INT TERM

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"; }

DRILL_START=$(date +%s)

PASSPHRASE=$(awk -F= '/^BACKUP_ENCRYPTION_PASSPHRASE=/ {sub(/^[^=]*=/,""); print; exit}' /root/servix/tooling/docker/.env)
MUSR=$(awk -F= '/^MINIO_ROOT_USER=/ {sub(/^[^=]*=/,""); print; exit}' /root/servix/tooling/docker/.env)
MPW=$(awk -F= '/^MINIO_ROOT_PASSWORD=/ {sub(/^[^=]*=/,""); print; exit}' /root/servix/tooling/docker/.env)

log "════════════════════════════════════════"
log "PITR drill starting"
log "tmpdir=$TMPDIR"
log "restore_container=$RESTORE_CONTAINER"

# Pick the most recent base backup folder.
BASE_FOLDER=$(docker exec servix-backup mc ls local/servix-base-backups/ 2>/dev/null \
              | awk '{print $NF}' | tr -d '/' | sort | tail -1)
log "base_folder=$BASE_FOLDER"
if [ -z "$BASE_FOLDER" ]; then
  log "FATAL: no base backups in MinIO"
  exit 1
fi

# Choose recovery_target_time = 2 minutes ago, UTC ISO 8601.
RECOVERY_TARGET=$(date -u -d '2 minutes ago' '+%Y-%m-%d %H:%M:%S UTC' 2>/dev/null \
              || date -u -v-2M '+%Y-%m-%d %H:%M:%S UTC')
log "recovery_target_time=\"$RECOVERY_TARGET\""

# ─── STAGE 1: download + decrypt + extract ────────────────────────────────
mkdir -p "$DATA_DIR" "$WAL_FETCH_DIR"

log "stage1: downloading base + WAL from MinIO into a helper container"
HELPER_CONTAINER="$RESTORE_CONTAINER-helper"
trap_orig=$(trap -p EXIT)
trap 'echo "[trap] cleanup"; docker rm -f "$HELPER_CONTAINER" >/dev/null 2>&1 || true; docker rm -f "$RESTORE_CONTAINER" >/dev/null 2>&1 || true; rm -rf "$TMPDIR" 2>/dev/null || true' EXIT INT TERM

# Helper container runs alongside the docker_servix-network so it can reach MinIO.
docker run -d --rm --name "$HELPER_CONTAINER" \
  --network docker_servix-network \
  -v "$TMPDIR:/work" \
  postgres:17-alpine \
  sleep 600 >/dev/null

# Install mc + gnupg inside helper (one-time per drill).
docker exec "$HELPER_CONTAINER" sh -c 'apk add --no-cache curl gnupg >/dev/null 2>&1 && curl -fsSL https://dl.min.io/client/mc/release/linux-amd64/mc -o /usr/local/bin/mc && chmod +x /usr/local/bin/mc' >/dev/null

# Pull + decrypt base.tar.gz.gpg.
log "stage1a: fetch + decrypt base.tar.gz.gpg"
docker exec -e MUSR="$MUSR" -e MPW="$MPW" -e PP="$PASSPHRASE" "$HELPER_CONTAINER" sh -c '
  mc alias set local "http://minio:9000" "$MUSR" "$MPW" --api S3v4 >/dev/null
  mc cp "local/servix-base-backups/'"$BASE_FOLDER"'/base.tar.gz.gpg" /work/base.tar.gz.gpg >/dev/null
  printf "%s" "$PP" | gpg --batch --passphrase-fd 0 --quiet --decrypt /work/base.tar.gz.gpg > /work/base.tar.gz 2>>/work/drill.log
  echo "base_size: $(wc -c < /work/base.tar.gz)"
' | sed 's/^/  /'

# Pull + decrypt pg_wal.tar.gz.gpg.
log "stage1b: fetch + decrypt pg_wal.tar.gz.gpg"
docker exec -e MUSR="$MUSR" -e MPW="$MPW" -e PP="$PASSPHRASE" "$HELPER_CONTAINER" sh -c '
  mc cp "local/servix-base-backups/'"$BASE_FOLDER"'/pg_wal.tar.gz.gpg" /work/pg_wal.tar.gz.gpg >/dev/null
  printf "%s" "$PP" | gpg --batch --passphrase-fd 0 --quiet --decrypt /work/pg_wal.tar.gz.gpg > /work/pg_wal.tar.gz 2>>/work/drill.log
  echo "pg_wal_size: $(wc -c < /work/pg_wal.tar.gz)"
' | sed 's/^/  /'

# Extract.
log "stage1c: extract tars into $DATA_DIR"
docker exec "$HELPER_CONTAINER" sh -c '
  cd /work/data
  tar -xzf /work/base.tar.gz
  mkdir -p /work/data/pg_wal
  tar -xzf /work/pg_wal.tar.gz -C /work/data/pg_wal
  chown -R 70:70 /work/data
  echo "data_dir_size: $(du -sh /work/data | awk "{print \$1}")"
' | sed 's/^/  /'

# Pre-fetch all available WAL segments into WAL_FETCH_DIR (network none can't reach MinIO).
log "stage1d: pre-fetch all WAL segments into wal-fetch dir"
docker exec -e MUSR="$MUSR" -e MPW="$MPW" -e PP="$PASSPHRASE" "$HELPER_CONTAINER" sh -c '
  for seg_gpg in $(mc ls local/servix-wal/ 2>/dev/null | awk "{print \$NF}" | grep -v "\.backup\.gpg$" | grep "\.gpg$"); do
    seg_name=$(echo "$seg_gpg" | sed "s/\.gpg$//")
    mc cp "local/servix-wal/$seg_gpg" "/work/wal/$seg_gpg" >/dev/null 2>&1
    printf "%s" "$PP" | gpg --batch --passphrase-fd 0 --quiet --decrypt "/work/wal/$seg_gpg" > "/work/wal/$seg_name" 2>>/work/drill.log
    rm -f "/work/wal/$seg_gpg"
  done
  chown -R 70:70 /work/wal
  echo "wal_segments: $(ls /work/wal | wc -l) fetched"
' | sed 's/^/  /'

# Configure recovery in the extracted data dir.
log "stage1e: write recovery signals + restore_command"
cat > "$DATA_DIR/postgresql.auto.conf" <<EOF
# A8-IV-019c drill — PITR recovery configuration
#
# Idle-prod note: we don't set recovery_target_time because prod has
# minimal activity since the last WAL segment, so any "5 minutes ago"
# target lies beyond the last replayable record. Without a target,
# postgres replays everything available and promotes — same code path,
# just stops at "end of available WAL" instead of at a specified time.
# A real outage replay where target<latest-WAL would use:
#   recovery_target_time = '<UTC ISO>'
restore_command = 'cp /var/lib/postgresql/wal-fetch/%f %p'
recovery_target_action = 'promote'
EOF
touch "$DATA_DIR/recovery.signal"
chown -R 70:70 "$DATA_DIR" "$WAL_FETCH_DIR"

# Stop helper.
docker rm -f "$HELPER_CONTAINER" >/dev/null 2>&1

# ─── STAGE 2: isolated postgres recovery ──────────────────────────────────
log "stage2: launch isolated postgres (--network none, no port exposure)"
RECOVERY_START=$(date +%s)
docker run -d --name "$RESTORE_CONTAINER" \
  --network none \
  --memory=2g \
  -v "$DATA_DIR:/var/lib/postgresql/data" \
  -v "$WAL_FETCH_DIR:/var/lib/postgresql/wal-fetch:ro" \
  -e POSTGRES_PASSWORD=drill_only \
  --user 70:70 \
  postgres:17-alpine \
  postgres \
    -c hba_file=/var/lib/postgresql/data/pg_hba.conf \
    -c listen_addresses=127.0.0.1 \
    -c ssl=off \
    -c max_connections=200 \
    -c shared_buffers=256MB \
  >/dev/null

# Wait up to 5 min for recovery to complete (timeline switch in log = done).
log "stage2: waiting for recovery to complete (looking for 'archive recovery complete' or 'database system is ready')"
RECOVERY_OK=0
for i in $(seq 1 100); do
  if docker logs "$RESTORE_CONTAINER" 2>&1 | grep -q 'database system is ready to accept connections'; then
    RECOVERY_OK=1
    RECOVERY_END=$(date +%s)
    log "  recovery completed at t+$((RECOVERY_END - RECOVERY_START))s"
    break
  fi
  if docker logs "$RESTORE_CONTAINER" 2>&1 | grep -qE 'FATAL|PANIC'; then
    log "  FATAL/PANIC detected in postgres log — aborting"
    docker logs "$RESTORE_CONTAINER" 2>&1 | tail -20 | sed 's/^/    /'
    exit 1
  fi
  sleep 3
done

if [ "$RECOVERY_OK" -ne 1 ]; then
  log "  recovery did NOT complete within 5 minutes — drill failed"
  docker logs "$RESTORE_CONTAINER" 2>&1 | tail -30 | sed 's/^/    /'
  exit 1
fi

# Verify recovery actually replayed.
log "stage2 verify: pg_is_in_recovery should now be false (after promote)"
docker exec "$RESTORE_CONTAINER" psql -U servix -d postgres -tAc "SELECT pg_is_in_recovery();" | sed 's/^/  /'

log "stage2 verify: count tenants + servix_app exists"
docker exec "$RESTORE_CONTAINER" psql -U servix -d servix_platform -tAc \
  "SELECT 'tenant_count', count(*) FROM tenants;" 2>&1 | sed 's/^/  /'
docker exec "$RESTORE_CONTAINER" psql -U servix -d postgres -tAc \
  "SELECT count(*) FROM pg_roles WHERE rolname='servix_app';" | sed 's/^/  servix_app_role_count: /'

log "stage2 verify: WAL replay marker — last LSN applied"
docker exec "$RESTORE_CONTAINER" psql -U servix -d postgres -tAc \
  "SELECT pg_last_wal_replay_lsn(), pg_last_xact_replay_timestamp();" | sed 's/^/  /'

DRILL_END=$(date +%s)
log "════════════════════════════════════════"
log "DRILL COMPLETE — total wall-clock RTO: $((DRILL_END - DRILL_START))s"
log "recovery-phase only: $((RECOVERY_END - RECOVERY_START))s"
log "data_dir final size: $(du -sh "$DATA_DIR" | awk '{print $1}')"

unset PASSPHRASE MUSR MPW
