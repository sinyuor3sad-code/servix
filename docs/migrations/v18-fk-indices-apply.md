# V-18 / A1-006 — FK indices runbook

**Severity:** HIGH (P1) — performance fix, blocks under-load query plans.
**Author:** Engineer 2 (Database).
**Created:** 2026-05-19.
**Audit source:** `docs/principal-audit/synthesis-2026-05-14.md`.

## What this migration does

Adds 5 missing FK indices across two schemas:

| Schema | Table | Column | Index name |
|---|---|---|---|
| tenant | `appointment_services` | `service_id` | `appointment_services_service_id_idx` |
| tenant | `appointment_services` | `employee_id` | `appointment_services_employee_id_idx` |
| tenant | `invoice_items` | `service_id` | `invoice_items_service_id_idx` |
| platform | `subscriptions` | `plan_id` | `subscriptions_plan_id_idx` |
| platform | `platform_invoices` | `subscription_id` | `platform_invoices_subscription_id_idx` |

All `CREATE INDEX CONCURRENTLY IF NOT EXISTS` — safe to retry, no table lock.

> **Why manual:** the platform DB has no `_prisma_migrations` table (initialised via `db push`), and the tenant migration toolchain has gaps (`tooling/scripts/migrate-tenants.ts` is a stub — tracked as **V-77+**). Until the toolchain is rebuilt, we apply per-DB with `psql` and reconcile Prisma state with `migrate resolve`.

## Pre-conditions

- [ ] Backup verification (see Step 0 below) — **NEVER skip**.
- [ ] Production traffic is normal (no concurrent DDL, no long-running transactions on target tables — `CONCURRENTLY` waits for them).
- [ ] You have SSH access to the production VM (`servix-admin@194.163.158.70`).
- [ ] Engineer 1 is reachable in case of failure.

---

## Step 0 — Verify a fresh backup exists (<1h old)

```bash
ssh servix-admin@194.163.158.70 << 'EOF'
  set -e
  echo "=== Latest backup files ==="
  sudo ls -lh /var/backups/postgres/ | tail -5

  echo ""
  echo "=== Integrity check (gzip -t) ==="
  for f in $(sudo ls /var/backups/postgres/latest-platform.sql.gz \
                     /var/backups/postgres/latest-tenant-*.sql.gz 2>/dev/null); do
    sudo gzip -t "$f" && echo "  OK: $f" || echo "  FAILED: $f"
  done

  echo ""
  echo "=== Age check (must be < 1h) ==="
  sudo find /var/backups/postgres/ -name 'latest-*.sql.gz' -mmin -60 -print
EOF
```

**Abort criteria:**
- Any `gzip -t` failure → STOP, escalate to Engineer 1.
- No file younger than 60 minutes → STOP, trigger a fresh backup before continuing.

---

## Step 1 — Apply platform migration

```bash
ssh servix-admin@194.163.158.70 << 'EOF'
  set -e
  # Path inside the api container after `docker cp` — adjust if running locally.
  SQL_FILE=/tmp/v18_platform.sql

  sudo docker cp \
    /home/servix-admin/servix/apps/api/prisma/platform-migrations/20260519_v18_fk_indices.sql \
    servix-postgres:$SQL_FILE

  sudo docker exec -e PGOPTIONS='--client-min-messages=warning' servix-postgres \
    psql -U servix -d servix_platform -v ON_ERROR_STOP=1 -f $SQL_FILE

  echo ""
  echo "=== Verify platform indices ==="
  sudo docker exec servix-postgres psql -U servix -d servix_platform -c "\d subscriptions" | grep -i plan_id_idx
  sudo docker exec servix-postgres psql -U servix -d servix_platform -c "\d platform_invoices" | grep -i subscription_id_idx
EOF
```

**Expected:** two `_idx` rows under "Indexes:" for each table. Re-runs are idempotent (`IF NOT EXISTS`).

---

## Step 2 — Apply tenant migration on every active tenant DB

The list below is the current production set (run `SELECT database_name FROM tenants WHERE status IN ('active','trial');` to refresh). **Skip `platform_admin_db` — it is an orphan registry entry with no actual DB (tracked separately).**

```bash
ssh servix-admin@194.163.158.70 << 'EOF'
  set -e

  # Active tenants as of 2026-05-19. servix_tenant_36e0b612 (slug
  # hthr-36e0b612) is registered in tenants but the database does not
  # exist on prod — see V-77+ follow-ups; intentionally excluded.
  TENANT_DBS=(
    servix_tenant_d0f48d47
    servix_tenant_test_ai_reception
  )

  SQL_FILE=/tmp/v18_tenant.sql
  sudo docker cp \
    /home/servix-admin/servix/apps/api/prisma/migrations/20260519_v18_fk_indices/migration.sql \
    servix-postgres:$SQL_FILE

  for db in "${TENANT_DBS[@]}"; do
    echo "=== Applying to $db ==="
    sudo docker exec -e PGOPTIONS='--client-min-messages=warning' servix-postgres \
      psql -U servix -d "$db" -v ON_ERROR_STOP=1 -f $SQL_FILE

    echo "=== Verify indices on $db ==="
    sudo docker exec servix-postgres psql -U servix -d "$db" -c "\d appointment_services" | grep -iE "service_id_idx|employee_id_idx"
    sudo docker exec servix-postgres psql -U servix -d "$db" -c "\d invoice_items" | grep -i service_id_idx
  done
EOF
```

---

## Step 3 — Register migration in Prisma history (tenant DBs only)

Platform DB has no `_prisma_migrations` table — skip this step for platform.

For each tenant DB, mark the migration as applied so `prisma migrate deploy` won't re-attempt it:

