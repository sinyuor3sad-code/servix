-- ════════════════════════════════════════════════════════════════════
-- SERVIX — V-18 / A1-006 — Missing FK indices on platform tables
-- Source: docs/principal-audit/synthesis-2026-05-14.md (HIGH P1)
-- ────────────────────────────────────────────────────────────────────
-- Apply against the PLATFORM database only. The platform DB is not under
-- Prisma migrate (no _prisma_migrations table), so this is a manual SQL
-- migration applied via psql — same pattern as
-- 20260425_compliance_platform_complaints.sql.
--
-- Runbook: docs/migrations/v18-fk-indices-apply.md
--
-- Usage:
--   psql "$PLATFORM_DATABASE_URL" \
--     -f apps/api/prisma/platform-migrations/20260519_v18_fk_indices.sql
--
-- IMPORTANT: psql with -f executes each statement in autocommit mode
-- (no surrounding transaction), so CREATE INDEX CONCURRENTLY works.
-- Do NOT wrap this script in BEGIN/COMMIT.
-- ════════════════════════════════════════════════════════════════════

CREATE INDEX CONCURRENTLY IF NOT EXISTS "subscriptions_plan_id_idx"
  ON "subscriptions"("plan_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "platform_invoices_subscription_id_idx"
  ON "platform_invoices"("subscription_id");

-- ────────────────────────────────────────────────────────────────────
-- Rollback (manual):
--   DROP INDEX CONCURRENTLY IF EXISTS "subscriptions_plan_id_idx";
--   DROP INDEX CONCURRENTLY IF EXISTS "platform_invoices_subscription_id_idx";
-- ════════════════════════════════════════════════════════════════════
