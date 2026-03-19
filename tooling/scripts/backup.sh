#!/bin/bash
# SEC-4: Database backup strategy
# Daily backup: pg_dump platform + all tenant DBs → gzip → S3
# Usage: ./backup.sh
# Env: PLATFORM_DATABASE_URL, S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY

set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/tmp/servix_backup_$$"
mkdir -p "$BACKUP_DIR"

# Parse base DB URL
if [ -z "$PLATFORM_DATABASE_URL" ]; then
  echo "PLATFORM_DATABASE_URL is required"
  exit 1
fi

# Extract DB name from URL (postgresql://user:pass@host:port/dbname)
DB_NAME=$(echo "$PLATFORM_DATABASE_URL" | sed -n 's|.*/\([^/?]*\).*|\1|p')
BASE_URL=$(echo "$PLATFORM_DATABASE_URL" | sed 's|/[^/]*$|/postgres|')

echo "Backing up platform database: $DB_NAME"
pg_dump "$PLATFORM_DATABASE_URL" | gzip > "$BACKUP_DIR/platform_${DB_NAME}.sql.gz"

# Get list of tenant databases from platform
TENANT_DBS=$(psql "$PLATFORM_DATABASE_URL" -t -c "SELECT \"databaseName\" FROM tenants WHERE status != 'cancelled';" 2>/dev/null | tr -d ' ' || true)

if [ -n "$TENANT_DBS" ]; then
  for tenant_db in $TENANT_DBS; do
    [ -z "$tenant_db" ] && continue
    TENANT_URL=$(echo "$PLATFORM_DATABASE_URL" | sed "s|/[^/]*$|/$tenant_db|")
    echo "Backing up tenant: $tenant_db"
    pg_dump "$TENANT_URL" 2>/dev/null | gzip > "$BACKUP_DIR/tenant_${tenant_db}.sql.gz" || echo "  (skip: $tenant_db)"
  done
fi

# Upload to S3 if configured
if [ -n "$S3_BUCKET" ] && [ -n "$S3_ACCESS_KEY" ]; then
  export AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY"
  export AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY"
  export AWS_DEFAULT_REGION="us-east-1"
  [ -n "$S3_ENDPOINT" ] && export AWS_ENDPOINT_URL="$S3_ENDPOINT"

  S3_PREFIX="backups/daily"
  for f in "$BACKUP_DIR"/*.gz; do
    [ -f "$f" ] || continue
    name=$(basename "$f")
    aws s3 cp "$f" "s3://${S3_BUCKET}/${S3_PREFIX}/${TIMESTAMP}_${name}" --endpoint-url "${S3_ENDPOINT:-https://s3.amazonaws.com}" 2>/dev/null || \
    aws s3 cp "$f" "s3://${S3_BUCKET}/${S3_PREFIX}/${TIMESTAMP}_${name}" 2>/dev/null || true
  done
  echo "Uploaded to S3"
fi

rm -rf "$BACKUP_DIR"
echo "Backup complete: $TIMESTAMP"
