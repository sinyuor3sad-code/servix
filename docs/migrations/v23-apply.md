# V-23 phase-1 — apply runbook

**Severity:** HIGH (P1) — schema additions only, no data movement, no app code changes.
**Author:** Engineer 2 (Database).
**Created:** 2026-05-19.

For the full three-phase plan see `docs/migrations/v23-encryption-rollout.md`. This runbook executes **Phase 1 only**.

## What this migration does

Adds three nullable `BYTEA` columns. No drops, no defaults, no backfill.

| Schema | Table | Column |
|---|---|---|
| platform | `users` | `two_factor_secret_encrypted` |
| platform | `whatsapp_instances` | `instance_token_encrypted` |
| tenant | `zatca_certificates` | `private_key_encrypted` |

`ADD COLUMN … BYTEA NULL` without a `DEFAULT` is metadata-only on PostgreSQL 11+ — no table rewrite, no `AccessExclusiveLock` beyond the catalog update. Safe in any window.

## Pre-conditions

- [ ] Backup verification (Step 0).
- [ ] SSH access to the prod VM.
- [ ] Engineer 1 reachable.
- [ ] V-18 and V-17/V-73 already applied (recommended — same toolchain).

---

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

Abort if any failure.

---

## Step 1 — Apply on platform DB (manual psql, no `_prisma_migrations`)

```bash
ssh servix-admin@194.163.158.70 << 'EOF'
  set -e
  SQL=/tmp/v23_platform.sql

  sudo docker cp \
    /home/servix-admin/servix/apps/api/prisma/platform-migrations/20260519_v23_encryption_columns_phase1.sql \
    servix-postgres:$SQL

  sudo docker exec -e PGOPTIONS='--client-min-messages=warning' servix-postgres \
    psql -U servix -d servix_platform -v ON_ERROR_STOP=1 -f $SQL

  echo ""
  echo "=== Verify platform columns ==="
  sudo docker exec servix-postgres psql -U servix -d servix_platform -tAc "
    SELECT table_name || '.' || column_name || ' ' || data_type || ' nullable=' || is_nullable
    FROM information_schema.columns
    WHERE (table_name='users' AND column_name='two_factor_secret_encrypted')
       OR (table_name='whatsapp_instances' AND column_name='instance_token_encrypted')
    ORDER BY table_name;"
EOF
```

**Expected:**
```
users.two_factor_secret_encrypted bytea nullable=YES
whatsapp_instances.instance_token_encrypted bytea nullable=YES
```

---

## Step 2 — Apply on active tenant DBs

Skip tenants without a backing DB (see V-77d). Currently active: `servix_tenant_d0f48d47`, `servix_tenant_test_ai_reception`.

```bash
ssh servix-admin@194.163.158.70 << 'EOF'
  set -e
  TENANT_DBS=(
    servix_tenant_d0f48d47
    servix_tenant_test_ai_reception
  )
  SQL=/tmp/v23_tenant.sql

  sudo docker cp \
    /home/servix-admin/servix/apps/api/prisma/migrations/20260519_v23_encryption_columns_phase1/migration.sql \
    servix-postgres:$SQL

  for db in "${TENANT_DBS[@]}"; do
    echo "=== Applying to $db ==="
    sudo docker exec -e PGOPTIONS='--client-min-messages=warning' servix-postgres \
      psql -U servix -d "$db" -v ON_ERROR_STOP=1 -f $SQL

    echo "=== Verify $db ==="
    sudo docker exec servix-postgres psql -U servix -d "$db" -tAc "
      SELECT column_name || ' ' || data_type || ' nullable=' || is_nullable
      FROM information_schema.columns
      WHERE table_name='zatca_certificates' AND column_name='private_key_encrypted';"
  done
EOF
```

**Expected per tenant:** `private_key_encrypted bytea nullable=YES`.

---

## Step 3 — Register migration in Prisma history (tenant DBs only)

Platform DB has no `_prisma_migrations` table (Phase 1 applied via manual psql, same pattern as `20260425_compliance_platform_complaints.sql`). Skip the resolve step for platform.

