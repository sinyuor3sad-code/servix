-- Plan Catalog Extension Migration
-- Safe: all new columns have defaults, no data loss

-- Plans table extensions
ALTER TABLE plans ADD COLUMN IF NOT EXISTS name_en VARCHAR(100);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS slug VARCHAR(50) UNIQUE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS badge VARCHAR(30);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true NOT NULL;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT false NOT NULL;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS setup_fee DECIMAL(10,2) DEFAULT 0 NOT NULL;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS trial_enabled BOOLEAN DEFAULT true NOT NULL;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS upgrade_allowed BOOLEAN DEFAULT true NOT NULL;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS downgrade_allowed BOOLEAN DEFAULT true NOT NULL;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Features table extensions
ALTER TABLE features ADD COLUMN IF NOT EXISTS name_en VARCHAR(100);
ALTER TABLE features ADD COLUMN IF NOT EXISTS category VARCHAR(50);
ALTER TABLE features ADD COLUMN IF NOT EXISTS is_addon BOOLEAN DEFAULT false NOT NULL;
ALTER TABLE features ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0 NOT NULL;
CREATE INDEX IF NOT EXISTS idx_features_category ON features(category);

-- PlanFeature table extensions
ALTER TABLE plan_features ADD COLUMN IF NOT EXISTS limit_value INTEGER;
ALTER TABLE plan_features ADD COLUMN IF NOT EXISTS is_included BOOLEAN DEFAULT true NOT NULL;

-- Subscription table extensions
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT true NOT NULL;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS metadata JSONB;

-- PlanAddon table (new)
CREATE TABLE IF NOT EXISTS plan_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100) NOT NULL,
  code VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  price_monthly DECIMAL(10,2) DEFAULT 0 NOT NULL,
  price_yearly DECIMAL(10,2) DEFAULT 0 NOT NULL,
  billing_mode VARCHAR(20) DEFAULT 'recurring' NOT NULL,
  feature_id UUID REFERENCES features(id),
  limit_boost INTEGER,
  applicable_plans JSONB,
  is_active BOOLEAN DEFAULT true NOT NULL,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Seed Feature Catalog
INSERT INTO features (id, code, name_ar, name_en, description_ar, category, sort_order, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'services', 'إدارة الخدمات', 'Service Management', 'إنشاء وتعديل الخدمات المقدمة', 'operations', 1, NOW(), NOW()),
  (gen_random_uuid(), 'customer_mgmt', 'إدارة العملاء', 'Customer Management', 'سجل العملاء وبياناتهم', 'customers', 2, NOW(), NOW()),
  (gen_random_uuid(), 'appointments', 'إدارة المواعيد', 'Appointment Management', 'حجز وإدارة المواعيد', 'scheduling', 3, NOW(), NOW()),
  (gen_random_uuid(), 'pos', 'نقاط البيع', 'Point of Sale', 'نظام نقاط البيع والفوترة', 'pos', 4, NOW(), NOW()),
  (gen_random_uuid(), 'invoices', 'إدارة الفواتير', 'Invoice Management', 'إنشاء وتتبع الفواتير', 'pos', 5, NOW(), NOW()),
  (gen_random_uuid(), 'basic_reports', 'التقارير الأساسية', 'Basic Reports', 'تقارير المبيعات والأداء الأساسية', 'reports', 6, NOW(), NOW()),
  (gen_random_uuid(), 'advanced_reports', 'التقارير المتقدمة', 'Advanced Reports', 'تقارير تحليلية وذكاء أعمال', 'reports', 7, NOW(), NOW()),
  (gen_random_uuid(), 'expense_mgmt', 'إدارة المصروفات', 'Expense Management', 'تتبع المصروفات والميزانية', 'finance', 8, NOW(), NOW()),
  (gen_random_uuid(), 'attendance', 'الحضور والانصراف', 'Attendance & Shifts', 'نظام الحضور والورديات', 'staff', 9, NOW(), NOW()),
  (gen_random_uuid(), 'online_booking', 'الحجز الإلكتروني', 'Online Booking', 'حجز المواعيد عبر الإنترنت', 'scheduling', 10, NOW(), NOW()),
  (gen_random_uuid(), 'loyalty', 'برنامج الولاء', 'Loyalty Program', 'نقاط ومكافآت العملاء', 'marketing', 11, NOW(), NOW()),
  (gen_random_uuid(), 'promotions', 'العروض والباقات', 'Promotions & Packages', 'إدارة العروض والعروض الترويجية', 'marketing', 12, NOW(), NOW()),
  (gen_random_uuid(), 'employee_permissions', 'صلاحيات الموظفين', 'Employee Permissions', 'نظام الأدوار والصلاحيات', 'staff', 13, NOW(), NOW()),
  (gen_random_uuid(), 'multi_branch', 'تعدد الفروع', 'Multi-Branch', 'إدارة فروع متعددة', 'operations', 14, NOW(), NOW()),
  (gen_random_uuid(), 'inventory', 'إدارة المخزون', 'Inventory Management', 'تتبع المنتجات والمخزون', 'inventory', 15, NOW(), NOW()),
  (gen_random_uuid(), 'notifications_sms', 'إشعارات SMS', 'SMS Notifications', 'إشعارات الرسائل النصية', 'integrations', 16, NOW(), NOW()),
  (gen_random_uuid(), 'notifications_whatsapp', 'إشعارات واتساب', 'WhatsApp Notifications', 'إشعارات عبر واتساب', 'integrations', 17, NOW(), NOW()),
  (gen_random_uuid(), 'exports', 'التصدير', 'Data Export', 'تصدير البيانات والتقارير', 'system', 18, NOW(), NOW()),
  (gen_random_uuid(), 'api_access', 'واجهة API', 'API Access', 'الوصول لواجهة البرمجة', 'integrations', 19, NOW(), NOW()),
  (gen_random_uuid(), 'backup', 'النسخ الاحتياطي', 'Backup', 'النسخ الاحتياطي للبيانات', 'system', 20, NOW(), NOW()),
  (gen_random_uuid(), 'audit_trail', 'سجل التدقيق', 'Audit Trail', 'تتبع جميع العمليات', 'system', 21, NOW(), NOW()),
  (gen_random_uuid(), 'ai_recommendations', 'توصيات ذكية', 'AI Recommendations', 'توصيات مدعومة بالذكاء الاصطناعي', 'ai', 22, NOW(), NOW()),
  (gen_random_uuid(), 'automation', 'الأتمتة', 'Automation Workflows', 'سير عمل آلي', 'ai', 23, NOW(), NOW()),
  (gen_random_uuid(), 'zatca', 'الربط مع زاتكا', 'ZATCA Integration', 'الفوترة الإلكترونية المتوافقة', 'finance', 24, NOW(), NOW()),
  (gen_random_uuid(), 'payment_gateway', 'بوابة الدفع', 'Payment Gateway', 'الدفع الإلكتروني', 'integrations', 25, NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
  name_en = EXCLUDED.name_en,
  category = EXCLUDED.category,
  description_ar = EXCLUDED.description_ar,
  sort_order = EXCLUDED.sort_order;
