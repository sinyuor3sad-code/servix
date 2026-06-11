# 🗺️ SERVIX Roadmap — خطة التنفيذ الرسمية

> ⚡ هذا الملف هو المرجع الأساسي لخطة التنفيذ. يتم تحديثه بعد إنجاز كل مهمة.
> آخر تحديث: **28 أبريل 2026** (تصحيح أخطاء حالة + إضافة مرحلة 7)
> الحالة: المنصة حيّة في الإنتاج — انظر تفاصيل كل مرحلة أدناه

---

## 📊 نسبة الإنجاز العامة

```
المرحلة 1 [██████████] 100% — الحماية والاستقرار ✅
المرحلة 2 [█████████░]  95% — تفعيل الميزات الجاهزة ✅ (ZATCA: كود جاهز ⚠️ ينتظر تسجيل رسمي)
المرحلة 3 [████████░░]  85% — التكاملات الخارجية (واتساب ✅ | SMS جاهز تقنياً ⚠️ | دفع ❌)
المرحلة 4 [██████████] 100% — التقارير والذكاء ✅ (شامل PDF+CSV ✅)
المرحلة 5 [██████████] 100% — تطبيق الجوال (PWA) ✅
المرحلة 6 [██████████] 100% — DevOps والتوسع ✅ (Prometheus+Grafana جاهزان ✅)
المرحلة 7 [██████████] 100% — ميزات متقدمة مُنفذة ✅ (AI Reception V2 + POS V2 + Smart Menu)
```

---

## 🔴 المرحلة 1: الحماية والاستقرار (2-3 أيام)

> ⚠️ **حرجة** — بدونها بيانات العملاء معرضة للخطر!

### 1.1 📁 النسخ الاحتياطي التلقائي
**الحالة:** ✅ مكتمل | **الأولوية:** 🔴 حرجة | **الوقت:** ~3 ساعات

- [x] إنشاء سكربت `backup.sh` يعمل `pg_dump` لكل قواعد البيانات
- [x] جدولة عبر `cron` كل 6 ساعات
- [x] تخزين النسخ في Docker volume
- [x] الاحتفاظ بآخر 7 أيام (حذف القديم تلقائياً)
- [x] إنشاء سكربت `restore.sh` للاسترجاع

**الملفات:**
```
tooling/docker/scripts/backup.sh       (جديد)
tooling/docker/scripts/restore.sh      (جديد)
tooling/docker/docker-compose.prod.yml (إضافة cron container)
```

---

### 1.2 🛡️ Rate Limiting
**الحالة:** ✅ مكتمل | **الأولوية:** 🔴 حرجة | **الوقت:** ~2 ساعة

- [x] RateLimitGuard مفعّل عالمياً (100 طلب/دقيقة)
- [x] 100 طلب/دقيقة للمستخدم العادي
- [x] 10 محاولات/دقيقة لتسجيل الدخول
- [x] 5 محاولات/دقيقة لإنشاء الحسابات
- [x] استخدام Redis كمخزن للعدادات (CacheService)

**الملفات:**
```
apps/api/src/app.module.ts
apps/api/src/modules/auth/auth.controller.ts
apps/api/package.json
```

---

### 1.3 🧹 تنظيف التنانت التجريبيين
**الحالة:** ✅ مكتمل | **الأولوية:** 🟡 مهمة | **الوقت:** ~1 ساعة

- [x] تحديد التنانت التجريبيين (17 تنانت)
- [x] حذف قواعد البيانات الفارغة/التجريبية (16 DB)
- [x] حذف سجلاتهم من `platform` DB
- [x] التأكد من أن الـ API يعمل بدون أخطاء

---

## 🟡 المرحلة 2: تفعيل الميزات الجاهزة (5-7 أيام)

> هذه الميزات بنيتها الأساسية جاهزة (Schema + صفحات) — تحتاج ربط وتفعيل فقط

### 2.1 📦 المخزون (Inventory)
**الحالة:** ✅ مكتمل (مبني مسبقاً) | **الأولوية:** 🟡 مهمة | **الوقت:** ~8 ساعات

- [x] ربط صفحة المخزون بالـ API (CRUD للمنتجات)
- [x] ربط فئات المنتجات
- [x] حركات المخزون (إضافة/صرف/تعديل)
- [x] ربط منتج بخدمة (LinkServiceProduct)
- [x] تنبيه نفاد المخزون (low-stock API)

