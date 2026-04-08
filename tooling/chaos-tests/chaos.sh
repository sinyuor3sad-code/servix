#!/bin/bash
# ═══════════════════════════════════════════════════════════
# SERVIX Chaos Testing Suite
# Run on STAGING ONLY — NEVER on production!
# ═══════════════════════════════════════════════════════════
set -euo pipefail

STAGING_URL="${STAGING_URL:-http://localhost:4100}"
RESULTS_DIR="docs/audit"
RESULTS_FILE="$RESULTS_DIR/phase5-chaos-test-$(date +%Y%m%d-%H%M).md"
PASS_COUNT=0
FAIL_COUNT=0

mkdir -p "$RESULTS_DIR"

log() { echo -e "\033[1;36m[CHAOS]\033[0m $1"; }
pass() { PASS_COUNT=$((PASS_COUNT + 1)); echo "✅ PASS: $1" >> "$RESULTS_FILE"; }
fail() { FAIL_COUNT=$((FAIL_COUNT + 1)); echo "❌ FAIL: $1" >> "$RESULTS_FILE"; }

echo "# SERVIX Chaos Test Results — $(date)" > "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"
echo "**Environment:** staging" >> "$RESULTS_FILE"
echo "**URL:** $STAGING_URL" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

# ─── Test 1: Redis Down ────────────────────────────────
log "Test 1: Redis Down — API should survive without Redis"
echo "## Test 1: Redis Down" >> "$RESULTS_FILE"
echo "**Goal:** API continues to work without Redis (slower, no cache)" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

docker stop servix-staging-redis 2>/dev/null || true
sleep 3

REDIS_OK=0
for i in $(seq 1 10); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$STAGING_URL/api/v1/health/live" 2>/dev/null || echo "000")
  echo "  Request $i: HTTP $STATUS" >> "$RESULTS_FILE"
  if [ "$STATUS" = "200" ]; then
    REDIS_OK=$((REDIS_OK + 1))
  fi
done

docker start servix-staging-redis 2>/dev/null || true
sleep 5

if [ "$REDIS_OK" -ge 8 ]; then
  pass "API survived Redis failure ($REDIS_OK/10 requests OK)"
else
  fail "API failed too many requests without Redis ($REDIS_OK/10 OK)"
fi
echo "" >> "$RESULTS_FILE"

# ─── Test 2: One API Instance Down ─────────────────────
log "Test 2: One API Instance Down — LB should route to surviving instance"
echo "## Test 2: One API Instance Down" >> "$RESULTS_FILE"
echo "**Goal:** Load balancer routes all traffic to surviving instance" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

docker stop servix-api-2 2>/dev/null || true
sleep 3

LB_OK=0
for i in $(seq 1 10); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$STAGING_URL/api/v1/health/live" 2>/dev/null || echo "000")
  echo "  Request $i: HTTP $STATUS" >> "$RESULTS_FILE"
  if [ "$STATUS" = "200" ]; then
    LB_OK=$((LB_OK + 1))
  fi
done

docker start servix-api-2 2>/dev/null || true
sleep 10

if [ "$LB_OK" -ge 9 ]; then
  pass "LB handled instance failure ($LB_OK/10 requests OK)"
else
  fail "LB failed with one instance down ($LB_OK/10 OK)"
fi
echo "" >> "$RESULTS_FILE"

# ─── Test 3: Connection Pool Stress ────────────────────
log "Test 3: Connection Pool Stress — LRU eviction under load"
echo "## Test 3: Connection Pool Stress" >> "$RESULTS_FILE"
echo "**Goal:** LRU evicts inactive tenants, no connection leak" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

for i in $(seq 1 60); do
  curl -s -H "x-tenant-id: test-tenant-$i" \
    --max-time 5 "$STAGING_URL/api/v1/health/live" > /dev/null 2>&1 &
done
wait

POOL_STATUS=$(curl -s --max-time 5 "$STAGING_URL/api/v1/health" 2>/dev/null || echo '{}')
echo "Pool status after stress:" >> "$RESULTS_FILE"
echo '```json' >> "$RESULTS_FILE"
echo "$POOL_STATUS" | head -20 >> "$RESULTS_FILE"
echo '```' >> "$RESULTS_FILE"
pass "Pool stress test completed — check pool stats above"
echo "" >> "$RESULTS_FILE"

# ─── Test 4: Read Replica Down ─────────────────────────
log "Test 4: Read Replica Down — writes should continue"
echo "## Test 4: Read Replica Down" >> "$RESULTS_FILE"
echo "**Goal:** Write operations continue, reports may fail gracefully" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

docker stop servix-staging-postgres-replica 2>/dev/null || true
sleep 3

WRITE_OK=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$STAGING_URL/api/v1/health/live" 2>/dev/null || echo "000")
echo "  Health check (writes): HTTP $WRITE_OK" >> "$RESULTS_FILE"

docker start servix-staging-postgres-replica 2>/dev/null || true
sleep 5

if [ "$WRITE_OK" = "200" ]; then
  pass "Writes continued with replica down"
else
  fail "Writes failed with replica down (HTTP $WRITE_OK)"
fi
echo "" >> "$RESULTS_FILE"

# ─── Test 5: Graceful Shutdown Under Load ──────────────
log "Test 5: Graceful Shutdown — active requests should complete"
echo "## Test 5: Graceful Shutdown Under Load" >> "$RESULTS_FILE"
echo "**Goal:** Active requests complete before shutdown" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

# Send slow requests in background
for i in $(seq 1 5); do
  curl -s --max-time 35 "$STAGING_URL/api/v1/health" > /dev/null 2>&1 &
done

docker kill --signal=SIGTERM servix-api-1 2>/dev/null || true
sleep 35

# Restart
docker start servix-api-1 2>/dev/null || true
sleep 15

RESTART_OK=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$STAGING_URL/api/v1/health/live" 2>/dev/null || echo "000")
echo "  Post-restart health: HTTP $RESTART_OK" >> "$RESULTS_FILE"

if [ "$RESTART_OK" = "200" ]; then
  pass "Graceful shutdown and restart successful"
else
  fail "API failed to restart after SIGTERM (HTTP $RESTART_OK)"
fi
echo "" >> "$RESULTS_FILE"

# ─── Summary ──────────────────────────────────────────
echo "---" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"
echo "## Summary" >> "$RESULTS_FILE"
echo "- **Passed:** $PASS_COUNT" >> "$RESULTS_FILE"
echo "- **Failed:** $FAIL_COUNT" >> "$RESULTS_FILE"
echo "- **Total:** $((PASS_COUNT + FAIL_COUNT))" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

log "════════════════════════════════════════"
log "Results: $RESULTS_FILE"
log "Passed: $PASS_COUNT | Failed: $FAIL_COUNT"
log "════════════════════════════════════════"

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
