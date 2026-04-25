-- AI Reception phase 1 safety fields.
-- Additive only: supports idempotent timeout notification and customer stop requests.

ALTER TYPE "AIPendingActionStatus" ADD VALUE IF NOT EXISTS 'cancelled_by_customer';

ALTER TABLE "ai_pending_actions"
  ADD COLUMN IF NOT EXISTS "timeout_notification_sent" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "timeout_notified_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "do_not_disturb" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "cancel_reason" VARCHAR(100);

CREATE INDEX IF NOT EXISTS "ai_pending_actions_customer_status_created_idx"
  ON "ai_pending_actions"("customer_phone", "status", "created_at");

CREATE INDEX IF NOT EXISTS "ai_pending_actions_timeout_claim_idx"
  ON "ai_pending_actions"("status", "expires_at", "timeout_notification_sent")
  WHERE "do_not_disturb" = FALSE;
