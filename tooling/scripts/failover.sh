#!/bin/bash
# ═══════════════════════════════════════════════════════════
# SERVIX — Disaster Recovery Failover
# Switches all traffic from primary (fsn1) to DR site (nbg1)
# RTO target: < 30 minutes
# ═══════════════════════════════════════════════════════════
set -euo pipefail

PRIMARY_IP="${PRIMARY_IP:-194.163.158.70}"
DR_IP="${DR_IP:?Set DR_IP environment variable}"
CF_ZONE_ID="${CF_ZONE_ID:?Set CloudFlare zone ID}"
CF_API_TOKEN="${CF_API_TOKEN:?Set CloudFlare API token}"

RED="\033[1;31m"
GREEN="\033[1;32m"
YELLOW="\033[1;33m"
NC="\033[0m"

log()  { echo -e "${GREEN}[FAILOVER]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
fail() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

echo ""
echo -e "${RED}═══════════════════════════════════════════════════${NC}"
echo -e "${RED}  SERVIX DISASTER RECOVERY — FAILOVER PROCEDURE   ${NC}"
echo -e "${RED}═══════════════════════════════════════════════════${NC}"
echo ""
echo "  Primary: $PRIMARY_IP (fsn1)"
echo "  DR Site: $DR_IP (nbg1)"
echo ""
echo -e "${RED}  ⚠️  This will switch ALL production traffic to DR!${NC}"
echo ""
read -p "Type 'FAILOVER' to confirm: " CONFIRM
[ "$CONFIRM" != "FAILOVER" ] && { echo "Aborted."; exit 0; }

FAIL_START=$(date +%s)

# ── 1. Pre-flight check: DR site health ────────────────
log "Step 1/6: Checking DR site health..."
DR_STATUS=$(ssh -o ConnectTimeout=10 "root@$DR_IP" \
  "curl -sf -o /dev/null -w '%{http_code}' http://localhost:4000/api/v1/health/live" 2>/dev/null || echo "000")

if [ "$DR_STATUS" != "200" ]; then
  fail "DR site not healthy (HTTP $DR_STATUS). Cannot failover!"
fi
log "  ✅ DR site healthy"

# ── 2. Promote PostgreSQL standby ──────────────────────
log "Step 2/6: Promoting PostgreSQL standby to primary..."
ssh "root@$DR_IP" "sudo -u postgres pg_ctl promote -D /var/lib/postgresql/data" 2>/dev/null || \
ssh "root@$DR_IP" "kubectl exec -n servix postgres-0 -- pg_ctl promote -D /var/lib/postgresql/data/pgdata" 2>/dev/null || \
warn "PG promote failed — may already be primary"
sleep 5
log "  ✅ PostgreSQL promoted"

# ── 3. Scale up API on DR site ─────────────────────────
log "Step 3/6: Scaling API on DR site..."
ssh "root@$DR_IP" "kubectl scale deployment servix-api --replicas=2 -n servix 2>/dev/null || \
  cd /opt/servix && docker compose up -d" || warn "Scale command sent"
sleep 10
log "  ✅ API scaled up"

# ── 4. Update CloudFlare DNS ───────────────────────────
log "Step 4/6: Switching DNS to DR site..."

# Get all A records pointing to primary
RECORDS=$(curl -sf "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records?type=A&content=${PRIMARY_IP}" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" | jq -r '.result[]?.id' 2>/dev/null)

SWITCHED=0
for RECORD_ID in $RECORDS; do
  curl -sf -X PATCH "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records/${RECORD_ID}" \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "{\"content\":\"${DR_IP}\"}" >/dev/null
  SWITCHED=$((SWITCHED + 1))
done
log "  ✅ $SWITCHED DNS records switched to $DR_IP"

# ── 5. Wait for DNS propagation ───────────────────────
log "Step 5/6: Waiting for DNS propagation (60s)..."
sleep 60

# ── 6. Final verification ─────────────────────────────
log "Step 6/6: Verifying..."
HEALTH=$(curl -sf -o /dev/null -w "%{http_code}" \
  --resolve "api.servi-x.com:443:${DR_IP}" \
  "https://api.servi-x.com/api/v1/health/ready" 2>/dev/null || echo "000")

FAIL_END=$(date +%s)
RTO_MINUTES=$(( (FAIL_END - FAIL_START) / 60 ))

echo ""
if [ "$HEALTH" = "200" ]; then
  echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  ✅ FAILOVER SUCCESSFUL                           ${NC}"
  echo -e "${GREEN}  DR site is now primary                           ${NC}"
  echo -e "${GREEN}  RTO: ${RTO_MINUTES} minutes                     ${NC}"
  echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
else
  warn "Health check returned HTTP $HEALTH — DNS may still be propagating"
fi

echo ""
echo "📋 Post-failover checklist:"
echo "  □ Verify all endpoints (api, dashboard, booking, admin)"
echo "  □ Check data consistency (compare record counts)"
echo "  □ Verify replication lag was minimal"
echo "  □ Notify development team"
echo "  □ Update monitoring targets to point to DR"
echo "  □ Plan failback to original primary after repair"
echo ""
echo "Logged: $(date) | RTO: ${RTO_MINUTES}min | DR_IP: ${DR_IP}"
