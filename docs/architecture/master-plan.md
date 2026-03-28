# 🗺️ SERVIX — Master Plan (التخطيط الكامل)
## مارس 2026 | Version 1.0

---

## 1. القرارات المعمارية المثبّتة ✅

| # | القرار | الاختيار |
|---|--------|----------|
| 1 | نموذج العمل | Hybrid SaaS (اشتراك + صفحة حجز عامة) |
| 2 | القطاع الأول | صالونات نسائية — السعودية |
| 3 | البنية | Core Platform + Salon Module |
| 4 | عزل البيانات | قاعدة بيانات مستقلة لكل صالون |
| 5 | الدخل | اشتراكات شهرية (Basic / Pro / Premium) |
| 6 | الثيمات | 6 ثيمات + ألوان مخصصة + شعار العميل |
| 7 | الواجهات | Dashboard + POS + Booking Page + Admin Panel |
| 8 | Real-time | WebSocket + Redis Pub/Sub |
| 9 | التوسع المستقبلي | مطاعم، عيادات، حلاقة (modules إضافية) |

---

## 2. تصميم قاعدة البيانات

### 2A. Platform Database (مشتركة — instance واحد)

```
tenants
├── id                  UUID PK
├── name_ar             VARCHAR(100)     "صالون الأناقة"
├── name_en             VARCHAR(100)     "Elegance Salon"
├── slug                VARCHAR(50)      "elegance" → elegance.servi-x.com
├── logo_url            VARCHAR(500)
├── primary_color       VARCHAR(7)       "#8B5CF6"
├── theme               ENUM             elegance|modern|vivid|minimal|corporate|royal
├── database_name       VARCHAR(50)      "tenant_abc123"
├── status              ENUM             active|suspended|trial|cancelled
├── trial_ends_at       TIMESTAMP
├── phone               VARCHAR(15)
├── email               VARCHAR(100)
├── city                VARCHAR(50)
├── address             TEXT
├── latitude            DECIMAL
├── longitude           DECIMAL
├── created_at          TIMESTAMP
└── updated_at          TIMESTAMP

users
├── id                  UUID PK
├── full_name           VARCHAR(100)
├── email               VARCHAR(100) UNIQUE
├── phone               VARCHAR(15) UNIQUE
├── password_hash       VARCHAR(255)
├── avatar_url          VARCHAR(500)
├── is_email_verified   BOOLEAN
├── is_phone_verified   BOOLEAN
├── last_login_at       TIMESTAMP
├── created_at          TIMESTAMP
└── updated_at          TIMESTAMP

tenant_users (many-to-many: user ↔ tenant)
├── id                  UUID PK
├── tenant_id           UUID FK → tenants
├── user_id             UUID FK → users
├── role_id             UUID FK → roles
├── is_owner            BOOLEAN
├── status              ENUM active|inactive
├── created_at          TIMESTAMP
└── updated_at          TIMESTAMP

roles
├── id                  UUID PK
├── name                VARCHAR(50)      "owner"|"manager"|"receptionist"|"cashier"|"staff"
├── name_ar             VARCHAR(50)      "مالك"|"مدير"|"استقبال"|"كاشير"|"موظفة"
├── is_system           BOOLEAN          (أدوار النظام لا تُحذف)
├── created_at          TIMESTAMP
└── updated_at          TIMESTAMP

permissions
├── id                  UUID PK
├── code                VARCHAR(100)     "appointments.create"|"invoices.void"|"reports.view"
├── name_ar             VARCHAR(100)
├── group               VARCHAR(50)      "appointments"|"invoices"|"reports"
├── created_at          TIMESTAMP
└── updated_at          TIMESTAMP

role_permissions (many-to-many: role ↔ permission)
├── role_id             UUID FK → roles
└── permission_id       UUID FK → permissions

plans
├── id                  UUID PK
├── name                VARCHAR(50)      "Basic"|"Pro"|"Premium"
├── name_ar             VARCHAR(50)      "أساسي"|"احترافي"|"متميز"
├── price_monthly       DECIMAL          199|399|699
├── price_yearly        DECIMAL          1990|3990|6990
├── max_employees       INT              3|10|unlimited(-1)
├── max_clients         INT              100|unlimited(-1)|unlimited(-1)
├── description_ar      TEXT
├── is_active           BOOLEAN
├── sort_order          INT
├── created_at          TIMESTAMP
└── updated_at          TIMESTAMP

features
├── id                  UUID PK
├── code                VARCHAR(50)      "online_booking"|"loyalty"|"whatsapp"|"reports_advanced"
├── name_ar             VARCHAR(100)
├── description_ar      TEXT
├── created_at          TIMESTAMP
└── updated_at          TIMESTAMP

plan_features (many-to-many: plan ↔ feature)
├── plan_id             UUID FK → plans
└── feature_id          UUID FK → features

subscriptions
├── id                  UUID PK
├── tenant_id           UUID FK → tenants
├── plan_id             UUID FK → plans
├── status              ENUM active|expired|cancelled|past_due
├── billing_cycle       ENUM monthly|yearly
├── current_period_start TIMESTAMP
├── current_period_end  TIMESTAMP
├── cancelled_at        TIMESTAMP NULL
├── created_at          TIMESTAMP
└── updated_at          TIMESTAMP

tenant_features (override: enable/disable per tenant)
├── id                  UUID PK
├── tenant_id           UUID FK → tenants
├── feature_id          UUID FK → features
├── is_enabled          BOOLEAN
├── enabled_at          TIMESTAMP
└── disabled_at         TIMESTAMP NULL

platform_invoices
├── id                  UUID PK
├── tenant_id           UUID FK → tenants
├── subscription_id     UUID FK → subscriptions
├── amount              DECIMAL
├── tax_amount          DECIMAL
├── total               DECIMAL
├── status              ENUM paid|pending|overdue|cancelled
├── due_date            DATE
├── paid_at             TIMESTAMP NULL
├── invoice_number      VARCHAR(20)      "INV-2026-0001"
├── created_at          TIMESTAMP
└── updated_at          TIMESTAMP

platform_audit_logs
├── id                  UUID PK
├── tenant_id           UUID FK → tenants NULL (null = platform-level)
├── user_id             UUID FK → users
├── action              VARCHAR(50)      "create"|"update"|"delete"|"login"
├── entity_type         VARCHAR(50)      "tenant"|"subscription"|"user"
├── entity_id           UUID
├── old_values          JSONB
├── new_values          JSONB
├── ip_address          VARCHAR(45)
├── user_agent          TEXT
├── created_at          TIMESTAMP
└── (no updated_at — audit logs are immutable)
```

