# SERVIX — Phase 0: Query Analysis (EXPLAIN ANALYZE)

> **تاريخ التنفيذ:** 2026-04-07
> **البيئة:** Windows 11 (بيئة التطوير المحلية)
> **الحالة:** ⚠️ EXPLAIN ANALYZE لم يُنفذ — يتطلب اتصالاً بقاعدة بيانات مستأجر
> **المنهجية:** تحليل ثابت للمخطط (Prisma schema) + كود الخدمات لتحديد الاستعلامات الحرجة وحالة الفهارس

---

## ملخص تنفيذي

تم تحليل **10 استعلامات** مطلوبة من الخطة، مع فحص شامل لحالة الفهارس في كلا المخططين (Platform: 530 سطر، Tenant: 1148 سطر).

**النتيجة:** 5 فهارس مفقودة مؤكدة + 3 فهارس مُوصى بإضافتها.

---

## الاستعلامات العشرة وتحليلها

### 1. جلب مواعيد اليوم لموظف معين

```sql
-- الاستعلام المُكافئ:
SELECT * FROM appointments
WHERE employee_id = ? AND date = ? AND status NOT IN ('cancelled')
ORDER BY start_time ASC
```

| الجانب | التفصيل |
|--------|---------|
| ملف المصدر | `appointments.service.ts:76-95` |
| الفهارس المتاحة | ✅ `@@index([employeeId])`, ✅ `@@index([date])`, ✅ `@@index([date, status])` |
| التقييم | ✅ **جيد** — فهرس composite `[date, status]` يغطي الفلتر الأساسي |
| التوصية | ⚡ إضافة فهرس composite `[employeeId, date]` سيكون أسرع لهذا الاستعلام المتكرر |

### 2. جلب كل العملاء مع آخر زيارة

```sql
-- الاستعلام المُكافئ:
SELECT c.*, c.last_visit_at
FROM clients c
WHERE c.is_active = true AND c.deleted_at IS NULL
ORDER BY c.created_at DESC
LIMIT ? OFFSET ?
```

| الجانب | التفصيل |
|--------|---------|
| ملف المصدر | `clients.service.ts` |
| الفهارس المتاحة | ✅ `@@index([isActive])`, ✅ `@@index([fullName])`, ✅ `@@index([phone])` |
| التقييم | ✅ **جيد** — `last_visit_at` مُخزن في Client model مباشرة (لا JOIN مطلوب) |
| التوصية | لا حاجة لتغيير — Prisma يدمج `isActive` + `deletedAt` في فلتر واحد |

### 3. جلب الفواتير مع بنودها

```sql
-- الاستعلام المُكافئ:
SELECT i.*, ii.*, s.*
FROM invoices i
LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
LEFT JOIN services s ON s.id = ii.service_id
WHERE i.client_id = ?
ORDER BY i.created_at DESC
```

| الجانب | التفصيل |
|--------|---------|
| ملف المصدر | `invoices.service.ts` |
| الفهارس المتاحة | ✅ `invoices: @@index([clientId])`, ✅ `invoice_items: @@index([invoiceId])` |
| التقييم | ✅ **جيد** — كل JOINs مدعومة بفهارس |
| ملاحظة | ⚠️ `Invoice.appointmentId` لا يملك فهرس — استعلام JOIN بين invoices و appointments سيكون بطيئاً |
| التوصية | 🔴 **إضافة `@@index([appointmentId])` على Invoice** |

### 4. جلب تقرير الإيرادات الشهري

```sql
-- الاستعلام المُكافئ:
SELECT
  DATE_TRUNC('day', created_at) as day,
  SUM(total) as revenue,
  COUNT(*) as count
FROM invoices
WHERE created_at BETWEEN ? AND ? AND status = 'paid'
GROUP BY DATE_TRUNC('day', created_at)
```

