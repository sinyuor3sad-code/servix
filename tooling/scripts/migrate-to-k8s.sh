#!/bin/bash
# ═══════════════════════════════════════════════════════════
# SERVIX — Docker Compose to K3s Migration Script
# ═══════════════════════════════════════════════════════════
set -euo pipefail

GREEN="\033[1;32m"
YELLOW="\033[1;33m"
RED="\033[1;31m"
NC="\033[0m"

log()  { echo -e "${GREEN}[MIGRATE]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
fail() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

K8S_DIR="$(cd "$(dirname "$0")/../k8s" && pwd)"

echo "═══════════════════════════════════════════════"
echo "  SERVIX Migration: Docker Compose → K3s"
echo "═══════════════════════════════════════════════"
echo ""

# ── Pre-flight checks ────────────────────────────────────
log "Pre-flight checks..."
command -v kubectl >/dev/null 2>&1 || fail "kubectl not found. Install K3s first."
kubectl get nodes >/dev/null 2>&1 || fail "K3s cluster not reachable."
log "  ✅ K3s cluster accessible"

# ── 1. Create namespace ──────────────────────────────────
log "Creating namespace..."
kubectl create namespace servix --dry-run=client -o yaml | kubectl apply -f -

# ── 2. Create secrets (must exist before deployments) ────
log "Creating secrets..."
if kubectl get secret servix-secrets -n servix >/dev/null 2>&1; then
  warn "Secrets already exist — skipping (delete and recreate if needed)"
else
  echo ""
  echo "  ⚠️  Create secrets manually:"
  echo "  kubectl create secret generic servix-secrets \\"
  echo "    --namespace servix \\"
  echo "    --from-literal=DB_USER=servix \\"
  echo "    --from-literal=DB_PASSWORD='<password>' \\"
  echo "    --from-literal=DATABASE_URL='postgresql://servix:<pass>@postgres:6432/servix_platform' \\"
  echo "    --from-literal=REDIS_URL='redis://:pass@redis-master:6379' \\"
  echo "    --from-literal=JWT_SECRET='<secret>' \\"
  echo "    --from-literal=JWT_REFRESH_SECRET='<secret>' \\"
  echo "    --from-literal=ENCRYPTION_KEY='<32-char-key>' \\"
  echo "    --from-literal=MOYASAR_API_KEY='<key>'"
  echo ""
  read -p "Press Enter after creating secrets, or Ctrl+C to abort..."
fi

# ── 3. Deploy PostgreSQL ─────────────────────────────────
log "Deploying PostgreSQL StatefulSet..."
kubectl apply -f "$K8S_DIR/postgres/"
log "  ⏳ Waiting for PostgreSQL to be ready..."
kubectl wait --for=condition=ready pod -l app=postgres -n servix --timeout=180s
log "  ✅ PostgreSQL is ready"

# ── 4. Deploy Redis HA ───────────────────────────────────
log "Deploying Redis HA (Sentinel)..."
if helm status redis -n servix >/dev/null 2>&1; then
  warn "Redis already installed — skipping"
else
  helm repo add bitnami https://charts.bitnami.com/bitnami 2>/dev/null || true
  helm repo update
  helm install redis bitnami/redis --namespace servix -f "$K8S_DIR/redis/values.yaml"
fi
log "  ⏳ Waiting for Redis..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=redis -n servix --timeout=180s
log "  ✅ Redis is ready"

# ── 5. Migrate data from Docker ──────────────────────────
log "Data migration..."
if docker ps --format '{{.Names}}' | grep -q servix-postgres; then
  warn "Docker PostgreSQL found — dumping data..."
  docker exec servix-postgres pg_dump -U servix servix_platform > /tmp/servix-k8s-migration.sql
  
  PG_POD=$(kubectl get pod -l app=postgres -n servix -o jsonpath='{.items[0].metadata.name}')
  kubectl cp /tmp/servix-k8s-migration.sql "servix/$PG_POD:/tmp/servix-dump.sql"
  kubectl exec -n servix "$PG_POD" -- psql -U servix servix_platform -f /tmp/servix-dump.sql
  log "  ✅ Data migrated"
else
  warn "Docker PostgreSQL not running — skipping data migration"
fi

# ── 6. Deploy API ────────────────────────────────────────
log "Deploying API..."
kubectl apply -f "$K8S_DIR/api/"
log "  ⏳ Waiting for API pods..."
kubectl wait --for=condition=ready pod -l app=servix-api -n servix --timeout=180s
log "  ✅ API is ready"

# ── 7. Deploy Ingress ────────────────────────────────────
log "Deploying Ingress..."
kubectl apply -f "$K8S_DIR/ingress/"

# ── 8. Apply Network Policies ────────────────────────────
log "Applying Network Policies..."
kubectl apply -f "$K8S_DIR/network-policies/"

# ── 9. Health check ──────────────────────────────────────
log "Running health check..."
API_POD=$(kubectl get pod -l app=servix-api -n servix -o jsonpath='{.items[0].metadata.name}')
if kubectl exec -n servix "$API_POD" -- curl -sf http://localhost:4000/api/v1/health/live >/dev/null 2>&1; then
  log "  ✅ API health check passed"
else
  warn "API health check failed — check logs: kubectl logs $API_POD -n servix"
fi

# ── Summary ──────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════"
echo "  ✅ Migration Complete!"
echo "═══════════════════════════════════════════════"
echo ""
echo "Pods:"
kubectl get pods -n servix
echo ""
echo "Services:"
kubectl get svc -n servix
echo ""
echo "HPA:"
kubectl get hpa -n servix
echo ""
echo "📋 Post-migration checklist:"
echo "  □ Verify all endpoints are responding"
echo "  □ Run E2E tests against K8s endpoints"
echo "  □ Test HPA with load test (k6)"
echo "  □ Keep Docker Compose ready for rollback (1 week)"
echo "  □ Update CI/CD to deploy to K8s"
