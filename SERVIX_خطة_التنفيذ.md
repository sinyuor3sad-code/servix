# خطة تنفيذ SERVIX — المرحلة الثالثة والرابعة
**التاريخ:** 20 أبريل 2026  
**المنصة:** SERVIX — نظام إدارة الصالونات  
**التقنيات:** NestJS + Prisma + PostgreSQL + Redis + Docker + n8n + Evolution API + Gemini AI

---

## 📋 نظرة عامة

هذا المستند يحتوي على خطتين رئيسيتين:
1. **المرحلة 3:** ربط الواتساب الذكي (Evolution API + n8n + Gemini AI)
2. **المرحلة 4:** تطوير نظام الولاء (إضافة نظام الزيارات)

---

# المرحلة 3: ربط الواتساب الذكي

## 🎯 الهدف
تفعيل منظومة واتساب ذكية لكل صالون مشترك في SERVIX تشمل:
- موظف استقبال آلي (يرد على استفسارات الزبائن بالذكاء الاصطناعي)
- إرسال الفواتير تلقائياً عبر واتساب
- تذكيرات المواعيد قبل 24 ساعة

## 📐 المعمارية

```
📱 زبون يرسل رسالة واتساب
        ↓
   Evolution API (يستقبل الرسالة)
        ↓ Webhook
   n8n Workflow (يعالج الرسالة)
        ↓
   SERVIX API (يجيب سياق الصالون)
        ↓
   Gemini AI (يولّد الرد الذكي)
        ↓
   n8n → Evolution API → واتساب
        ↓
   📱 الزبون يستقبل الرد
```

---

## الخطوة 1: تثبيت Evolution API على السيرفر
**المدة:** 30 دقيقة

> **ملاحظة:** Evolution API هو بديل مجاني ومفتوح المصدر لـ Meta Cloud API. يعمل عبر WhatsApp Web Protocol. يدعم فقط **واتساب بزنس**.

### الملفات المطلوبة:

#### [MODIFY] `docker-compose.prod.yml`
إضافة خدمة Evolution API:

```yaml
evolution-api:
  image: atendai/evolution-api:latest
  container_name: servix-evolution
  restart: always
  environment:
    SERVER_URL: https://evo.servi-x.com
    AUTHENTICATION_API_KEY: ${EVOLUTION_API_KEY}
    DATABASE_PROVIDER: postgresql
    DATABASE_CONNECTION_URI: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/evolution_db
    DATABASE_CONNECTION_CLIENT_NAME: evolution
    DATABASE_SAVE_DATA_INSTANCE: true
    DATABASE_SAVE_DATA_NEW_MESSAGE: true
    DATABASE_SAVE_DATA_CONTACTS: true
    DATABASE_SAVE_DATA_CHATS: true
    LOG_LEVEL: WARN
    DEL_INSTANCE: false
    LANGUAGE: ar
  ports:
    - "127.0.0.1:8080:8080"
  depends_on:
    postgres:
      condition: service_healthy
  networks:
    - servix-network
  volumes:
    - evolution_data:/evolution/instances
```

إضافة volume:
```yaml
volumes:
  evolution_data:
```

#### [MODIFY] `.env.example`
```env
# ═══ Evolution API (WhatsApp) ═══
EVOLUTION_API_KEY=evo_servix_2026_CHANGE_ME
```

#### [MODIFY] Nginx Config
إضافة subdomain `evo.servi-x.com` → `127.0.0.1:8080`

### التحقق:
```bash
curl -H "apikey: $EVOLUTION_API_KEY" http://localhost:8080/instance/fetchInstances
# يجب أن يرجع [] (مصفوفة فارغة)
```

---

## الخطوة 2: تركيب n8n على السيرفر
**المدة:** 15 دقيقة

