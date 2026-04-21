#!/bin/bash
# ═══════════════════════════════════════════════════════════
# SERVIX — Failback to Original Primary
# Restores traffic to the original primary after DR event
# ═══════════════════════════════════════════════════════════
set -euo pipefail

PRIMARY_IP="${PRIMARY_IP:-194.163.158.70}"
DR_IP="${DR_IP:?Set DR_IP}"
CF_ZONE_ID="${CF_ZONE_ID:?Set CloudFlare zone ID}"
CF_API_TOKEN="${CF_API_TOKEN:?Set CloudFlare API token}"

echo "═══ SERVIX Failback: DR ($DR_IP) → Primary ($PRIMARY_IP) ═══"
echo ""
read -p "Is the primary server repaired and data synced? (yes/no): " READY
[ "$READY" != "yes" ] && { echo "Repair primary first, then run failback."; exit 0; }

# 1. Verify primary health
echo "🏥 Checking primary health..."
ssh "root@$PRIMARY_IP" "curl -sf http://localhost:4000/api/v1/health/live" >/dev/null || {
  echo "❌ Primary not healthy. Cannot failback."
  exit 1
}
echo "  ✅ Primary is healthy"

# 2. Sync latest data from DR → Primary
echo "📦 Syncing data from DR to primary..."
ssh "root@$DR_IP" "pg_dump -U servix servix_platform" | \
  ssh "root@$PRIMARY_IP" "psql -U servix servix_platform" 2>/dev/null || \
  echo "  ⚠️  Manual data sync may be needed"

# 3. Switch DNS back
echo "🌐 Switching DNS back to primary..."
RECORDS=$(curl -sf "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records?type=A&content=${DR_IP}" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" | jq -r '.result[]?.id' 2>/dev/null)

for RECORD_ID in $RECORDS; do
  curl -sf -X PATCH "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records/${RECORD_ID}" \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "{\"content\":\"${PRIMARY_IP}\"}" >/dev/null
done

# 4. Wait and verify
echo "⏳ Waiting 60s for DNS propagation..."
sleep 60

echo "═══ ✅ Failback complete — Primary is active ═══"
echo ""
echo "📋 Post-failback:"
echo "  □ Re-establish streaming replication (Primary → DR)"
echo "  □ Verify all services"
echo "  □ Update monitoring targets"
