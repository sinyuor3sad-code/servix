-- ════════════════════════════════════════════════════════════════════
-- SERVIX — V-23 / A1-002 phase-1 — Encryption columns (platform)
-- Source: docs/principal-audit/synthesis-2026-05-14.md (HIGH P1)
-- ────────────────────────────────────────────────────────────────────
-- Adds nullable BYTEA columns for the encrypted-at-rest variants of
-- two secrets stored on the platform DB:
--   - users.two_factor_secret       (TOTP shared secret)
--   - whatsapp_instances.instance_token  (Evolution API token)
--
-- The plaintext columns are preserved alongside the new ones; backfill
-- is Phase 2 (Engineer 4 K1/K2) and the plaintext drop is Phase 3.
-- See docs/migrations/v23-encryption-rollout.md.
--
-- The platform DB has no _prisma_migrations table (initialised via
-- db push), so this is a manual SQL migration applied via psql — same
-- pattern as 20260425_compliance_platform_complaints.sql.
--
-- Usage:
--   psql "$PLATFORM_DATABASE_URL" \
--     -f apps/api/prisma/platform-migrations/20260519_v23_encryption_columns_phase1.sql
--
-- ADD COLUMN nullable BYTEA without a DEFAULT is metadata-only on
-- PostgreSQL 11+. Safe to run any time.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "two_factor_secret_encrypted" BYTEA;

ALTER TABLE "whatsapp_instances"
  ADD COLUMN IF NOT EXISTS "instance_token_encrypted" BYTEA;

-- ────────────────────────────────────────────────────────────────────
-- Rollback (manual):
--   ALTER TABLE "users"              DROP COLUMN IF EXISTS "two_factor_secret_encrypted";
--   ALTER TABLE "whatsapp_instances" DROP COLUMN IF EXISTS "instance_token_encrypted";
-- ════════════════════════════════════════════════════════════════════
