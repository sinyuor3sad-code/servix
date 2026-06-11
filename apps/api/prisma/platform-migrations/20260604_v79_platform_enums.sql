-- ════════════════════════════════════════════════════════════════════
-- V-79 (platform) — VARCHAR → enum for 4 fields, in-place with DEFENSIVE USING
-- Source: docs/principal-audit/synthesis-2026-05-14.md (V-79 / A1-014, LOW)
-- ────────────────────────────────────────────────────────────────────
-- Platform DB has no _prisma_migrations (db-push pattern), so this is applied by
-- psql (same flow as prior platform-migrations/*.sql) and the schema is kept in
-- sync via `prisma db push` of platform.prisma.
--
-- DEFENSIVE USING: any value outside the enum set coerces to a safe fallback
-- instead of failing, so no pre-flight prod value-audit is required (pre-launch,
-- LOW severity, write paths emit in-set values). RAISE NOTICE reports coerced
-- rows. Enum sets = schema comments + the @IsIn validation in admin.dto.ts:
--   BillingMode     = recurring (default) | one_time | usage   (plan_addons)
--   BackupInitiator = auto | manual           (platform_backups; code writes 'manual')
--   NotifChannel    = email | sms | push | whatsapp                 (admin.dto.ts:253)
--   NotifTarget     = all | basic | pro | enterprise | expiring | trial (admin.dto.ts:257)
--
-- Idempotency: this whole script runs in one psql transaction (no CONCURRENTLY),
-- so a partial failure rolls back cleanly and the script can be re-run. Resulting
-- column types/defaults match `prisma db push` of platform.prisma (drift-clean,
-- verified on a scratch DB).
-- ════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TYPE "BillingMode"     AS ENUM ('recurring', 'one_time', 'usage');
CREATE TYPE "BackupInitiator" AS ENUM ('auto', 'manual');
CREATE TYPE "NotifChannel"    AS ENUM ('email', 'sms', 'push', 'whatsapp');
CREATE TYPE "NotifTarget"     AS ENUM ('all', 'basic', 'pro', 'enterprise', 'expiring', 'trial');

-- Visibility: report any rows that will be coerced (does not fail).
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM "plan_addons"           WHERE "billing_mode" NOT IN ('recurring','one_time','usage');
  IF n > 0 THEN RAISE NOTICE 'V-79: % plan_addons.billing_mode row(s) coerced to ''recurring''', n; END IF;
  SELECT count(*) INTO n FROM "platform_backups"      WHERE "initiator"    NOT IN ('auto','manual');
  IF n > 0 THEN RAISE NOTICE 'V-79: % platform_backups.initiator row(s) coerced to ''manual''', n; END IF;
  SELECT count(*) INTO n FROM "platform_notifications" WHERE "channel"     NOT IN ('email','sms','push','whatsapp');
  IF n > 0 THEN RAISE NOTICE 'V-79: % platform_notifications.channel row(s) coerced to ''email''', n; END IF;
  SELECT count(*) INTO n FROM "platform_notifications" WHERE "target"      NOT IN ('all','basic','pro','enterprise','expiring','trial');
  IF n > 0 THEN RAISE NOTICE 'V-79: % platform_notifications.target row(s) coerced to ''all''', n; END IF;
END $$;

-- plan_addons.billing_mode → BillingMode (default 'recurring')
ALTER TABLE "plan_addons" ALTER COLUMN "billing_mode" DROP DEFAULT;
ALTER TABLE "plan_addons" ALTER COLUMN "billing_mode" TYPE "BillingMode"
  USING (CASE WHEN "billing_mode" IN ('recurring','one_time','usage') THEN "billing_mode"::"BillingMode"
              ELSE 'recurring'::"BillingMode" END);
ALTER TABLE "plan_addons" ALTER COLUMN "billing_mode" SET DEFAULT 'recurring';

-- platform_backups.initiator → BackupInitiator (no default in schema)
ALTER TABLE "platform_backups" ALTER COLUMN "initiator" TYPE "BackupInitiator"
  USING (CASE WHEN "initiator" IN ('auto','manual') THEN "initiator"::"BackupInitiator"
              ELSE 'manual'::"BackupInitiator" END);

-- platform_notifications.channel → NotifChannel (no default)
ALTER TABLE "platform_notifications" ALTER COLUMN "channel" TYPE "NotifChannel"
  USING (CASE WHEN "channel" IN ('email','sms','push','whatsapp') THEN "channel"::"NotifChannel"
              ELSE 'email'::"NotifChannel" END);

-- platform_notifications.target → NotifTarget (no default)
ALTER TABLE "platform_notifications" ALTER COLUMN "target" TYPE "NotifTarget"
  USING (CASE WHEN "target" IN ('all','basic','pro','enterprise','expiring','trial') THEN "target"::"NotifTarget"
              ELSE 'all'::"NotifTarget" END);

COMMIT;

-- ────────────────────────────────────────────────────────────────────
-- Down (manual): convert back to VARCHAR, then DROP TYPE.
--   ALTER TABLE "plan_addons"            ALTER COLUMN "billing_mode" TYPE VARCHAR(20) USING "billing_mode"::text;
--   ALTER TABLE "platform_backups"       ALTER COLUMN "initiator"    TYPE VARCHAR(50) USING "initiator"::text;
--   ALTER TABLE "platform_notifications" ALTER COLUMN "channel"      TYPE VARCHAR(20) USING "channel"::text;
--   ALTER TABLE "platform_notifications" ALTER COLUMN "target"       TYPE VARCHAR(50) USING "target"::text;
--   DROP TYPE "BillingMode"; DROP TYPE "BackupInitiator"; DROP TYPE "NotifChannel"; DROP TYPE "NotifTarget";
-- ════════════════════════════════════════════════════════════════════