| الجانب | التفصيل |
|--------|---------|
| ملف المصدر | `reports.service.ts` |
| الفهارس المتاحة | ✅ `@@index([createdAt])`, ✅ `@@index([status])` |
| التقييم | 🟡 **متوسط** — لا فهرس composite `[status, createdAt]` |
| التوصية | ⚡ إضافة `@@index([status, createdAt])` سيُحسّن تقارير الإيرادات بشكل كبير |

### 5. جلب جدول الموظف الأسبوعي

```sql
-- الاستعلام المُكافئ:
SELECT es.*, a.*
FROM employee_schedules es
LEFT JOIN appointments a ON a.employee_id = es.employee_id AND a.date BETWEEN ? AND ?
WHERE es.employee_id = ?
```

| الجانب | التفصيل |
|--------|---------|
| ملف المصدر | `appointments.service.ts:395-415` |
| الفهارس المتاحة | ✅ `employee_schedules: @@unique([employeeId, dayOfWeek])`, ✅ `appointments: @@index([employeeId])`, ✅ `@@index([date])` |
| التقييم | ✅ **جيد** — الفهارس تغطي هذا الاستعلام |
| التوصية | لا تغيير مطلوب |

### 6. البحث عن عميل بالاسم أو الهاتف

```sql
-- الاستعلام المُكافئ:
SELECT * FROM clients
WHERE (full_name ILIKE '%?%' OR phone LIKE '%?%')
  AND is_active = true AND deleted_at IS NULL
```

| الجانب | التفصيل |
|--------|---------|
| ملف المصدر | `clients.service.ts` |
| الفهارس المتاحة | ✅ `@@index([fullName])`, ✅ `@@index([phone])` |
| التقييم | 🟡 **محدود** — الفهارس العادية (B-tree) لا تُفيد مع `ILIKE '%...'` (بحث يبدأ بـ wildcard) |
| التوصية | ⚡ في مرحلة التوسع: إضافة `pg_trgm` GiST/GIN index لدعم البحث الجزئي. حالياً كافٍ لأقل من 1000 عميل لكل مستأجر. |

### 7. جلب الإشعارات غير المقروءة

```sql
-- الاستعلام المُكافئ:
SELECT * FROM notifications
WHERE recipient_type = ? AND recipient_id = ? AND is_read = false
ORDER BY created_at DESC
```

| الجانب | التفصيل |
|--------|---------|
| ملف المصدر | `notifications.service.ts` |
| الفهارس المتاحة | ✅ `@@index([recipientType, recipientId])`, ✅ `@@index([isRead])`, ✅ `@@index([createdAt])` |
| التقييم | ✅ **جيد** — الفهارس تغطي كل شروط الفلتر |
| التوصية | ⚡ فهرس composite `[recipientType, recipientId, isRead]` أفضل — يمنع lookup ثاني |

### 8. جلب إعدادات المستأجر

```sql
-- الاستعلام المُكافئ:
SELECT * FROM settings WHERE key = ?
```

| الجانب | التفصيل |
|--------|---------|
| ملف المصدر | `settings.service.ts` |
| الفهارس المتاحة | ✅ `key` هو `@id` (Primary Key) |
| التقييم | ✅ **ممتاز** — البحث بالمفتاح الأساسي دائماً O(1) |
| ملاحظة | ⚡ هذا الاستعلام متكرر جداً — يجب أن يكون مُخزن في Redis (التحقق: نعم، `CacheService` يُخزنه) |

### 9. جلب الخدمات مع فئاتها

```sql
-- الاستعلام المُكافئ:
SELECT s.*, sc.*
FROM services s
JOIN service_categories sc ON sc.id = s.category_id
WHERE s.is_active = true
ORDER BY sc.sort_order, s.sort_order
```

| الجانب | التفصيل |
|--------|---------|
| ملف المصدر | `services.service.ts` |
| الفهارس المتاحة | ✅ `services: @@index([categoryId])`, ✅ `@@index([isActive])` |
| التقييم | ✅ **جيد** — الفهارس تغطي JOIN والفلتر |
| التوصية | لا تغيير مطلوب |

### 10. جلب سجل الحضور الشهري