#### [MODIFY] `docker-compose.prod.yml`
```yaml
n8n:
  image: n8nio/n8n:latest
  container_name: servix-n8n
  restart: always
  environment:
    N8N_HOST: n8n.servi-x.com
    N8N_PORT: 5678
    N8N_PROTOCOL: https
    WEBHOOK_URL: https://n8n.servi-x.com/
    N8N_BASIC_AUTH_ACTIVE: "true"
    N8N_BASIC_AUTH_USER: ${N8N_USER}
    N8N_BASIC_AUTH_PASSWORD: ${N8N_PASSWORD}
  ports:
    - "127.0.0.1:5678:5678"
  volumes:
    - n8n_data:/home/node/.n8n
  networks:
    - servix-network
```

#### [MODIFY] Nginx Config
إضافة subdomain `n8n.servi-x.com` → `127.0.0.1:5678`

---

## الخطوة 3: بناء 4 Workflows في n8n
**المدة:** 3-4 ساعات

---

### Workflow 1: 📱 إنشاء واتساب لصالون جديد

**المُحفّز:** Webhook من SERVIX Dashboard  
**الهدف:** إنشاء instance واتساب جديد لكل صالون + عرض QR Code

**Nodes:**
```
Node 1: Webhook
  ← يستقبل: { tenantId, salonName }

Node 2: HTTP Request → Evolution API
  POST /instance/create
  { instanceName: "salon-{tenantId}", qrcode: true }

Node 3: HTTP Request → Evolution API
  GET /instance/connect/{instanceName}
  ← يرجع QR Code (base64)

Node 4: HTTP Request → SERVIX API
  POST /api/v1/whatsapp/instance
  { tenantId, instanceName, status: "qr_pending" }

Node 5: Respond to Webhook
  ← يرجع QR Code للـ Dashboard
```

**Webhook إضافي — تأكيد الاتصال:**
```
Node 1: Webhook (من Evolution API — connection.update)
  ← يستقبل: { instance, state: "open" }

Node 2: HTTP Request → SERVIX API
  PATCH /api/v1/whatsapp/instance/{instanceName}
  { status: "connected", phoneNumber: "966..." }
```

---

### Workflow 2: 🤖 الرد الآلي على رسائل الزبائن

**المُحفّز:** Webhook من Evolution API (رسالة جديدة)  
**الهدف:** استقبال رسائل الزبائن والرد عليهم بذكاء اصطناعي

**Nodes:**
```
Node 1: Webhook (من Evolution API — messages.upsert)
  ← يستقبل: { instance, sender, message, messageType }

Node 2: IF — فلترة
  ← تجاهل رسائل المجموعات
  ← تجاهل رسائل النظام (status, reactions)
  ← قبول: نص / صوت / صورة فقط

Node 3: Switch — حسب نوع الرسالة
  ├─ نص → مباشرة للخطوة التالية
  ├─ صوت → تحويل لنص عبر Gemini → ثم الخطوة التالية
  └─ صورة → وصف الصورة عبر Gemini → ثم الخطوة التالية

Node 4: HTTP Request → SERVIX API
  POST /api/v1/whatsapp/chat
  {
    tenantId: (مُستخرج من instanceName),
    customerPhone: sender,
    message: messageText,
    messageType: "text|voice|image"
  }
  ← SERVIX يرسل الرسالة لـ Gemini مع سياق الصالون (خدمات، أسعار، مواعيد)
  ← يرجع: { reply, action }

Node 5: Switch — حسب الـ action
  ├─ "reply" → إرسال رد نصي عادي
  ├─ "booking_request" → إرسال طلب حجز للصالون + رد للزبون
  └─ "cancel_request" → إرسال طلب إلغاء للصالون + رد للزبون

Node 6: HTTP Request → Evolution API
  POST /message/sendText/{instanceName}
  { number: sender, text: reply }

Node 7: Wait (5 ثواني)
  ← تأخير ذكي بين الرسائل
```