**Models جاهزة:** `Product`, `ProductCategory`, `InventoryMovement`, `ServiceProduct`

---

### 2.2 ❤️ نظام الولاء (Loyalty)
**الحالة:** ✅ مكتمل (مبني مسبقاً) | **الأولوية:** 🟡 مهمة | **الوقت:** ~6 ساعات

- [x] API مع leaderboard + settings + إحصائيات
- [x] صفحة الولاء مع لوحة المتصدرين
- [x] عرض إعدادات النقاط (نقاط/ريال، قيمة الاسترداد، الحد الأدنى)
- [x] Empty state مع شرح كيفية العمل

**Models جاهزة:** `LoyaltyPoints`, `LoyaltyTransaction`

---

### 2.3 🧾 ZATCA (الفوترة الإلكترونية)
**الحالة:** ⚠️ كود جاهز تقنياً — ينتظر تسجيل رسمي | **الأولوية:** 🟡 مهمة (مطلب حكومي)

> [!NOTE]
> تصحيح: كان مكتوباً "لم يُبدأ" — هذا خطأ. الكود مُنفذ فعلاً منذ مارس 2026.

- [x] `zatca.service.ts` — 14KB — XML builder + QR TLV encoding + crypto
- [x] توليد QR Code للفاتورة المبسطة
- [x] تنسيق XML حسب معيار UBL 2.1
- [x] Onboarding flow + CSR generation
- [ ] تسجيل رسمي في بوابة فاتورة هيئة الزكاة والدخل ← **المتبقي الوحيد**
- [ ] ربط مع بيئة Sandbox ثم Production

**Models:** `ZatcaCertificate`, `ZatcaInvoice` ✅ موجودة
**⚠️ الكود جاهز 100% — يحتاج فقط بيانات التسجيل الرسمية من بوابة هيئة الزكاة**

---

### 2.4 🧬 Client DNA (ذاكرة العميل)
**الحالة:** ✅ مكتمل (مبني مسبقاً) | **الأولوية:** 🟢 تحسين | **الوقت:** ~4 ساعات

- [x] API endpoints (getClientDna, computeClientDna, computeAllDna)
- [x] Dashboard service methods مربوطة
- [x] تاب DNA في صفحة تفاصيل العميل (Churn Risk + VIP Score + CLV + متوسط الفاتورة)

**Model جاهز:** `ClientDna`

---

### 2.5 📋 الباقات (Packages)
**الحالة:** ✅ مكتمل | **الأولوية:** 🟢 تحسين | **الوقت:** ~4 ساعات

- [x] API جاهز (CRUD + ربط خدمات)
- [x] صفحة إنشاء باقة مع محدد خدمات + حاسبة خصم
- [x] عرض الباقات مع نسبة التوفير
- [x] حذف الباقة

**Models جاهزة:** `Package`, `PackageService`

---

## 🔵 المرحلة 3: التكاملات الخارجية (4-6 أيام)

> تفتح مصادر إيرادات جديدة + تحسّن تجربة العميل

### 3.1 💳 بوابة الدفع الإلكتروني
**الحالة:** ❌ لم يُبدأ | **الأولوية:** 🔵 عالية | **الوقت:** ~12 ساعة

**خيارات مقترحة:**
| البوابة | الأفضل لـ | الرسوم |
|---------|-----------|--------|
| **Moyasar** | السعودية (مدى + Apple Pay) | 2.1% |
| **Tap Payments** | الخليج | 2.5% |
| **Stripe** | عالمي | 2.9% |

- [ ] إنشاء حساب في البوابة المختارة
- [ ] إضافة `payments` module في الـ API
- [ ] صفحة الدفع في صفحة الحجز (Booking)
- [ ] Webhook لتأكيد الدفع
- [ ] إيصال إلكتروني

---

### 3.2 💬 تكامل واتساب
**الحالة:** ✅ مكتمل (بانتظار ربط الحسابات) | **الأولوية:** 🔵 عالية | **الوقت:** ~8 ساعات

- [x] إنشاء `whatsapp.service.ts` (إرسال نصوص + مستندات PDF)
- [x] صفحة إعدادات واتساب في الداشبورد (كل صالون برقمه الخاص)
- [x] ربط مع نظام الإشعارات
- [x] إرسال تلقائي: تأكيد + تذكير + شكر + فواتير
- [ ] تصميم Templates واعتمادها من Meta (بعد ربط الحساب)

