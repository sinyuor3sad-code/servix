# V-17 + V-73 — Cascade redesign + soft-delete + ZATCA delete trigger

**Severity:** HIGH (P1) — financial integrity + ZATCA legal retention.
**Author:** Engineer 2 (Database).
**Created:** 2026-05-19.
**Audit source:** `docs/principal-audit/synthesis-2026-05-14.md` (A1-003 + A1-010, merged).

## What this migration does

Four protective changes to tenant DBs:

1. **5 FK relations CASCADE → RESTRICT** — prevents accidental loss of financial/loyalty rows when a parent is deleted.

   | Child table | FK column | Parent | Was → Now |
   |---|---|---|---|
   | `payments` | `invoice_id` | `invoices` | CASCADE → **RESTRICT** |
   | `discounts` | `invoice_id` | `invoices` | CASCADE → **RESTRICT** |
   | `loyalty_transactions` | `client_id` | `clients` | CASCADE → **RESTRICT** |
   | `client_debts` | `client_id` | `clients` | CASCADE → **RESTRICT** |
   | `employee_debts` | `employee_id` | `employees` | CASCADE → **RESTRICT** |

2. **Soft-delete columns** — `deleted_at TIMESTAMPTZ NULL` on `invoices` and `payments`. The Prisma middleware that translates `.delete()` → `.update({ deletedAt })` is tracked separately as **V-17b** (Engineer 4 scope); until it lands, application code still hard-deletes but the FK Restrict above prevents the dangerous cases.

3. **Partial index** — `invoices(client_id) WHERE deleted_at IS NULL`. Once soft-delete is wired up, every list query joins by client and filters out tombstones; this index serves that pattern without bloating the existing full index.

4. **ZATCA-finalized invoice delete trigger** — `BEFORE DELETE` trigger on `invoices` raises if a matching `zatca_invoices` row has `submission_status IN ('submitted','cleared','reported')`. These three states represent submissions that have left our system; ZATCA's 6-year retention applies. `pending`, `rejected`, `failed` remain deletable.

   The trigger is defense-in-depth: the FK `zatca_invoices_invoice_id_fkey` is already `ON DELETE RESTRICT`, so any ZATCA row blocks DELETE. The trigger adds precise legal-status enforcement on top.

> **Why manual:** tenant migration toolchain has unresolved gaps (V-77+). Until they are fixed, we apply per-DB with `psql` and reconcile Prisma state with `migrate resolve` — same pattern as V-18.

## Pre-conditions

- [ ] Backup verification (Step 0) — **NEVER skip**.
- [ ] Production traffic is normal (no concurrent DDL, no long-running transactions on `invoices`, `payments`, `clients`, `employees` — `ALTER TABLE … DROP/ADD CONSTRAINT` takes `AccessExclusiveLock`).
- [ ] SSH access to the prod VM (`servix-admin@194.163.158.70`).
- [ ] Engineer 1 reachable.
- [ ] V-18 applied (recommended — same runbook foundations, builds operator muscle memory).

---

## Step 0 — Verify a fresh backup exists (<1h old)

```bash
ssh servix-admin@194.163.158.70 << 'EOF'
  set -e
  echo "=== Latest backup files ==="
  sudo ls -lh /var/backups/postgres/ | tail -5

  echo ""
  echo "=== Integrity check ==="
  for f in $(sudo ls /var/backups/postgres/latest-platform.sql.gz \
                     /var/backups/postgres/latest-tenant-*.sql.gz 2>/dev/null); do
    sudo gzip -t "$f" && echo "  OK: $f" || echo "  FAILED: $f"
  done

  echo ""
  echo "=== Age check (must be < 1h) ==="
  sudo find /var/backups/postgres/ -name 'latest-*.sql.gz' -mmin -60 -print
EOF
```

**Abort criteria:** any failure → STOP, escalate to Engineer 1.

---

## Step 1 — Apply migration on canary tenant (`servix_tenant_d0f48d47`)

