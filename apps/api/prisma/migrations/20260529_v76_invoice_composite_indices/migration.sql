-- ════════════════════════════════════════════════════════════════════
-- SERVIX — V-76 — Composite indices on invoices (tenant)
-- Source: docs/principal-audit/synthesis-2026-05-14.md (P3)
-- ────────────────────────────────────────────────────────────────────
-- Adds two composite indices backing common Invoice query patterns the
-- single-column indices don't cover efficiently:
--   - (client_id, status)  — a client's invoices filtered by status
--   - (status, created_at) — status-scoped lists ordered by recency
-- Both are idempotent (IF NOT EXISTS); index names match Prisma's @@index
-- naming so there is no schema/DB drift.
--
-- Index-build strategy (see V-77+): plain CREATE INDEX — instant on the empty
-- tenant DBs that `prisma migrate deploy` targets. To add these to an EXISTING
-- POPULATED tenant without locking writes, build them OUT-OF-BAND FIRST (then
-- migrate deploy is a no-op via IF NOT EXISTS), each on its own psql -c call
-- (CONCURRENTLY needs autocommit):
--   psql "$TENANT_DATABASE_URL" -c 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "invoices_client_id_status_idx" ON "invoices" ("client_id","status");'
--   psql "$TENANT_DATABASE_URL" -c 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "invoices_status_created_at_idx" ON "invoices" ("status","created_at");'
-- These were CONCURRENTLY in-file until V-77+; removed because Prisma runs a
-- no-transaction migration as one multi-statement implicit tx, where
-- CONCURRENTLY is forbidden. New tenants get them via migrate deploy.
-- ════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS "invoices_client_id_status_idx"
  ON "invoices" ("client_id", "status");

CREATE INDEX IF NOT EXISTS "invoices_status_created_at_idx"
  ON "invoices" ("status", "created_at");

-- ────────────────────────────────────────────────────────────────────
-- Rollback (manual):
--   DROP INDEX IF EXISTS "invoices_client_id_status_idx";
--   DROP INDEX IF EXISTS "invoices_status_created_at_idx";
-- (On a populated tenant, prefer DROP INDEX CONCURRENTLY IF EXISTS … via psql.)
-- ════════════════════════════════════════════════════════════════════