---

### 3.3 📱 SMS
**الحالة:** ⚠️ كود جاهز — ينتظر credentials الإنتاج | **الأولوية:** 🟢 متوسطة

> [!NOTE]
> تصحيح: كان مكتوباً "لم يُبدأ" — هذا خطأ. الكود مُنفذ فعلاً منذ فبراير 2026.

- [x] `sms.service.ts` — Unifonic provider كامل + Circuit Breaker
- [x] إرسال OTP للتحقق
- [x] تذكير بالموعد
- [ ] تفعيل credentials حقيقية من Unifonic ← **المتبقي الوحيد**

**⚠️ يحتاج فقط:** `UNIFONIC_API_KEY` و `UNIFONIC_SENDER_ID` في الـ .env

---

## 📊 المرحلة 4: التقارير المتقدمة والذكاء (4-6 أيام)

### 4.1 📈 تقارير إضافية
**الحالة:** ✅ مكتمل بالكامل | **الوقت:** ~8 ساعات

- [x] صفحة تقرير الخدمات (الأكثر طلباً، الأعلى إيراداً، ترتيب متعدد)
- [x] صفحة تقرير المصروفات (شهري + ربعي + سنوي مع مقارنة)
- [x] تقرير الربح الصافي (إيرادات - مصروفات + هامش ربح)
- [x] رسوم بيانية (إيرادات يومية + اتجاه شهري + تفصيل فئات)
- [x] **تصدير التقارير PDF/Excel** ✅ — `report-export.service.ts` (9.3KB)
  - إيرادات PDF + CSV
  - موظفات PDF + CSV
  - خدمات CSV
  - مصروفات CSV
  - عملاء CSV

> [!NOTE]
> تصحيح: كان مكتوباً "مؤجل" — هذا خطأ. التصدير مُنفذ منذ أبريل 2026 مع 11 API endpoint.

---

### 4.2 💰 التسعير الذكي (Dynamic Pricing)
**الحالة:** ✅ مكتمل (مبني مسبقاً) | **الوقت:** ~8 ساعات

- [x] ربط صفحة التسعير بالـ API (CRUD لقواعد التسعير)
- [x] أنواع: ذروة، خارج الذروة، عطلة، مخصص
- [x] تفعيل/تعطيل القواعد
- [x] عرض نسبة الزيادة/الخصم

**Model جاهز:** `PricingRule`

---

### 4.3 📢 نظام التسويق (Campaigns)
**الحالة:** ✅ مكتمل (مبني مسبقاً) | **الوقت:** ~8 ساعات

- [x] ربط صفحة التسويق بالـ API (CRUD للحملات)
- [x] إنشاء حملة (اسم + رسالة + قناة + محفز)
- [x] تنفيذ الحملة + عداد الإرسال
- [x] كشف فجوات التقويم التلقائي

**Model جاهز:** `Campaign`

---

## 📱 المرحلة 5: تطبيق الجوال (2-3 أسابيع)

### 5.1 PWA — تطبيق ويب تقدمي (بدلاً من React Native)
**الحالة:** ✅ مكتمل | **الوقت:** ~3 ساعات

- [x] manifest.json (standalone, RTL, أيقونات متعددة الأحجام)
- [x] Service Worker (تخزين مؤقت ذكي + عمل بدون إنترنت)
- [x] صفحة "غير متصل" مع زر إعادة المحاولة
- [x] PWA Install Prompt للأندرويد/Chrome (مع cooldown 24 ساعة)
- [x] iOS Add to Home Screen دليل (لمتصفح Safari)
- [x] أيقونة التطبيق (SERVIX brand icon)
- [x] Security headers + aggressive caching + AVIF/WebP optimization
- [x] viewport-fit: cover (دعم notch)

### 5.2 تطبيق أصلي (React Native / Expo) — مستقبلي
**الحالة:** ❌ مؤجل (لما يصير 50+ صالون) | **الوقت:** ~2 أسبوع

- [ ] تسجيل دخول / OTP
- [ ] البحث عن صالون
- [ ] حجز موعد
- [ ] الإشعارات Push
- [ ] رصيد الولاء

---

## ⚙️ المرحلة 6: DevOps والتوسع (5-7 أيام — بالتوازي)

