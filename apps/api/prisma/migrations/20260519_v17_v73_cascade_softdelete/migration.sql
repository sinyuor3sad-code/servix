-- ════════════════════════════════════════════════════════════════════
-- V-17 / A1-003 + V-73 / A1-010 (merged) — Cascade redesign + soft-delete
-- Source: docs/principal-audit/synthesis-2026-05-14.md (HIGH P1)
-- ────────────────────────────────────────────────────────────────────
-- Four sections, applied atomically within the migration's transaction
-- (Prisma wraps the whole migration in one tx — a partial failure rolls the
-- entire migration back, so no FK is ever left in a torn state):
--   §1  Convert ON DELETE CASCADE → ON DELETE RESTRICT on 5 FK relations
--       that protect financial/loyalty integrity.
--   §2  Add `deleted_at` columns on invoices and payments (soft-delete).
--       IF NOT EXISTS keeps re-runs idempotent.
--   §3  Partial index on invoices(client_id) WHERE deleted_at IS NULL.
--       Plain CREATE INDEX — instant on the empty tenant DBs migrate deploy
--       targets. For an EXISTING POPULATED tenant, build it OUT-OF-BAND first
--       to avoid locking writes (then this is a no-op via IF NOT EXISTS):
--         psql "$TENANT_DATABASE_URL" -c 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "invoices_client_id_active_idx" ON "invoices" ("client_id") WHERE "deleted_at" IS NULL;'
--       (Was CONCURRENTLY in-file until V-77+; removed because Prisma runs a
--       no-transaction migration as one multi-statement implicit tx, where
--       CONCURRENTLY is forbidden.)
--   §4  ZATCA-finalized invoice delete protection. Trigger function +
--       trigger on invoices. CREATE OR REPLACE / DROP IF EXISTS make
--       this idempotent. Function references zatca_invoices because
--       submission_status lives on that table, not on invoices itself.
--
-- Apply via the runbook: docs/migrations/v17-v73-apply.md
-- ════════════════════════════════════════════════════════════════════

-- ─────────── §1 — Convert 5 FKs from CASCADE to RESTRICT ─────────────
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_invoice_id_fkey";
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "discounts" DROP CONSTRAINT IF EXISTS "discounts_invoice_id_fkey";
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "loyalty_transactions" DROP CONSTRAINT IF EXISTS "loyalty_transactions_client_id_fkey";
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "client_debts" DROP CONSTRAINT IF EXISTS "client_debts_client_id_fkey";
ALTER TABLE "client_debts" ADD CONSTRAINT "client_debts_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "employee_debts" DROP CONSTRAINT IF EXISTS "employee_debts_employee_id_fkey";
ALTER TABLE "employee_debts" ADD CONSTRAINT "employee_debts_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

-- ─────────── §2 — Soft-delete columns (idempotent) ───────────────────
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ;

-- ─────────── §3 — Partial index on active invoices ───────────────────
-- Plain CREATE INDEX (runs inside the migration's transaction). For an
-- existing populated tenant, build out-of-band with CONCURRENTLY first
-- (see the header note) so writes are never locked.
CREATE INDEX IF NOT EXISTS "invoices_client_id_active_idx"
  ON "invoices" ("client_id") WHERE "deleted_at" IS NULL;

-- ─────────── §4 — ZATCA-finalized invoice delete protection ──────────
-- Blocks DELETE on invoices whose ZATCA submission_status is
-- 'submitted', 'cleared', or 'reported'. These three states represent
-- submissions that have left our system and are subject to ZATCA's
-- 6-year retention obligation. 'pending', 'rejected', and 'failed'
-- remain deletable (no legal commitment was created).
CREATE OR REPLACE FUNCTION prevent_zatca_finalized_invoice_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM zatca_invoices
    WHERE invoice_id = OLD.id
      AND submission_status IN ('submitted', 'cleared', 'reported')
  ) THEN
    RAISE EXCEPTION 'Cannot delete ZATCA-finalized invoice % (status: submitted/cleared/reported, 6y retention)', OLD.id
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "no_delete_finalized_zatca_invoices" ON "invoices";
CREATE TRIGGER "no_delete_finalized_zatca_invoices"
  BEFORE DELETE ON "invoices"
  FOR EACH ROW EXECUTE FUNCTION prevent_zatca_finalized_invoice_delete();

-- ════════════════════════════════════════════════════════════════════
-- Rollback (manual, NOT auto-generated by Prisma):
--
--   -- §4 reverse
--   DROP TRIGGER IF EXISTS "no_delete_finalized_zatca_invoices" ON "invoices";
--   DROP FUNCTION IF EXISTS prevent_zatca_finalized_invoice_delete();
--
--   -- §3 reverse (plain; on a populated tenant prefer
--   --  DROP INDEX CONCURRENTLY IF EXISTS … on its own psql -c call)
--   DROP INDEX IF EXISTS "invoices_client_id_active_idx";
--
--   -- §2 reverse (data-loss warning: existing deleted_at timestamps
--   -- are dropped; only run if no soft-deleted rows exist)
--   ALTER TABLE "payments" DROP COLUMN IF EXISTS "deleted_at";
--   ALTER TABLE "invoices" DROP COLUMN IF EXISTS "deleted_at";
--
--   -- §1 reverse — restore CASCADE
--   ALTER TABLE "employee_debts" DROP CONSTRAINT "employee_debts_employee_id_fkey";
--   ALTER TABLE "employee_debts" ADD CONSTRAINT "employee_debts_employee_id_fkey"
--     FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
--     ON UPDATE CASCADE ON DELETE CASCADE;
--   ALTER TABLE "client_debts" DROP CONSTRAINT "client_debts_client_id_fkey";
--   ALTER TABLE "client_debts" ADD CONSTRAINT "client_debts_client_id_fkey"
--     FOREIGN KEY ("client_id") REFERENCES "clients"("id")
--     ON UPDATE CASCADE ON DELETE CASCADE;
--   ALTER TABLE "loyalty_transactions" DROP CONSTRAINT "loyalty_transactions_client_id_fkey";
--   ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_client_id_fkey"
--     FOREIGN KEY ("client_id") REFERENCES "clients"("id")
--     ON UPDATE CASCADE ON DELETE CASCADE;
--   ALTER TABLE "discounts" DROP CONSTRAINT "discounts_invoice_id_fkey";
--   ALTER TABLE "discounts" ADD CONSTRAINT "discounts_invoice_id_fkey"
--     FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id")
--     ON UPDATE CASCADE ON DELETE CASCADE;
--   ALTER TABLE "payments" DROP CONSTRAINT "payments_invoice_id_fkey";
--   ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey"
--     FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id")
--     ON UPDATE CASCADE ON DELETE CASCADE;
-- ════════════════════════════════════════════════════════════════════
