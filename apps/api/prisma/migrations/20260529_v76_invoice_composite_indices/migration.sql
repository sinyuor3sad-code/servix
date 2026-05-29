-- prisma+migrate:no-transaction
-- ════════════════════════════════════════════════════════════════════
-- SERVIX — V-76 — Composite indices on invoices (tenant)
-- Source: docs/principal-audit/synthesis-2026-05-14.md (P3)
-- ────────────────────────────────────────────────────────────────────
-- Adds two composite indices backing common Invoice query patterns the
-- single-column indices don't cover efficiently:
--   - (client_id, status)  — a client's invoices filtered by status
--   - (status, created_at) — status-scoped lists ordered by recency
-- CONCURRENTLY so prod index builds never lock writes; IF NOT EXISTS keeps
-- it idempotent. Index names match Prisma's @@index naming so there is no
-- schema/DB drift.
--
-- CONCURRENTLY cannot run inside a transaction — the directive on line 1
-- tells Prisma migrate to execute outside a tx block. The tenant toolchain
-- is broken (V-77+), so until E1 rebuilds it, apply on each EXISTING tenant
-- DB via the V-18 workaround (NO -1 / NO BEGIN — CONCURRENTLY needs autocommit):
--   psql "$TENANT_DATABASE_URL" \
--     -f prisma/migrations/20260529_v76_invoice_composite_indices/migration.sql
--   npx prisma migrate resolve --schema=prisma/tenant.prisma \
--     --applied 20260529_v76_invoice_composite_indices
-- New tenants via create-tenant.ts (db push) pick up the indices automatically.
-- ════════════════════════════════════════════════════════════════════

CREATE INDEX CONCURRENTLY IF NOT EXISTS "invoices_client_id_status_idx"
  ON "invoices" ("client_id", "status");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "invoices_status_created_at_idx"
  ON "invoices" ("status", "created_at");

-- ────────────────────────────────────────────────────────────────────
-- Rollback (manual, outside a transaction):
--   DROP INDEX CONCURRENTLY IF EXISTS "invoices_client_id_status_idx";
--   DROP INDEX CONCURRENTLY IF EXISTS "invoices_status_created_at_idx";
-- ════════════════════════════════════════════════════════════════════