```sql
-- الاستعلام المُكافئ:
SELECT a.*, e.full_name
FROM attendance a
JOIN employees e ON e.id = a.employee_id
WHERE a.date BETWEEN ? AND ?
ORDER BY a.date DESC, e.full_name
```

| الجانب | التفصيل |
|--------|---------|
| ملف المصدر | `attendance.service.ts` |
| الفهارس المتاحة | ✅ `@@unique([employeeId, date])`, ✅ `@@index([date])` |
| التقييم | ✅ **جيد** — فهرس `date` يغطي الفلتر الشهري |
| التوصية | لا تغيير مطلوب |

---

## تحليل الفهارس المفقودة (من MASTER_PLAN)

### ✅ فهارس تم التحقق من غيابها

| # | النموذج | العمود | في المخطط؟ | الأثر |
|---|---------|--------|-----------|-------|
| 1 | `TenantUser` | `roleId` | ❌ **مفقود** | JOIN بطيء عند جلب المستخدمين مع أدوارهم. `platform.prisma:148` — العمود موجود لكن بدون `@@index` |
| 2 | `Invoice` | `appointmentId` | ❌ **مفقود** | JOIN بين الفواتير والمواعيد = Seq Scan. `tenant.prisma:545` |
| 3 | `Product` | `categoryId` | ✅ **موجود** | `@@index([categoryId])` في `tenant.prisma:891` — **MASTER_PLAN خاطئ هنا** |
| 4 | `LoyaltyTransaction` | `invoiceId` | ❌ **مفقود** | JOIN بين معاملات الولاء والفواتير = Seq Scan. `tenant.prisma:676` |
| 5 | `ClientDna` | (بالكامل) | ❌ **مفقود** | لا فهارس على `churnRisk`, `priceSensitivity`, `isVip` — استعلامات تحليلية ستكون بطيئة. `tenant.prisma:931-964` |

### ملاحظة تصحيحية

`Product.categoryId` **لديه فهرس** بالفعل (`@@index([categoryId])` في سطر 891). هذا يعني أن MASTER_PLAN أخطأ في هذه النقطة. العدد الفعلي للفهارس المفقودة هو **4 (وليس 5)** + `ClientDna` بالكامل.

---

## فهارس مُوصى بإضافتها (أولوية)

### 🔴 حرج (يجب إضافتها في المرحلة 2)

| # | النموذج | الفهرس المُقترح | السبب |
|---|---------|----------------|-------|
| 1 | `Invoice` | `@@index([appointmentId])` | JOIN بين الفواتير والمواعيد — استعلام متكرر |
| 2 | `LoyaltyTransaction` | `@@index([invoiceId])` | JOIN بين معاملات الولاء والفواتير |
| 3 | `TenantUser` | `@@index([roleId])` | JOIN بين المستخدمين والأدوار |

### 🟡 عالي (يُحسن الأداء بشكل ملحوظ)

| # | النموذج | الفهرس المُقترح | السبب |
|---|---------|----------------|-------|
| 4 | `ClientDna` | `@@index([churnRisk])` | فلترة العملاء حسب خطر المغادرة |
| 5 | `ClientDna` | `@@index([isVip])` | فلترة العملاء VIP |
| 6 | `ClientDna` | `@@index([clientId])` | على الرغم من `@unique` — يجب التحقق أن Prisma يُنشئ index للـ unique |

### ⚡ تحسين (يُسرّع الاستعلامات المتكررة)

| # | النموذج | الفهرس المُقترح | السبب |
|---|---------|----------------|-------|
| 7 | `Appointment` | `@@index([employeeId, date])` | Composite أسرع من فهرسين منفصلين |
| 8 | `Invoice` | `@@index([status, createdAt])` | تقارير الإيرادات |

---

## فحص Cascade Delete الناقص

