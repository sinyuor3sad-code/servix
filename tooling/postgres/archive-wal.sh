#!/bin/sh
# ═══════════════════════════════════════════════════════════════
# Postgres archive_command — ships a completed WAL segment to MinIO.
#
# Called by postgres for every WAL segment with:
#   $1 = full local path (%p)   e.g. pg_wal/000000010000000000000005
#   $2 = file name (%f)         e.g. 000000010000000000000005
#
# Contract with postgres:
#   - Exit 0 → segment archived, postgres may recycle it.
#   - Exit non-zero → postgres retries the SAME segment forever, eventually
#     blocking writes when pg_wal fills up. Therefore: be paranoid, fail
#     loudly, never claim success on a partial upload.
#
# The script is intentionally synchronous (fsync via mc), so postgres
# back-pressures if MinIO is unreachable rather than losing WAL.
# ═══════════════════════════════════════════════════════════════

set -eu

WAL_PATH="$1"
WAL_FILE="$2"

MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://minio:9000}"
MINIO_BUCKET="servix-wal"
MINIO_ALIAS="wal"
MINIO_ACCESS_KEY="${MINIO_ROOT_USER:-}"
MINIO_SECRET_KEY="${MINIO_ROOT_PASSWORD:-}"
PASSPHRASE="${BACKUP_ENCRYPTION_PASSPHRASE:-}"

[ -z "$PASSPHRASE" ] && { echo "[archive-wal] FATAL: BACKUP_ENCRYPTION_PASSPHRASE unset" >&2; exit 1; }

# Configure mc once (mc alias is idempotent).
mc alias set "$MINIO_ALIAS" "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" --api S3v4 >/dev/null 2>&1
mc ls "$MINIO_ALIAS/$MINIO_BUCKET" >/dev/null 2>&1 \
  || mc mb "$MINIO_ALIAS/$MINIO_BUCKET" >/dev/null 2>&1

# Encrypt → upload. Use `mc pipe` so we never write plaintext to disk.
if gpg --batch --quiet --cipher-algo AES256 \
       --passphrase "$PASSPHRASE" \
       --symmetric --output - "$WAL_PATH" \
   | mc pipe "$MINIO_ALIAS/$MINIO_BUCKET/$(date -u +%Y/%m/%d)/${WAL_FILE}.gpg" >/dev/null 2>&1; then
  exit 0
fi

echo "[archive-wal] FAIL: could not archive $WAL_FILE" >&2
exit 1
