-- ════════════════════════════════════════════════════════════════════
-- V-79 (tenant) — VARCHAR → enum for 3 fields, in-place with DEFENSIVE USING
-- Source: docs/principal-audit/synthesis-2026-05-14.md (V-79 / A1-014, LOW)
-- ────────────────────────────────────────────────────────────────────
-- Converts invoice_feedbacks.source / follow_up_status and review_requests.source
-- from VARCHAR to Postgres enums matching tenant.prisma. The USING clause is
-- DEFENSIVE: any value outside the enum set coerces to the column default instead
-- of failing the migration — so no pre-flight prod value-audit is required.
-- Justified for this context: pre-launch (test data only), the write paths emit
-- in-set values, and V-79 is LOW severity. A RAISE NOTICE reports coerced rows.
--
-- Enum sets = code-observed write set + schema default:
--   FeedbackSource = qr (default) | self_order | cashier   (public.service.ts:390)
--   FollowUpStatus = new (default) | reviewed | contacted  (feedback.service.ts:152)
--   ReviewSource   = invoice (default) | whatsapp
--
-- Plain transactional migration (no CONCURRENTLY) → Prisma wraps it in one tx,
-- so the coercion + type change is atomic. Index naming/types otherwise unchanged
-- → drift-clean vs tenant.prisma (verified on a scratch DB).
-- ════════════════════════════════════════════════════════════════════

CREATE TYPE "FeedbackSource" AS ENUM ('qr', 'self_order', 'cashier');
CREATE TYPE "FollowUpStatus" AS ENUM ('new', 'reviewed', 'contacted');
CREATE TYPE "ReviewSource"   AS ENUM ('invoice', 'whatsapp');

-- Visibility: report any rows whose value would be coerced (does not fail).
DO $$
DECLARE n_fs int; n_fus int; n_rs int;
BEGIN
  SELECT count(*) INTO n_fs  FROM "invoice_feedbacks" WHERE "source"           NOT IN ('qr','self_order','cashier');
  SELECT count(*) INTO n_fus FROM "invoice_feedbacks" WHERE "follow_up_status" NOT IN ('new','reviewed','contacted');
  SELECT count(*) INTO n_rs  FROM "review_requests"   WHERE "source"           NOT IN ('invoice','whatsapp');
  IF n_fs  > 0 THEN RAISE NOTICE 'V-79: % invoice_feedbacks.source row(s) coerced to default ''qr''', n_fs; END IF;
  IF n_fus > 0 THEN RAISE NOTICE 'V-79: % invoice_feedbacks.follow_up_status row(s) coerced to default ''new''', n_fus; END IF;
  IF n_rs  > 0 THEN RAISE NOTICE 'V-79: % review_requests.source row(s) coerced to default ''invoice''', n_rs; END IF;
END $$;

-- invoice_feedbacks.source → FeedbackSource (default 'qr')
ALTER TABLE "invoice_feedbacks" ALTER COLUMN "source" DROP DEFAULT;
ALTER TABLE "invoice_feedbacks" ALTER COLUMN "source" TYPE "FeedbackSource"
  USING (CASE WHEN "source" IN ('qr','self_order','cashier') THEN "source"::"FeedbackSource"
              ELSE 'qr'::"FeedbackSource" END);
ALTER TABLE "invoice_feedbacks" ALTER COLUMN "source" SET DEFAULT 'qr';

-- invoice_feedbacks.follow_up_status → FollowUpStatus (default 'new')
ALTER TABLE "invoice_feedbacks" ALTER COLUMN "follow_up_status" DROP DEFAULT;
ALTER TABLE "invoice_feedbacks" ALTER COLUMN "follow_up_status" TYPE "FollowUpStatus"
  USING (CASE WHEN "follow_up_status" IN ('new','reviewed','contacted') THEN "follow_up_status"::"FollowUpStatus"
              ELSE 'new'::"FollowUpStatus" END);
ALTER TABLE "invoice_feedbacks" ALTER COLUMN "follow_up_status" SET DEFAULT 'new';

-- review_requests.source → ReviewSource (default 'invoice')
ALTER TABLE "review_requests" ALTER COLUMN "source" DROP DEFAULT;
ALTER TABLE "review_requests" ALTER COLUMN "source" TYPE "ReviewSource"
  USING (CASE WHEN "source" IN ('invoice','whatsapp') THEN "source"::"ReviewSource"
              ELSE 'invoice'::"ReviewSource" END);
ALTER TABLE "review_requests" ALTER COLUMN "source" SET DEFAULT 'invoice';
