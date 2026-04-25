ALTER TABLE "ai_conversations"
  ADD COLUMN IF NOT EXISTS "state" JSONB NOT NULL DEFAULT '{}'::jsonb;