```bash
# Run from the project root on a workstation with access to the prod tenant DSNs.
# The Prisma CLI computes the checksum from the migration.sql file and inserts
# the row into _prisma_migrations with a correct sha256 — avoiding drift if
# Prisma ever rewrites the table layout.

for db in servix_tenant_d0f48d47 servix_tenant_36e0b612 servix_tenant_test_ai_reception; do
  export TENANT_DATABASE_URL="postgresql://servix:<PASSWORD>@194.163.158.70:5432/$db"
  pnpm --filter @servix/api exec prisma migrate resolve \
    --applied 20260519_v18_fk_indices \
    --schema=apps/api/prisma/tenant.prisma
done
```

> If port 5432 is not exposed externally, run `prisma migrate resolve` from inside the api container instead — it picks up `TENANT_DATABASE_URL` from the env you pass to `docker exec`.

**Verify** (read-only, expect 1 row per DB):
```sql
SELECT migration_name, started_at, finished_at
FROM _prisma_migrations
WHERE migration_name = '20260519_v18_fk_indices';
```

---

## Step 4 — Performance verification

Run on **one** tenant DB to confirm the planner picks the new index. Replace `<UUID>` with any real `service_id` from `services`:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM appointment_services WHERE service_id = '<UUID>' LIMIT 10;
```

**Expected:** `Index Scan using appointment_services_service_id_idx` (not `Seq Scan`).

Repeat for `appointment_services.employee_id` and `invoice_items.service_id`. On platform: `subscriptions.plan_id` and `platform_invoices.subscription_id`.

If any plan still uses `Seq Scan` on a high-cardinality value, run `ANALYZE <table>;` to refresh statistics.

---

## Rollback

Only roll back if the indices cause an unexpected regression (very unlikely — they only add an option to the planner).

> **Important:** `DROP INDEX CONCURRENTLY` cannot run inside a transaction block, and `psql -c "stmt1; stmt2;"` wraps multiple statements in an implicit transaction — which makes the DROP fail with `cannot run inside a transaction block`. Run each DROP as a **separate** `psql -c` call.

**Platform:**
```bash
sudo docker exec servix-postgres psql -U servix -d servix_platform -v ON_ERROR_STOP=1 \
  -c "DROP INDEX CONCURRENTLY IF EXISTS subscriptions_plan_id_idx;"
sudo docker exec servix-postgres psql -U servix -d servix_platform -v ON_ERROR_STOP=1 \
  -c "DROP INDEX CONCURRENTLY IF EXISTS platform_invoices_subscription_id_idx;"
```

**Tenant (each DB):**
```bash
for db in servix_tenant_d0f48d47 servix_tenant_test_ai_reception; do
  sudo docker exec servix-postgres psql -U servix -d "$db" -v ON_ERROR_STOP=1 \
    -c "DROP INDEX CONCURRENTLY IF EXISTS appointment_services_service_id_idx;"
  sudo docker exec servix-postgres psql -U servix -d "$db" -v ON_ERROR_STOP=1 \
    -c "DROP INDEX CONCURRENTLY IF EXISTS appointment_services_employee_id_idx;"
  sudo docker exec servix-postgres psql -U servix -d "$db" -v ON_ERROR_STOP=1 \
    -c "DROP INDEX CONCURRENTLY IF EXISTS invoice_items_service_id_idx;"
done
```

> The tenant list above is the **active** set as of 2026-05-19. `servix_tenant_36e0b612` (slug `hthr-36e0b612`) is an orphan registry row with no backing DB and is intentionally excluded — see V-77+ follow-ups.

Then revert the Prisma migration record:
```bash
for db in servix_tenant_d0f48d47 servix_tenant_36e0b612 servix_tenant_test_ai_reception; do
  export TENANT_DATABASE_URL="postgresql://servix:<PASSWORD>@194.163.158.70:5432/$db"
  pnpm --filter @servix/api exec prisma migrate resolve \
    --rolled-back 20260519_v18_fk_indices \
    --schema=apps/api/prisma/tenant.prisma
done
```

And revert the schema edits in `platform.prisma` / `tenant.prisma` via `git revert <commit>`.

---

## Caveats

1. **`CONCURRENTLY` requirements:**
   - Cannot run inside an explicit transaction. The tenant migration file uses the `-- prisma+migrate:no-transaction` directive (Prisma 5+); platform is applied via `psql -f` which is autocommit by default.
   - Builds the index in two passes and waits for in-progress transactions on the table. On a busy table this can take noticeably longer than a normal `CREATE INDEX`.
   - If interrupted, leaves an `INVALID` index behind. Check with `\d <table>` — if you see `INVALID`, drop and retry.

2. **Idempotency:** all statements use `IF NOT EXISTS`. Re-running the migration is safe.

3. **Out of scope for this card** (tracked separately):
   - `tooling/scripts/migrate-tenants.ts` is a stub — there is no automation to loop migrations over tenant DBs. → V-77+ (Engineer 1).
   - `deploy.sh:74` runs `prisma migrate deploy --schema=platform.prisma` against a DB that has no `_prisma_migrations` and where tenant migrations would fail anyway. → V-77c (Engineer 1).
   - `create-tenant.ts` uses `prisma db push` instead of `migrate deploy`, so newly created tenants start with an empty `_prisma_migrations` and diverge from existing ones. → V-77+ (Engineer 1).
   - `platform-admin` tenant has no backing DB — orphan registry row. → Engineer 1 cleanup card.
   - `InvoiceItem.employee_id` and `LoyaltyTransaction.invoice_id` are also un-indexed FKs not listed in V-18. → V-18b (Engineer 2 next).
