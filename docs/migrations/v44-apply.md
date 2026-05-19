# V-44 / A1-012 — Decimal widening runbook

**Severity:** HIGH (P1) — schema-only, no data movement.
**Author:** Engineer 2 (Database).
**Created:** 2026-05-19.
**Audit source:** `docs/principal-audit/synthesis-2026-05-14.md`.

## What this migration does

Widens four accumulator Decimal columns from their current precision to `NUMERIC(14, 2)` (max ≈ 999B SAR per row):

| Schema | Table | Column | From → To |
|---|---|---|---|
| tenant | `clients` | `total_spent` | `NUMERIC(10, 2)` → **`NUMERIC(14, 2)`** |
| tenant | `campaigns` | `revenue` | `NUMERIC(10, 2)` → **`NUMERIC(14, 2)`** |
| tenant | `client_dna` | `predicted_clv` | `NUMERIC(10, 2)` → **`NUMERIC(14, 2)`** |
| platform | `tenant_usage_logs` | `total_revenue` | `NUMERIC(12, 2)` → **`NUMERIC(14, 2)`** |

`ALTER COLUMN TYPE NUMERIC(p', s)` with the same scale (`s = 2`) and increased precision is **metadata-only** on PostgreSQL ≥ 9.2 — no table rewrite, only a brief `AccessExclusiveLock` for the catalog update. Safe to run any time.

Also lands in the same commit but does not require runbook execution:
- A new ESLint plugin `@servix/eslint-plugin-servix` exposing `no-decimal-to-number`. Currently severity `warn`; flip to `error` once Engineer 4 cleans the 6 pre-existing call sites (see V-44b follow-up).

## Pre-conditions

- [ ] Backup verification (Step 0).
- [ ] SSH access to the prod VM.
- [ ] Engineer 1 reachable.

## Step 0 — Verify a fresh backup exists (<1h old)

```bash
ssh servix-admin@194.163.158.70 << 'EOF'
  set -e
  sudo ls -lh /var/backups/postgres/ | tail -5
  for f in $(sudo ls /var/backups/postgres/latest-platform.sql.gz \
                     /var/backups/postgres/latest-tenant-*.sql.gz 2>/dev/null); do
    sudo gzip -t "$f" && echo "  OK: $f" || echo "  FAILED: $f"
  done
  sudo find /var/backups/postgres/ -name 'latest-*.sql.gz' -mmin -60 -print
EOF
```

## Step 1 — Apply on platform DB

```bash
ssh servix-admin@194.163.158.70 << 'EOF'
  set -e
  SQL=/tmp/v44_platform.sql
  sudo docker cp \
    /home/servix-admin/servix/apps/api/prisma/platform-migrations/20260519_v44_decimal_widening.sql \
    servix-postgres:$SQL
  sudo docker exec -e PGOPTIONS='--client-min-messages=warning' servix-postgres \
    psql -U servix -d servix_platform -v ON_ERROR_STOP=1 -f $SQL
  sudo docker exec servix-postgres psql -U servix -d servix_platform -tAc "
    SELECT 'tenant_usage_logs.total_revenue precision=' || numeric_precision
    FROM information_schema.columns
    WHERE table_name='tenant_usage_logs' AND column_name='total_revenue';"
EOF
```

**Expected:** `tenant_usage_logs.total_revenue precision=14`.

## Step 2 — Apply on active tenant DBs

```bash
ssh servix-admin@194.163.158.70 << 'EOF'
  set -e
  TENANT_DBS=(
    servix_tenant_d0f48d47
    servix_tenant_test_ai_reception
  )
  SQL=/tmp/v44_tenant.sql
  sudo docker cp \
    /home/servix-admin/servix/apps/api/prisma/migrations/20260519_v44_decimal_widening/migration.sql \
    servix-postgres:$SQL
  for db in "${TENANT_DBS[@]}"; do
    echo "=== Applying to $db ==="
    sudo docker exec -e PGOPTIONS='--client-min-messages=warning' servix-postgres \
      psql -U servix -d "$db" -v ON_ERROR_STOP=1 -f $SQL
    sudo docker exec servix-postgres psql -U servix -d "$db" -tAc "
      SELECT column_name || ' precision=' || numeric_precision
      FROM information_schema.columns
      WHERE table_name IN ('clients','campaigns','client_dna')
        AND column_name IN ('total_spent','revenue','predicted_clv')
      ORDER BY column_name;"
  done
EOF
```

**Expected per tenant:** three lines `…precision=14`.

## Step 3 — Register migration in Prisma history (tenant DBs only)

```bash
for db in servix_tenant_d0f48d47 servix_tenant_test_ai_reception; do
  export TENANT_DATABASE_URL="postgresql://servix:<PASSWORD>@194.163.158.70:5432/$db"
  pnpm --filter @servix/api exec prisma migrate resolve \
    --applied 20260519_v44_decimal_widening \
    --schema=apps/api/prisma/tenant.prisma
done
```

## Rollback

Safe only if no live row already exceeds `NUMERIC(10, 2)` (tenant) or `NUMERIC(12, 2)` (platform). Verify first:

```sql
-- tenant
SELECT MAX(total_spent)   FROM clients;     -- must be ≤ 99999999.99
SELECT MAX(revenue)       FROM campaigns;   -- must be ≤ 99999999.99
SELECT MAX(predicted_clv) FROM client_dna;  -- must be ≤ 99999999.99
-- platform
SELECT MAX(total_revenue) FROM tenant_usage_logs;  -- must be ≤ 9999999999.99
```

Then revert (per DB, single tx):

```sql
-- tenant
BEGIN;
  ALTER TABLE clients    ALTER COLUMN total_spent   TYPE NUMERIC(10, 2);
  ALTER TABLE campaigns  ALTER COLUMN revenue       TYPE NUMERIC(10, 2);
  ALTER TABLE client_dna ALTER COLUMN predicted_clv TYPE NUMERIC(10, 2);
COMMIT;
```

```sql
-- platform
BEGIN;
  ALTER TABLE tenant_usage_logs ALTER COLUMN total_revenue TYPE NUMERIC(12, 2);
COMMIT;
```

Then `prisma migrate resolve --rolled-back 20260519_v44_decimal_widening` per tenant DB.

## Caveats

1. **Lock duration:** `ALTER COLUMN TYPE` with same scale is metadata-only on PG ≥ 9.2 — `AccessExclusiveLock` is held only for the catalog update, typically < 50ms even on large tables. No table rewrite.
2. **Blast radius on prod (2026-05-19 snapshot):**
   - `clients.total_spent` max: 24,354.70 (canary)
   - all three other targets: 0 rows
   No live value approaches even the existing `NUMERIC(10, 2)` ceiling. This is forward defense.
3. **ESLint rule severity:** `no-decimal-to-number` starts at `warn`. 6 pre-existing call sites need Engineer 4 cleanup (pos-shifts, reports, pdf services); a single-line follow-up flips to `error` after that.
