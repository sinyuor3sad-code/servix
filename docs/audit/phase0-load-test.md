# SERVIX — Phase 0: Load Test Baseline

> **تاريخ التنفيذ:** 2026-04-07
> **البيئة:** Windows 11 (بيئة التطوير المحلية)
> **الحالة:** ⚠️ لم يُنفذ — يتطلب تشغيل API محلياً + تثبيت k6

---

## سبب عدم التنفيذ

اختبار الحمل يتطلب:
1. **k6** — غير مُثبت على بيئة التطوير
2. **API قيد التشغيل** — يحتاج PostgreSQL + Redis + API server
3. **بيانات تجريبية** — مستأجر تجريبي مع بيانات seed

---

## سكربت الاختبار

✅ **تم إنشاء سكربت k6 الأساسي:** `tooling/load-tests/baseline.js`

### السيناريوهات المُغطاة

| # | السيناريو | النوع | المصادقة | التفصيل |
|---|-----------|-------|---------|---------|
| A | `GET /api/v1/health` | قراءة | ❌ بدون | فحص سلامة النظام |
| B | `POST /api/v1/auth/login` | كتابة | ❌ بدون | تسجيل دخول بيانات تجريبية |
| C | `GET /api/v1/appointments?date=today` | قراءة | ✅ JWT | جلب مواعيد اليوم |
| D | `GET /api/v1/clients?page=1&limit=20` | قراءة | ✅ JWT | جلب العملاء مع pagination |
| E | `POST /api/v1/appointments` | كتابة | ✅ JWT | إنشاء حجز (10% من VUs فقط) |
| F | `GET /api/v1/services` | قراءة | ✅ JWT | جلب الخدمات |
| G | `GET /api/v1/employees` | قراءة | ✅ JWT | جلب الموظفين |
| H | `GET /api/v1/notifications` | قراءة | ✅ JWT | جلب الإشعارات غير المقروءة |

### تكوين الحمل

```
الوقت    | VUs
---------|-----
0-30s    | 0 → 10    (warm-up)
30s-1.5m | 10 → 50   (ramp-up)
1.5m-3.5m| 50 → 100  (sustained load)
3.5m-4.5m| 100 → 50  (scale-down)
4.5m-5m  | 50 → 0    (cool-down)
```

### عتبات النجاح

| المقياس | العتبة |
|---------|--------|
| p95 latency | < 3,000ms |
| p99 latency | < 5,000ms |
| Error rate | < 5% |
| Custom error rate | < 10% |

### مقاييس مُخصصة

- `login_duration` — وقت تسجيل الدخول
- `appointments_duration` — وقت جلب المواعيد
- `clients_duration` — وقت جلب العملاء
- `create_appointment_duration` — وقت إنشاء حجز

---

## كيفية التنفيذ

### 1. تثبيت k6

```bash
# Windows (Chocolatey)
choco install k6

# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

### 2. تشغيل البيئة المحلية

```bash
# تشغيل قاعدة البيانات و Redis
pnpm docker:up

# تشغيل API
cd apps/api && pnpm dev
```

### 3. تشغيل الاختبار

```bash
# الافتراضي (100 مستخدم، 5 دقائق)
k6 run tooling/load-tests/baseline.js

# مع إعدادات مخصصة
k6 run \
  --env BASE_URL=http://localhost:4000 \
  --env TENANT_SLUG=test-salon \
  --env TEST_EMAIL=owner@test.com \
  --env TEST_PASSWORD=Test123456 \
  tooling/load-tests/baseline.js

# اختبار مختصر (للتحقق السريع)
k6 run --vus 10 --duration 1m tooling/load-tests/baseline.js
```

### 4. توثيق النتائج

بعد التشغيل، حدّث هذا الملف بالنتائج التالية:

---

## النتائج (سيتم ملؤها بعد التنفيذ)

### المقاييس الأساسية

| المقياس | القيمة |
|---------|--------|
| إجمالي الطلبات | — |
| طلبات في الثانية (RPS) | — |
| p50 latency | — ms |
| p95 latency | — ms |
| p99 latency | — ms |
| نسبة الأخطاء | — % |
| Max VUs | — |

### مقاييس حسب Endpoint

| Endpoint | p50 | p95 | p99 | Error% |
|----------|-----|-----|-----|--------|
| Health Check | — | — | — | — |
| Login | — | — | — | — |
| Appointments (read) | — | — | — | — |
| Clients (read) | — | — | — | — |
| Create Appointment | — | — | — | — |
| Services | — | — | — | — |
| Employees | — | — | — | — |
| Notifications | — | — | — | — |

### سلوك النظام تحت الحمل

| الملاحظة | القيمة |
|----------|--------|
| عند أي حمل يبدأ التباطؤ | — VUs |
| هل ظهرت أخطاء 500 | — |
| هل ظهرت أخطاء اتصال DB (pool exhaustion) | — |
| استهلاك CPU للخادم | — % |
| استهلاك RAM للخادم | — MB |

### النتيجة

| السؤال | الإجابة |
|--------|---------|
| هل اجتاز عتبة p95 < 3s | — |
| هل اجتاز عتبة error rate < 5% | — |
| ما هو سقف المستخدمين المتزامنين | — |
| هل النظام جاهز لـ 50 عميل (≈ 200 مستخدم متزامن) | — |

---

## التوصيات (سيتم تحديثها بعد التنفيذ)

1. —
2. —
3. —

---

*هذا الملف جزء من تدقيق المرحلة 0 — خط الأساس قبل أي إصلاح.*
*⚠️ يجب تحديث هذا الملف بنتائج k6 الفعلية بعد التنفيذ.*
