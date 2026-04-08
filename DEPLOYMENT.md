# SERVIX — Deployment Guide

## Table of Contents
- [Server Requirements](#server-requirements)
- [First Deploy](#first-deploy)
- [Environment Variables](#environment-variables)
- [Updates & Rolling Deploys](#updates--rolling-deploys)
- [Rollback](#rollback)
- [Backup & Restore](#backup--restore)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

---

## Server Requirements

| Component     | Minimum     | Recommended    |
|---------------|-------------|----------------|
| CPU           | 2 vCPU      | 4 vCPU         |
| RAM           | 4 GB        | 8 GB           |
| Storage       | 40 GB SSD   | 100 GB SSD     |
| OS            | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| Docker        | 24.x        | 27.x           |
| Docker Compose| v2.20+      | v2.30+         |

### Required Ports
| Port | Service         | Access    |
|------|-----------------|-----------|
| 80   | HTTP (Nginx)    | Public    |
| 443  | HTTPS (Nginx)   | Public    |
| 5432 | PostgreSQL      | Internal  |
| 6379 | Redis           | Internal  |
| 4000 | API             | Internal  |
| 3000 | Dashboard       | Internal  |
| 3001 | Booking         | Internal  |
| 3002 | Admin           | Internal  |
| 9090 | Prometheus      | Internal  |
| 3100 | Grafana         | Internal* |
| 3200 | Uptime Kuma     | Internal* |

> *Optionally expose Grafana/Uptime Kuma behind nginx with auth.

---

## First Deploy

### 1. Clone & Configure

```bash
# Clone repository
git clone git@github.com:your-org/servix.git
cd servix

# Copy environment template
cp .env.example .env

# Edit all values (see Environment Variables section)
nano .env
```

### 2. Generate Secrets

```bash
# Generate JWT secrets
openssl rand -base64 64  # → JWT_ACCESS_SECRET
openssl rand -base64 64  # → JWT_REFRESH_SECRET

# Generate Postgres password
openssl rand -base64 32  # → POSTGRES_PASSWORD

# Generate Redis password
openssl rand -base64 32  # → REDIS_PASSWORD
```

### 3. SSL Certificates

```bash
mkdir -p tooling/docker/nginx/ssl

# Using Certbot (Let's Encrypt)
sudo certbot certonly --standalone \
  -d api.servi-x.com \
  -d app.servi-x.com \
  -d booking.servi-x.com \
  -d admin.servi-x.com \
  -d servi-x.com

# Copy certs
sudo cp /etc/letsencrypt/live/servi-x.com/fullchain.pem tooling/docker/nginx/ssl/
sudo cp /etc/letsencrypt/live/servi-x.com/privkey.pem tooling/docker/nginx/ssl/
```

### 4. Build & Launch

```bash
cd tooling/docker

# Build all images
docker compose -f docker-compose.prod.yml build

# Start infrastructure first
docker compose -f docker-compose.prod.yml up -d postgres redis

# Wait for health checks
sleep 10

# Run database migrations
docker compose -f docker-compose.prod.yml run --rm api \
  npx prisma migrate deploy --schema=prisma/platform/schema.prisma

# Start all services
docker compose -f docker-compose.prod.yml up -d

# Verify
docker compose -f docker-compose.prod.yml ps
```

### 5. Verify Health

```bash
# API health check
curl -s https://api.servi-x.com/api/v1/health/live

# All containers running
docker compose -f docker-compose.prod.yml ps --format "table {{.Name}}\t{{.Status}}"
```

---

## Environment Variables

| Variable              | Required | Example                                    | Description                          |
|-----------------------|----------|--------------------------------------------|--------------------------------------|
| `POSTGRES_USER`       | ✅       | `servix`                                   | PostgreSQL admin user                |
| `POSTGRES_PASSWORD`   | ✅       | `<random-64-char>`                         | PostgreSQL password                  |
| `POSTGRES_DB`         | ✅       | `servix_platform`                          | Platform database name               |
| `REDIS_PASSWORD`      | ✅       | `<random-32-char>`                         | Redis password                       |
| `JWT_ACCESS_SECRET`   | ✅       | `<random-64-char>`                         | JWT access token secret              |
| `JWT_REFRESH_SECRET`  | ✅       | `<random-64-char>`                         | JWT refresh token secret             |
| `CORS_ORIGINS`        | ✅       | `https://app.servi-x.com,...`              | Comma-separated CORS origins         |
| `API_URL`             | ✅       | `https://api.servi-x.com/api/v1`           | Public API base URL                  |
| `WS_URL`              | ✅       | `https://api.servi-x.com`                  | WebSocket URL                        |
| `MINIO_ROOT_USER`     | ✅       | `servix-admin`                             | MinIO admin user                     |
| `MINIO_ROOT_PASSWORD` | ✅       | `<random-32-char>`                         | MinIO admin password                 |
| `SENTRY_DSN`          | ❌       | `https://xxx@sentry.io/xxx`                | Sentry error tracking DSN            |
| `NODE_ENV`            | ✅       | `production`                               | Always `production` in prod          |

---

## Updates & Rolling Deploys

```bash
cd /path/to/servix

# 1. Pull latest code
git pull origin main

# 2. Build new images
docker compose -f tooling/docker/docker-compose.prod.yml build

# 3. Run migrations (if any)
docker compose -f tooling/docker/docker-compose.prod.yml run --rm api \
  npx prisma migrate deploy --schema=prisma/platform/schema.prisma

# 4. Rolling restart (zero downtime)
docker compose -f tooling/docker/docker-compose.prod.yml up -d --no-deps api
sleep 15  # Wait for health check
docker compose -f tooling/docker/docker-compose.prod.yml up -d --no-deps dashboard
docker compose -f tooling/docker/docker-compose.prod.yml up -d --no-deps booking
docker compose -f tooling/docker/docker-compose.prod.yml up -d --no-deps admin

# 5. Verify health
docker compose -f tooling/docker/docker-compose.prod.yml ps
curl -s https://api.servi-x.com/api/v1/health/live
```

---

## Rollback

### Quick Rollback (previous image)

```bash
# 1. Stop current version
docker compose -f tooling/docker/docker-compose.prod.yml stop api dashboard booking admin

# 2. Checkout previous commit
git checkout HEAD~1

# 3. Rebuild and start
docker compose -f tooling/docker/docker-compose.prod.yml build api dashboard booking admin
docker compose -f tooling/docker/docker-compose.prod.yml up -d
```

### Database Rollback

> ⚠️ Database rollbacks are destructive. Always take a backup first.

```bash
# Backup current state first
docker exec servix-postgres pg_dump -U servix servix_platform > pre_rollback_backup.sql

# Rollback one migration (use with caution)
docker compose -f tooling/docker/docker-compose.prod.yml run --rm api \
  npx prisma migrate resolve --rolled-back <migration_name> \
  --schema=prisma/platform/schema.prisma
```

---

## Backup & Restore

### Automated Backups

The `backup` service runs `pg_dump` every 6 hours automatically via cron.

Backups are stored in the `backup_data` Docker volume.

```bash
# Check backup logs
docker logs servix-backup --tail 20

# List backups
docker exec servix-backup ls -la /backups/

# Manual backup trigger
docker exec servix-backup /bin/sh /scripts/backup.sh
```

### Manual Backup

```bash
# Full platform database
docker exec servix-postgres pg_dump \
  -U servix \
  -Fc \
  servix_platform > servix_platform_$(date +%Y%m%d_%H%M%S).dump

# All tenant databases
for db in $(docker exec servix-postgres psql -U servix -tAc \
  "SELECT datname FROM pg_database WHERE datname LIKE 'servix_tenant_%'"); do
  docker exec servix-postgres pg_dump -U servix -Fc "$db" > "${db}_$(date +%Y%m%d_%H%M%S).dump"
done
```

### Restore

```bash
# Restore platform
docker exec -i servix-postgres pg_restore \
  -U servix \
  -d servix_platform \
  --clean --if-exists \
  < servix_platform_backup.dump

# Restore specific tenant
docker exec -i servix-postgres pg_restore \
  -U servix \
  -d servix_tenant_xyz \
  --clean --if-exists \
  < servix_tenant_xyz_backup.dump
```

---

## Monitoring

### Health Endpoints

| Endpoint                              | Purpose              |
|---------------------------------------|----------------------|
| `GET /api/v1/health/live`             | Liveness probe       |
| `GET /api/v1/health/ready`            | Readiness probe      |
| `GET /metrics`                        | Prometheus metrics   |

### Prometheus + Grafana

Access Grafana at `http://SERVER:3100` (default credentials: `admin/servix2026`).

Pre-configured dashboards:
- **System Overview**: HTTP request rate, latency, error rate
- **Tenant Pool**: Connection pool size, cache hit ratio
- **BullMQ Jobs**: Queue depth, processing time, DLQ count

### Uptime Kuma

Access at `http://SERVER:3200`.

Pre-configured monitors:
- API Health (`/api/v1/health/live`)
- Dashboard, Booking, Admin frontends
- PostgreSQL connectivity
- Redis connectivity

---

## Troubleshooting

### Container won't start

```bash
# Check logs
docker logs servix-api --tail 100

# Check for port conflicts
docker compose -f tooling/docker/docker-compose.prod.yml ps

# Rebuild from scratch
docker compose -f tooling/docker/docker-compose.prod.yml down
docker compose -f tooling/docker/docker-compose.prod.yml build --no-cache
docker compose -f tooling/docker/docker-compose.prod.yml up -d
```

### Database connection issues

```bash
# Test direct connection
docker exec servix-postgres psql -U servix -d servix_platform -c "SELECT 1"

# Check PgBouncer stats
docker exec servix-pgbouncer pgbouncer -d /etc/pgbouncer/pgbouncer.ini

# Check connection count
docker exec servix-postgres psql -U servix -c "SELECT count(*) FROM pg_stat_activity"
```

### Redis connection issues

```bash
# Test Redis
docker exec servix-redis redis-cli -a ${REDIS_PASSWORD} ping

# Check memory usage
docker exec servix-redis redis-cli -a ${REDIS_PASSWORD} info memory
```

### High memory / CPU

```bash
# Check resource usage
docker stats --no-stream

# Check for memory leaks in API
docker exec servix-api node -e "console.log(process.memoryUsage())"

# Restart heavy services
docker compose -f tooling/docker/docker-compose.prod.yml restart api
```

### SSL Certificate renewal

```bash
# Renew with certbot
sudo certbot renew

# Copy new certs
sudo cp /etc/letsencrypt/live/servi-x.com/fullchain.pem tooling/docker/nginx/ssl/
sudo cp /etc/letsencrypt/live/servi-x.com/privkey.pem tooling/docker/nginx/ssl/

# Reload nginx
docker exec servix-nginx nginx -s reload
```