### 2B. Salon Database (واحدة لكل صالون — معزولة تماماً)

```
salon_info
├── id                  UUID PK
├── name_ar             VARCHAR(100)
├── name_en             VARCHAR(100)
├── tagline_ar          VARCHAR(200)     "جمالك أولويتنا"
├── description_ar      TEXT
├── phone               VARCHAR(15)
├── email               VARCHAR(100)
├── address             TEXT
├── city                VARCHAR(50)
├── working_days        JSONB            {"sun":true,"mon":true,...}
├── opening_time        TIME             "09:00"
├── closing_time        TIME             "22:00"
├── slot_duration       INT              30 (minutes)
├── buffer_time         INT              10 (minutes between appointments)
├── currency            VARCHAR(3)       "SAR"
├── tax_percentage      DECIMAL          15.0
├── tax_number          VARCHAR(20)
├── created_at          TIMESTAMP
└── updated_at          TIMESTAMP

service_categories
├── id                  UUID PK
├── name_ar             VARCHAR(100)     "خدمات الشعر"
├── name_en             VARCHAR(100)     "Hair Services"
├── sort_order          INT
├── is_active           BOOLEAN
├── created_at          TIMESTAMP
└── updated_at          TIMESTAMP

services
├── id                  UUID PK
├── category_id         UUID FK → service_categories
├── name_ar             VARCHAR(100)     "قص شعر"
├── name_en             VARCHAR(100)     "Haircut"
├── description_ar      TEXT
├── price               DECIMAL          80.00
├── duration            INT              30 (minutes)
├── is_active           BOOLEAN
├── sort_order          INT
├── image_url           VARCHAR(500)
├── created_at          TIMESTAMP
└── updated_at          TIMESTAMP

employees
├── id                  UUID PK
├── user_id             UUID NULL        (FK → platform users, if linked)
├── full_name           VARCHAR(100)     "سارة أحمد"
├── phone               VARCHAR(15)
├── email               VARCHAR(100)
├── role                ENUM stylist|manager|receptionist|cashier
├── commission_type     ENUM percentage|fixed|none
├── commission_value    DECIMAL          10.0
├── is_active           BOOLEAN
├── avatar_url          VARCHAR(500)
├── created_at          TIMESTAMP
└── updated_at          TIMESTAMP

employee_services (many-to-many: employee ↔ service)
├── employee_id         UUID FK → employees
└── service_id          UUID FK → services

employee_schedules
├── id                  UUID PK
├── employee_id         UUID FK → employees
├── day_of_week         INT              0=Sunday...6=Saturday
├── start_time          TIME             "09:00"
├── end_time            TIME             "17:00"
├── is_day_off          BOOLEAN
├── created_at          TIMESTAMP
└── updated_at          TIMESTAMP

employee_breaks
├── id                  UUID PK
├── employee_id         UUID FK → employees
├── day_of_week         INT
├── start_time          TIME             "12:00"
├── end_time            TIME             "13:00"
├── created_at          TIMESTAMP
└── updated_at          TIMESTAMP

clients
├── id                  UUID PK
├── full_name           VARCHAR(100)     "نورة محمد"
├── phone               VARCHAR(15)
├── email               VARCHAR(100)
├── gender              ENUM female|male
├── date_of_birth       DATE NULL
├── notes               TEXT             "تحب الصبغة الفاتحة"
├── source              ENUM walk_in|online|phone|referral
├── total_visits        INT DEFAULT 0
├── total_spent         DECIMAL DEFAULT 0
├── last_visit_at       TIMESTAMP NULL
├── is_active           BOOLEAN
├── created_at          TIMESTAMP
└── updated_at          TIMESTAMP

appointments
├── id                  UUID PK
├── client_id           UUID FK → clients
├── employee_id         UUID FK → employees NULL (أي موظفة)
├── date                DATE             "2026-03-20"
├── start_time          TIME             "14:00"
├── end_time            TIME             "15:30" (calculated)
├── status              ENUM pending|confirmed|in_progress|completed|cancelled|no_show
├── source              ENUM online|phone|walk_in|dashboard
├── notes               TEXT
├── total_price         DECIMAL          330.00
├── total_duration      INT              90 (minutes)
├── cancelled_at        TIMESTAMP NULL
├── cancellation_reason TEXT NULL
├── created_at          TIMESTAMP
└── updated_at          TIMESTAMP

appointment_services (services in one appointment)
├── id                  UUID PK
├── appointment_id      UUID FK → appointments
├── service_id          UUID FK → services
├── employee_id         UUID FK → employees
├── price               DECIMAL          250.00 (price at time of booking)
├── duration            INT              60
├── status              ENUM pending|in_progress|completed
├── created_at          TIMESTAMP
└── updated_at          TIMESTAMP

invoices
├── id                  UUID PK
├── appointment_id      UUID FK → appointments NULL (walk-in = no appointment)
├── client_id           UUID FK → clients
├── invoice_number      VARCHAR(20)      "INV-0001"
├── subtotal            DECIMAL          330.00
├── discount_amount     DECIMAL          0.00
├── tax_amount          DECIMAL          49.50
├── total               DECIMAL          379.50
├── status              ENUM draft|paid|partially_paid|void|refunded
├── notes               TEXT
├── created_by          UUID             (employee who created it)
├── paid_at             TIMESTAMP NULL
├── created_at          TIMESTAMP
└── updated_at          TIMESTAMP

invoice_items
├── id                  UUID PK
├── invoice_id          UUID FK → invoices
├── service_id          UUID FK → services NULL
├── description         VARCHAR(200)     "قص شعر"
├── quantity            INT              1
├── unit_price          DECIMAL          80.00
├── total_price         DECIMAL          80.00
├── employee_id         UUID FK → employees
├── created_at          TIMESTAMP
└── updated_at          TIMESTAMP

payments
├── id                  UUID PK
├── invoice_id          UUID FK → invoices
├── amount              DECIMAL          379.50
├── method              ENUM cash|card|bank_transfer|wallet
├── reference           VARCHAR(100)     (transaction ID)
├── status              ENUM completed|pending|failed|refunded
├── created_at          TIMESTAMP
└── updated_at          TIMESTAMP

discounts
├── id                  UUID PK
├── invoice_id          UUID FK → invoices
├── type                ENUM percentage|fixed
├── value               DECIMAL          10.0
├── amount              DECIMAL          33.00
├── reason              VARCHAR(200)     "خصم عميلة VIP"
├── created_at          TIMESTAMP
└── updated_at          TIMESTAMP

coupons
├── id                  UUID PK
├── code                VARCHAR(20)      "WELCOME20"
├── type                ENUM percentage|fixed
├── value               DECIMAL          20.0
├── min_order           DECIMAL NULL     100.00
├── max_discount        DECIMAL NULL     50.00
├── usage_limit         INT NULL
├── used_count          INT DEFAULT 0
├── valid_from          TIMESTAMP
├── valid_until         TIMESTAMP
├── is_active           BOOLEAN
├── created_at          TIMESTAMP
└── updated_at          TIMESTAMP

loyalty_points
├── id                  UUID PK
├── client_id           UUID FK → clients
├── points              INT              150
├── lifetime_points     INT              500 (total ever earned)
├── created_at          TIMESTAMP
└── updated_at          TIMESTAMP

loyalty_transactions
├── id                  UUID PK
├── client_id           UUID FK → clients
├── type                ENUM earned|redeemed|expired|adjusted
├── points              INT              50
├── invoice_id          UUID FK → invoices NULL
├── description         VARCHAR(200)     "50 نقطة مقابل 330 ر.س"
├── created_at          TIMESTAMP
└── (no updated_at — immutable)

expenses
├── id                  UUID PK
├── category            ENUM rent|salary|supplies|utilities|marketing|other
├── description         VARCHAR(200)
├── amount              DECIMAL
├── date                DATE
├── receipt_url         VARCHAR(500)
├── created_by          UUID
├── created_at          TIMESTAMP
└── updated_at          TIMESTAMP

attendance
├── id                  UUID PK
├── employee_id         UUID FK → employees
├── date                DATE
├── check_in            TIME
├── check_out           TIME NULL
├── status              ENUM present|absent|late|half_day|vacation
├── notes               TEXT
├── created_at          TIMESTAMP
└── updated_at          TIMESTAMP

notifications
├── id                  UUID PK
├── recipient_type      ENUM employee|client
├── recipient_id        UUID
├── title_ar            VARCHAR(200)
├── body_ar             TEXT
├── type                ENUM booking_new|booking_confirmed|booking_cancelled|payment|reminder|general
├── channel             ENUM in_app|push|sms|whatsapp|email
├── is_read             BOOLEAN DEFAULT false
├── data                JSONB            (extra data like appointment_id)
├── sent_at             TIMESTAMP
├── read_at             TIMESTAMP NULL
├── created_at          TIMESTAMP
└── (no updated_at)

activity_logs (salon-level audit)
├── id                  UUID PK
├── user_id             UUID
├── action              VARCHAR(50)
├── entity_type         VARCHAR(50)
├── entity_id           UUID
├── description         VARCHAR(300)     "أصدر فاتورة #INV-0001 بقيمة 330 ر.س"
├── old_values          JSONB
├── new_values          JSONB
├── ip_address          VARCHAR(45)
├── created_at          TIMESTAMP
└── (no updated_at — immutable)

settings (key-value store for salon settings)
├── key                 VARCHAR(100) PK  "booking_auto_confirm"|"sms_reminders"|"loyalty_enabled"
├── value               TEXT             "true"|"false"|"24"|"custom json"
├── updated_at          TIMESTAMP
└── updated_by          UUID
```