```bash
ssh servix-admin@194.163.158.70 << 'EOF'
  set -e
  SQL_FILE=/tmp/v17_v73.sql

  sudo docker cp \
    /home/servix-admin/servix/apps/api/prisma/migrations/20260519_v17_v73_cascade_softdelete/migration.sql \
    servix-postgres:$SQL_FILE

  sudo docker exec -e PGOPTIONS='--client-min-messages=warning' servix-postgres \
    psql -U servix -d servix_tenant_d0f48d47 -v ON_ERROR_STOP=1 -f $SQL_FILE
EOF
```

Verify canary state before proceeding to the next tenant:

```bash
ssh servix-admin@194.163.158.70 << 'EOF'
  set -e
  DB=servix_tenant_d0f48d47

  echo "=== §1: 5 FKs are RESTRICT ==="
  sudo docker exec servix-postgres psql -U servix -d "$DB" -tAc "
    SELECT conname || ' → ' ||
      CASE WHEN pg_get_constraintdef(oid) LIKE '%ON DELETE RESTRICT%' THEN 'RESTRICT ✓' ELSE 'FAIL ✗' END
    FROM pg_constraint
    WHERE conname IN (
      'payments_invoice_id_fkey','discounts_invoice_id_fkey',
      'loyalty_transactions_client_id_fkey','client_debts_client_id_fkey',
      'employee_debts_employee_id_fkey'
    )
    ORDER BY conname;"

  echo ""
  echo "=== §2: deleted_at on invoices + payments ==="
  sudo docker exec servix-postgres psql -U servix -d "$DB" -tAc "
    SELECT table_name || '.deleted_at' FROM information_schema.columns
    WHERE table_name IN ('invoices','payments') AND column_name='deleted_at';"

  echo ""
  echo "=== §3: partial index ==="
  sudo docker exec servix-postgres psql -U servix -d "$DB" -tAc "
    SELECT indexname || ' (' || regexp_replace(indexdef, '^.*WHERE ', 'WHERE ') || ')'
    FROM pg_indexes WHERE indexname='invoices_client_id_active_idx';"

  echo ""
  echo "=== §4: trigger ==="
  sudo docker exec servix-postgres psql -U servix -d "$DB" -tAc "
    SELECT trigger_name || ' ' || action_timing || ' ' || event_manipulation
    FROM information_schema.triggers
    WHERE trigger_name='no_delete_finalized_zatca_invoices';"
EOF
```

**Expected output (5 + 2 + 1 + 1):**
- five `_fkey → RESTRICT ✓` lines
- `invoices.deleted_at`, `payments.deleted_at`
- `invoices_client_id_active_idx (WHERE (deleted_at IS NULL))`
- `no_delete_finalized_zatca_invoices BEFORE DELETE`

If any line is missing → STOP, do **not** proceed to the second tenant.

---

## Step 2 — Apply on remaining tenant(s)

Skip tenants whose DB does not exist (see runbook v18 for the active-set rule; same exclusions apply here).

```bash
ssh servix-admin@194.163.158.70 << 'EOF'
  set -e
  TENANT_DBS=(servix_tenant_test_ai_reception)   # canary already done above
  SQL_FILE=/tmp/v17_v73.sql

  for db in "${TENANT_DBS[@]}"; do
    echo "=== Applying to $db ==="
    sudo docker exec -e PGOPTIONS='--client-min-messages=warning' servix-postgres \
      psql -U servix -d "$db" -v ON_ERROR_STOP=1 -f $SQL_FILE
  done
EOF
```

Repeat the Step 1 verification block for each tenant DB.

---

## Step 3 — Register migration in Prisma history (tenant DBs only)

Platform DB is unaffected by this migration. For each tenant DB, mark the migration as applied:

```bash
for db in servix_tenant_d0f48d47 servix_tenant_test_ai_reception; do
  export TENANT_DATABASE_URL="postgresql://servix:<PASSWORD>@194.163.158.70:5432/$db"
  pnpm --filter @servix/api exec prisma migrate resolve \
    --applied 20260519_v17_v73_cascade_softdelete \
    --schema=apps/api/prisma/tenant.prisma
done
```

Verify (1 row per DB):
```sql
SELECT migration_name, started_at, finished_at
FROM _prisma_migrations
WHERE migration_name = '20260519_v17_v73_cascade_softdelete';
```

