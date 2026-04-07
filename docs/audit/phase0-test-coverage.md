# SERVIX — Phase 0: Test Coverage Baseline

> **تاريخ التنفيذ:** 2026-04-07
> **الأمر المُنفذ:** `cd apps/api && npx jest --coverage --passWithNoTests`
> **البيئة:** Windows / Node.js 20+ / Jest 29.7 / ts-jest 29.2

---

## ملخص النتائج

### التغطية الإجمالية

| المقياس | النسبة |
|---------|--------|
| **Statements** | **9.86%** |
| **Branches** | **7.53%** |
| **Functions** | **5.84%** |
| **Lines** | **9.78%** |

### ملخص الاختبارات

| المقياس | القيمة |
|---------|--------|
| إجمالي ملفات الاختبار (Test Suites) | 7 |
| Test Suites ناجحة | 4 |
| Test Suites فاشلة | 3 |
| إجمالي الاختبارات (Tests) | 110 |
| اختبارات ناجحة | 84 |
| اختبارات فاشلة | 26 |
| وقت التنفيذ | ~17.6 ثانية |

---

## ملفات الاختبار الموجودة (7 ملفات)

| # | الملف | الحالة | ملاحظات |
|---|-------|--------|---------|
| 1 | `src/core/tenants/tenants.service.spec.ts` | ✅ ناجح | — |
| 2 | `src/core/subscriptions/subscriptions.service.spec.ts` | ✅ ناجح | — |
| 3 | `src/modules/salon/appointments/appointments.service.spec.ts` | ✅ ناجح | — |
| 4 | `src/modules/salon/invoices/invoices.service.spec.ts` | ✅ ناجح | — |
| 5 | `src/core/admin/admin.service.spec.ts` | ❌ فاشل | خطأ في حل التبعيات |
| 6 | `src/core/auth/auth.service.spec.ts` | ❌ فاشل | `TypeError: Cannot read properties of undefined (reading 'findFirst')` — Mock غير كافي لـ PlatformPrismaClient |
| 7 | `src/shared/middleware/tenant.middleware.spec.ts` | ❌ فاشل | تبعية `PlatformSettingsService` مفقودة من test module |

---

## تحليل الاختبارات الفاشلة

### auth.service.spec.ts (فشل)
- **السبب:** Mock لـ `PlatformPrismaClient` لا يحوي `plan.findFirst` — الاختبار لم يُحدّث بعد إضافة البحث عن خطة أساسية في دالة `register()`
- **عدد الاختبارات الفاشلة:** متعدد — كل اختبارات `register` تفشل
- **الإصلاح المطلوب:** إضافة mock لـ `prisma.plan` في ملف الاختبار

### admin.service.spec.ts (فشل)
- **السبب:** خطأ في حل تبعيات NestJS — تبعيات مفقودة في test module
- **الإصلاح المطلوب:** تحديث providers في TestingModule

### tenant.middleware.spec.ts (فشل)
- **السبب:** `PlatformSettingsService` مفقود من TestingModule — تم إضافته كمعامل جديد لـ TenantMiddleware لكن لم يُحدّث ملف الاختبار
- **الإصلاح المطلوب:** إضافة mock لـ `PlatformSettingsService` في ملف الاختبار

---

## ملفات بدون اختبارات (عينة من الأهم)

### خدمات حرجة بدون اختبارات

| الملف | الأسطر | الخطورة | السبب |
|-------|--------|---------|-------|
| `booking.service.ts` | ~300+ | 🔴 حرج | الحجز العام — واجهة العميل |
| `employees.service.ts` | ~400+ | 🔴 حرج | جدولة وتوفر الموظفين |
| `settings.service.ts` | ~200+ | 🟡 عالي | إعدادات لكل مستأجر |
| `cache.service.ts` | ~200+ | 🟡 عالي | كل عمليات Redis — ثغرة مذكورة في D12 |
| `whatsapp.service.ts` | ~130+ | 🟡 عالي | تكامل خارجي |
| `clients.service.ts` | ~300+ | 🟡 عالي | إدارة العملاء |
| `products.service.ts` | ~200+ | 🟠 متوسط | إدارة المنتجات |
| `attendance.service.ts` | ~200+ | 🟠 متوسط | حضور الموظفين |
| `expenses.service.ts` | ~200+ | 🟠 متوسط | المصروفات |
| `reports.service.ts` | ~300+ | 🟠 متوسط | تقارير مالية |