---

## 3. خريطة الـ API (كل endpoint)

### 3A. Auth endpoints (مصادقة)
```
POST   /api/v1/auth/register              تسجيل مستخدم جديد
POST   /api/v1/auth/login                 تسجيل الدخول (email/phone + password)
POST   /api/v1/auth/refresh               تجديد Access Token
POST   /api/v1/auth/logout                تسجيل الخروج
POST   /api/v1/auth/forgot-password       طلب إعادة تعيين كلمة المرور
POST   /api/v1/auth/reset-password        إعادة تعيين فعلية
POST   /api/v1/auth/verify-otp            التحقق من OTP
GET    /api/v1/auth/me                    بيانات المستخدم الحالي
PUT    /api/v1/auth/me                    تعديل بياناتي
PUT    /api/v1/auth/change-password       تغيير كلمة المرور
```

### 3B. Tenant Management (إدارة الصالونات — Platform level)
```
POST   /api/v1/tenants                    إنشاء صالون جديد (+ DB)
GET    /api/v1/tenants/:id                بيانات صالون
PUT    /api/v1/tenants/:id                تعديل بيانات صالون
DELETE /api/v1/tenants/:id                حذف/تعليق صالون
GET    /api/v1/tenants/:id/subscription   اشتراك الصالون
PUT    /api/v1/tenants/:id/features       تفعيل/إيقاف ميزات
```