### 6.1 🔄 CI/CD Pipeline
**الحالة:** ✅ مكتمل | **الوقت:** ~8 ساعات

- [x] GitHub Actions: Lint + Type-check عند كل PR
- [x] Build Docker images تلقائي (matrix: api, dashboard, booking, admin)
- [x] Auto-deploy عند merge إلى `main` (SSH → docker compose pull → up)
- [x] Health check verification بعد كل deploy
- [x] Rollback تلقائي عند فشل Health check
- [x] Concurrency control (إلغاء builds سابقة)

---

### 6.2 📊 Monitoring & Health
**الحالة:** ✅ مكتمل | **الوقت:** ~4 ساعات

- [x] Sentry Error Tracking (مدمج في AppModule)
- [x] Health Check API (/health, /health/ready, /health/live)
- [x] Docker HEALTHCHECK لكل container (API + Dashboard + Booking)
- [x] docker-compose healthcheck + depends_on condition
- [x] Memory + uptime + DB status في health endpoint
- [x] **Prometheus + Grafana + Alertmanager** ✅ — جاهزة في `tooling/prometheus/` و `tooling/grafana/`
  - 5 Grafana dashboards (API Overview, Tenant Health, Background Jobs, Infrastructure, Custom)
  - 3 Alertmanager alert files (error rate, latency, queue depth)
  - metrics middleware في الـ API
  - Node/Postgres/Redis/Nginx exporters في docker-compose

> [!NOTE]
> تصحيح: كان مكتوباً "مؤجل" — هذا خطأ. Prometheus+Grafana جاهزتان منذ أبريل 2026.

---

### 6.3 🔐 تحسينات أمنية
**الحالة:** ✅ مكتمل | **الوقت:** ~8 ساعات

- [x] Rate Limiting (100 req/min عام، 10 للتسجيل)
- [x] JWT Authentication + Refresh Tokens
- [x] Audit Module (تسجيل العمليات)
- [x] Security headers (X-Frame-Options, X-XSS-Protection, nosniff)
- [x] CORS Configuration (domain-specific)
- [x] Subscription Write Guard (حماية الكتابة)
- [x] 2FA (TOTP — RFC 6238) مع QR Code + backup codes
- [x] OAuth (Google Login) — تسجيل دخول بحساب Google

---

## 📅 الجدول الزمني

| المرحلة | المدة | الأولوية |
|---------|-------|----------|
| **1. الحماية** | 2-3 أيام | 🔴 فوري |
| **2. التفعيل** | 5-7 أيام | 🟡 أسبوع |
| **3. التكامل** | 4-6 أيام | 🔵 أسبوعين |
| **4. الذكاء** | 4-6 أيام | 🟢 شهر |
| **5. الجوال** | 2-3 أسابيع | 🟢 شهرين |
| **6. DevOps** | 5-7 أيام | 🟡 بالتوازي |

**الإجمالي:** ~6-8 أسابيع (المراحل 1-6 مكتملة)

---

## 🚀 المرحلة 7: ميزات متقدمة مُنفذة (لم تكن في الخطة الأصلية)

> هذه الميزات بُنيت خلال أبريل 2026 وتجاوزت الخطة الأصلية بشكل كبير

### 7.1 🤖 AI Reception V2 — الاستقبال الذكي الكامل
**الحالة:** ✅ مكتمل 100% (6 مراحل) | **الحجم:** 22 ملف، ~170KB

- [x] Router ذكي يحسم 70% من الرسائل بدون AI (opt-out, vacation, DB answers, أزرار)
- [x] **GPT-5-nano** (80% من المحادثات) + **GPT-5-mini** (20% المعقد)
- [x] **Gemini Flash** كـ fallback (حماية عند انقطاع OpenAI)
- [x] **Whisper عبر Groq** — تحويل الصوتيات
- [x] **AI Safety Net** — فلترة الردود (أسعار، تأكيد وهمي، هوية)
- [x] **Client Memory** — ذاكرة العميل في Redis (90 يوم)
- [x] **Semantic Cache** — كاش الأسئلة المتكررة (Jaccard، 24 ساعة)
- [x] **Rich Media** — أزرار + قوائم + صور + موقع عبر WhatsApp Evolution
- [x] **AI Analytics** — تقرير أسبوعي (Cron الأحد 9ص)
- [x] **Proactive Messages** — متابعة الحجوزات + إعادة تفاعل
- [x] **Manager Approval Flow** — موافقة/رفض المديرة على الإجراءات
- [x] **صفحة إعدادات AI** في Dashboard (وضع تشغيل + نبرة + باقات)
- [x] 94 اختبار AI مكتوب

