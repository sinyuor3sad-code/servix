#!/bin/bash
# SEC-4: Restore database from backup
# Usage: ./restore.sh <backup_timestamp> [database_type]
# Example: ./restore.sh 20260318_030000 platform
# Example: ./restore.sh 20260318_030000 tenant servix_tenant_abc123

set -e

if [ -z "$1" ]; then
  echo "Usage: ./restore.sh <timestamp> [platform|tenant <dbname>]"
  echo "  timestamp: e.g. 20260318_030000"
  exit 1
fi

TIMESTAMP=$1
TYPE=${2:-platform}

if [ "$TYPE" = "platform" ]; then
  if [ -z "$PLATFORM_DATABASE_URL" ]; then
    echo "PLATFORM_DATABASE_URL required"
    exit 1
  fi
  DB_NAME=$(echo "$PLATFORM_DATABASE_URL" | sed -n 's|.*/\([^/?]*\).*|\1|p')
  BACKUP_FILE="backups/daily/${TIMESTAMP}_platform_${DB_NAME}.sql.gz"
  echo "Restoring platform from $BACKUP_FILE"
  aws s3 cp "s3://${S3_BUCKET}/${BACKUP_FILE}" - 2>/dev/null | gunzip | psql "$PLATFORM_DATABASE_URL" || {
    echo "Download from S3 failed. If local: gunzip -c /path/to/backup.sql.gz | psql \$PLATFORM_DATABASE_URL"
    exit 1
  }
elif [ "$TYPE" = "tenant" ] && [ -n "$3" ]; then
  TENANT_DB=$3
  if [ -z "$PLATFORM_DATABASE_URL" ]; then
    echo "PLATFORM_DATABASE_URL required"
    exit 1
  fi
  TENANT_URL=$(echo "$PLATFORM_DATABASE_URL" | sed "s|/[^/]*$|/$TENANT_DB|")
  BACKUP_FILE="backups/daily/${TIMESTAMP}_tenant_${TENANT_DB}.sql.gz"
  echo "Restoring tenant $TENANT_DB from $BACKUP_FILE"
  aws s3 cp "s3://${S3_BUCKET}/${BACKUP_FILE}" - 2>/dev/null | gunzip | psql "$TENANT_URL" || {
    echo "Download from S3 failed."
    exit 1
  }
else
  echo "Usage: ./restore.sh <timestamp> platform"
  echo "       ./restore.sh <timestamp> tenant <tenant_db_name>"
  exit 1
fi

echo "Restore complete"
