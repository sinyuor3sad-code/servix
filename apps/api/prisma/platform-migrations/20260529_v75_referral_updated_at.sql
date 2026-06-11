-- ════════════════════════════════════════════════════════════════════
-- SERVIX — V-75 — Add updated_at to referrals (platform)
-- Source: docs/principal-audit/synthesis-2026-05-14.md (P3)
-- ────────────────────────────────────────────────────────────────────
-- Adds an app-managed updated_at column (Prisma @updatedAt) to the
-- referrals table. Existing rows are backfilled from created_at (the
-- truthful "last known mutation" point) rather than an invented now().
-- The transient DEFAULT now() lets the ADD COLUMN succeed on a populated
-- table and covers any row inserted between this migration and the next
-- Prisma client deploy; it is then DROPPED so the DB matches the Prisma
-- schema exactly (@updatedAt has no DB default — the client writes the
-- value on every create/update). Avoids db-push drift.
--
-- The platform DB has no _prisma_migrations table (initialised via
-- db push), so this is a manual SQL migration applied via psql.
--
-- Usage:
--   psql "$PLATFORM_DATABASE_URL" \
--     -f apps/api/prisma/platform-migrations/20260529_v75_referral_updated_at.sql
-- ════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE "referrals"
  ADD COLUMN "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill existing rows to their creation time (more truthful than now()).
UPDATE "referrals" SET "updated_at" = "created_at";

-- Match the Prisma schema: @updatedAt is app-managed, no DB default.
ALTER TABLE "referrals" ALTER COLUMN "updated_at" DROP DEFAULT;

COMMIT;

-- ────────────────────────────────────────────────────────────────────
-- Rollback (manual):
--   BEGIN;
--     ALTER TABLE "referrals" DROP COLUMN "updated_at";
--   COMMIT;
-- ════════════════════════════════════════════════════════════════════
