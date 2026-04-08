#!/bin/bash
# ═══════════════════════════════════════════════════════════
# SERVIX Environment Comparison
# Verifies staging matches production 1:1
# ═══════════════════════════════════════════════════════════
set -euo pipefail

STAGING_COMPOSE="tooling/docker/docker-compose.staging.yml"
PROD_COMPOSE="tooling/docker/docker-compose.prod.yml"
GREEN="\033[1;32m"
RED="\033[1;31m"
NC="\033[0m"

echo "═══ Comparing Staging vs Production ═══"
echo ""

# ── Docker Images ──────────────────────────────────────────
echo "📦 Docker Images:"
STAGING_IMAGES=$(docker compose -f "$STAGING_COMPOSE" config --images 2>/dev/null | sort || echo "N/A")
PROD_IMAGES=$(docker compose -f "$PROD_COMPOSE" config --images 2>/dev/null | sort || echo "N/A")

if [ "$STAGING_IMAGES" = "$PROD_IMAGES" ]; then
  echo -e "  ${GREEN}✅ Images match${NC}"
else
  echo -e "  ${RED}❌ Image mismatch:${NC}"
  diff <(echo "$STAGING_IMAGES") <(echo "$PROD_IMAGES") || true
fi
echo ""

# ── Service Counts ─────────────────────────────────────────
echo "🐳 Service Counts:"
STAGING_COUNT=$(docker compose -f "$STAGING_COMPOSE" config --services 2>/dev/null | wc -l || echo "0")
PROD_COUNT=$(docker compose -f "$PROD_COMPOSE" config --services 2>/dev/null | wc -l || echo "0")
echo "  Staging:    $STAGING_COUNT services"
echo "  Production: $PROD_COUNT services"

if [ "$STAGING_COUNT" -eq "$PROD_COUNT" ]; then
  echo -e "  ${GREEN}✅ Service count matches${NC}"
else
  echo -e "  ${RED}⚠️  Service count differs${NC}"
fi
echo ""

# ── Environment Variables ──────────────────────────────────
echo "🔑 Environment Variable Keys (only differences):"
STAGING_KEYS=$(docker compose -f "$STAGING_COMPOSE" config 2>/dev/null | grep -oP '^\s+\K[A-Z_]+(?=:)' | sort -u || echo "")
PROD_KEYS=$(docker compose -f "$PROD_COMPOSE" config 2>/dev/null | grep -oP '^\s+\K[A-Z_]+(?=:)' | sort -u || echo "")

MISSING_IN_STAGING=$(comm -23 <(echo "$PROD_KEYS") <(echo "$STAGING_KEYS"))
if [ -z "$MISSING_IN_STAGING" ]; then
  echo -e "  ${GREEN}✅ All production env vars exist in staging${NC}"
else
  echo -e "  ${RED}❌ Missing in staging:${NC}"
  echo "$MISSING_IN_STAGING" | sed 's/^/    /'
fi
echo ""

# ── Volume Comparison ──────────────────────────────────────
echo "💾 Volumes:"
STAGING_VOLS=$(docker compose -f "$STAGING_COMPOSE" config --volumes 2>/dev/null | sort || echo "N/A")
PROD_VOLS=$(docker compose -f "$PROD_COMPOSE" config --volumes 2>/dev/null | sort || echo "N/A")
echo "  Staging:    $(echo "$STAGING_VOLS" | wc -l) volumes"
echo "  Production: $(echo "$PROD_VOLS" | wc -l) volumes"
echo ""

echo "═══ Comparison complete ═══"