---

## Step 4 — DELETE behaviour smoke test (canary only)

Run as a read-only-ish probe (each DELETE is wrapped in `BEGIN; … ROLLBACK;`). Pick a real invoice/client/employee from the canary.

```sql
-- Pre-V17 baseline: should still be DELETE-blocked because we just made it so.
BEGIN;
  DELETE FROM payments WHERE invoice_id = '<pick a real invoice id>';
  -- (Real test would be DELETE FROM invoices … but invoices may not be safe
  -- to attempt even in a rolled-back tx — use a doomed-anyway invoice id
  -- only if you are sure.)
ROLLBACK;

-- ZATCA trigger: insert a synthetic ZATCA row in a tx and try DELETE
BEGIN;
  INSERT INTO zatca_invoices (id, invoice_id, certificate_id, invoice_type,
                              invoice_sub_type, submission_status,
                              invoice_counter_value, updated_at)
  VALUES (gen_random_uuid(), '<pick a no-zatca invoice>',
          '<an existing certificate_id>', 'standard', '0100', 'cleared',
          999999, NOW());
  -- expect: ERROR 23001 — 'Cannot delete ZATCA-finalized invoice …'
  DELETE FROM invoices WHERE id = '<that same invoice id>';
ROLLBACK;
```

If the trigger fires with `ERRCODE 23001 restrict_violation`, V-17/V-73 is operational. If not, STOP and investigate.

---

## Step 5 — Partial-index sanity check

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM invoices WHERE client_id = '<real client_id>' AND deleted_at IS NULL;
```

On small datasets the planner will still pick Seq Scan — confirm the index is available with:

```sql
SET enable_seqscan = OFF;
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM invoices WHERE client_id = '<real client_id>' AND deleted_at IS NULL;
```

Expect `Index Scan using invoices_client_id_active_idx`.

---

## Rollback

Trigger this only if a regression is observed. Each step uses **separate** `psql -c` calls where required (CONCURRENTLY), matching the V-18 pattern.

### §4 reverse — drop trigger and function

```bash
for db in servix_tenant_d0f48d47 servix_tenant_test_ai_reception; do
  sudo docker exec servix-postgres psql -U servix -d "$db" -v ON_ERROR_STOP=1 \
    -c "DROP TRIGGER IF EXISTS no_delete_finalized_zatca_invoices ON invoices;"
  sudo docker exec servix-postgres psql -U servix -d "$db" -v ON_ERROR_STOP=1 \
    -c "DROP FUNCTION IF EXISTS prevent_zatca_finalized_invoice_delete();"
done
```

### §3 reverse — drop partial index

```bash
for db in servix_tenant_d0f48d47 servix_tenant_test_ai_reception; do
  sudo docker exec servix-postgres psql -U servix -d "$db" -v ON_ERROR_STOP=1 \
    -c "DROP INDEX CONCURRENTLY IF EXISTS invoices_client_id_active_idx;"
done
```

### §2 reverse — drop soft-delete columns (DATA-LOSS WARNING)

Only run if no soft-deleted rows exist (`SELECT count(*) FROM invoices WHERE deleted_at IS NOT NULL` returns 0). Otherwise restore deleted rows first or accept the loss explicitly.

```bash
for db in servix_tenant_d0f48d47 servix_tenant_test_ai_reception; do
  sudo docker exec servix-postgres psql -U servix -d "$db" -v ON_ERROR_STOP=1 \
    -c "ALTER TABLE payments DROP COLUMN IF EXISTS deleted_at;"
  sudo docker exec servix-postgres psql -U servix -d "$db" -v ON_ERROR_STOP=1 \
    -c "ALTER TABLE invoices DROP COLUMN IF EXISTS deleted_at;"