### 3C. Salon Info (بيانات الصالون — Tenant level)
```
GET    /api/v1/salon                      بيانات صالوني
PUT    /api/v1/salon                      تعديل بيانات صالوني
PUT    /api/v1/salon/branding             تعديل الشعار والألوان والثيم
PUT    /api/v1/salon/working-hours        تعديل ساعات العمل
GET    /api/v1/salon/settings             كل الإعدادات
PUT    /api/v1/salon/settings             تعديل إعداد
```

### 3D. Services (الخدمات)
```
GET    /api/v1/services                   قائمة الخدمات
POST   /api/v1/services                   إضافة خدمة
GET    /api/v1/services/:id               تفاصيل خدمة
PUT    /api/v1/services/:id               تعديل خدمة
DELETE /api/v1/services/:id               حذف خدمة
GET    /api/v1/services/categories        تصنيفات الخدمات
POST   /api/v1/services/categories        إضافة تصنيف
PUT    /api/v1/services/categories/:id    تعديل تصنيف
DELETE /api/v1/services/categories/:id    حذف تصنيف
PUT    /api/v1/services/reorder           إعادة ترتيب
```

### 3E. Employees (الموظفات)
```
GET    /api/v1/employees                  قائمة الموظفات
POST   /api/v1/employees                  إضافة موظفة
GET    /api/v1/employees/:id              تفاصيل موظفة
PUT    /api/v1/employees/:id              تعديل موظفة
DELETE /api/v1/employees/:id              حذف موظفة
GET    /api/v1/employees/:id/schedule     جدول الدوام
PUT    /api/v1/employees/:id/schedule     تعديل جدول الدوام
GET    /api/v1/employees/:id/availability أوقات متاحة لتاريخ معين
GET    /api/v1/employees/:id/services     خدمات الموظفة
PUT    /api/v1/employees/:id/services     ربط/فك خدمات
```

### 3F. Clients (العملاء)
```
GET    /api/v1/clients                    قائمة العملاء (+ search + filters)
POST   /api/v1/clients                    إضافة عميل
GET    /api/v1/clients/:id                تفاصيل عميل
PUT    /api/v1/clients/:id                تعديل عميل
DELETE /api/v1/clients/:id                حذف عميل (soft delete)
GET    /api/v1/clients/:id/history        تاريخ الزيارات
GET    /api/v1/clients/:id/loyalty        نقاط الولاء
GET    /api/v1/clients/search?q=نورة      بحث سريع
GET    /api/v1/clients/stats              إحصائيات العملاء
```

