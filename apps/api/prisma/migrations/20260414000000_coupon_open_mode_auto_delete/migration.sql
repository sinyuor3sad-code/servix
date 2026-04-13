-- Coupon system upgrade: open-ended coupons + auto-delete

-- Make valid_until nullable (null = open-ended, no expiry)
ALTER TABLE "coupons" ALTER COLUMN "valid_until" DROP NOT NULL;

-- Add auto_delete flag (auto-cleanup after 24h of exhaustion/expiry)
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "auto_delete" BOOLEAN NOT NULL DEFAULT false;
