#!/bin/bash
# ═══════════════════════════════════════════════════════════
# SERVIX Manual Rollback
# Instantly switch back to the previous environment
# ═══════════════════════════════════════════════════════════
set -euo pipefail

DEPLOY_DIR="/opt/servix"
COMPOSE_DIR="$DEPLOY_DIR/tooling/docker"
CURRENT=$(cat "$DEPLOY_DIR/active-env" 2>/dev/null || echo "blue")
PREV=$([ "$CURRENT" = "blue" ] && echo "green" || echo "blue")

echo "═══ Rollback: $CURRENT → $PREV ═══"

# Start previous environment
docker compose -f "$COMPOSE_DIR/docker-compose.$PREV.yml" up -d
sleep 5

# Switch Nginx
sed -i "s/api-${CURRENT}/api-${PREV}/g" /etc/nginx/conf.d/upstream.conf
nginx -s reload

# Stop current
docker compose -f "$COMPOSE_DIR/docker-compose.$CURRENT.yml" down

echo "$PREV" > "$DEPLOY_DIR/active-env"
echo "✅ Rolled back to $PREV"
