-- ════════════════════════════════════════════════════════════════════
-- SERVIX — V-44 / A1-012 — Widen accumulator Decimal columns (platform)
-- Source: docs/principal-audit/synthesis-2026-05-14.md (HIGH P1)
-- ────────────────────────────────────────────────────────────────────
-- Widens tenant_usage_logs.total_revenue from NUMERIC(12,2) to
-- NUMERIC(14,2). Same scale (2), increased precision → metadata-only
-- on PostgreSQL ≥ 9.2.
--
-- The platform DB has no _prisma_migrations table (initialised via
-- db push), so this is a manual SQL migration applied via psql.
--
-- Usage:
--   psql "$PLATFORM_DATABASE_URL" \
--     -f apps/api/prisma/platform-migrations/20260519_v44_decimal_widening.sql
-- ════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE "tenant_usage_logs"
  ALTER COLUMN "total_revenue" TYPE NUMERIC(14, 2);

COMMIT;

-- ────────────────────────────────────────────────────────────────────
-- Rollback (manual; safe only if MAX(total_revenue) ≤ 9,999,999,999.99):
--   BEGIN;
--     ALTER TABLE "tenant_usage_logs"
--       ALTER COLUMN "total_revenue" TYPE NUMERIC(12, 2);
--   COMMIT;
-- ════════════════════════════════════════════════════════════════════
