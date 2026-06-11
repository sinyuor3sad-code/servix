-- ════════════════════════════════════════════════════════════════════
-- SERVIX — V-42 — 2FA backup (recovery) codes table (platform)
-- Source: docs/principal-audit/synthesis-2026-05-14.md (P2)
-- ────────────────────────────────────────────────────────────────────
-- New table backing single-use 2FA recovery codes. Codes are bcrypt-hashed
-- in app code (cost 12, same as passwords); used_at enforces single-use via
-- an atomic guarded UPDATE. ON DELETE CASCADE so codes die with the user.
-- Column shapes/constraint names match Prisma's @@map output (no db-push drift).
--
-- The platform DB has no _prisma_migrations table (initialised via db push),
-- so this is a manual SQL migration applied via psql.
--
-- Usage:
--   psql "$PLATFORM_DATABASE_URL" \
--     -f apps/api/prisma/platform-migrations/20260529_v42_2fa_backup_codes.sql
-- ════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS "two_factor_backup_codes" (
  "id"         UUID         NOT NULL,
  "user_id"    UUID         NOT NULL,
  "code_hash"  VARCHAR(255) NOT NULL,
  "used_at"    TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "two_factor_backup_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "two_factor_backup_codes_user_id_idx"
  ON "two_factor_backup_codes" ("user_id");

ALTER TABLE "two_factor_backup_codes"
  ADD CONSTRAINT "two_factor_backup_codes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;

-- ────────────────────────────────────────────────────────────────────
-- Rollback (manual):
--   BEGIN;
--     DROP TABLE IF EXISTS "two_factor_backup_codes";
--   COMMIT;
-- ════════════════════════════════════════════════════════════════════
