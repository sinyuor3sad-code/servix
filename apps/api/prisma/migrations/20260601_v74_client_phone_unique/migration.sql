-- prisma+migrate:no-transaction
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
-- CONCURRENTLY so prod index builds never lock writes; cannot run inside a
-- transaction — the directive on line 1 tells Prisma migrate to run outside a
-- tx. The tenant toolchain is broken (V-77+), so until E1 rebuilds it, apply on
-- each EXISTING tenant DB via the V-18 workaround (NO -1 / NO BEGIN —
-- CONCURRENTLY needs autocommit):
--   psql "$TENANT_DATABASE_URL" \
--     -f prisma/migrations/20260601_v74_client_phone_unique/migration.sql
--   npx prisma migrate resolve --schema=prisma/tenant.prisma \
--     --applied 20260601_v74_client_phone_unique
-- New tenants via create-tenant.ts (db push) pick up the unique index
-- automatically. If a populated tenant DB has duplicates, the CREATE UNIQUE
-- INDEX below will fail — dedup first (see card), then re-run.
-- ════════════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "clients_phone_key"
  ON "clients" ("phone");

DROP INDEX CONCURRENTLY IF EXISTS "clients_phone_idx";

-- ────────────────────────────────────────────────────────────────────
-- Rollback (manual). Run each statement on its OWN psql invocation —
-- CONCURRENTLY needs autocommit and fails if the two are sent in one tx block:
--   psql "$TENANT_DATABASE_URL" -c 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "clients_phone_idx" ON "clients" ("phone");'
--   psql "$TENANT_DATABASE_URL" -c 'DROP INDEX CONCURRENTLY IF EXISTS "clients_phone_key";'
-- ════════════════════════════════════════════════════════════════════
