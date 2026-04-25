-- AI Reception feature — conversation state + pending actions.
-- Table names are snake_case to match Prisma @@map directives in tenant.prisma.

-- Enums ---------------------------------------------------------------

CREATE TYPE "AIPendingActionStatus" AS ENUM (
  'awaiting_manager',
  'approved',
  'rejected',
  'expired'
);

CREATE TYPE "AIPendingActionType" AS ENUM (
  'book_appointment',
  'cancel_appointment',
  'reschedule_appointment'
);

-- ai_conversations ----------------------------------------------------

CREATE TABLE "ai_conversations" (
  "id"             TEXT                     NOT NULL,
  "phone"          VARCHAR(20)              NOT NULL,
  "client_id"      UUID,
  "messages"       JSONB                    NOT NULL DEFAULT '[]'::jsonb,
  "last_active_at" TIMESTAMPTZ              NOT NULL,
  "created_at"     TIMESTAMPTZ              NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_conversations_phone_key"       ON "ai_conversations"("phone");
CREATE        INDEX "ai_conversations_last_active_idx" ON "ai_conversations"("last_active_at");

-- ai_pending_actions --------------------------------------------------

CREATE TABLE "ai_pending_actions" (
  "id"                 SERIAL                   NOT NULL,
  "conversation_id"    TEXT                     NOT NULL,
  "type"               "AIPendingActionType"    NOT NULL,
  "payload"            JSONB                    NOT NULL,
  "status"             "AIPendingActionStatus"  NOT NULL DEFAULT 'awaiting_manager',
  "manager_message_id" VARCHAR(100),
  "customer_phone"     VARCHAR(20)              NOT NULL,
  "expires_at"         TIMESTAMPTZ              NOT NULL,
  "resolved_at"        TIMESTAMPTZ,
  "resolved_by"        VARCHAR(20),
  "created_at"         TIMESTAMPTZ              NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ai_pending_actions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_pending_actions_status_expires_idx" ON "ai_pending_actions"("status", "expires_at");
CREATE INDEX "ai_pending_actions_conversation_idx"   ON "ai_pending_actions"("conversation_id");

ALTER TABLE "ai_pending_actions"
  ADD CONSTRAINT "ai_pending_actions_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
