-- ════════════════════════════════════════════════════════════════════
-- V-44 / A1-012 — Widen accumulator Decimal columns (tenant)
-- Source: docs/principal-audit/synthesis-2026-05-14.md (HIGH P1)
-- ────────────────────────────────────────────────────────────────────
-- Lifetime/unbounded accumulators move from NUMERIC(10,2) (max ≈ 100M)
-- to NUMERIC(14,2) (max ≈ 1T) — forward defense against overflow as
-- tenants age. Per-transaction columns (invoices, payments, shifts)
-- are intentionally left at (10,2); their natural cap is per-event.
--
-- ALTER COLUMN TYPE NUMERIC(p',s) with same scale (s) and increased
-- precision (p' > p) is metadata-only on PostgreSQL ≥ 9.2: no table
-- rewrite, no full table lock — only a brief AccessExclusiveLock for
-- the catalog update. Safe to run any time.
--
-- Apply via the runbook: docs/migrations/v44-apply.md
-- ════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE "clients"    ALTER COLUMN "total_spent"   TYPE NUMERIC(14, 2);
ALTER TABLE "campaigns"  ALTER COLUMN "revenue"       TYPE NUMERIC(14, 2);
ALTER TABLE "client_dna" ALTER COLUMN "predicted_clv" TYPE NUMERIC(14, 2);

COMMIT;

-- ────────────────────────────────────────────────────────────────────
-- Rollback (manual; safe only if no value already exceeds NUMERIC(10,2)
-- — max 99,999,999.99 ≈ 100M SAR. Verify with:
--   SELECT MAX(total_spent)   FROM clients;
--   SELECT MAX(revenue)       FROM campaigns;
--   SELECT MAX(predicted_clv) FROM client_dna;
-- Each must be ≤ 99999999.99 before rollback succeeds.):
--
--   BEGIN;
--     ALTER TABLE "clients"    ALTER COLUMN "total_spent"   TYPE NUMERIC(10, 2);
--     ALTER TABLE "campaigns"  ALTER COLUMN "revenue"       TYPE NUMERIC(10, 2);
--     ALTER TABLE "client_dna" ALTER COLUMN "predicted_clv" TYPE NUMERIC(10, 2);
--   COMMIT;
-- ════════════════════════════════════════════════════════════════════
