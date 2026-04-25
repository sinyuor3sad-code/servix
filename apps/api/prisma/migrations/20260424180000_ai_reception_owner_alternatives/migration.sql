ALTER TYPE "AIPendingActionStatus" ADD VALUE IF NOT EXISTS 'awaiting_customer';
ALTER TYPE "AIPendingActionStatus" ADD VALUE IF NOT EXISTS 'customer_accepted_alternative';
ALTER TYPE "AIPendingActionStatus" ADD VALUE IF NOT EXISTS 'alternative_rejected';
