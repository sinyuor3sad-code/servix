-- ════════════════════════════════════════════════════════════════════
-- SERVIX — V-40a — Account self-unlock tokens (platform)
-- Source: docs/principal-audit/synthesis-2026-05-14.md (V-40, P1)
-- ────────────────────────────────────────────────────────────────────
-- Backs the email self-unlock flow: a locked-out user (V-25 account lock)
-- requests an emailed unlock link, then redeems it to clear their own
-- account lock. Tokens are sha256-hashed at rest (V-24 parity), single-use
-- (used_at), short-lived (1h, set in app code). ON DELETE CASCADE.
-- Column shapes / constraint names match Prisma's @@map output (no drift).
--
-- NOTE: V-40 stays PARTIALLY OPEN — this (V-40a) reduces DoS IMPACT only;
-- the CAPTCHA half (V-40b, gated: Turnstile + frontend E3 + env E1) reduces
-- LIKELIHOOD and is filed separately.
--
-- Platform DB has no _prisma_migrations table (db push init); apply via psql:
--   psql "$PLATFORM_DATABASE_URL" \
--     -f apps/api/prisma/platform-migrations/20260530_v40a_account_unlocks.sql
-- ════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS "account_unlocks" (
  "id"         UUID         NOT NULL,
  "user_id"    UUID         NOT NULL,
  "token_hash" VARCHAR(64)  NOT NULL,
  "expires_at" TIMESTAMPTZ  NOT NULL,
  "used_at"    TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "account_unlocks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "account_unlocks_token_hash_key"
  ON "account_unlocks" ("token_hash");

CREATE INDEX IF NOT EXISTS "account_unlocks_user_id_idx"
  ON "account_unlocks" ("user_id");

ALTER TABLE "account_unlocks"
  ADD CONSTRAINT "account_unlocks_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;

-- ────────────────────────────────────────────────────────────────────
-- Rollback (manual):
--   BEGIN;
--     DROP TABLE IF EXISTS "account_unlocks";
--   COMMIT;
-- ════════════════════════════════════════════════════════════════════
