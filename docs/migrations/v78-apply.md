# V-78 / A1-008 — PlatformAuditLog FK Restrict runbook

**Severity:** HIGH (P1) — PDPL/SOC2 audit-trail integrity.
**Author:** Engineer 2 (Database).
**Created:** 2026-05-19.
**Audit source:** `docs/principal-audit/synthesis-2026-05-14.md` A1-008.

## What this migration does

Switches the `platform_audit_logs.tenant_id` foreign-key behaviour from `ON DELETE SET NULL` to `ON DELETE RESTRICT`. Deleting a tenant that has audit rows now fails with `ERRCODE 23503` instead of silently nulling `tenant_id` across the audit table.

`tenant_id` stays nullable (178 / 214 rows on prod are genuine system-level events with `tenant_id IS NULL` — login attempts, platform admin actions). The Restrict only affects rows that *do* reference a tenant.

| Setting | Before | After |
|---|---|---|
| FK | `platform_audit_logs_tenant_id_fkey` | same name (drop + re-add) |
| `ON DELETE` | `SET NULL` | **`RESTRICT`** |
| `ON UPDATE` | `CASCADE` | `CASCADE` (unchanged) |
| `tenant_id` column | `uuid NULL` | `uuid NULL` (unchanged) |

> **Platform-only migration.** No tenant DB is touched.

## Pre-conditions

- [ ] Backup verification (Step 0).
- [ ] No active session is in the middle of executing a tenant hard-delete (no such code path exists today; the gate is procedural only).
- [ ] SSH access to the prod VM.

## Step 0 — Verify a fresh backup exists (<1h old)

```bash
ssh servix-admin@194.163.158.70 << 'EOF'
  set -e
  sudo ls -lh /var/backups/postgres/ | tail -5
  for f in $(sudo ls /var/backups/postgres/latest-platform.sql.gz 2>/dev/null); do
    sudo gzip -t "$f" && echo "  OK: $f" || echo "  FAILED: $f"
  done
  sudo find /var/backups/postgres/ -name 'latest-platform.sql.gz' -mmin -60 -print
EOF
```

Abort on any failure.

## Step 1 — Apply

```bash
ssh servix-admin@194.163.158.70 << 'EOF'
  set -e
  SQL=/tmp/v78_platform.sql
  sudo docker cp \
    /home/servix-admin/servix/apps/api/prisma/platform-migrations/20260519_v78_audit_log_restrict.sql \
    servix-postgres:$SQL
  sudo docker exec -e PGOPTIONS='--client-min-messages=warning' servix-postgres \
    psql -U servix -d servix_platform -v ON_ERROR_STOP=1 -f $SQL
EOF
```

## Step 2 — Verify FK now says RESTRICT

```bash
ssh servix-admin@194.163.158.70 << 'EOF'
  set -e
  echo "── FK definition (must end with 'ON DELETE RESTRICT') ──"
  sudo docker exec servix-postgres psql -U servix -d servix_platform -tAc "
    SELECT pg_get_constraintdef(con.oid)
    FROM pg_constraint con JOIN pg_class cls ON cls.oid = con.conrelid
    WHERE cls.relname='platform_audit_logs' AND con.conname='platform_audit_logs_tenant_id_fkey';"

  echo ""
  echo "── Row counts must equal pre-migration values (214 total, 178 NULL) ──"
  sudo docker exec servix-postgres psql -U servix -d servix_platform -tAc "
    SELECT 'total: ' || COUNT(*) FROM platform_audit_logs;
    SELECT 'null tenant_id: ' || COUNT(*) FROM platform_audit_logs WHERE tenant_id IS NULL;"
EOF
```

**Expected:**
- FK def: `FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT`
- 214 total / 178 NULL (data unchanged — no rewrite happened).

## Step 3 — Functional smoke test

Run inside a `BEGIN; … ROLLBACK;` so prod data is never affected. Pick a real tenant that has audit rows (e.g. `dantila-d0f48d47`):

```sql
-- Should fail with SQLSTATE 23503 (foreign_key_violation)
BEGIN;
  DELETE FROM tenants WHERE id = '<real-tenant-uuid-with-audit-rows>';
  -- expected: ERROR: update or delete on table "tenants" violates foreign key
  --          constraint "platform_audit_logs_tenant_id_fkey" on table "platform_audit_logs"
ROLLBACK;
```

If the DELETE succeeds, STOP and investigate — the migration did not take effect.

## Rollback

Restores the previous `SET NULL` behaviour. **Do this only if a real regression is observed** — `SET NULL` is the regression V-78 was filed to fix.

```bash
sudo docker exec servix-postgres psql -U servix -d servix_platform -v ON_ERROR_STOP=1 -c "
BEGIN;
  ALTER TABLE platform_audit_logs DROP CONSTRAINT platform_audit_logs_tenant_id_fkey;
  ALTER TABLE platform_audit_logs
    ADD CONSTRAINT platform_audit_logs_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON UPDATE CASCADE ON DELETE SET NULL;
COMMIT;"
```

Then `git revert <V-78 commit>` on the schema edit.

## Caveats

1. **Lock duration:** `ALTER … DROP/ADD CONSTRAINT` takes `AccessExclusiveLock`. The table holds 214 rows on prod, so the lock window is < 100ms. Safe at any hour.
2. **No data rewrite:** changing FK metadata does not touch rows. Idempotent: re-running the migration drops the existing FK and re-adds it with the same name (a no-op effectively).
3. **Coordination with future purge-cron** (V-78b in `engineer-2-database-auth.md`): if Engineer 1 later builds a "purge after pendingDeletionAt grace" job, it must NOT call `prisma.tenant.delete()` / `DELETE FROM tenants` — that will now fail with 23503. The supported design is: `DROP DATABASE servix_tenant_<slug>` + keep the platform `tenants` row in `status='cancelled'` (optionally a new `status='purged'` enum value + `purged_at` column). Audit rows keep their valid `tenant_id` reference forever.
4. **PDPL alignment:** `apps/api/src/modules/data-rights/data-rights.service.ts:261-264` already promises users that audit logs are retained when they request erasure. This migration makes the database enforce that promise.