```bash
for db in servix_tenant_d0f48d47 servix_tenant_test_ai_reception; do
  export TENANT_DATABASE_URL="postgresql://servix:<PASSWORD>@194.163.158.70:5432/$db"
  pnpm --filter @servix/api exec prisma migrate resolve \
    --applied 20260519_v23_encryption_columns_phase1 \
    --schema=apps/api/prisma/tenant.prisma
done
```

Verify:
```sql
SELECT migration_name FROM _prisma_migrations
WHERE migration_name = '20260519_v23_encryption_columns_phase1';
```

---

## Step 4 — Smoke test column accepts BYTEA

The column is exercised in Phase 2 by Engineer 4. For Phase 1 sign-off, prove it accepts both NULL and a binary value:

```sql
-- Pick a real row, set + clear the encrypted column in a tx, never commit.
BEGIN;
  UPDATE users SET two_factor_secret_encrypted = E'\\xDEADBEEF'::bytea
   WHERE id = '<a real user id>';
  SELECT id, two_factor_secret_encrypted FROM users WHERE id = '<that id>';
  -- expect: id | \xdeadbeef
ROLLBACK;
```

Repeat for `whatsapp_instances.instance_token_encrypted` and `zatca_certificates.private_key_encrypted`. Always inside `BEGIN; … ROLLBACK;` — Phase 1 does not write production data.

---

## Rollback

Schema additions only — rollback is trivial (data-loss-free if Phase 2 has not yet written anything to the encrypted columns).

**Platform:**
```bash
sudo docker exec servix-postgres psql -U servix -d servix_platform -v ON_ERROR_STOP=1 \
  -c "ALTER TABLE users DROP COLUMN IF EXISTS two_factor_secret_encrypted;"
sudo docker exec servix-postgres psql -U servix -d servix_platform -v ON_ERROR_STOP=1 \
  -c "ALTER TABLE whatsapp_instances DROP COLUMN IF EXISTS instance_token_encrypted;"
```

**Tenant (each DB):**
```bash
for db in servix_tenant_d0f48d47 servix_tenant_test_ai_reception; do
  sudo docker exec servix-postgres psql -U servix -d "$db" -v ON_ERROR_STOP=1 \
    -c "ALTER TABLE zatca_certificates DROP COLUMN IF EXISTS private_key_encrypted;"
done
```

**Reconcile Prisma history:**
```bash
for db in servix_tenant_d0f48d47 servix_tenant_test_ai_reception; do
  export TENANT_DATABASE_URL="postgresql://servix:<PASSWORD>@194.163.158.70:5432/$db"
  pnpm --filter @servix/api exec prisma migrate resolve \
    --rolled-back 20260519_v23_encryption_columns_phase1 \
    --schema=apps/api/prisma/tenant.prisma
done
```

**Revert schema edits:** `git revert <commit>` on the V-23 phase-1 commit.

> ⚠️ If Phase 2 has already written ciphertext to the encrypted columns, `DROP COLUMN` will silently delete those bytes. Engineer 4 must confirm zero `_encrypted IS NOT NULL` rows before rollback in that case, or decrypt them back into the plaintext column first.

---

## Caveats

1. **Phase 1 is inert** — adding columns alone changes no behaviour. The runtime still reads and writes the plaintext columns. Real protection arrives with Phase 2.
2. **NOT NULL plaintext columns** (`whatsapp_instances.instance_token`, `zatca_certificates.private_key`) remain NOT NULL through Phase 2. Phase 3 will flip the NOT NULL constraint to the encrypted column before dropping the plaintext column.
3. **No `_prisma_migrations` on platform** — by design. Phase 1 platform SQL is applied via `psql`, same as `20260425_compliance_platform_complaints.sql`. The fix is V-77+ (Engineer 1, separate scope).
4. **Out of scope (encryption.service):** zero edits to `apps/api/src/shared/encryption/encryption.service.ts` in Phase 1. Phase 2 (Engineer 4) owns that file.