**سلوك الحجز عبر الواتساب:**
```
زبونة: "أبي أحجز بكرا الساعة 4 صبغة"

1. AI يتحقق من المواعيد المتاحة عبر SERVIX API
2. لو متاح → يرفع طلب حجز (status: pending_approval)
3. يرد على الزبونة: "تم إرسال طلب الحجز، ننتظر تأكيد الصالون 🙏"
4. الصالون يشوف الطلب في Dashboard (إشعار فوري)
5. الصالون يوافق ✅ أو يرفض ❌
6. n8n يرسل النتيجة للزبونة عبر واتساب:
   - ✅ "تم تأكيد موعدك ✅ بكرا 4:00 م"
   - ❌ "للأسف الصالون اعتذر عن الموعد"
```

**سلوك الإلغاء عبر الواتساب:**
```
زبونة تكتب: "الغاء"

1. AI يرد: "تم إرسال طلب إلغاء للصالون، راح نبلغك بالرد 🙏"
2. الصالون يستقبل إشعار في Dashboard
3. الصالون يوافق ✅ أو يرفض ❌
4. الزبونة تستقبل الرد على واتساب
```

---

### Workflow 3: 🧾 إرسال الفواتير تلقائياً

**المُحفّز:** Webhook من SERVIX API (فاتورة جديدة)  
**الهدف:** إرسال ملخص الفاتورة + PDF عبر واتساب

**Nodes:**
```
Node 1: Webhook
  ← يستقبل: { tenantId, invoiceId, customerPhone, customerName,
               salonName, services, total, pdfUrl }

Node 2: IF — تحقق
  ← هل الصالون عنده واتساب مفعّل؟
  ← هل الزبون ما طلب إيقاف الرسائل؟

Node 3: Set — تجهيز الرسالة
  رسالة نصية:
  """
  ✨ شكراً لزيارتك {salonName}!

  🧾 فاتورة #{invoiceId}
  💇‍♀️ {services}
  💰 المجموع: {total} ر.س

  📎 الفاتورة مرفقة بالأسفل

  اكتب *توقف* لإيقاف الرسائل
  """

Node 4: HTTP Request → تحميل PDF
  GET {pdfUrl} → Binary data

Node 5: HTTP Request → Evolution API
  POST /message/sendText/{instanceName}
  ← إرسال الرسالة النصية أولاً

Node 6: Wait (2 ثانية)

Node 7: HTTP Request → Evolution API
  POST /message/sendMedia/{instanceName}
  ← إرسال ملف PDF
```

---

### Workflow 4: ⏰ تذكيرات المواعيد

**المُحفّز:** Cron (كل ساعة)  
**الهدف:** إرسال تذكيرات للمواعيد القادمة بعد 24 ساعة

**Nodes:**
```
Node 1: Cron Trigger
  ← كل ساعة (*/60 * * * *)

Node 2: HTTP Request → SERVIX API
  GET /api/v1/whatsapp/upcoming-appointments?hours=24
  ← يرجع المواعيد اللي بعد 24 ساعة ولم يُرسل لها تذكير

Node 3: Split In Batches
  ← معالجة كل موعد على حدة

Node 4: Set — تجهيز الرسالة
  """
  مرحباً {customerName} 👋
  تذكير بموعدك:
  📅 {date}
  ⏰ الساعة {time}
  ✂️ {services}
  📍 {salonName} - {address}

  للإلغاء اكتبي: الغاء
  """

Node 5: HTTP Request → Evolution API
  POST /message/sendText/{instanceName}

Node 6: Wait (5 ثواني)
  ← تأخير بين كل رسالة

Node 7: HTTP Request → SERVIX API
  PATCH /api/v1/appointments/{id}/reminder-sent
  ← يسجل إن التذكير انرسل (عشان ما يترسل مرتين)
```

---

## الخطوة 4: بناء API Endpoints في SERVIX
**المدة:** 3-4 ساعات

### [NEW] `apps/api/src/modules/whatsapp-integration/whatsapp-integration.module.ts`
### [NEW] `apps/api/src/modules/whatsapp-integration/whatsapp-integration.controller.ts`

