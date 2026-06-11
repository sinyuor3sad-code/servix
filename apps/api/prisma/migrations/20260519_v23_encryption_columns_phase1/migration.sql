-- ════════════════════════════════════════════════════════════════════
-- V-23 / A1-002 phase-1 — Encryption columns (tenant)
-- Source: docs/principal-audit/synthesis-2026-05-14.md (HIGH P1)
-- ────────────────────────────────────────────────────────────────────
-- Adds a nullable BYTEA column for the encrypted-at-rest variant of
-- ZatcaCertificate.private_key. The plaintext column is preserved
-- alongside the new one; backfill is Phase 2 (Engineer 4 K1/K2) and
-- the plaintext column drop is Phase 3.
--
-- See docs/migrations/v23-encryption-rollout.md for the full plan.
--
-- ADD COLUMN nullable BYTEA without a DEFAULT is a metadata-only
-- operation on PostgreSQL 11+ (no rewrite, no AccessExclusiveLock
-- beyond the catalog update). Safe to run any time.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE "zatca_certificates"
  ADD COLUMN IF NOT EXISTS "private_key_encrypted" BYTEA;

-- ────────────────────────────────────────────────────────────────────
-- Rollback (manual, not Prisma-generated):
--   ALTER TABLE "zatca_certificates" DROP COLUMN IF EXISTS "private_key_encrypted";
-- ════════════════════════════════════════════════════════════════════