| # | النموذج | العلاقة | الحالة | الأثر |
|---|---------|---------|--------|-------|
| 1 | `PlatformInvoice` → `Subscription` | `subscriptionId` | ⚠️ لا `onDelete: Cascade` | حذف اشتراك يترك فواتير يتيمة |
| 2 | `AppointmentService` → `Service` | `serviceId` | ⚠️ لا `onDelete: Cascade` | حذف خدمة يترك سجلات مرتبطة بالمواعيد |
| 3 | `AppointmentService` → `Employee` | `employeeId` | ⚠️ لا `onDelete: Cascade` | حذف موظف يترك سجلات مرتبطة بالمواعيد |
| 4 | `ServiceCategory` → `Service` | `categoryId` | ⚠️ لا `onDelete: Cascade` | حذف فئة يترك خدمات يتيمة |

---

## الاستعلامات المطلوب تشغيل EXPLAIN ANALYZE عليها (للتنفيذ لاحقاً)

```sql
-- يجب تشغيل هذه على قاعدة بيانات مستأجر حقيقية:

-- 1. مواعيد اليوم لموظف
EXPLAIN ANALYZE
SELECT * FROM appointments
WHERE employee_id = '<uuid>' AND date = CURRENT_DATE AND status != 'cancelled'
ORDER BY start_time ASC;

-- 2. العملاء مع آخر زيارة
EXPLAIN ANALYZE
SELECT * FROM clients
WHERE is_active = true AND deleted_at IS NULL
ORDER BY created_at DESC LIMIT 20;

-- 3. الفواتير مع بنودها
EXPLAIN ANALYZE
SELECT i.*, ii.*
FROM invoices i
LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
WHERE i.client_id = '<uuid>'
ORDER BY i.created_at DESC;

-- 4. تقرير الإيرادات الشهري
EXPLAIN ANALYZE
SELECT DATE(created_at) as day, SUM(total), COUNT(*)
FROM invoices
WHERE created_at >= '2026-03-01' AND created_at < '2026-04-01' AND status = 'paid'
GROUP BY DATE(created_at);

-- 5. جدول الموظف الأسبوعي
EXPLAIN ANALYZE
SELECT * FROM appointments
WHERE employee_id = '<uuid>' AND date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
ORDER BY date, start_time;

-- 6. البحث عن عميل
EXPLAIN ANALYZE
SELECT * FROM clients
WHERE (full_name ILIKE '%أحمد%' OR phone LIKE '%0555%')
AND is_active = true;

-- 7. الإشعارات غير المقروءة
EXPLAIN ANALYZE
SELECT * FROM notifications
WHERE recipient_type = 'employee' AND recipient_id = '<uuid>' AND is_read = false
ORDER BY created_at DESC;

-- 8. الإعدادات
EXPLAIN ANALYZE
SELECT * FROM settings WHERE key = 'salon_name';

-- 9. الخدمات مع فئاتها
EXPLAIN ANALYZE
SELECT s.*, sc.name_ar as category_name
FROM services s
JOIN service_categories sc ON sc.id = s.category_id
WHERE s.is_active = true
ORDER BY sc.sort_order, s.sort_order;

-- 10. الحضور الشهري
EXPLAIN ANALYZE
SELECT a.*, e.full_name
FROM attendance a
JOIN employees e ON e.id = a.employee_id
WHERE a.date BETWEEN '2026-03-01' AND '2026-03-31'
ORDER BY a.date DESC;
```

---

## ملخص التوصيات

| الأولوية | الإجراء | العدد |
|----------|---------|-------|
| 🔴 حرج | فهارس مفقودة يجب إضافتها | 3 |
| 🟡 عالي | فهارس ClientDna | 2-3 |
| ⚡ تحسين | فهارس composite | 2 |
| ⚠️ إصلاح | Cascade delete ناقص | 4 |
| 📊 قياس | EXPLAIN ANALYZE على الخادم | 10 استعلامات |

---

*هذا الملف جزء من تدقيق المرحلة 0 — خط الأساس قبل أي إصلاح.*
*⚠️ يجب تحديث هذا الملف بنتائج EXPLAIN ANALYZE الفعلية عند الاتصال بقاعدة بيانات مستأجر.*
