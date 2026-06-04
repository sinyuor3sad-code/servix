-- ════════════════════════════════════════════════════════════════════
-- V-77e — Reconcile tenant migration history with tenant.prisma
-- Source: discovered during V-77+ (migrate deploy unblock), 2026-06-03
-- ────────────────────────────────────────────────────────────────────
-- Root cause: create-tenant.ts provisions via `prisma db push`, so tenant.prisma
-- became the de-facto source of truth while the migration history lagged. Once
-- V-77+ made `prisma migrate deploy` run end-to-end, a fresh deploy produced a
-- DB that differed from tenant.prisma in ~21 ways (this migration). It is the
-- prerequisite for switching create-tenant.ts to migrate deploy (E1, V-77+):
-- without it, migrate-deploy-provisioned tenants would be MISSING columns that
-- db-push-provisioned tenants already have.
--
-- Every statement is idempotent (IF [NOT] EXISTS, or DROP DEFAULT which no-ops
-- when no default exists) so this is safe on BOTH a fresh tenant (migrate deploy
-- applies the changes) AND an existing db-push'd tenant (which already matches
-- tenant.prisma, so every statement is a no-op). Body = Prisma's own
-- `migrate diff` (deployed-history → tenant.prisma) with idempotency guards added.
--
-- Cross-scope note: reconciled objects span E3 (ai_* index names + dropped
-- ai_knowledge_snippets FK) and E4 (invoices refund/terminal/nfc columns +
-- index, salon_info ZATCA address columns). This only catches the migration
-- history up to schema those engineers already committed — no behaviour change.
-- Authorised as a scoped cross-scope exception by the owner.
-- ════════════════════════════════════════════════════════════════════

-- ─────────── DropForeignKey (schema no longer declares this relation) [E3] ───
ALTER TABLE "ai_knowledge_snippets"
  DROP CONSTRAINT IF EXISTS "ai_knowledge_snippets_source_escalation_id_fkey";

-- ─────────── Drop DB-side defaults Prisma generates app-side ─────────────────
-- (@default(uuid()) and @updatedAt are app-managed; the DB column carries no
--  default. DROP DEFAULT no-ops when there is none, so this is idempotent.)
ALTER TABLE "invoice_feedbacks"     ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "pos_checkout_attempts" ALTER COLUMN "id" DROP DEFAULT,
                                    ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "pos_held_bills"        ALTER COLUMN "id" DROP DEFAULT,
                                    ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "review_requests"       ALTER COLUMN "id" DROP DEFAULT,
                                    ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "self_orders"           ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "whatsapp_opt_outs"     ALTER COLUMN "id" DROP DEFAULT;

-- ─────────── Ghost columns (in tenant.prisma, never migrated) [E4] ───────────
ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "nfc_claimed_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "refund_reason"  VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "refunded_at"    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "terminal_id"    VARCHAR(50);

ALTER TABLE "salon_info"
  ADD COLUMN IF NOT EXISTS "building_number"          VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "commercial_registration"  VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "district"                 VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "postal_code"              VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "street"                   VARCHAR(200);

-- ─────────── Ghost indices ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "invoices_terminal_id_nfc_claimed_at_idx"
  ON "invoices"("terminal_id", "nfc_claimed_at");

-- review_requests appointment_id/invoice_id: the create migration made these
-- PARTIAL unique indexes (WHERE … IS NOT NULL); tenant.prisma's @unique on a
-- nullable column is a FULL unique index (Postgres treats NULLs as distinct, so
-- the two are functionally identical — multiple NULLs allowed either way). Drop
-- the partial form and recreate as full to match the schema. Atomic within this
-- migration's transaction, so there is no uniqueness gap.
DROP INDEX IF EXISTS "review_requests_appointment_id_key";
CREATE UNIQUE INDEX IF NOT EXISTS "review_requests_appointment_id_key"
  ON "review_requests"("appointment_id");
DROP INDEX IF EXISTS "review_requests_invoice_id_key";
CREATE UNIQUE INDEX IF NOT EXISTS "review_requests_invoice_id_key"
  ON "review_requests"("invoice_id");

-- ─────────── Align index names with Prisma @@index naming [E3 + review_requests] ─
ALTER INDEX IF EXISTS "ai_conversations_last_active_idx"
  RENAME TO "ai_conversations_last_active_at_idx";
ALTER INDEX IF EXISTS "ai_escalations_conversation_type_status_created_idx"
  RENAME TO "ai_escalations_conversation_id_escalation_type_status_creat_idx";
ALTER INDEX IF EXISTS "ai_escalations_status_created_idx"
  RENAME TO "ai_escalations_status_created_at_idx";
ALTER INDEX IF EXISTS "ai_knowledge_snippets_use_count_idx"
  RENAME TO "ai_knowledge_snippets_use_count_created_at_idx";
ALTER INDEX IF EXISTS "ai_pending_actions_conversation_idx"
  RENAME TO "ai_pending_actions_conversation_id_idx";
ALTER INDEX IF EXISTS "ai_pending_actions_customer_status_created_idx"
  RENAME TO "ai_pending_actions_customer_phone_status_created_at_idx";
ALTER INDEX IF EXISTS "ai_pending_actions_status_expires_idx"
  RENAME TO "ai_pending_actions_status_expires_at_idx";
ALTER INDEX IF EXISTS "review_requests_customer_phone_status_created_idx"
  RENAME TO "review_requests_customer_phone_status_created_at_idx";

-- ────────────────────────────────────────────────────────────────────
-- No rollback: this migration only makes the migration history match
-- tenant.prisma. Reverting would re-introduce the drift. If a specific object
-- must be undone, do it in a new forward migration that also updates tenant.prisma.
-- ════════════════════════════════════════════════════════════════════
