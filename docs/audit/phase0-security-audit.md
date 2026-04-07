# SERVIX — Phase 0: Security Audit (pnpm audit)

> **تاريخ التنفيذ:** 2026-04-07
> **الأمر المُنفذ:** `pnpm audit --production`
> **البيئة:** Windows / Node.js 20+ / pnpm 10.32.1

---

## ملخص النتائج

| الخطورة | العدد |
|---------|-------|
| Critical | 0 |
| High | 5 |
| Moderate | 6 |
| Low | 0 |
| **الإجمالي** | **11** |

---

## الثغرات العالية (High) — 5 ثغرات

### 1. effect — AsyncLocalStorage context lost/contaminated

| البيان | القيمة |
|--------|--------|
| الحزمة | `effect` |
| الإصدار المتأثر | `< 3.20.0` |
| الإصدار المُصحح | `>= 3.20.0` |
| المسار | `apps__api > @prisma/client > prisma > @prisma/config > effect` |
| الاستشارة | [GHSA-38f7-945m-qr2g](https://github.com/advisories/GHSA-38f7-945m-qr2g) |
| الأثر | فقدان/تلوث سياق AsyncLocalStorage تحت حمل متزامن — قد يؤثر على عزل المستأجرين |
| قابلية الإصلاح | ✅ يمكن الإصلاح بترقية `prisma` و `@prisma/client` |

### 2. picomatch — ReDoS vulnerability via extglob quantifiers

| البيان | القيمة |
|--------|--------|
| الحزمة | `picomatch` |
| الإصدار المتأثر | `>= 4.0.0 < 4.0.4` |
| الإصدار المُصحح | `>= 4.0.4` |
| المسار | `apps__dashboard > next-intl > @parcel/watcher > picomatch` |
| الاستشارة | [GHSA-c2c7-rcm5-vvqj](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj) |
| الأثر | ReDoS في بيئة التطوير — خطر منخفض في الإنتاج |
| قابلية الإصلاح | ⚠️ تبعية عابرة عبر `next-intl` — تحتاج ترقية `next-intl` |

### 3. path-to-regexp — DoS via sequential optional groups

| البيان | القيمة |
|--------|--------|
| الحزمة | `path-to-regexp` |
| الإصدار المتأثر | `>= 8.0.0 < 8.4.0` |
| الإصدار المُصحح | `>= 8.4.0` |
| المسار | `apps__api > @nestjs/core > path-to-regexp` |
| الاستشارة | [GHSA-j3q9-mxjg-w52f](https://github.com/advisories/GHSA-j3q9-mxjg-w52f) |
| الأثر | **خطر مباشر** — مهاجم يمكنه إرسال مسار URL مُصنع لتعطيل API |
| قابلية الإصلاح | ✅ يمكن الإصلاح بترقية `@nestjs/core` |

### 4. lodash — Code Injection via `_.template` imports key names

| البيان | القيمة |
|--------|--------|
| الحزمة | `lodash` |
| الإصدار المتأثر | `>= 4.0.0 <= 4.17.23` |
| الإصدار المُصحح | `>= 4.18.0` |
| المسار | `apps__admin > recharts > lodash` |
| الاستشارة | [GHSA-r5fr-rjxr-66jc](https://github.com/advisories/GHSA-r5fr-rjxr-66jc) |
| الأثر | حقن كود عبر `_.template` — خطر منخفض لأن `recharts` لا تستخدم `_.template` مباشرة |
| قابلية الإصلاح | ⚠️ تبعية عابرة عبر `recharts` — تحتاج ترقية `recharts` أو pnpm overrides |

### 5. defu — Prototype pollution via `__proto__` key

| البيان | القيمة |
|--------|--------|
| الحزمة | `defu` |
| الإصدار المتأثر | `<= 6.1.4` |
| الإصدار المُصحح | `>= 6.1.5` |
| المسار | `apps__api > @prisma/client > prisma > @prisma/config > c12 > defu` |
| الاستشارة | [GHSA-737v-mqg7-c878](https://github.com/advisories/GHSA-737v-mqg7-c878) |
| الأثر | تلوث النموذج الأولي — خطر متوسط لأنه في سلسلة تبعيات Prisma config |
| قابلية الإصلاح | ✅ يمكن الإصلاح بترقية `prisma` و `@prisma/client` |

---

## الثغرات المتوسطة (Moderate) — 6 ثغرات

### 6. next — Unbounded next/image disk cache growth

| البيان | القيمة |
|--------|--------|
| الحزمة | `next` |
| الإصدار المتأثر | `>= 10.0.0 < 15.5.14` |
| الإصدار المُصحح | `>= 15.5.14` |
| المسار | `apps__admin > next` |
| الاستشارة | [GHSA-3x4c-7xq6-9pq8](https://github.com/advisories/GHSA-3x4c-7xq6-9pq8) |
| الأثر | نمو غير محدود لذاكرة التخزين المؤقت للصور — قد يستنزف مساحة القرص |
| قابلية الإصلاح | ✅ ترقية `next` إلى `>= 15.5.14` |

### 7. brace-expansion — Zero-step sequence causes process hang

| البيان | القيمة |
|--------|--------|
| الحزمة | `brace-expansion` |
| الإصدار المتأثر | `>= 2.0.0 < 2.0.3` |
| الإصدار المُصحح | `>= 2.0.3` |
| المسار | `apps__api > @sentry/nestjs > @sentry/node > minimatch > brace-expansion` |
| الاستشارة | [GHSA-f886-m6hf-6m8v](https://github.com/advisories/GHSA-f886-m6hf-6m8v) |
| قابلية الإصلاح | ✅ ترقية `@sentry/nestjs` |

### 8. picomatch — Method Injection in POSIX Character Classes

| البيان | القيمة |
|--------|--------|
| الحزمة | `picomatch` |
| الإصدار المتأثر | `>= 4.0.0 < 4.0.4` |
| الإصدار المُصحح | `>= 4.0.4` |
| المسار | `apps__dashboard > next-intl > @parcel/watcher > picomatch` |
| الاستشارة | [GHSA-3v7f-55p6-f55p](https://github.com/advisories/GHSA-3v7f-55p6-f55p) |
| قابلية الإصلاح | ⚠️ نفس مسار picomatch #2 — تحتاج ترقية `next-intl` |

### 9. path-to-regexp — ReDoS via multiple wildcards

| البيان | القيمة |
|--------|--------|
| الحزمة | `path-to-regexp` |
| الإصدار المتأثر | `>= 8.0.0 < 8.4.0` |
| الإصدار المُصحح | `>= 8.4.0` |
| المسار | `apps__api > @nestjs/core > path-to-regexp` |
| الاستشارة | [GHSA-27v5-c462-wpq7](https://github.com/advisories/GHSA-27v5-c462-wpq7) |
| قابلية الإصلاح | ✅ نفس مسار path-to-regexp #3 — ترقية `@nestjs/core` |

### 10. lodash — Prototype Pollution via array path bypass

| البيان | القيمة |
|--------|--------|
| الحزمة | `lodash` |
| الإصدار المتأثر | `<= 4.17.23` |
| الإصدار المُصحح | `>= 4.18.0` |
| المسار | `apps__admin > recharts > lodash` |
| الاستشارة | [GHSA-f23m-r3pf-42rh](https://github.com/advisories/GHSA-f23m-r3pf-42rh) |
| قابلية الإصلاح | ⚠️ نفس مسار lodash #4 — تحتاج ترقية `recharts` أو pnpm overrides |

### 11. @nestjs/core — Injection vulnerability

| البيان | القيمة |
|--------|--------|
| الحزمة | `@nestjs/core` |
| الإصدار المتأثر | `<= 11.1.17` |
| الإصدار المُصحح | `>= 11.1.18` |
| المسار | `apps__api > @nestjs/core` |
| الاستشارة | [GHSA-36xv-jgw5-4q75](https://github.com/advisories/GHSA-36xv-jgw5-4q75) |
| الأثر | **خطر مباشر** — ثغرة حقن في NestJS core |
| قابلية الإصلاح | ✅ ترقية `@nestjs/core` إلى `>= 11.1.18` |

---

## تحليل قابلية الإصلاح

### ✅ يمكن إصلاحها مباشرة (7 ثغرات)

| الحزمة الجذرية | الثغرات | الإجراء |
|----------------|---------|---------|
| `@nestjs/core` | 3 (path-to-regexp ×2 + @nestjs/core injection) | `pnpm update @nestjs/core --filter @servix/api` |
| `prisma` + `@prisma/client` | 2 (effect + defu) | `pnpm update prisma @prisma/client --filter @servix/api` |
| `@sentry/nestjs` | 1 (brace-expansion) | `pnpm update @sentry/nestjs --filter @servix/api` |
| `next` | 1 (disk cache) | `pnpm update next --filter apps/admin` |

### ⚠️ تحتاج pnpm overrides أو انتظار upstream (4 ثغرات)

| الحزمة الجذرية | الثغرات | السبب |
|----------------|---------|-------|
| `next-intl` (via picomatch) | 2 | تبعية عابرة عبر `@parcel/watcher` |
| `recharts` (via lodash) | 2 | `recharts` يعتمد على `lodash <= 4.17.23` |

**حل مُقترح للتبعيات العابرة:**
```json
// في package.json الجذر
"pnpm": {
  "overrides": {
    "picomatch": ">=4.0.4",
    "lodash": ">=4.18.0"
  }
}
```

### ❌ ثغرات لا يمكن إصلاحها

لا توجد — كل الثغرات لها إصلاحات متاحة.

---

## التوصيات

1. **عاجل (قبل الإنتاج):** ترقية `@nestjs/core` إلى `>= 11.1.18` — ثغرة الحقن تؤثر على API مباشرة
2. **عاجل:** ترقية `prisma` و `@prisma/client` — ثغرة `effect` تؤثر على AsyncLocalStorage وقد تؤثر على عزل المستأجرين
3. **مرتفع:** إضافة pnpm overrides لـ `picomatch` و `lodash`
4. **مرتفع:** ترقية `next` في Admin panel
5. **متوسط:** ترقية `@sentry/nestjs`
6. **أتمتة:** إضافة `pnpm audit --production` في CI/CD pipeline مع فشل على ثغرات `high` و `critical`

---

## محاولة الإصلاح التلقائي

> ⚠️ لم يتم تنفيذ `pnpm audit fix` — هذا خارج نطاق المرحلة 0 (التوثيق فقط).
> سيتم تنفيذ الإصلاحات في المرحلة 1 بعد اعتماد الخطة.

---

*هذا الملف جزء من تدقيق المرحلة 0 — خط الأساس قبل أي إصلاح.*
