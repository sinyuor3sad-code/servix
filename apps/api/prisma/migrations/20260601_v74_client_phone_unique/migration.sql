-- ════════════════════════════════════════════════════════════════════
-- SERVIX — V-74 — Client.phone @unique (tenant)
-- Source: docs/principal-audit/synthesis-2026-05-14.md (V-74 / A1-011, P3)
-- ────────────────────────────────────────────────────────────────────
-- Makes a client's phone its natural key: enables the booking upsert-by-phone
-- path (V-89, Engineer 4) and blocks duplicate client rows. phone stays
-- NOT NULL (no nullability change) so the generated Prisma type stays `string`
-- and no service caller breaks.
--
-- Replaces the plain @@index([phone]) (clients_phone_idx) with a UNIQUE index
-- (clients_phone_key) — the unique index already serves the phone lookups, so
-- keeping both would be a redundant second index. Names match Prisma's @@unique
-- output so there is no schema/DB drift.
--
-- Pre-launch: zero live tenant data, so there are no duplicate phones to merge
-- (the dedup step the card describes is a no-op now). The dedup-then-migrate
-- sequence is only needed if this is ever re-applied to a populated tenant DB.
--
-- Index-build strategy (see V-77+): plain CREATE/DROP INDEX — instant on the
-- empty tenant DBs that `prisma migrate deploy` targets. To apply to an
-- EXISTING POPULATED tenant without locking writes, run OUT-OF-BAND FIRST (then
-- migrate deploy is a no-op), each statement on its own psql -c call
-- (CONCURRENTLY needs autocommit):
--   psql "$TENANT_DATABASE_URL" -c 'CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "clients_phone_key" ON "clients" ("phone");'
--   psql "$TENANT_DATABASE_URL" -c 'DROP INDEX CONCURRENTLY IF EXISTS "clients_phone_idx";'
-- These were CONCURRENTLY in-file until V-77+; removed because Prisma runs a
-- no-transaction migration as one multi-statement implicit tx, where
-- CONCURRENTLY is forbidden. If a populated tenant has duplicate phones, the
-- CREATE UNIQUE INDEX fails — dedup first (see card), then re-run.
-- ════════════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX IF NOT EXISTS "clients_phone_key"
  ON "clients" ("phone");

DROP INDEX IF EXISTS "clients_phone_idx";

-- ────────────────────────────────────────────────────────────────────
-- Rollback (manual):
--   CREATE INDEX IF NOT EXISTS "clients_phone_idx" ON "clients" ("phone");
--   DROP INDEX IF EXISTS "clients_phone_key";
-- (On a populated tenant, prefer the CONCURRENTLY forms via psql, each on its
--  own psql -c call.)
-- ════════════════════════════════════════════════════════════════════