**Endpoints:**
```
POST   /api/v1/whatsapp/instance          → ينشئ/يحفظ instance
GET    /api/v1/whatsapp/instance/:tenantId → يجلب حالة الاتصال
PATCH  /api/v1/whatsapp/instance/:name     → يحدّث الحالة
DELETE /api/v1/whatsapp/instance/:tenantId → يحذف instance

POST   /api/v1/whatsapp/chat              → يستقبل رسالة ويرد بـ AI
GET    /api/v1/whatsapp/upcoming-appointments → المواعيد القادمة
PATCH  /api/v1/whatsapp/appointments/:id/reminder-sent → يسجل التذكير
```

### [NEW] `apps/api/src/modules/whatsapp-integration/whatsapp-integration.service.ts`

**المسؤوليات:**
- التواصل مع Evolution API عبر HTTP (محمي بـ Circuit Breaker)
- إدارة instances لكل tenant
- تمرير الرسائل لـ Gemini AI مع سياق الصالون
- التحقق من قواعد الحماية من الحظر

### [MODIFY] Prisma Schema
إضافة جدول:
```prisma
model WhatsAppInstance {
  id           String   @id @default(uuid())
  tenantId     String   @unique
  instanceName String   @unique
  instanceId   String?
  status       String   @default("disconnected") // connected, disconnected, qr_pending
  phoneNumber  String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  tenant       Tenant   @relation(fields: [tenantId], references: [id])
}

model WhatsAppOptOut {
  id          String   @id @default(uuid())
  tenantId    String
  phone       String
  createdAt   DateTime @default(now())

  @@unique([tenantId, phone])
}
```

---

## الخطوة 5: صفحة ربط الواتساب في Dashboard
**المدة:** 2-3 ساعات

### [NEW] `apps/dashboard/src/app/[locale]/(dashboard)/settings/whatsapp/page.tsx`

**تصميم الصفحة:**
```
┌─────────────────────────────────────────┐
│  ⚙️ إعدادات الواتساب                     │
│                                         │
│  الحالة: 🟢 متصل                        │
│  الرقم: +966 5X XXX XXXX                │
│                                         │
│  ┌─────────────────┐                    │
│  │   QR Code       │  ← يظهر فقط عند   │
│  │   ████████      │     عدم الاتصال    │
│  │   ████████      │                    │
│  └─────────────────┘                    │
│                                         │
│  [🔌 فصل الواتساب]                      │
│                                         │
│  ─────────────────────────────          │
│  📊 إحصائيات:                           │
│  • رسائل اليوم: 47                      │
│  • ردود AI: 42                          │
│  • فواتير مرسلة: 12                     │
└─────────────────────────────────────────┘
```

---

## ⛔ قواعد الحماية من الحظر (إلزامية)

> **تحذير:** هذه القواعد يجب تطبيقها في كل مكان يُرسل فيه رسالة واتساب. عدم الالتزام = حظر الرقم.

| # | القاعدة | التفاصيل |
|---|---------|----------|
| 1 | **لا رسائل تسويقية** | فقط: ردود على رسائل + فواتير + تذكيرات |
| 2 | **تأخير بين الرسائل** | 5 ثواني بين كل رسالة، 30 ثانية للأرقام الجديدة |
| 3 | **حد يومي** | max 200 رسالة / صالون / يوم، max 3 رسائل / زبون / يوم |
| 4 | **قائمة بيضاء فقط** | لا إرسال إلا لأرقام موجودة في قاعدة بيانات الصالون |
| 5 | **زر إلغاء الاشتراك** | كل رسالة فيها "اكتب *توقف* لإيقاف الرسائل"، والزبون اللي يكتب "توقف" يُحفظ في جدول `WhatsAppOptOut` |

---

---

# المرحلة 4: تطوير نظام الولاء — إضافة نظام الزيارات

