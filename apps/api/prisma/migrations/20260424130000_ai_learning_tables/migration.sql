-- AI Learning feature — escalations + knowledge snippets.
-- When the AI doesn't know the answer, it escalates to the owner. When the
-- owner replies, the answer becomes a knowledge snippet injected into future
-- prompts so the AI "learns" the salon's specifics over time.

CREATE TABLE "ai_escalations" (
  "id"                SERIAL       NOT NULL,
  "conversation_id"   TEXT         NOT NULL,
  "customer_phone"    VARCHAR(20)  NOT NULL,
  "customer_question" TEXT         NOT NULL,
  "customer_context"  TEXT,
  "uncertain_reason"  VARCHAR(200),
  "status"            VARCHAR(20)  NOT NULL DEFAULT 'pending',
  "manager_answer"    TEXT,
  "snippet_id"        INTEGER,
  "created_at"        TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "answered_at"       TIMESTAMPTZ,

  CONSTRAINT "ai_escalations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_escalations_status_created_idx" ON "ai_escalations"("status", "created_at");
CREATE INDEX "ai_escalations_customer_phone_idx" ON "ai_escalations"("customer_phone");

ALTER TABLE "ai_escalations"
  ADD CONSTRAINT "ai_escalations_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ai_knowledge_snippets" (
  "id"                   SERIAL       NOT NULL,
  "question"             TEXT         NOT NULL,
  "answer"               TEXT         NOT NULL,
  "keywords"             TEXT         NOT NULL DEFAULT '',
  "source_escalation_id" INTEGER,
  "use_count"            INTEGER      NOT NULL DEFAULT 0,
  "last_used_at"         TIMESTAMPTZ,
  "created_at"           TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ai_knowledge_snippets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_knowledge_snippets_use_count_idx" ON "ai_knowledge_snippets"("use_count" DESC, "created_at" DESC);

ALTER TABLE "ai_knowledge_snippets"
  ADD CONSTRAINT "ai_knowledge_snippets_source_escalation_id_fkey"
  FOREIGN KEY ("source_escalation_id") REFERENCES "ai_escalations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_escalations"
  ADD CONSTRAINT "ai_escalations_snippet_id_fkey"
  FOREIGN KEY ("snippet_id") REFERENCES "ai_knowledge_snippets"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
