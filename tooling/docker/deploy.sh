#!/bin/bash
set -euo pipefail

# ══════════════════════════════════════════════════
# SERVIX Production Deployment Script
# Usage: sudo bash /root/servix/tooling/docker/deploy.sh
# ══════════════════════════════════════════════════

SERVIX_DIR="/root/servix"
DOCKER_DIR="$SERVIX_DIR/tooling/docker"
COMPOSE_SINGLE="$DOCKER_DIR/docker-compose.single.yml"
COMPOSE_PROD="$DOCKER_DIR/docker-compose.prod.yml"

echo ""
echo "══════════════════════════════════════════"
echo "  SERVIX Deploy — $(date '+%Y-%m-%d %H:%M:%S')"
echo "══════════════════════════════════════════"
echo ""

# ── 1. Pull latest code ──
echo "▶ [1/5] Pulling latest code..."
cd "$SERVIX_DIR"
git pull --ff-only
echo "  ✅ Code updated"
echo ""

# ── 2. Build ALL API + Dashboard images ──
echo "▶ [2/5] Building API (single) + Dashboard..."
cd "$DOCKER_DIR"
docker compose -f "$COMPOSE_SINGLE" build api dashboard --no-cache
echo "  ✅ API + Dashboard built (single)"
echo ""

echo "▶ [3/5] Building API-1 + API-2 (prod)..."
docker compose -f "$COMPOSE_PROD" build api-1 api-2 --no-cache
echo "  ✅ API-1 + API-2 built (prod)"
echo ""

# ── 3. Restart containers (zero-downtime: one at a time) ──
echo "▶ [4/5] Restarting containers..."

# API-1 first
docker compose -f "$COMPOSE_PROD" up -d api-1
echo "  ⏳ Waiting for API-1 to be healthy..."
timeout 60 bash -c 'until [ "$(docker inspect --format="{{.State.Health.Status}}" servix-api-1 2>/dev/null)" = "healthy" ]; do sleep 2; done' || true
echo "  ✅ API-1 running"

# API-2
docker compose -f "$COMPOSE_PROD" up -d api-2
echo "  ⏳ Waiting for API-2 to be healthy..."
timeout 60 bash -c 'until [ "$(docker inspect --format="{{.State.Health.Status}}" servix-api-2 2>/dev/null)" = "healthy" ]; do sleep 2; done' || true
echo "  ✅ API-2 running"

# Dashboard
docker compose -f "$COMPOSE_SINGLE" up -d dashboard
echo "  ⏳ Waiting for Dashboard to be healthy..."
timeout 90 bash -c 'until [ "$(docker inspect --format="{{.State.Health.Status}}" servix-dashboard 2>/dev/null)" = "healthy" ]; do sleep 2; done' || true
echo "  ✅ Dashboard running"

# Nginx reload (pick up new container IPs)
docker restart servix-nginx
echo "  ✅ Nginx reloaded"
echo ""

# ── 4. Health check ──
echo "▶ [5/5] Verifying deployment..."
sleep 3

API_STATUS=$(curl -s -o /dev/null -w '%{http_code}' https://api.servi-x.com/api/v1/health/live 2>/dev/null || echo "000")
DASH_STATUS=$(curl -s -o /dev/null -w '%{http_code}' https://app.servi-x.com/ 2>/dev/null || echo "000")

if [ "$API_STATUS" = "200" ]; then
  echo "  ✅ API: healthy ($API_STATUS)"
else
  echo "  ❌ API: unhealthy ($API_STATUS)"
fi

if [ "$DASH_STATUS" = "200" ]; then
  echo "  ✅ Dashboard: healthy ($DASH_STATUS)"
else
  echo "  ❌ Dashboard: unhealthy ($DASH_STATUS)"
fi

echo ""
echo "══════════════════════════════════════════"
echo "  Deploy complete — $(date '+%Y-%m-%d %H:%M:%S')"
echo "══════════════════════════════════════════"
echo ""
