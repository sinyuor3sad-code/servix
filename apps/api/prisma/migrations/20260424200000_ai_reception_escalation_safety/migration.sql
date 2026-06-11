ALTER TABLE "ai_escalations"
  ADD COLUMN IF NOT EXISTS "customer_name" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "last_customer_message" TEXT,
  ADD COLUMN IF NOT EXISTS "escalation_type" VARCHAR(50) NOT NULL DEFAULT 'unclear',
  ADD COLUMN IF NOT EXISTS "related_request_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "notified_manager" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "last_notified_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "occurrence_count" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS "ai_escalations_conversation_type_status_created_idx"
  ON "ai_escalations"("conversation_id", "escalation_type", "status", "created_at");