### 3G. Appointments (الحجوزات)
```
GET    /api/v1/appointments               قائمة الحجوزات (+ date + status filters)
POST   /api/v1/appointments               إنشاء حجز
GET    /api/v1/appointments/:id           تفاصيل حجز
PUT    /api/v1/appointments/:id           تعديل حجز
PUT    /api/v1/appointments/:id/status    تغيير حالة (confirm/start/complete/cancel)
DELETE /api/v1/appointments/:id           إلغاء حجز
GET    /api/v1/appointments/today         حجوزات اليوم
GET    /api/v1/appointments/upcoming      الحجوزات القادمة
GET    /api/v1/appointments/available-slots  الأوقات المتاحة (date + employee + services)
GET    /api/v1/appointments/calendar      عرض تقويم (week/month)
```

### 3H. Invoices & POS (الفواتير والكاشير)
```
GET    /api/v1/invoices                   قائمة الفواتير
POST   /api/v1/invoices                   إنشاء فاتورة
GET    /api/v1/invoices/:id               تفاصيل فاتورة
PUT    /api/v1/invoices/:id               تعديل فاتورة (draft فقط)
POST   /api/v1/invoices/:id/pay           تسجيل دفع
PUT    /api/v1/invoices/:id/void          إلغاء فاتورة
GET    /api/v1/invoices/:id/pdf           تحميل PDF
POST   /api/v1/invoices/:id/send          إرسال (WhatsApp/SMS/Email)
POST   /api/v1/invoices/:id/discount      إضافة خصم
POST   /api/v1/invoices/:id/coupon        تطبيق كوبون
```

### 3I. Coupons (الكوبونات)
```
GET    /api/v1/coupons                    قائمة الكوبونات
POST   /api/v1/coupons                    إنشاء كوبون
GET    /api/v1/coupons/:id                تفاصيل كوبون
PUT    /api/v1/coupons/:id                تعديل كوبون
DELETE /api/v1/coupons/:id                حذف كوبون
POST   /api/v1/coupons/validate           التحقق من صلاحية كوبون
```

### 3J. Loyalty (الولاء)
```
GET    /api/v1/loyalty/settings           إعدادات نظام الولاء
PUT    /api/v1/loyalty/settings           تعديل إعدادات
GET    /api/v1/loyalty/clients/:id        نقاط عميل
POST   /api/v1/loyalty/clients/:id/adjust تعديل نقاط يدوي
GET    /api/v1/loyalty/transactions       سجل العمليات
```

### 3K. Reports (التقارير)
```
GET    /api/v1/reports/dashboard          ملخص لوحة التحكم
GET    /api/v1/reports/revenue            تقرير الإيرادات
GET    /api/v1/reports/appointments       تقرير الحجوزات
GET    /api/v1/reports/clients            تقرير العملاء
GET    /api/v1/reports/employees          تقرير الموظفات
GET    /api/v1/reports/services           تقرير الخدمات
GET    /api/v1/reports/expenses           تقرير المصروفات
GET    /api/v1/reports/export             تصدير (PDF/Excel)
```

### 3L. Notifications (الإشعارات)
```
GET    /api/v1/notifications              قائمة إشعاراتي
PUT    /api/v1/notifications/:id/read     تعليم كمقروء
PUT    /api/v1/notifications/read-all     تعليم الكل مقروء
GET    /api/v1/notifications/settings     إعدادات الإشعارات
PUT    /api/v1/notifications/settings     تعديل إعدادات
```

### 3M. Uploads (رفع الملفات)
```
POST   /api/v1/uploads/image              رفع صورة
POST   /api/v1/uploads/logo               رفع شعار
DELETE /api/v1/uploads/:id                حذف ملف
```

### 3N. Public Booking Page (صفحة الحجز — بدون مصادقة)
```
GET    /api/v1/booking/:slug              بيانات الصالون العامة
GET    /api/v1/booking/:slug/services     الخدمات المتاحة
GET    /api/v1/booking/:slug/employees    الموظفات المتاحة
GET    /api/v1/booking/:slug/slots        الأوقات المتاحة
POST   /api/v1/booking/:slug/book         إنشاء حجز
GET    /api/v1/booking/:slug/verify/:code تأكيد الحجز بـ OTP
```

### 3O. Platform Admin (لوحة الأدمن المركزية)
```
GET    /api/v1/admin/tenants              كل الصالونات
GET    /api/v1/admin/tenants/:id          تفاصيل صالون
PUT    /api/v1/admin/tenants/:id/status   تعليق/تفعيل
GET    /api/v1/admin/subscriptions        كل الاشتراكات
GET    /api/v1/admin/invoices             فواتير المنصة
GET    /api/v1/admin/stats                إحصائيات شاملة
GET    /api/v1/admin/audit-logs           سجل العمليات
```

**الإجمالي: ~95 endpoint**

---

## 4. خريطة الصفحات (كل شاشة)

### 4A. Dashboard (لوحة تحكم الصالون) — Next.js

