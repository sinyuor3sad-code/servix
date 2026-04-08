#!/bin/bash
# ═══════════════════════════════════════════════════════════
# SERVIX — Monthly Chaos Engineering
# Run on STAGING first Wednesday of each month
# ═══════════════════════════════════════════════════════════
set -euo pipefail

NAMESPACE="servix"
REPORT_DIR="docs/audit"
REPORT_FILE="$REPORT_DIR/chaos-$(date +%Y%m).md"

echo "═══ Monthly Chaos Engineering — $(date) ═══"
echo ""

mkdir -p "$REPORT_DIR"
echo "# Chaos Test Report — $(date '+%B %Y')" > "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "Date: $(date)" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

TESTS_PASSED=0
TESTS_FAILED=0

run_test() {
  local NAME="$1"
  local DESCRIPTION="$2"
  
  echo "── Test: $NAME ──"
  echo "   $DESCRIPTION"
  echo "## $NAME" >> "$REPORT_FILE"
  echo "$DESCRIPTION" >> "$REPORT_FILE"
  echo "" >> "$REPORT_FILE"
}

check_health() {
  local MAX_WAIT="${1:-30}"
  for i in $(seq 1 "$MAX_WAIT"); do
    if kubectl exec -n "$NAMESPACE" deploy/servix-api -- \
      curl -sf http://localhost:4000/api/v1/health/live >/dev/null 2>&1; then
      echo "   ✅ Health restored (${i}s)"
      echo "Result: ✅ PASS (recovered in ${i}s)" >> "$REPORT_FILE"
      TESTS_PASSED=$((TESTS_PASSED + 1))
      echo "" >> "$REPORT_FILE"
      return 0
    fi
    sleep 1
  done
  echo "   ❌ Health check failed after ${MAX_WAIT}s"
  echo "Result: ❌ FAIL (did not recover in ${MAX_WAIT}s)" >> "$REPORT_FILE"
  TESTS_FAILED=$((TESTS_FAILED + 1))
  echo "" >> "$REPORT_FILE"
  return 1
}

# ── Test 1: Kill API Pod ─────────────────────────────────
run_test "kill-api-pod" "Delete a random API pod — K8s should replace it automatically"
API_POD=$(kubectl get pod -l app=servix-api -n "$NAMESPACE" -o jsonpath='{.items[0].metadata.name}')
kubectl delete pod "$API_POD" -n "$NAMESPACE" --wait=false
sleep 5
echo "   Pods after delete:"
kubectl get pods -l app=servix-api -n "$NAMESPACE" --no-headers | sed 's/^/   /'
check_health 60

# ── Test 2: Kill Redis Master ────────────────────────────
run_test "kill-redis-master" "Delete Redis master — Sentinel should promote a replica"
kubectl delete pod redis-master-0 -n "$NAMESPACE" --wait=false 2>/dev/null || echo "   (Redis master pod not found — skipping)"
sleep 15
check_health 45

# ── Test 3: CPU Stress ──────────────────────────────────
run_test "cpu-stress" "4-core stress test for 20 seconds — test HPA scaling"
kubectl exec -n "$NAMESPACE" deploy/servix-api -- \
  timeout 20 dd if=/dev/urandom of=/dev/null bs=1M 2>/dev/null || true
sleep 5
echo "   HPA status:"
kubectl get hpa -n "$NAMESPACE" --no-headers 2>/dev/null | sed 's/^/   /' || echo "   (HPA not configured)"
check_health 30

# ── Test 4: DNS Resolution Check ────────────────────────
run_test "dns-resolution" "Verify internal DNS resolves correctly"
DNS_OK=$(kubectl exec -n "$NAMESPACE" deploy/servix-api -- \
  nslookup postgres.$NAMESPACE.svc.cluster.local 2>/dev/null | grep -c "Address" || echo "0")
if [ "$DNS_OK" -gt 1 ]; then
  echo "   ✅ DNS resolves correctly"
  echo "Result: ✅ PASS" >> "$REPORT_FILE"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo "   ❌ DNS resolution failed"
  echo "Result: ❌ FAIL" >> "$REPORT_FILE"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo "" >> "$REPORT_FILE"

# ── Test 5: Rolling Restart ──────────────────────────────
run_test "rolling-restart" "Trigger rolling restart — zero downtime expected"
kubectl rollout restart deployment/servix-api -n "$NAMESPACE"
sleep 10
check_health 90

# ── Summary ──────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════"
echo "  Results: $TESTS_PASSED passed, $TESTS_FAILED failed"
echo "  Report: $REPORT_FILE"
echo "═══════════════════════════════════════════════"

echo "" >> "$REPORT_FILE"
echo "---" >> "$REPORT_FILE"
echo "**Summary**: $TESTS_PASSED passed, $TESTS_FAILED failed" >> "$REPORT_FILE"
