#!/bin/bash
# ═══════════════════════════════════════════════════════════
# SERVIX Blue-Green Deployment
# Zero-downtime deploy with automatic rollback on error spike
# ═══════════════════════════════════════════════════════════
set -euo pipefail

VERSION="${1:?Usage: $0 <version>}"
DEPLOY_DIR="/opt/servix"
COMPOSE_DIR="$DEPLOY_DIR/tooling/docker"
CURRENT=$(cat "$DEPLOY_DIR/active-env" 2>/dev/null || echo "blue")
NEW=$([ "$CURRENT" = "blue" ] && echo "green" || echo "blue")
HEALTH_URL="http://localhost"
PROMETHEUS_URL="http://localhost:9090"
MAX_HEALTH_CHECKS=30
MONITOR_SECONDS=60

log()  { echo -e "\033[1;36m[DEPLOY]\033[0m $1"; }
ok()   { echo -e "\033[1;32m[✅]\033[0m $1"; }
fail() { echo -e "\033[1;31m[❌]\033[0m $1"; }

log "═══ Blue-Green Deploy: $CURRENT → $NEW (v$VERSION) ═══"

# ── 1. Build image ────────────────────────────────────────
log "Building servix-api:$VERSION..."
docker build -t servix-api:"$VERSION" -t servix-api:latest "$DEPLOY_DIR"

# ── 2. Start new environment ─────────────────────────────
log "Starting $NEW environment..."
VERSION="$VERSION" docker compose -f "$COMPOSE_DIR/docker-compose.$NEW.yml" up -d

# ── 3. Health check ───────────────────────────────────────
log "Running health checks (max ${MAX_HEALTH_CHECKS} attempts)..."
HEALTHY=false
for i in $(seq 1 "$MAX_HEALTH_CHECKS"); do
  STATUS=$(curl -sf -o /dev/null -w "%{http_code}" \
    --max-time 5 "$HEALTH_URL/api/v1/health/ready" 2>/dev/null || echo "000")
  
  if [ "$STATUS" = "200" ]; then
    HEALTHY=true
    ok "$NEW is healthy (attempt $i)"
    break
  fi
  
  log "  Attempt $i/$MAX_HEALTH_CHECKS: HTTP $STATUS"
  sleep 2
done

if [ "$HEALTHY" = false ]; then
  fail "Health check failed after $MAX_HEALTH_CHECKS attempts"
  docker compose -f "$COMPOSE_DIR/docker-compose.$NEW.yml" down
  exit 1
fi

# ── 4. Capture pre-switch error rate ──────────────────────
ERROR_BEFORE=$(curl -sf "$PROMETHEUS_URL/api/v1/query?query=rate(http_requests_total{status_code=~\"5..\"}[5m])" \
  | jq -r '.data.result[0].value[1] // "0"' 2>/dev/null || echo "0")
log "Pre-switch error rate: $ERROR_BEFORE"

# ── 5. Switch Nginx upstream ─────────────────────────────
log "Switching Nginx upstream to $NEW..."
sed -i "s/api-${CURRENT}/api-${NEW}/g" /etc/nginx/conf.d/upstream.conf
nginx -s reload
ok "Traffic now routing to $NEW"

# ── 6. Monitor for $MONITOR_SECONDS ──────────────────────
log "Monitoring for ${MONITOR_SECONDS}s..."
sleep "$MONITOR_SECONDS"

# ── 7. Check post-switch error rate ───────────────────────
ERROR_AFTER=$(curl -sf "$PROMETHEUS_URL/api/v1/query?query=rate(http_requests_total{status_code=~\"5..\"}[1m])" \
  | jq -r '.data.result[0].value[1] // "0"' 2>/dev/null || echo "0")
log "Post-switch error rate: $ERROR_AFTER"

# ── 8. Auto-rollback if error rate > 5% ──────────────────
if (( $(echo "$ERROR_AFTER > 0.05" | bc -l 2>/dev/null || echo "0") )); then
  fail "Error rate too high ($ERROR_AFTER) — AUTO ROLLBACK"
  sed -i "s/api-${NEW}/api-${CURRENT}/g" /etc/nginx/conf.d/upstream.conf
  nginx -s reload
  docker compose -f "$COMPOSE_DIR/docker-compose.$NEW.yml" down
  fail "Rolled back to $CURRENT"
  exit 1
fi

# ── 9. Tear down old environment ─────────────────────────
log "Shutting down $CURRENT environment..."
sleep 10
docker compose -f "$COMPOSE_DIR/docker-compose.$CURRENT.yml" down
echo "$NEW" > "$DEPLOY_DIR/active-env"

ok "═══ Deploy complete: $NEW active (v$VERSION) ═══"
