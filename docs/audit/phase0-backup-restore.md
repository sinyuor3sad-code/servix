# SERVIX — Phase 0: Backup & Restore Test

> **تاريخ التنفيذ:** 2026-04-07
> **البيئة:** Windows 11 (بيئة التطوير المحلية)
> **الحالة:** ⚠️ لم يُنفذ — يجب تنفيذه على خادم الإنتاج

---

## سبب عدم التنفيذ

اختبار النسخ الاحتياطي والاسترجاع يتطلب:
1. **Docker** — غير مُشغّل على بيئة التطوير المحلية (Windows)
2. **PostgreSQL CLI (`psql`, `pg_dump`)** — غير مُثبت محلياً
3. **الوصول لقاعدة البيانات** — قاعدة بيانات الإنتاج على خادم Ubuntu بعيد

هذا الاختبار يجب تنفيذه على **خادم الإنتاج أو بيئة staging** لاحقاً.

---

## تحليل سكربت النسخ الاحتياطي

### مراجعة `tooling/scripts/backup.sh`

| الجانب | التقييم | الملاحظة |
|--------|---------|---------|
| الوجود | ✅ موجود | 158 سطر، مُوثق بشكل جيد |
| الأوامر المدعومة | ✅ 3 أوضاع | `backup` (افتراضي), `--list`, `--restore <file>` |
| نسخ Platform DB | ✅ مُنفذ | يستخدم `pg_dump` مع gzip |
| نسخ Tenant DBs | ✅ مُنفذ | يستعلم عن كل المستأجرين من platform DB ثم ينسخ كل واحد |
| احتفاظ 30 يوم | ✅ مُنفذ | `find -mtime +30 -exec rm` |
| رفع S3 | ✅ مُنفذ | اختياري — يعمل إذا كان `S3_BUCKET` و `S3_ACCESS_KEY` مُعرّفين |
| تقرير ملخص | ✅ مُنفذ | عدد النجاح/الفشل + الحجم الكلي |
| `set -euo pipefail` | ✅ مُنفذ | يتوقف عند أي خطأ |

### تحليل سكربت الاسترجاع (داخل `backup.sh --restore`)

```bash
# خطوات الاسترجاع (سطر 53-69):
1. يقبل مسار ملف النسخة الاحتياطية (.sql.gz)
2. يتحقق من وجود PLATFORM_DATABASE_URL
3. يستخرج اسم قاعدة البيانات من اسم الملف
4. يبني URL الاسترجاع من PLATFORM_DATABASE_URL
5. gunzip -c <file> | psql <url>
```

### ⚠️ مشاكل مكتشفة في سكربت الاسترجاع

| # | المشكلة | الخطورة | التفصيل |
|---|---------|---------|---------|
| 1 | **لا يُنشئ قاعدة البيانات** | 🔴 حرج | الاسترجاع يفترض أن DB موجودة مسبقاً. إذا كنت تسترجع في بيئة نظيفة، يجب إنشاء DB يدوياً أولاً |
| 2 | **لا يوقف التطبيق** | 🔴 حرج | الاسترجاع لا يوقف API أولاً — ممكن تعارض إذا كان التطبيق يكتب أثناء الاسترجاع |
| 3 | **يسترجع DB واحدة فقط** | 🟡 عالي | `--restore` يقبل ملف واحد فقط. لاسترجاع كامل يجب تكرار الأمر لكل DB |
| 4 | **لا تحقق بعد الاسترجاع** | 🟡 عالي | لا يُشغّل SELECT count أو أي فحص سلامة بعد الاسترجاع |
| 5 | **لا يسترجع ترتيب المفاتيح الأجنبية** | 🟠 متوسط | ممكن فشل الاسترجاع إذا كانت FKs تشير لجداول لم تُسترجع بعد |
| 6 | **لا سكربت استرجاع شامل** | 🟡 عالي | لا يوجد أمر واحد يسترجع كل شيء (platform + كل tenants) |

### سكربت `tooling/scripts/restore.sh` المنفصل

يوجد أيضاً ملف `restore.sh` منفصل (1692 بايت). هذا يخلق ارتباكاً — أيهما يُستخدم؟

---

## خطة اختبار الاسترجاع (للتنفيذ لاحقاً)

### المتطلبات

1. خادم تجريبي بـ Docker + PostgreSQL
2. نسخة احتياطية حديثة من الإنتاج
3. وقت صيانة (لا يؤثر على العملاء)

### خطوات الاختبار

```bash
# 1. إنشاء بيئة نظيفة
docker run -d --name pg-restore-test \
  -e POSTGRES_USER=servix \
  -e POSTGRES_PASSWORD=test_secret \
  -p 5433:5432 \
  postgres:16-alpine

# 2. إنشاء قواعد البيانات
export PLATFORM_DATABASE_URL="postgresql://servix:test_secret@localhost:5433/servix_platform"
psql "$PLATFORM_DATABASE_URL" -c "CREATE DATABASE servix_platform;"

# 3. استرجاع Platform DB
bash tooling/scripts/backup.sh --restore /path/to/platform_servix_platform.sql.gz

# 4. التحقق
psql "$PLATFORM_DATABASE_URL" -c "SELECT count(*) FROM tenants;"
psql "$PLATFORM_DATABASE_URL" -c "SELECT count(*) FROM users;"

# 5. استرجاع كل Tenant DBs
for file in /path/to/backup/tenant_*.sql.gz; do
  DB_NAME=$(basename "$file" .sql.gz | sed 's/^tenant_//')
  psql "$PLATFORM_DATABASE_URL" -c "CREATE DATABASE $DB_NAME;"
  bash tooling/scripts/backup.sh --restore "$file"
done

# 6. التحقق من Tenant DB
TENANT_URL="postgresql://servix:test_secret@localhost:5433/servix_tenant_XXXXX"
psql "$TENANT_URL" -c "SELECT count(*) FROM appointments;"
psql "$TENANT_URL" -c "SELECT count(*) FROM clients;"
psql "$TENANT_URL" -c "SELECT count(*) FROM invoices;"

# 7. تنظيف
docker stop pg-restore-test && docker rm pg-restore-test
```

### ما يجب توثيقه عند التنفيذ

- [ ] هل الاسترجاع نجح؟
- [ ] كم استغرق (بالدقائق)؟
- [ ] هل كل الجداول موجودة بعد الاسترجاع؟
- [ ] هل عدد السجلات مطابق؟
- [ ] هل قواعد المستأجرين استُرجعت بشكل صحيح؟
- [ ] هل يمكن تشغيل API على البيانات المسترجعة؟
- [ ] أي مشاكل واجهتها؟

---

## التوصيات

1. **إنشاء سكربت استرجاع شامل** — أمر واحد يسترجع platform + كل tenant DBs
2. **إضافة إنشاء DB تلقائياً** — السكربت يجب أن يُنشئ DB إذا لم تكن موجودة
3. **إضافة تحقق بعد الاسترجاع** — `SELECT count(*)` على الجداول الرئيسية
4. **إزالة الارتباك بين `backup.sh --restore` و `restore.sh`** — توحيد في سكربت واحد
5. **إضافة خيار `--dry-run`** — لاختبار السكربت بدون تنفيذ فعلي
6. **جدولة اختبار استرجاع شهري** — كما يوصي MASTER_PLAN

---

*هذا الملف جزء من تدقيق المرحلة 0 — خط الأساس قبل أي إصلاح.*
*⚠️ يجب تحديث هذا الملف بعد تنفيذ اختبار الاسترجاع الفعلي على الخادم.*
