#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# SERVIX — One-Command Deploy Script
# ═══════════════════════════════════════════════════════════════
# Usage: ./deploy.sh [--build] [--migrate] [--restart]
#
# Options:
#   --build     Force rebuild all Docker images
#   --migrate   Run database migrations before deploying
#   --restart   Restart without rebuilding (fast deploy)
#   (no args)   Full deploy: build + migrate + start
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DOCKER_DIR="$SCRIPT_DIR/../docker"
COMPOSE_FILE="$DOCKER_DIR/docker-compose.single.yml"
ENV_FILE="$DOCKER_DIR/.env"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[SERVIX]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ── Check prerequisites ──
check_prerequisites() {
  log "🔍 Checking prerequisites..."
  command -v docker >/dev/null 2>&1 || err "Docker not installed"
  command -v docker compose >/dev/null 2>&1 || err "Docker Compose not installed"
  [ -f "$COMPOSE_FILE" ] || err "Compose file not found: $COMPOSE_FILE"
  
  if [ ! -f "$ENV_FILE" ]; then
    warn "⚠️  .env file not found! Copying from .env.example..."
    cp "$DOCKER_DIR/.env.example" "$ENV_FILE"
    err "Please fill in the values in $ENV_FILE before deploying!"
  fi

  # Check for CHANGE_ME values
  if grep -q "CHANGE_ME" "$ENV_FILE"; then
    err "Found CHANGE_ME values in .env — please fill all secrets before deploying!"
  fi

  log "✅ Prerequisites OK"
}

# ── Build images ──
build_images() {
  log "🔨 Building Docker images..."
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --parallel
  log "✅ Build complete"
}

# ── Run database migrations ──
run_migrations() {
  log "🗄️  Running database migrations..."
  
  # Start only postgres + redis (dependencies)
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d postgres redis
  
  # Wait for postgres
  log "⏳ Waiting for PostgreSQL..."
  sleep 5
  
  # Run migrations via API container
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm \
    -e NODE_ENV=production \
    api sh -c "npx prisma migrate deploy --schema=prisma/platform.prisma && npx prisma migrate deploy --schema=prisma/tenant.prisma"
  
  log "✅ Migrations complete"
}

# ── Deploy (start/restart services) ──
deploy() {
  log "🚀 Deploying SERVIX..."
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d
  log "✅ All services started"
}

# ── Health check ──
health_check() {
  log "🏥 Running health checks..."
  
  local max_attempts=30
  local attempt=1
  
  while [ $attempt -le $max_attempts ]; do
    if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps | grep -q "unhealthy"; then
      echo -n "."
      sleep 5
      attempt=$((attempt + 1))
    else
      break
    fi
  done
  
  echo ""
  
  # Show status
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
  
  # Check API health
  local api_health
  api_health=$(docker exec servix-api wget -qO- http://127.0.0.1:4000/api/v1/health/live 2>/dev/null || echo "failed")
  
  if echo "$api_health" | grep -qi "ok\|alive\|healthy"; then
    log "✅ API is healthy!"
  else
    warn "⚠️  API health check returned: $api_health"
  fi
  
  echo ""
  log "═══════════════════════════════════════"
  log "  🎉 SERVIX deployed successfully!"
  log "═══════════════════════════════════════"
  log "  API:       http://localhost:4000"
  log "  Dashboard: http://localhost:3000"
  log "  Booking:   http://localhost:3001"
  log "  Admin:     http://localhost:3002"
  log "  Landing:   http://localhost:3003"
  log "  Grafana:   http://localhost:3100"
  log "  Uptime:    http://localhost:3200"
  log "═══════════════════════════════════════"
}

# ── Show logs ──
show_logs() {
  log "📋 Recent logs:"
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs --tail=20
}

# ── Stop ──
stop() {
  log "🛑 Stopping all services..."
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down
  log "✅ Stopped"
}

# ── Main ──
main() {
  echo -e "${BLUE}"
  echo "  ╔═══════════════════════════════════════╗"
  echo "  ║      SERVIX Deployment Script         ║"
  echo "  ╚═══════════════════════════════════════╝"
  echo -e "${NC}"
  
  case "${1:-}" in
    --build)
      check_prerequisites
      build_images
      ;;
    --migrate)
      check_prerequisites
      run_migrations
      ;;
    --restart)
      check_prerequisites
      deploy
      health_check
      ;;
    --stop)
      stop
      ;;
    --logs)
      show_logs
      ;;
    --status)
      docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
      ;;
    *)
      # Full deploy
      check_prerequisites
      build_images
      run_migrations
      deploy
      health_check
      ;;
  esac
}

main "$@"