```
/login                          تسجيل الدخول
/register                       تسجيل صالون جديد
/forgot-password                نسيت كلمة المرور
/reset-password                 إعادة تعيين

/dashboard                      الصفحة الرئيسية (ملخص + إحصائيات + حجوزات اليوم)
/dashboard/appointments         الحجوزات (يوم/أسبوع/تقويم)
/dashboard/appointments/new     حجز جديد
/dashboard/appointments/:id     تفاصيل حجز

/dashboard/clients              العملاء (قائمة + بحث)
/dashboard/clients/new          عميل جديد
/dashboard/clients/:id          تفاصيل عميل + تاريخ

/dashboard/employees            الموظفات
/dashboard/employees/new        موظفة جديدة
/dashboard/employees/:id        تفاصيل + جدول دوام

/dashboard/services             الخدمات
/dashboard/services/new         خدمة جديدة
/dashboard/services/:id         تعديل خدمة
/dashboard/services/categories  تصنيفات

/dashboard/pos                  الكاشير (واجهة سريعة)
/dashboard/invoices             الفواتير
/dashboard/invoices/:id         تفاصيل فاتورة

/dashboard/reports              التقارير (إيرادات/حجوزات/عملاء/موظفات)
/dashboard/reports/revenue      تقرير الإيرادات
/dashboard/reports/appointments تقرير الحجوزات
/dashboard/reports/clients      تقرير العملاء
/dashboard/reports/employees    تقرير الموظفات

/dashboard/coupons              الكوبونات
/dashboard/coupons/new          كوبون جديد

/dashboard/loyalty              نظام الولاء

/dashboard/expenses             المصروفات
/dashboard/expenses/new         مصروف جديد

/dashboard/settings             الإعدادات العامة
/dashboard/settings/salon       بيانات الصالون
/dashboard/settings/branding    الشعار والألوان والثيم
/dashboard/settings/working-hours ساعات العمل
/dashboard/settings/users       المستخدمين والصلاحيات
/dashboard/settings/notifications إعدادات الإشعارات
/dashboard/settings/subscription الاشتراك والباقة
/dashboard/settings/billing     الفواتير والمدفوعات
```

**الإجمالي: ~35 صفحة**

### 4B. Booking Page (صفحة الحجز العامة)

```
/:slug                          الصفحة الرئيسية للصالون
/:slug/book                     خطوات الحجز (خدمات → موظفة → وقت → بيانات → تأكيد)
/:slug/confirmation/:id         تأكيد الحجز
```

### 4C. Admin Panel (لوحة أدمن المنصة)

```
/admin/login                    دخول الأدمن
/admin/dashboard                إحصائيات شاملة
/admin/tenants                  إدارة الصالونات
/admin/tenants/:id              تفاصيل صالون
/admin/subscriptions            الاشتراكات
/admin/invoices                 فواتير المنصة
/admin/plans                    إدارة الباقات
/admin/features                 إدارة الميزات
/admin/audit-logs               سجل العمليات
/admin/settings                 إعدادات المنصة
```

**إجمالي كل الصفحات: ~50 صفحة**

---

## 5. هيكل المجلدات الصحيح

