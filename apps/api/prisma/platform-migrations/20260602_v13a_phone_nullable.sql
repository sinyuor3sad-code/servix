-- ════════════════════════════════════════════════════════════════════
-- SERVIX — V-13a-phone-placeholder (Option A) — users.phone NULLABLE (platform)
-- Source: docs/principal-audit/execution/engineer-2-database-auth.md (V-13a-phone-placeholder)
-- ────────────────────────────────────────────────────────────────────
-- Google-first accounts previously stored a synthetic `g-<sub[0:10]>` phone to
-- satisfy NOT NULL. That risked a unique-collision once per ~10^10 Google subs
-- (presenting as a confusing 500 to the 2nd victim) and leaked into the profile.
-- Option A makes phone NULLABLE so phone-less accounts carry no placeholder.
--
-- Matches Prisma `phone String? @unique @db.VarChar(15)`. NOTE: we deliberately
-- do NOT touch the existing `users_phone_key` UNIQUE index. In PostgreSQL a
-- standard UNIQUE index treats NULLs as DISTINCT, so it already permits many
-- phone-less rows — a partial `WHERE phone IS NOT NULL` index is unnecessary AND
-- would drift vs Prisma's @unique (which emits a full index). Drift-verified.
--
-- The platform DB has no _prisma_migrations table (initialised via db push), so
-- this is a manual SQL migration applied via psql.
--
-- Usage:
--   psql "$PLATFORM_DATABASE_URL" \
--     -f apps/api/prisma/platform-migrations/20260602_v13a_phone_nullable.sql
-- ════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE "users" ALTER COLUMN "phone" DROP NOT NULL;

COMMIT;

-- ────────────────────────────────────────────────────────────────────
-- Rollback (manual) — ONLY safe while NO phone-less (Google-only) rows exist;
-- SET NOT NULL fails hard if any users.phone IS NULL:
--   BEGIN;
--     ALTER TABLE "users" ALTER COLUMN "phone" SET NOT NULL;
--   COMMIT;
-- ════════════════════════════════════════════════════════════════════
