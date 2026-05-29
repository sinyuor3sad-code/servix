-- ════════════════════════════════════════════════════════════════════
-- SERVIX — V-75 — Add updated_at to self_orders + invoice_feedbacks (tenant)
-- Source: docs/principal-audit/synthesis-2026-05-14.md (P3)
-- ────────────────────────────────────────────────────────────────────
-- Adds an app-managed updated_at column (Prisma @updatedAt) to two tenant
-- tables that had created_at but no updated_at. Existing rows are backfilled
-- from created_at; the transient DEFAULT now() lets ADD COLUMN succeed on a
-- populated table and is then DROPPED so the DB matches the Prisma schema
-- (@updatedAt has no DB default — the client writes the value on write).
--
-- ⚠ Tenant migration toolchain is broken (V-77+: migrate-tenants.ts is a stub,
-- and a pos_shifts gap breaks `prisma migrate deploy`). Until E1 rebuilds it,
-- apply on each tenant DB via the V-18 workaround — raw SQL, then mark resolved:
--   psql "$TENANT_DATABASE_URL" -1 \
--     -f prisma/migrations/20260529_v75_tenant_updated_at/migration.sql
--   npx prisma migrate resolve --schema=prisma/tenant.prisma \
--     --applied 20260529_v75_tenant_updated_at
-- All statements run in one transaction (apply with psql -1); no CONCURRENTLY,
-- so no `prisma+migrate:no-transaction` directive is needed.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE "self_orders" ADD COLUMN "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now();
UPDATE "self_orders" SET "updated_at" = "created_at";
ALTER TABLE "self_orders" ALTER COLUMN "updated_at" DROP DEFAULT;

ALTER TABLE "invoice_feedbacks" ADD COLUMN "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now();
UPDATE "invoice_feedbacks" SET "updated_at" = "created_at";
ALTER TABLE "invoice_feedbacks" ALTER COLUMN "updated_at" DROP DEFAULT;

-- ────────────────────────────────────────────────────────────────────
-- Rollback (manual):
--   ALTER TABLE "self_orders" DROP COLUMN "updated_at";
--   ALTER TABLE "invoice_feedbacks" DROP COLUMN "updated_at";
-- ════════════════════════════════════════════════════════════════════