**المرجع:** `docs/features/AI_RECEPTION_V2_PLAN.md` | `CLAUDE.md`

---

### 7.2 💬 WhatsApp Evolution — التكامل الكامل
**الحالة:** ✅ مكتمل | **الحجم:** 13 ملف

- [x] `whatsapp-evolution.service.ts` — إرسال نص/media
- [x] `whatsapp-evolution-webhook.controller.ts` — استقبال الرسائل
- [x] `whatsapp-rich-media.service.ts` — أزرار + قوائم + صور + تنزيل media
- [x] `whatsapp-anti-ban.service.ts` — حماية من الحظر + rate limiting
- [x] صفحة ربط QR في Dashboard

---

### 7.3 🖥️ POS V2 — نظام الكاشير المتكامل
**الحالة:** ✅ مُنفذ أساسياً ⏳ إضافات قيد التنفيذ

- [x] 13 صفحة POS (كاشير كامل)
- [x] **POS Shifts** — درج نقدي + فتح/إغلاق وردية
- [x] **Self Orders** — طلب ذاتي بـ QR (رمز A001)
- [x] دفع متعدد (نقدي + بطاقة + Apple Pay + مقسّم)
- [x] تعليق/استدعاء فواتير
- [x] كوبونات + عمولات موظفات
- [x] فاتورة QR عامة (public token)
- [x] WebSocket notifications (real-time)
- [⏳] Partial Refunds (قيد التنفيذ)
- [⏳] تاب المواعيد في الكاشير

**المرجع:** `docs/features/POS_V2_APPROVED_PLAN.md`

---

### 7.4 🎨 Smart Menu — المنيو الذكي
**الحالة:** ✅ مكتمل

- [x] 5 ثيمات سينمائية: **Luxe, Bloom, Glamour, Golden, Banan**
- [x] 8 لوحات ألوان مضبوطة
- [x] صفحة `/order` عامة بدون تسجيل
- [x] نظام أرقام طلبات (A001, B002)
- [x] WebSocket: تحديث فوري عند الدفع
- [x] تقييم 5 نجوم + دعوة Google Maps

**المرجع:** `docs/features/SMART_MENU_QR_INVOICE_PLAN.md`

---

### 7.5 🔧 ميزات تقنية متقدمة
**الحالة:** ✅ جميعها مكتملة

| الميزة | الملف/الموقع |
|--------|-------------|
| **Debts Module** — متابعة ديون العملاء | `modules/salon/debts/` |
| **Feedback System** — تقييمات العملاء | `modules/salon/feedback/` |
| **Review Requests** — طلبات تقييم | `modules/salon/review-requests/` |
| **Loyalty Visits** — نظام الزيارات | `modules/salon/loyalty/visits/` |
| **Circuit Breaker** — opossum | `shared/resilience/` |
| **Distributed Locks** — Redis SET NX | `shared/locks/` |
| **Encryption at-rest** — AES-256-GCM | `shared/encryption/` |
| **Feature Flags + A/B Testing** | `shared/feature-flags/` |
| **OpenTelemetry Tracing** | `shared/telemetry/` |
| **Terraform IaC** — Hetzner | `tooling/terraform/` (9 ملفات) |
| **K8s manifests** | `tooling/k8s/` (11 ملف) |
| **Chaos Tests** | `tooling/chaos/` (3 ملفات) |
| **K6 Load Tests** | `tooling/k6/` (12 ملف) |

---

### 7.6 📋 النواقص الحرجة المتبقية

| النقص | الأولوية | الملاحظة |
|-------|---------|------|
| **بوابة الدفع** (Moyasar/Tap) | 🔴 حرج | الـ `payments/` module فارغ (Mock فقط) |
| **ZATCA تسجيل رسمي** | 🟡 مهم | الكود جاهز — يحتاج بيانات الهيئة |
| **SMS credentials** | 🟡 مهم | الكود جاهز — يحتاج UNIFONIC_API_KEY |
| **React Native** | 🟢 مستقبلي | skeleton موجود — لما يصير 50+ صالون |
| **Partial Refunds** | 🟡 قيد التنفيذ | الـ DTO موجود — Frontend لم يكتمل |