## 🎯 الهدف
إعطاء كل صالون خيار اختيار نوع برنامج الولاء:
- **نقاط** (موجود ✅): كل ريال = نقاط → يستبدلها بخصم
- **زيارات** (جديد ❌): كل زيارة تنعد → بعد X زيارة = مكافأة

## الشرط الأساسي
**الزبون لازم يكون مسجّل برقم الهاتف** عشان النظام يحسب زياراته.

---

## التعديلات المطلوبة

### [MODIFY] إعدادات الولاء

الإعدادات الحالية (نقاط):
```
loyalty_enabled: boolean
loyalty_points_per_sar: number
loyalty_redemption_value: number
```

الإعدادات الجديدة (نضيف):
```
loyalty_type: "points" | "visits"          // نوع الولاء
loyalty_visits_required: number            // عدد الزيارات المطلوبة (مثلاً 5)
loyalty_visits_reward_type: "free_service" | "fixed_discount" | "percentage_discount"
loyalty_visits_reward_value: number        // قيمة المكافأة أو نسبتها
loyalty_visits_reward_service_id: string?  // ID الخدمة المجانية (لو الجائزة خدمة)
```

### [MODIFY] `apps/api/src/modules/salon/loyalty/loyalty.service.ts`

إضافة methods جديدة:
```typescript
// تسجيل زيارة جديدة
async recordVisit(db, clientId, invoiceId): Promise<{
  visitCount: number;    // العدد الحالي
  required: number;      // المطلوب
  rewardEarned: boolean; // هل كسب مكافأة؟
  reward?: {
    type: string;
    value: number;
    serviceName?: string;
  }
}>

// جلب عداد زيارات الزبون
async getVisitCount(db, clientId): Promise<number>

// إعادة تعيين العداد بعد كسب المكافأة
async resetVisitCount(db, clientId): Promise<void>
```

### [MODIFY] `apps/api/src/modules/salon/loyalty/dto/update-settings.dto.ts`

إضافة حقول:
```typescript
loyaltyType?: 'points' | 'visits';
visitsRequired?: number;
visitsRewardType?: 'free_service' | 'fixed_discount' | 'percentage_discount';
visitsRewardValue?: number;
visitsRewardServiceId?: string;
```

### [MODIFY] Prisma Schema

إضافة حقل `visitCount` لجدول `LoyaltyPoints`:
```prisma
model LoyaltyPoints {
  // ... الحقول الموجودة
  visitCount Int @default(0)  // ← جديد: عداد الزيارات
}
```

### [MODIFY] عند إصدار الفاتورة
في الكود اللي يصدر الفاتورة، نضيف تحقق:

```typescript
const settings = await loyaltyService.getSettings(db);

if (settings.loyaltyType === 'points') {
  // النظام الحالي — كسب نقاط
  await loyaltyService.earnPoints(db, clientId, invoiceId, amount);
} else if (settings.loyaltyType === 'visits') {
  // النظام الجديد — عد زيارة
  const result = await loyaltyService.recordVisit(db, clientId, invoiceId);
  if (result.rewardEarned) {
    // تطبيق المكافأة تلقائياً أو إشعار الكاشير
  }
}
```

---

## تجربة المستخدم

### إعدادات الصالون (Dashboard):
```
┌─────────────────────────────────────────┐
│  ⭐ برنامج الولاء                       │
│                                         │
│  نوع البرنامج:                          │
│  ○ نقاط (كل ريال = نقاط)               │
│  ● زيارات (كل زيارة تنعد)              │
│                                         │
│  ─────────────────────────────          │
│  عدد الزيارات للمكافأة: [5]             │
│                                         │
│  نوع المكافأة:                          │
│  ○ خدمة مجانية → [قص شعر     ▼]        │
│  ● خصم ثابت   → [50] ر.س               │
│  ○ خصم نسبة   → [20] %                 │
│                                         │
│  [💾 حفظ]                               │
└─────────────────────────────────────────┘
```