### مكونات بنية تحتية بدون اختبارات

| الملف | التغطية | الملاحظة |
|-------|---------|---------|
| `tenant.middleware.ts` | 14% (13% lines) | بوابة كل طلب — 26 اختبار فاشل |
| `tenant-client.factory.ts` | 0% | إدارة مجمع اتصالات المستأجرين |
| `jwt-auth.guard.ts` | 0% | حماية المصادقة |
| `roles.guard.ts` | 0% | حماية الصلاحيات |
| `feature.guard.ts` | 0% | حماية الميزات |
| `http-exception.filter.ts` | 0% | معالجة الأخطاء |
| `response-transform.interceptor.ts` | 0% | تنسيق الاستجابات |

### واجهات أمامية بدون أي اختبارات

| التطبيق | عدد ملفات الاختبار |
|---------|-------------------|
| Dashboard (59 صفحة) | 0 |
| Admin Panel | 0 |
| Booking App | 0 |
| Landing Page | 0 |

---

## تغطية حسب المجلد (ملخص)

| المجلد | Stmts | Branch | Func | Lines |
|--------|-------|--------|------|-------|
| `src/core/admin` | ~15% | ~4% | ~9% | ~15% |
| `src/core/auth` | ~19% | ~2% | ~18% | ~18% |
| `src/core/subscriptions` | ~42% | ~6% | ~37% | ~40% |
| `src/core/tenants` | ~23% | ~3% | ~11% | ~22% |
| `src/modules/salon/appointments` | ~18% | ~7% | ~10% | ~15% |
| `src/modules/salon/invoices` | ~18% | ~5% | ~14% | ~17% |
| `src/modules/salon/*` (باقي) | 0% | 0% | 0% | 0% |
| `src/shared/middleware` | 14% | 0% | 0% | 13% |
| `src/shared/guards` | 0% | 0% | 0% | 0% |
| `src/shared/events` | 62% | 25% | 18% | 56% |
| `src/shared/*` (باقي) | 0-8% | 0% | 0% | 0-6% |

---

## ملاحظات مهمة

1. **التغطية 9.86% وليس 1.4%** — أعلى مما ذُكر في MASTER_PLAN.md، لكن هذا لأن Jest يقيس تغطية الأسطر المُنفذة أثناء الاختبارات (بما في ذلك imports وboilerplate)، بينما MASTER_PLAN قاس بعدد الملفات (7/504 = 1.4%)
2. **3 من 7 ملفات اختبار فاشلة** — هذا يعني أن الاختبارات الموجودة لم تُصان مع تطور الكود
3. **لا تكوين تغطية دنيا** — `jest.config.ts` لا يحتوي على `coverageThreshold`
4. **لا بوابة CI** — يمكن دمج كود بتغطية 0%
5. **صفر اختبارات واجهة** — لا Jest/Vitest/Playwright/Cypress في أي تطبيق واجهة

---

## خط الأساس للمرحلة القادمة

| المقياس | القيمة الحالية | الهدف (المرحلة 3) |
|---------|---------------|-------------------|
| Statements | 9.86% | 60% |
| Branches | 7.53% | 50% |
| Functions | 5.84% | 60% |
| Lines | 9.78% | 60% |
| Test Suites ناجحة | 4/7 | 30+ |
| Tests ناجحة | 84/110 | 500+ |
| اختبارات واجهة | 0 | 40% تغطية |
| اختبارات E2E | 0 | 8 تدفقات |

---

*هذا الملف جزء من تدقيق المرحلة 0 — خط الأساس قبل أي إصلاح.*
