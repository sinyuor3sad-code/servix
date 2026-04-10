-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "EmployeeRole" AS ENUM ('stylist', 'cashier', 'makeup', 'nails', 'skincare');

-- CreateEnum
CREATE TYPE "CommissionType" AS ENUM ('percentage', 'fixed', 'none');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('female', 'male');

-- CreateEnum
CREATE TYPE "ClientSource" AS ENUM ('walk_in', 'online', 'phone', 'referral', 'whatsapp', 'campaign');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show');

-- CreateEnum
CREATE TYPE "AppointmentSource" AS ENUM ('online', 'phone', 'walk_in', 'dashboard', 'whatsapp');

-- CreateEnum
CREATE TYPE "AppointmentServiceStatus" AS ENUM ('pending', 'in_progress', 'completed');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('draft', 'paid', 'partially_paid', 'void', 'refunded');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'card', 'bank_transfer', 'wallet', 'stc_pay', 'apple_pay');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('completed', 'pending', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('percentage', 'fixed');

-- CreateEnum
CREATE TYPE "CouponType" AS ENUM ('percentage', 'fixed');

-- CreateEnum
CREATE TYPE "LoyaltyTransactionType" AS ENUM ('earned', 'redeemed', 'expired', 'adjusted');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('rent', 'salary', 'supplies', 'utilities', 'marketing', 'other');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('present', 'absent', 'on_break', 'off_duty', 'late', 'half_day', 'vacation');

-- CreateEnum
CREATE TYPE "NotificationRecipientType" AS ENUM ('employee', 'client');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('booking_new', 'booking_confirmed', 'booking_cancelled', 'booking_rescheduled', 'payment', 'reminder', 'healing', 'marketing', 'stock_alert', 'zatca', 'general');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('in_app', 'push', 'sms', 'whatsapp', 'email');

-- CreateEnum
CREATE TYPE "CommitmentType" AS ENUM ('appointment', 'shift', 'inventory_hold');

-- CreateEnum
CREATE TYPE "CommitmentState" AS ENUM ('pledged', 'confirmed', 'in_progress', 'fulfilled', 'broken', 'healed', 'cancelled');

-- CreateEnum
CREATE TYPE "HealingAction" AS ENUM ('reassigned', 'time_shifted', 'client_compensated', 'escalated');

-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('scheduled', 'active', 'completed', 'absent', 'late');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('purchase', 'consumption', 'adjustment', 'waste', 'return_to_supplier');

-- CreateEnum
CREATE TYPE "ChurnRisk" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "PriceSensitivity" AS ENUM ('low', 'moderate', 'high');

-- CreateEnum
CREATE TYPE "ZatcaInvoiceType" AS ENUM ('standard', 'simplified', 'debit_note', 'credit_note');

-- CreateEnum
CREATE TYPE "ZatcaSubmissionStatus" AS ENUM ('pending', 'submitted', 'cleared', 'reported', 'rejected', 'failed');

-- CreateEnum
CREATE TYPE "PricingRuleType" AS ENUM ('peak_hour', 'off_peak', 'weekend', 'prayer_time', 'demand_based', 'loyalty_tier', 'new_client');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "CampaignTrigger" AS ENUM ('manual', 'gap_detected', 'churn_risk', 'birthday', 'inactive_client', 'post_visit', 'review_request');

-- CreateTable
CREATE TABLE "salon_info" (
    "id" UUID NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,
    "name_en" VARCHAR(100),
    "tagline_ar" VARCHAR(200),
    "description_ar" TEXT,
    "phone" VARCHAR(15),
    "email" VARCHAR(100),
    "address" TEXT,
    "city" VARCHAR(50),
    "working_days" JSONB NOT NULL DEFAULT '{}',
    "opening_time" VARCHAR(5) NOT NULL DEFAULT '09:00',
    "closing_time" VARCHAR(5) NOT NULL DEFAULT '22:00',
    "slot_duration" INTEGER NOT NULL DEFAULT 30,
    "buffer_time" INTEGER NOT NULL DEFAULT 10,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'SAR',
    "tax_percentage" DECIMAL(5,2) NOT NULL DEFAULT 15.0,
    "tax_number" VARCHAR(20),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "salon_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_categories" (
    "id" UUID NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,
    "name_en" VARCHAR(100),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,
    "name_en" VARCHAR(100),
    "description_ar" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "duration" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "image_url" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packages" (
    "id" UUID NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,
    "name_en" VARCHAR(100),
    "original_price" DECIMAL(10,2) NOT NULL,
    "package_price" DECIMAL(10,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_services" (
    "package_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,

    CONSTRAINT "package_services_pkey" PRIMARY KEY ("package_id","service_id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "full_name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(15),
    "email" VARCHAR(100),
    "role" "EmployeeRole" NOT NULL DEFAULT 'stylist',
    "commission_type" "CommissionType" NOT NULL DEFAULT 'none',
    "commission_value" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "max_daily_appointments" INTEGER NOT NULL DEFAULT 12,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "avatar_url" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_services" (
    "employee_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "skill_level" SMALLINT NOT NULL DEFAULT 5,

    CONSTRAINT "employee_services_pkey" PRIMARY KEY ("employee_id","service_id")
);

-- CreateTable
CREATE TABLE "employee_schedules" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "is_day_off" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "employee_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_breaks" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "employee_breaks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "full_name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(15) NOT NULL,
    "email" VARCHAR(100),
    "gender" "Gender" NOT NULL DEFAULT 'female',
    "date_of_birth" DATE,
    "notes" TEXT,
    "source" "ClientSource" NOT NULL DEFAULT 'walk_in',
    "total_visits" INTEGER NOT NULL DEFAULT 0,
    "total_spent" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "last_visit_at" TIMESTAMPTZ,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "employee_id" UUID,
    "date" DATE NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'pending',
    "source" "AppointmentSource" NOT NULL DEFAULT 'dashboard',
    "notes" TEXT,
    "total_price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_duration" INTEGER NOT NULL DEFAULT 0,
    "original_employee_id" UUID,
    "reassigned_at" TIMESTAMPTZ,
    "reassignment_reason" VARCHAR(300),
    "inventory_deducted" BOOLEAN NOT NULL DEFAULT false,
    "original_price" DECIMAL(10,2),
    "pricing_rule_applied" VARCHAR(100),
    "cancelled_at" TIMESTAMPTZ,
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_services" (
    "id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "duration" INTEGER NOT NULL,
    "status" "AppointmentServiceStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "appointment_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "appointment_id" UUID,
    "client_id" UUID NOT NULL,
    "invoice_number" VARCHAR(20) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "created_by" UUID NOT NULL,
    "paid_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "service_id" UUID,
    "description" VARCHAR(200) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "total_price" DECIMAL(10,2) NOT NULL,
    "employee_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" VARCHAR(100),
    "status" "PaymentStatus" NOT NULL DEFAULT 'completed',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discounts" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "type" "DiscountType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" VARCHAR(200),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "type" "CouponType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "min_order" DECIMAL(10,2),
    "max_discount" DECIMAL(10,2),
    "usage_limit" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "valid_from" TIMESTAMPTZ NOT NULL,
    "valid_until" TIMESTAMPTZ NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_points" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "lifetime_points" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "loyalty_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_transactions" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "type" "LoyaltyTransactionType" NOT NULL,
    "points" INTEGER NOT NULL,
    "invoice_id" UUID,
    "description" VARCHAR(200),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "description" VARCHAR(200) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "date" DATE NOT NULL,
    "receipt_url" VARCHAR(500),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "check_in" VARCHAR(5),
    "check_out" VARCHAR(5),
    "is_on_break" BOOLEAN NOT NULL DEFAULT false,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'present',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "recipient_type" "NotificationRecipientType" NOT NULL,
    "recipient_id" UUID NOT NULL,
    "title_ar" VARCHAR(200) NOT NULL,
    "body_ar" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "data" JSONB,
    "sent_at" TIMESTAMPTZ,
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" UUID NOT NULL,
    "description" VARCHAR(300),
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "status" "ShiftStatus" NOT NULL DEFAULT 'scheduled',
    "max_load" INTEGER NOT NULL DEFAULT 8,
    "current_load" INTEGER NOT NULL DEFAULT 0,
    "checked_in_at" TIMESTAMPTZ,
    "checked_out_at" TIMESTAMPTZ,
    "late_minutes" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commitments" (
    "id" UUID NOT NULL,
    "type" "CommitmentType" NOT NULL,
    "state" "CommitmentState" NOT NULL DEFAULT 'pledged',
    "reference_id" UUID NOT NULL,
    "owner_employee_id" UUID,
    "client_id" UUID,
    "starts_at" TIMESTAMPTZ NOT NULL,
    "ends_at" TIMESTAMPTZ NOT NULL,
    "broken_at" TIMESTAMPTZ,
    "healed_at" TIMESTAMPTZ,
    "healing_action" "HealingAction",
    "healing_note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "commitments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commitment_dependencies" (
    "id" UUID NOT NULL,
    "commitment_id" UUID NOT NULL,
    "depends_on_id" UUID NOT NULL,
    "is_critical" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commitment_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" UUID NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,
    "name_en" VARCHAR(100),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,
    "name_en" VARCHAR(100),
    "sku" VARCHAR(50),
    "unit" VARCHAR(20) NOT NULL DEFAULT 'قطعة',
    "cost_price" DECIMAL(10,2) NOT NULL,
    "sell_price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "current_stock" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "min_stock" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_products" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity_per_use" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "service_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "type" "InventoryMovementType" NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "reference_type" VARCHAR(50),
    "reference_id" UUID,
    "note" VARCHAR(300),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_dna" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "predicted_clv" DECIMAL(10,2),
    "churn_risk" "ChurnRisk" NOT NULL DEFAULT 'low',
    "churn_probability" DECIMAL(5,4),
    "price_sensitivity" "PriceSensitivity" NOT NULL DEFAULT 'moderate',
    "avg_days_between_visits" DECIMAL(6,1),
    "days_since_last_visit" INTEGER,
    "expected_next_visit_at" TIMESTAMPTZ,
    "optimal_contact_hour" SMALLINT,
    "optimal_contact_day" SMALLINT,
    "prefers_whatsapp" BOOLEAN NOT NULL DEFAULT true,
    "avg_ticket_value" DECIMAL(10,2),
    "max_ticket_value" DECIMAL(10,2),
    "preferred_pay_method" "PaymentMethod",
    "top_service_ids" JSONB,
    "top_employee_ids" JSONB,
    "never_booked_categories" JSONB,
    "vip_score" SMALLINT NOT NULL DEFAULT 0,
    "is_vip" BOOLEAN NOT NULL DEFAULT false,
    "last_computed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "client_dna_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zatca_certificates" (
    "id" UUID NOT NULL,
    "csr_content" TEXT NOT NULL,
    "private_key" TEXT NOT NULL,
    "certificate_content" TEXT,
    "csid" VARCHAR(500),
    "csid_expires_at" TIMESTAMPTZ,
    "is_production" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "zatca_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zatca_invoices" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "certificate_id" UUID NOT NULL,
    "invoice_type" "ZatcaInvoiceType" NOT NULL,
    "invoice_sub_type" VARCHAR(10) NOT NULL,
    "xml_content" TEXT,
    "xml_hash" VARCHAR(128),
    "digital_signature" TEXT,
    "qr_code" TEXT,
    "submission_status" "ZatcaSubmissionStatus" NOT NULL DEFAULT 'pending',
    "zatca_request_id" VARCHAR(200),
    "zatca_invoice_hash" VARCHAR(200),
    "zatca_warnings" JSONB,
    "zatca_errors" JSONB,
    "submitted_at" TIMESTAMPTZ,
    "signed_xml_url" VARCHAR(500),
    "signed_pdf_url" VARCHAR(500),
    "invoice_counter_value" INTEGER NOT NULL,
    "previous_invoice_hash" VARCHAR(128),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "zatca_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_rules" (
    "id" UUID NOT NULL,
    "service_id" UUID,
    "rule_type" "PricingRuleType" NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,
    "multiplier" DECIMAL(5,3) NOT NULL DEFAULT 1.0,
    "fixed_adjustment" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "conditions" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" TIMESTAMPTZ,
    "valid_until" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" UUID NOT NULL,
    "name_ar" VARCHAR(200) NOT NULL,
    "trigger" "CampaignTrigger" NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'draft',
    "target_filter" JSONB,
    "message_ar" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'whatsapp',
    "coupon_id" UUID,
    "requires_slot_availability" BOOLEAN NOT NULL DEFAULT true,
    "scheduled_at" TIMESTAMPTZ,
    "executed_at" TIMESTAMPTZ,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "opened_count" INTEGER NOT NULL DEFAULT 0,
    "booked_count" INTEGER NOT NULL DEFAULT 0,
    "revenue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domain_events" (
    "id" UUID NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "aggregate_type" VARCHAR(50) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "emitted_by" VARCHAR(50),
    "processed_at" TIMESTAMPTZ,
    "failed_at" TIMESTAMPTZ,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "domain_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_debts" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "description" VARCHAR(200) NOT NULL,
    "type" VARCHAR(50) NOT NULL DEFAULT 'advance',
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "paid_at" TIMESTAMPTZ,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "employee_debts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_debts" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "invoice_id" UUID,
    "amount" DECIMAL(10,2) NOT NULL,
    "description" VARCHAR(200) NOT NULL,
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "paid_at" TIMESTAMPTZ,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "client_debts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "services_category_id_idx" ON "services"("category_id");

-- CreateIndex
CREATE INDEX "services_is_active_idx" ON "services"("is_active");

-- CreateIndex
CREATE INDEX "packages_is_active_idx" ON "packages"("is_active");

-- CreateIndex
CREATE INDEX "employees_is_active_idx" ON "employees"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "employee_schedules_employee_id_day_of_week_key" ON "employee_schedules"("employee_id", "day_of_week");

-- CreateIndex
CREATE INDEX "employee_breaks_employee_id_day_of_week_idx" ON "employee_breaks"("employee_id", "day_of_week");

-- CreateIndex
CREATE INDEX "clients_phone_idx" ON "clients"("phone");

-- CreateIndex
CREATE INDEX "clients_full_name_idx" ON "clients"("full_name");

-- CreateIndex
CREATE INDEX "clients_is_active_idx" ON "clients"("is_active");

-- CreateIndex
CREATE INDEX "appointments_client_id_idx" ON "appointments"("client_id");

-- CreateIndex
CREATE INDEX "appointments_employee_id_idx" ON "appointments"("employee_id");

-- CreateIndex
CREATE INDEX "appointments_date_idx" ON "appointments"("date");

-- CreateIndex
CREATE INDEX "appointments_status_idx" ON "appointments"("status");

-- CreateIndex
CREATE INDEX "appointments_date_status_idx" ON "appointments"("date", "status");

-- CreateIndex
CREATE INDEX "appointments_employee_id_date_idx" ON "appointments"("employee_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_employee_id_date_start_time_key" ON "appointments"("employee_id", "date", "start_time");

-- CreateIndex
CREATE INDEX "appointment_services_appointment_id_idx" ON "appointment_services"("appointment_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "invoices_client_id_idx" ON "invoices"("client_id");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_created_at_idx" ON "invoices"("created_at");

-- CreateIndex
CREATE INDEX "invoice_items_invoice_id_idx" ON "invoice_items"("invoice_id");

-- CreateIndex
CREATE INDEX "payments_invoice_id_idx" ON "payments"("invoice_id");

-- CreateIndex
CREATE INDEX "discounts_invoice_id_idx" ON "discounts"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "coupons_code_idx" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "coupons_is_active_idx" ON "coupons"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_points_client_id_key" ON "loyalty_points"("client_id");

-- CreateIndex
CREATE INDEX "loyalty_transactions_client_id_idx" ON "loyalty_transactions"("client_id");

-- CreateIndex
CREATE INDEX "loyalty_transactions_created_at_idx" ON "loyalty_transactions"("created_at");

-- CreateIndex
CREATE INDEX "expenses_date_idx" ON "expenses"("date");

-- CreateIndex
CREATE INDEX "expenses_category_idx" ON "expenses"("category");

-- CreateIndex
CREATE INDEX "attendance_date_idx" ON "attendance"("date");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_employee_id_date_key" ON "attendance"("employee_id", "date");

-- CreateIndex
CREATE INDEX "notifications_recipient_type_recipient_id_idx" ON "notifications"("recipient_type", "recipient_id");

-- CreateIndex
CREATE INDEX "notifications_recipient_id_is_read_idx" ON "notifications"("recipient_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_is_read_idx" ON "notifications"("is_read");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "activity_logs_user_id_idx" ON "activity_logs"("user_id");

-- CreateIndex
CREATE INDEX "activity_logs_entity_type_entity_id_idx" ON "activity_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs"("created_at");

-- CreateIndex
CREATE INDEX "shifts_date_status_idx" ON "shifts"("date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_employee_id_date_key" ON "shifts"("employee_id", "date");

-- CreateIndex
CREATE INDEX "commitments_type_state_idx" ON "commitments"("type", "state");

-- CreateIndex
CREATE INDEX "commitments_owner_employee_id_starts_at_idx" ON "commitments"("owner_employee_id", "starts_at");

-- CreateIndex
CREATE INDEX "commitments_client_id_idx" ON "commitments"("client_id");

-- CreateIndex
CREATE INDEX "commitments_reference_id_idx" ON "commitments"("reference_id");

-- CreateIndex
CREATE INDEX "commitments_state_starts_at_idx" ON "commitments"("state", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "commitment_dependencies_commitment_id_depends_on_id_key" ON "commitment_dependencies"("commitment_id", "depends_on_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "products_current_stock_idx" ON "products"("current_stock");

-- CreateIndex
CREATE UNIQUE INDEX "service_products_service_id_product_id_key" ON "service_products"("service_id", "product_id");

-- CreateIndex
CREATE INDEX "inventory_movements_product_id_created_at_idx" ON "inventory_movements"("product_id", "created_at");

-- CreateIndex
CREATE INDEX "inventory_movements_reference_type_reference_id_idx" ON "inventory_movements"("reference_type", "reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_dna_client_id_key" ON "client_dna"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "zatca_invoices_invoice_id_key" ON "zatca_invoices"("invoice_id");

-- CreateIndex
CREATE INDEX "zatca_invoices_submission_status_idx" ON "zatca_invoices"("submission_status");

-- CreateIndex
CREATE INDEX "zatca_invoices_created_at_idx" ON "zatca_invoices"("created_at");

-- CreateIndex
CREATE INDEX "pricing_rules_rule_type_is_active_idx" ON "pricing_rules"("rule_type", "is_active");

-- CreateIndex
CREATE INDEX "campaigns_status_idx" ON "campaigns"("status");

-- CreateIndex
CREATE INDEX "campaigns_trigger_idx" ON "campaigns"("trigger");

-- CreateIndex
CREATE INDEX "domain_events_event_type_created_at_idx" ON "domain_events"("event_type", "created_at");

-- CreateIndex
CREATE INDEX "domain_events_aggregate_type_aggregate_id_idx" ON "domain_events"("aggregate_type", "aggregate_id");

-- CreateIndex
CREATE INDEX "domain_events_processed_at_idx" ON "domain_events"("processed_at");

-- CreateIndex
CREATE INDEX "employee_debts_employee_id_idx" ON "employee_debts"("employee_id");

-- CreateIndex
CREATE INDEX "employee_debts_is_paid_idx" ON "employee_debts"("is_paid");

-- CreateIndex
CREATE INDEX "client_debts_client_id_idx" ON "client_debts"("client_id");

-- CreateIndex
CREATE INDEX "client_debts_is_paid_idx" ON "client_debts"("is_paid");

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_services" ADD CONSTRAINT "package_services_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_services" ADD CONSTRAINT "package_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_services" ADD CONSTRAINT "employee_services_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_services" ADD CONSTRAINT "employee_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_schedules" ADD CONSTRAINT "employee_schedules_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_breaks" ADD CONSTRAINT "employee_breaks_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_services" ADD CONSTRAINT "appointment_services_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_services" ADD CONSTRAINT "appointment_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_services" ADD CONSTRAINT "appointment_services_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_points" ADD CONSTRAINT "loyalty_points_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_owner_employee_id_fkey" FOREIGN KEY ("owner_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commitment_dependencies" ADD CONSTRAINT "commitment_dependencies_commitment_id_fkey" FOREIGN KEY ("commitment_id") REFERENCES "commitments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commitment_dependencies" ADD CONSTRAINT "commitment_dependencies_depends_on_id_fkey" FOREIGN KEY ("depends_on_id") REFERENCES "commitments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_products" ADD CONSTRAINT "service_products_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_products" ADD CONSTRAINT "service_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_dna" ADD CONSTRAINT "client_dna_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zatca_invoices" ADD CONSTRAINT "zatca_invoices_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zatca_invoices" ADD CONSTRAINT "zatca_invoices_certificate_id_fkey" FOREIGN KEY ("certificate_id") REFERENCES "zatca_certificates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_debts" ADD CONSTRAINT "employee_debts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_debts" ADD CONSTRAINT "client_debts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_debts" ADD CONSTRAINT "client_debts_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