### تجربة الكاشير:
```
عند إصدار الفاتورة للزبون المسجّل:

┌─────────────────────────────────────────┐
│  ⭐ ولاء العميل                          │
│  الزيارات: ⭐⭐⭐☆☆ (3/5)               │
│  باقي زيارتين للمكافأة!                 │
└─────────────────────────────────────────┘

عند وصول 5/5:

┌─────────────────────────────────────────┐
│  🎉 مبروك! كسب مكافأة!                  │
│  خصم 50 ر.س على هذه الفاتورة           │
│  [✅ تطبيق الخصم]  [⏭️ تأجيل]           │
└─────────────────────────────────────────┘
```

### تجربة الزبون (لو واتساب مفعّل):
```
بعد كل زيارة:
"شكراً لزيارتك صالون النور ✨
 عداد زياراتك: ⭐⭐⭐☆☆ (3/5)
 باقي زيارتين وتكسبين خصم 50 ر.س! 💜"

عند كسب المكافأة:
"🎉 مبروك! وصلتي 5 زيارات!
 كسبتي خصم 50 ر.س على زيارتك الجاية!
 نتشرف بخدمتك دائماً 💜"
```

---

---

# 📅 الجدول الزمني

| اليوم | المهمة | المدة |
|-------|--------|-------|
| **1** | تثبيت Evolution API + n8n على السيرفر (Docker + Nginx) | 1 ساعة |
| **1** | بناء Workflow 1 في n8n (إنشاء واتساب + QR Code) | 2 ساعة |
| **2** | بناء API endpoints (WhatsApp Integration module) | 3 ساعات |
| **2** | بناء Prisma schema + migration | 30 دقيقة |
| **2** | بناء صفحة واتساب في Dashboard | 2 ساعة |
| **3** | بناء Workflow 2 (الرد الآلي + AI) | 2 ساعة |
| **3** | بناء Workflow 3 (إرسال الفواتير) | 1 ساعة |
| **3** | بناء Workflow 4 (تذكيرات المواعيد) | 1 ساعة |
| **4** | تطوير نظام الولاء (إضافة الزيارات) | 2 ساعة |
| **4** | تعديل صفحة إعدادات الولاء في Dashboard | 1 ساعة |
| **5** | اختبار شامل + إصلاح أخطاء | 2 ساعة |
| | **المجموع** | **~17 ساعة عمل (5 أيام)** |

---

# ✅ خطة التحقق والاختبار

### واتساب:
- [ ] إنشاء instance لصالون تجريبي
- [ ] مسح QR Code من الجوال وتأكيد الاتصال
- [ ] إرسال رسالة "السلام عليكم" من رقم آخر والتأكد من رد AI ذكي
- [ ] إصدار فاتورة والتأكد من وصولها (نص + PDF) عبر واتساب
- [ ] تأكيد وصول تذكير الموعد قبل 24 ساعة
- [ ] اختبار كتابة "توقف" والتأكد من إيقاف الرسائل
- [ ] اختبار طلب حجز عبر واتساب ← الصالون يوافق ← الزبون يستقبل التأكيد
- [ ] اختبار طلب إلغاء عبر واتساب ← الصالون يوافق ← الزبون يستقبل التأكيد
- [ ] التأكد من تأخير 5 ثواني بين الرسائل
- [ ] التأكد من حد 200 رسالة/يوم

### الولاء:
- [ ] تغيير نوع الولاء من "نقاط" إلى "زيارات" في إعدادات الصالون
- [ ] إصدار فواتير متتالية لنفس الزبون والتأكد من العداد
- [ ] التأكد من ظهور المكافأة عند وصول العدد المطلوب
- [ ] اختبار الثلاث أنواع: خدمة مجانية / خصم ثابت / خصم نسبة
- [ ] التأكد إن الزبون الغير مسجّل ما تنعد زياراته
- [ ] التأكد من إعادة تعيين العداد بعد كسب المكافأة
