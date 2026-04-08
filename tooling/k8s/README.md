# SERVIX Kubernetes Deployment

## Architecture

```
┌──────────────────── K3s Cluster ────────────────────┐
│                                                      │
│  ┌─── Ingress (nginx + cert-manager TLS) ──────┐    │
│  │  api.servi-x.com → servix-api:4000          │    │
│  │  dashboard.servi-x.com → servix-dashboard   │    │
│  │  booking.servi-x.com → servix-booking       │    │
│  │  admin.servi-x.com → servix-admin           │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ┌─── API ──────────────────────────────────────┐    │
│  │  Deployment: 2-8 pods (HPA auto-scaling)     │    │
│  │  CPU target: 70% │ Memory target: 80%        │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ┌─── Data ─────────────────────────────────────┐    │
│  │  PostgreSQL 17 (StatefulSet + PgBouncer)     │    │
│  │  Redis HA (Sentinel: 1 master + 2 replicas)  │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ┌─── Network Policies ─────────────────────────┐    │
│  │  API ←→ PG/Redis/Jaeger only                 │    │
│  │  PG ← API only                               │    │
│  └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

## Prerequisites

- K3s installed (`curl -sfL https://get.k3s.io | sh -s - --disable traefik`)
- Helm 3.x for Redis HA chart
- cert-manager for automatic TLS

## Quick Start

```bash
# 1. Run migration script
bash tooling/scripts/migrate-to-k8s.sh

# 2. Verify
kubectl get all -n servix
kubectl get hpa -n servix
```

## Manual Deployment

```bash
kubectl create namespace servix
kubectl create secret generic servix-secrets --namespace servix --from-env-file=.env.production
kubectl apply -f tooling/k8s/postgres/
kubectl apply -f tooling/k8s/api/
kubectl apply -f tooling/k8s/ingress/
kubectl apply -f tooling/k8s/network-policies/
helm install redis bitnami/redis -n servix -f tooling/k8s/redis/values.yaml
```

## Manifests

| Directory | Files | Purpose |
|-----------|-------|---------|
| `api/` | deployment, service, hpa | API with auto-scaling |
| `postgres/` | statefulset, service | PostgreSQL + PgBouncer |
| `redis/` | values.yaml | Redis HA (Helm) |
| `ingress/` | ingress, cluster-issuer | TLS + routing |
| `network-policies/` | api, postgres | Network isolation |

## Useful Commands

```bash
# Scale manually
kubectl scale deployment servix-api --replicas=4 -n servix

# View logs
kubectl logs -l app=servix-api -n servix --tail=100 -f

# Exec into pod
kubectl exec -it deploy/servix-api -n servix -- sh

# View HPA status
kubectl describe hpa servix-api-hpa -n servix

# Rollback
kubectl rollout undo deployment/servix-api -n servix
```