```
servix/
├── apps/
│   ├── api/                         ← NestJS Backend
│   │   ├── src/
│   │   │   ├── core/                ← مشترك بين كل القطاعات
│   │   │   │   ├── auth/            ← JWT + OTP + password reset
│   │   │   │   ├── tenants/         ← CRUD + DB creation + middleware
│   │   │   │   ├── users/           ← platform users
│   │   │   │   ├── subscriptions/   ← plans + billing + renewal
│   │   │   │   ├── features/        ← feature flags
│   │   │   │   ├── billing/         ← platform invoices + payments
│   │   │   │   ├── roles/           ← RBAC
│   │   │   │   ├── notifications/   ← multi-channel (push/sms/whatsapp/email)
│   │   │   │   ├── uploads/         ← S3 file management
│   │   │   │   ├── audit/           ← platform-level logs
│   │   │   │   └── admin/           ← super admin endpoints
│   │   │   │
│   │   │   ├── modules/
│   │   │   │   └── salon/           ← وحدة الصالونات (القطاع الأول)
│   │   │   │       ├── salon-info/
│   │   │   │       ├── services/
│   │   │   │       ├── employees/
│   │   │   │       ├── clients/
│   │   │   │       ├── appointments/
│   │   │   │       ├── invoices/
│   │   │   │       ├── payments/
│   │   │   │       ├── coupons/
│   │   │   │       ├── loyalty/
│   │   │   │       ├── expenses/
│   │   │   │       ├── attendance/
│   │   │   │       ├── reports/
│   │   │   │       ├── booking/     ← public booking API
│   │   │   │       └── settings/
│   │   │   │
│   │   │   ├── shared/              ← utilities used across core + modules
│   │   │   │   ├── database/        ← Prisma client factory + connection manager
│   │   │   │   ├── guards/          ← AuthGuard, RolesGuard, TenantGuard, FeatureGuard
│   │   │   │   ├── interceptors/    ← response transform, logging, timeout
│   │   │   │   ├── decorators/      ← @CurrentUser, @CurrentTenant, @RequireFeature
│   │   │   │   ├── filters/         ← global exception filter
│   │   │   │   ├── pipes/           ← validation pipe
│   │   │   │   ├── middleware/      ← TenantMiddleware, LoggingMiddleware
│   │   │   │   ├── events/          ← event emitters + WebSocket gateway
│   │   │   │   ├── jobs/            ← Bull queues (reminders, cleanup, reports)
│   │   │   │   ├── mail/            ← email templates + sender
│   │   │   │   ├── sms/             ← SMS gateway
│   │   │   │   ├── whatsapp/        ← WhatsApp API
│   │   │   │   └── config/          ← env validation + config module
│   │   │   │
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   │
│   │   ├── prisma/
│   │   │   ├── platform.prisma      ← Platform DB schema
│   │   │   ├── tenant.prisma        ← Salon DB schema (template)
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   │
│   │   ├── test/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── dashboard/                   ← Next.js Salon Dashboard
│   │   ├── src/
│   │   │   ├── app/                 ← App Router pages
│   │   │   │   ├── (auth)/          ← login, register, forgot-password
│   │   │   │   ├── (dashboard)/     ← all dashboard pages
│   │   │   │   └── layout.tsx
│   │   │   ├── components/
│   │   │   │   ├── ui/              ← Button, Input, Modal, Table, etc
│   │   │   │   ├── layout/          ← Sidebar, Header, BottomNav
│   │   │   │   ├── dashboard/       ← StatsCard, RevenueChart, etc
│   │   │   │   ├── appointments/    ← AppointmentCard, Calendar, etc
│   │   │   │   ├── clients/
│   │   │   │   ├── employees/
│   │   │   │   ├── services/
│   │   │   │   ├── invoices/
│   │   │   │   ├── pos/
│   │   │   │   ├── reports/
│   │   │   │   └── settings/
│   │   │   ├── hooks/               ← useAuth, useTenant, useAppointments, etc
│   │   │   ├── lib/                 ← api client, utils, formatters
│   │   │   ├── services/            ← API service functions
│   │   │   ├── stores/              ← Zustand stores
│   │   │   ├── themes/              ← 6 theme configs
│   │   │   ├── locales/             ← ar.json, en.json
│   │   │   └── types/
│   │   ├── public/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── booking/                     ← Next.js Public Booking Page
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── [slug]/          ← dynamic salon page
│   │   │   │   └── layout.tsx
│   │   │   ├── components/
│   │   │   └── ...
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── admin/                       ← Next.js Platform Admin
│       ├── src/
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── database/                    ← Prisma schemas + client factory
│   ├── types/                       ← shared TypeScript types
│   ├── utils/                       ← shared utilities
│   ├── validations/                 ← shared Zod schemas
│   ├── constants/                   ← shared enums + constants
│   ├── email-templates/             ← email HTML templates
│   ├── ui/                          ← shared UI components (dashboard + admin)
│   ├── eslint-config/
│   └── tsconfig/
│
├── tooling/
│   ├── docker/
│   │   └── docker-compose.yml
│   └── scripts/
│       ├── create-tenant.ts         ← script to create new tenant DB
│       └── migrate-tenants.ts       ← script to migrate all tenant DBs
│
├── docs/
│   ├── api/                         ← API documentation
│   ├── architecture/                ← architecture decisions
│   └── guides/                      ← developer guides
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
│
├── .env.example
├── .gitignore
├── .editorconfig
├── .prettierrc
├── .prettierignore
├── .nvmrc
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

ملاحظة: تم تغيير `apps/admin` → `apps/dashboard` (لوحة الصالون) و`apps/admin` الجديد = لوحة أدمن المنصة.
وتم إضافة `apps/booking` كتطبيق منفصل لصفحة الحجز.

---

## 6. مراحل البناء بالترتيب

### المرحلة 1: البنية التحتية (الأسبوع 1)
```
□ إصلاح هيكل المجلدات حسب الخطة الجديدة
□ إنشاء NestJS داخل apps/api
□ إنشاء Next.js داخل apps/dashboard
□ إعداد Docker (PostgreSQL + Redis)
□ إعداد .env.example + validation
□ إعداد ESLint + Prettier على كل المشاريع
□ أول commit + push لـ GitHub
```

### المرحلة 2: قاعدة البيانات (الأسبوع 1-2)
```
□ كتابة platform.prisma (كل جداول المنصة)
□ كتابة tenant.prisma (كل جداول الصالون)
□ تشغيل migrations
□ كتابة seed data (باقات + أدوار + صلاحيات + ميزات)
□ بناء Prisma Client Factory (يوصل بالـ DB الصحيحة)
□ بناء Tenant Connection Manager
```

### المرحلة 3: النواة الأساسية — Backend (الأسبوع 2-3)
```
□ Auth Module (register + login + JWT + refresh + OTP)
□ Tenant Module (CRUD + DB creation + middleware)
□ Tenant Middleware (يستخرج tenant من JWT → يوصل بـ DB)
□ RBAC (roles + permissions + guards)
□ Feature Flags (check feature enabled per tenant)
□ Subscription Module (plans + subscribe + renew)
□ Audit Log (تسجيل كل عملية)
□ Upload Module (S3 + image resize)
□ Global Exception Filter + Response Interceptor
```

### المرحلة 4: وحدة الصالونات — Backend (الأسبوع 3-5)
```
□ Services CRUD + Categories
□ Employees CRUD + Schedules + Availability
□ Clients CRUD + Search + History
□ Appointments CRUD + Status + Conflict Prevention + Available Slots
□ Invoices + Items + Payments
□ POS Logic (walk-in + quick invoice)
□ Coupons CRUD + Validation
□ Loyalty Points (earn + redeem)
□ Expenses CRUD
□ Attendance
□ Settings (key-value)
□ Activity Logs
```

### المرحلة 5: Dashboard — Frontend (الأسبوع 5-8)
```
□ Design System (UI components + themes)
□ Auth Pages (login + register + forgot password)
□ Layout (sidebar + header + RTL)
□ Dashboard Home (stats + charts + today's appointments)
□ Appointments (list + calendar + create + edit)
□ Clients (list + search + profile + history)
□ Employees (list + schedule editor)
□ Services (list + categories + create + edit)
□ POS / Cashier (fast interface)
□ Invoices (list + detail + PDF)
□ Reports (revenue + appointments + clients + employees)
□ Coupons + Loyalty
□ Settings (salon + branding + users + notifications)
□ Theme Engine (6 themes + custom colors + dark mode)
```

### المرحلة 6: صفحة الحجز (الأسبوع 8-9)
```
□ Public booking page (mobile-first)
□ Service selection
□ Employee selection
□ Time slot picker
□ Client info form
□ Booking confirmation
□ OTP verification
□ Salon branding (logo + colors + theme)
```

### المرحلة 7: الإشعارات والتكاملات (الأسبوع 9-10)
```
□ In-app notifications + bell icon
□ WebSocket (real-time updates)
□ SMS Gateway (OTP + reminders)
□ WhatsApp API (booking confirmation + invoice)
□ Email (welcome + subscription invoice + reports)
□ Push Notifications (PWA)
□ Appointment Reminders (background job)
```

### المرحلة 8: Admin Panel (الأسبوع 10-11)
```
□ Admin login
□ Dashboard (platform stats)
□ Tenants management (list + detail + suspend)
□ Subscriptions overview
□ Platform invoices
□ Plans + Features management
□ Audit logs viewer
```

### المرحلة 9: الاختبار والتحسين (الأسبوع 11-12)
```
□ API tests (Jest)
□ E2E tests (Playwright)
□ Security audit (tenant isolation + permissions)
□ Performance optimization (caching + query optimization)
□ Lighthouse score > 90
□ Mobile responsive QA
□ RTL QA
□ Dark mode QA
```

### المرحلة 10: النشر (الأسبوع 12-13)
```
□ VPS setup (Hetzner/DO)
□ Docker production setup
□ Nginx + SSL
□ CloudFlare (CDN + DNS + protection)
□ CI/CD (GitHub Actions)
□ Monitoring (Sentry + Uptime Kuma)
□ Backup automation
□ Domain setup
```

### المرحلة 11: الإطلاق (الأسبوع 13-14)
```
□ Landing page (servi-x.com)
□ Beta test (3-5 salons)
□ Feedback + fixes
□ Official launch
```

---

## 7. القرارات التقنية النهائية

| Layer | Technology | Version |
|-------|-----------|---------|
| Backend Framework | NestJS | Latest (11+) |
| Frontend Framework | Next.js | Latest (15+) |
| Language | TypeScript | Latest (5.8+) |
| ORM | Prisma | Latest (6+) |
| Database | PostgreSQL | 17 |
| Cache | Redis | 8 |
| CSS | Tailwind CSS | Latest (4+) |
| UI Components | Shadcn/UI + Radix | Latest |
| State Management | Zustand | Latest |
| Data Fetching | TanStack Query | v5 |
| Forms | React Hook Form + Zod | Latest |
| Charts | Recharts | Latest |
| Icons | Lucide React | Latest |
| Animation | Motion (framer) | Latest |
| i18n | next-intl | Latest |
| Auth | Passport + JWT | Latest |
| Queue | BullMQ | Latest |
| WebSocket | Socket.io | v4 |
| File Storage | S3 (MinIO locally) | Latest |
| Monorepo | Turborepo + pnpm | Latest |
| Container | Docker + Compose | Latest |
| CI/CD | GitHub Actions | - |
| CDN | CloudFlare | Free |
| Monitoring | Sentry + Uptime Kuma | Free |
| Hosting | Hetzner Cloud | CPX31 (~$14/mo) |

---

## 8. ملخص

| البند | الرقم |
|-------|-------|
| جداول قاعدة البيانات | 28 (12 platform + 16 salon) |
| API Endpoints | ~95 |
| صفحات Frontend | ~50 |
| مراحل البناء | 11 مرحلة |
| المدة المتوقعة | 13-14 أسبوع (مطور واحد) |
| تكلفة شهرية للبداية | ~$20 (75 ر.س) |

**هذه الخطة تُبنى مرة واحدة صح — ولا تحتاج تغيير مهما كبر المشروع.**
