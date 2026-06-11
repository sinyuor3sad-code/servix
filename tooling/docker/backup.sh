#!/bin/bash
set -euo pipefail

# === SERVIX Automated Backup Script ===
# Runs daily at 03:00 via cron
# Backs up: PostgreSQL, n8n workflows, .env, nginx config

DATE=$(date +%Y%m%d_%H%M)
DIR="/root/backups"
LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')]"

echo "$LOG_PREFIX Starting backup..."

# 1. PostgreSQL full dump
echo "$LOG_PREFIX Dumping PostgreSQL..."
docker exec servix-postgres pg_dumpall -U servix | gzip > "$DIR/db_${DATE}.sql.gz"
DB_SIZE=$(du -h "$DIR/db_${DATE}.sql.gz" | cut -f1)
echo "$LOG_PREFIX  → db_${DATE}.sql.gz ($DB_SIZE)"

# 2. n8n workflows export
echo "$LOG_PREFIX Exporting n8n workflows..."
docker exec servix-n8n n8n export:workflow --all --output=/tmp/wf_backup.json 2>/dev/null || true
docker cp servix-n8n:/tmp/wf_backup.json "$DIR/n8n_wf_${DATE}.json" 2>/dev/null || true
echo "$LOG_PREFIX  → n8n_wf_${DATE}.json"

# 3. n8n credentials export
docker exec servix-n8n n8n export:credentials --all --output=/tmp/cred_backup.json 2>/dev/null || true
docker cp servix-n8n:/tmp/cred_backup.json "$DIR/n8n_cred_${DATE}.json" 2>/dev/null || true
echo "$LOG_PREFIX  → n8n_cred_${DATE}.json"

# 4. Environment file backup
if [ -f /root/servix/tooling/docker/.env ]; then
    cp /root/servix/tooling/docker/.env "$DIR/env_${DATE}.bak"
    echo "$LOG_PREFIX  → env_${DATE}.bak"
fi

# 5. Nginx config backup
docker exec servix-nginx cat /etc/nginx/nginx.conf > "$DIR/nginx_${DATE}.conf" 2>/dev/null || true
echo "$LOG_PREFIX  → nginx_${DATE}.conf"

# 6. Docker compose backup
if [ -f /root/servix/tooling/docker/docker-compose.prod.yml ]; then
    cp /root/servix/tooling/docker/docker-compose.prod.yml "$DIR/compose_${DATE}.yml"
    echo "$LOG_PREFIX  → compose_${DATE}.yml"
fi

# 7. Cleanup: delete backups older than 30 days
DELETED=$(find "$DIR" -mtime +30 -type f -delete -print | wc -l)
echo "$LOG_PREFIX Cleaned up $DELETED old files"

# 8. Summary
TOTAL_SIZE=$(du -sh "$DIR" | cut -f1)
FILE_COUNT=$(ls -1 "$DIR" | wc -l)
echo "$LOG_PREFIX Backup complete: $FILE_COUNT files, $TOTAL_SIZE total"
echo "$LOG_PREFIX ✅ Done"