done
```

### §1 reverse — FKs back to CASCADE

Per DB, single transaction:

```bash
for db in servix_tenant_d0f48d47 servix_tenant_test_ai_reception; do
  sudo docker exec servix-postgres psql -U servix -d "$db" -v ON_ERROR_STOP=1 -c "
    BEGIN;
    ALTER TABLE payments DROP CONSTRAINT payments_invoice_id_fkey;
    ALTER TABLE payments ADD CONSTRAINT payments_invoice_id_fkey
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON UPDATE CASCADE ON DELETE CASCADE;
    ALTER TABLE discounts DROP CONSTRAINT discounts_invoice_id_fkey;
    ALTER TABLE discounts ADD CONSTRAINT discounts_invoice_id_fkey
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON UPDATE CASCADE ON DELETE CASCADE;
    ALTER TABLE loyalty_transactions DROP CONSTRAINT loyalty_transactions_client_id_fkey;
    ALTER TABLE loyalty_transactions ADD CONSTRAINT loyalty_transactions_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES clients(id) ON UPDATE CASCADE ON DELETE CASCADE;
    ALTER TABLE client_debts DROP CONSTRAINT client_debts_client_id_fkey;
    ALTER TABLE client_debts ADD CONSTRAINT client_debts_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES clients(id) ON UPDATE CASCADE ON DELETE CASCADE;
    ALTER TABLE employee_debts DROP CONSTRAINT employee_debts_employee_id_fkey;
    ALTER TABLE employee_debts ADD CONSTRAINT employee_debts_employee_id_fkey
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON UPDATE CASCADE ON DELETE CASCADE;
    COMMIT;
  "
done
```

### Reconcile Prisma history

```bash
for db in servix_tenant_d0f48d47 servix_tenant_test_ai_reception; do
  export TENANT_DATABASE_URL="postgresql://servix:<PASSWORD>@194.163.158.70:5432/$db"
  pnpm --filter @servix/api exec prisma migrate resolve \
    --rolled-back 20260519_v17_v73_cascade_softdelete \
    --schema=apps/api/prisma/tenant.prisma
done
```

Then `git revert <commit>` on the schema edits in `tenant.prisma`.

---

## Caveats

1. **Lock duration:** `ALTER TABLE … DROP/ADD CONSTRAINT` takes `AccessExclusiveLock` on the child table for the duration. On production-sized tables (`invoices` ≈ 408 kB, `payments` ≈ 72 kB on canary) this is < 100 ms but blocks all reads/writes during that window. Prefer a low-traffic window.

2. **CONCURRENTLY:** §3 partial index uses `CONCURRENTLY IF NOT EXISTS`. The migration file has the `-- prisma+migrate:no-transaction` directive (Prisma 5+) so `migrate deploy` runs it outside a tx. When invoked via `psql -f`, autocommit makes it work the same way.

3. **`DROP INDEX CONCURRENTLY`** cannot run inside a transaction block, and `psql -c "stmt1; stmt2;"` wraps multiple statements in an implicit transaction. Each `DROP INDEX CONCURRENTLY` in rollback is a **separate** `psql -c` call.

4. **ZATCA trigger semantics:** blocks DELETE only when a matching `zatca_invoices` row has `submission_status IN ('submitted','cleared','reported')`. `pending`/`rejected`/`failed` are deletable. The FK `zatca_invoices_invoice_id_fkey` is already `ON DELETE RESTRICT`, so ZATCA rows in *any* state block DELETE at the FK layer — the trigger adds precision (legal vs. operational rejection) and a domain-specific error message.

5. **Trigger error code:** `RAISE EXCEPTION … USING ERRCODE = 'restrict_violation'` → SQLSTATE `23001`. This is the same code Postgres emits for FK RESTRICT violations, so a single `catch` in the app layer handles both. The trigger message starts with `Cannot delete ZATCA-finalized invoice` and includes the invoice UUID — no PII or sensitive data is leaked.

6. **Out of scope** (tracked separately):
   - **V-17b** — Prisma middleware to transform `.delete()` → `.update({ deletedAt: new Date() })` on `Invoice` and `Payment` in `apps/api/src/modules/salon/invoices/invoices.service.ts` and the payments service. **Engineer 4 scope** (money/compliance). Without this middleware, application code that calls `prisma.invoice.delete()` will hit FK RESTRICT or the trigger; users will see error messages instead of silent soft-delete.
   - **V-77+** — tenant migration toolchain rebuild (Engineer 1 scope, see engineer-2-database-auth.md).
