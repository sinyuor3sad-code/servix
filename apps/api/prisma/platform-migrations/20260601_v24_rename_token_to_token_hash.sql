-- ════════════════════════════════════════════════════════════════════
-- SERVIX — V-24-rename — password_resets.token → token_hash (platform)
-- Source: docs/principal-audit/execution/engineer-2-database-auth.md (V-24-rename)
-- ────────────────────────────────────────────────────────────────────
-- Post-V-24 the column holds a sha256 hex EXCLUSIVELY (the raw token is never
-- stored). Renaming token → token_hash makes the raw-vs-hash contract explicit
-- at the schema level and prevents future code from re-introducing a plaintext
-- token. Cosmetic / clarity — no behavioural change.
--
-- Uses RENAME (NOT Prisma's auto-diff drop+add) so the rename is non-destructive
-- and preserves any existing rows. Index identifiers are renamed to match
-- Prisma's @@unique / @@index output for password_resets.tokenHash so there is
-- no schema/DB drift.
--
-- Platform DB has no _prisma_migrations table (db push init); apply via psql:
--   psql "$PLATFORM_DATABASE_URL" \
--     -f apps/api/prisma/platform-migrations/20260601_v24_rename_token_to_token_hash.sql
--
-- Idempotent-ish: wrapped in a tx; safe to run once. Re-running after success is
-- a no-op-with-error (column already renamed) — that is the intended guard.
-- ════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE "password_resets" RENAME COLUMN "token" TO "token_hash";

ALTER INDEX "password_resets_token_key" RENAME TO "password_resets_token_hash_key";
ALTER INDEX "password_resets_token_idx" RENAME TO "password_resets_token_hash_idx";

COMMIT;

-- ────────────────────────────────────────────────────────────────────
-- Rollback (manual):
--   BEGIN;
--     ALTER TABLE "password_resets" RENAME COLUMN "token_hash" TO "token";
--     ALTER INDEX "password_resets_token_hash_key" RENAME TO "password_resets_token_key";
--     ALTER INDEX "password_resets_token_hash_idx" RENAME TO "password_resets_token_idx";
--   COMMIT;
-- ════════════════════════════════════════════════════════════════════
