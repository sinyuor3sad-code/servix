# خطة تنفيذ: الاستقبال الذكي (AI Reception) — V1

---

> [!CAUTION]
> ## ⛔ هذه الخطة مُستبدَلة — SUPERSEDED BY V2
>
> **تاريخ الأرشفة:** 2026-04-28
>
> هذه الخطة تصف **V1 القديم** الذي كان يعتمد على n8n + Gemini.
> **V1 أُلغي بالكامل واستُبدل بـ V2.**
>
> | V1 (هذا الملف — ملغي) | V2 (المُنفذ الآن) |
> |------------------------|-----------------|
> | n8n webhook كـ AI bridge | AIProviderService مباشر |
> | Gemini كـ AI أساسي | GPT-5-nano/mini (Gemini = fallback فقط) |
> | n8n.client.ts | مُعطَّل — "لا تعيد ربطه" (CLAUDE.md) |
> | لا ذاكرة عميل | ai-client-memory.service.ts (90 يوم) |
> | لا semantic cache | ai-semantic-cache.service.ts (Jaccard) |
> | لا rich media | whatsapp-rich-media.service.ts |
> | لا voice support | Whisper عبر Groq |
>
> **المرجع الصحيح:** `docs/features/AI_RECEPTION_V2_PLAN.md` — جميع مراحله مكتملة ✅

---

> نسخة: v1.0 • التاريخ: 2026-04-22 • **مؤرشف — للرجوع التاريخي فقط**

---

## 1. ملخّص تنفيذي

إضافة نظام "استقبال ذكي" يتلقّى رسائل واتساب من عملاء الصالون ويرد عليهم باستخدام Gemini (عبر n8n). الـ AI يجاوب على الاستفسارات من معلومات الصالون مباشرة، لكن **أي إجراء يؤثر على الحالة (حجز/إلغاء/تعديل) يتطلب موافقة المديرة عبر واتساب الشخصي** قبل التنفيذ.

**الربط تلقائي:** كل صالون جديد يشترك يُفعَّل له الاستقبال الذكي افتراضياً — لا ربط يدوي.

---

## 2. المُنجز سابقاً (جاهز للاستخدام)

- `WhatsAppEvolutionService.sendText(instanceName, phone, text)` — إرسال عبر Evolution API
- `WhatsAppEvolutionWebhookController` — يستقبل `messages.upsert` من Evolution، يعالج opt-out حالياً
- `WhatsAppAntiBanService` — فلترة opt-out + rate limiting + business hours
- `SettingsService.getAll(db)` و `upsert` — إعدادات مفتاح/قيمة للـ tenant
- `WhatsAppInstance` model في platform DB (name, status, phone, tenantId)
- `CircuitBreakerService` — لأي استدعاء خارجي (n8n/Gemini)
- 4 workflows موجودة في `tooling/n8n/workflows/` (welcome/booking/reminder/review)
- Gemini configured في n8n (حسب تأكيد المالك)

---

## 3. المتطلبات

### المطلوب وظيفياً

1. **استفسارات معلوماتية** (أسعار، موقع، ساعات، خدمات، سياسات): AI يرد مباشرة من بيانات الصالون — **بدون موافقة**.
2. **إجراءات transactional** (حجز، إلغاء، تعديل موعد): AI يصيغ الطلب، يرسله للمديرة، ينتظر موافقتها.
3. **رد المديرة** (`موافق` أو `رفض`): يُنفَّذ الإجراء فعلياً عبر الـ API (وليس AI)، ثم يُبلَّغ العميل بالنتيجة.
4. **تعدد الطلبات المعلّقة**: تمييز بأرقام الطلب (`#247`) لمنع الالتباس.
5. **انتهاء المهلة** (30 دقيقة افتراضياً): إذا ما ردّت المديرة، الطلب يُلغى تلقائياً ويُبلَّغ العميل بالاعتذار.
6. **الربط التلقائي**: hook في subscription activation ينشئ Evolution instance + يفعّل AI defaults. المديرة فقط تمسح QR + تدخل رقمها.

### المطلوب غير الوظيفي

- **Multi-tenant isolated**: كل صالون له conversation history + pending actions + system prompt خاص
- **Auditable**: كل قرار AI/مديرة يُسجَّل
- **Resilient**: فشل Gemini/n8n ما يكسر الـ webhook (fallback graceful)
- **Arabic-first**: كل النصوص والـ prompts بالعربية (Asia/Riyadh timezone)

---

## 4. القرارات الأربعة (Defaults — يُعدَّل عند الطلب)

| # | القرار | الافتراضي المُقترح | التفاصيل |
|---|--------|---------------------|----------|
| 1 | **كلمات الموافقة/الرفض** | Regex: `/^(موافق\|ok\|نعم)\b/i` و `/^(رفض\|لا\|ارفض)\b/i` | case-insensitive، يقبل الكلمة مع/بدون رقم الطلب. |
| 2 | **مدة انتهاء الطلب** | 30 دقيقة | Job schedule يفحص كل 5 دقائق. |
| 3 | **تمييز الطلبات المتعدّدة** | رقم `#247` في رسالة المديرة. المديرة ترد: `موافق 247` أو فقط `موافق` (= آخر طلب) | الرقم = auto-increment per tenant. |
| 4 | **صفحة إعدادات** | `/settings/ai-reception` | toggle + جوال المديرة + tone (رسمي/ودّي) + معاينة system prompt |

---

## 5. التصميم المعماري

### A. تدفّق الرسالة الواردة (من العميل)

```
Customer WhatsApp msg
  └→ Evolution API
      └→ POST /salon/whatsapp/evolution/webhook/:instanceName
          ├─ kind = connection.update → كما هو (موجود)
          └─ kind = messages.upsert → MessageDispatcher
              ├─ [1] opt-out keyword? → AntiBanService.addOptOut (موجود)
              ├─ [2] sender == manager phone? → ManagerReplyHandler (جديد)
              │   ├─ parse "موافق/رفض [#id]"
              │   ├─ find latest pending AIPendingAction
              │   ├─ execute or cancel
              │   └─ notify customer
              └─ [3] else → AIReceptionService.handleCustomerMessage (جديد)
                  ├─ AIConversation.upsert (ضيف الرسالة)
                  ├─ ContextBuilder.buildForTenant() → {salon, services, hours, policies}
                  ├─ n8n webhook POST /webhook/servix-ai-reception
                  │   └─ body: { tenantId, phone, message, salonContext, history[], systemPrompt }
                  │       └─ n8n → Gemini (structured output)
                  │           └─ returns: { intent, reply, proposedAction? }
                  └─ ResponseRouter:
                      ├─ proposedAction.type == 'book_appointment' →
                      │   ├─ create AIPendingAction (status=awaiting_manager, expiresAt=+30min)
                      │   ├─ sendText(manager, "طلب #247: العميل س يريد حجز [خدمة] يوم [تاريخ]. رد: موافق أو رفض")
                      │   └─ sendText(customer, "جاري التأكد من المديرة — نرد خلال دقائق")
                      └─ proposedAction absent →
                          └─ sendText(customer, reply)
```

### B. تدفّق موافقة المديرة

```
Manager: "موافق 247"
  └→ Evolution → webhook
      └→ sender = manager phone → ManagerReplyHandler
          ├─ parse: action = approve, id = 247
          ├─ fetch AIPendingAction(id=247, tenantId, status=awaiting_manager)
          │   ├─ not found / expired → "الطلب منتهي"
          │   └─ found →
          │       ├─ status = approved
          │       ├─ switch payload.type:
          │       │   ├─ book_appointment → BookingService.createBooking(...)
          │       │   ├─ cancel_appointment → AppointmentsService.changeStatus(cancelled)
          │       │   └─ reschedule → AppointmentsService.update(...)
          │       ├─ sendText(customer, "تم التأكيد ✓ [تفاصيل الحجز]")
          │       └─ AuditLog.insert(...)
```

### C. التدفّق التلقائي للربط (Auto-Onboarding)

```
Tenant subscribes → SubscriptionService.activate(tenantId)
  └→ emit TenantActivated event
      └→ AIReceptionOnboardingListener.handle(tenantId)
          ├─ WhatsAppInstance.create(name = `salon-${slug}`, autoCreate=true)
          ├─ Settings.upsert: ai_reception_enabled=true, ai_tone=friendly,
          │                    ai_system_prompt_template=default
          └─ log "AI reception auto-enabled for tenant X"

Owner onboarding UX: 1) مسح QR  2) إدخال جوال المديرة  3) تم
```

---

## 6. المراحل (Phases)

### Phase 1 — Prisma Schema + Migrations

**الهدف:** جداول وإعدادات AI في tenant DB.

**الملفات:**
- `apps/api/prisma/tenant.prisma` — أضف:
  ```prisma
  model AIConversation {
    id          String   @id @default(cuid())
    phone       String   @db.VarChar(20)
    clientId    String?  @map("client_id")
    messages    Json     // [{role:'user'|'assistant', text, ts}]
    lastActiveAt DateTime @map("last_active_at") @db.Timestamptz()
    createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz()
    
    @@unique([phone])
    @@index([lastActiveAt])
    @@map("ai_conversations")
  }

  enum AIPendingActionStatus { awaiting_manager approved rejected expired }
  enum AIPendingActionType   { book_appointment cancel_appointment reschedule_appointment }

  model AIPendingAction {
    id          Int      @id @default(autoincrement())
    conversationId String @map("conversation_id")
    type        AIPendingActionType
    payload     Json     // {clientName, service, date, time, ...}
    status      AIPendingActionStatus @default(awaiting_manager)
    managerMessageId String? @map("manager_message_id") @db.VarChar(100)
    customerPhone String @map("customer_phone") @db.VarChar(20)
    expiresAt   DateTime @map("expires_at") @db.Timestamptz()
    resolvedAt  DateTime? @map("resolved_at") @db.Timestamptz()
    resolvedBy  String?  @map("resolved_by") @db.VarChar(20)  // manager phone
    createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz()
    
    @@index([status, expiresAt])
    @@index([tenantId, status])
    @@map("ai_pending_actions")
  }
  ```
- إعدادات جديدة (Settings rows):
  - `ai_reception_enabled` (default: `'true'`)
  - `ai_manager_phone` (default: empty — لازم المديرة تدخله)
  - `ai_tone` (default: `'friendly'`، خيارات: `formal`/`friendly`)
  - `ai_system_prompt_override` (اختياري — يلغي التمبلت الافتراضي)
  - `ai_approval_timeout_minutes` (default: `'30'`)

**Migration:** `prisma migrate dev --schema=./prisma/tenant.prisma --name add_ai_reception`

**ملاحظة:** يوجد schema drift موجود مسبقاً (`refunded_at` في Invoice بدون migration). المطور المُستلِم لازم يصلحه في نفس المرحلة: `prisma migrate dev --name add_invoice_refund_fields` قبل AI migration.

**Commit:** `feat(ai-reception): db schema — conversations, pending actions, settings`

---

### Phase 2 — n8n Workflow (Gemini Structured Output)

**الهدف:** workflow يستقبل رسالة + سياق ويرجّع JSON منظّم من Gemini.

**File جديد:** `tooling/n8n/workflows/05-ai-reception.json`

**البنية (nodes):**
1. **Webhook** — path `servix-ai-reception`, method POST, responseMode `responseNode`
2. **Validate Payload** — IF node يتأكد: `tenantId`, `phone`, `message`, `salonContext` غير فارغة
3. **Build Gemini Prompt** — Set node يبني prompt مركّب:
   ```
   أنت موظف استقبال في {salonContext.name}. تحدّث بلهجة {tone} ومختصر.
   المعلومات المتاحة: {JSON.stringify(salonContext)}
   آخر المحادثة: {JSON.stringify(history)}
   
   الرسالة الجديدة: {message}
   
   ارجع JSON **فقط** بالصيغة:
   {
     "intent": "inquiry|book|cancel|reschedule|complaint|smalltalk",
     "reply": "نصك الموجّه للعميل",
     "proposedAction": null | {
       "type": "book_appointment|cancel_appointment|reschedule_appointment",
       "payload": { ... المعلومات المستخلصة من المحادثة }
     }
   }
   
   **قواعد حتمية:**
   - لا تؤكّد أي حجز/إلغاء/تعديل من نفسك — يجب أن يكون proposedAction.
   - إذا نقصت معلومة (مثل الخدمة أو التاريخ) — اطلبها في reply ولا تنشئ proposedAction.
   - لا تخترع أسعاراً/خدمات غير موجودة في salonContext.
   ```
4. **Gemini Node** — يستخدم credential المحفوظ (أو Gemini proxy إن استُخدم)
5. **Parse JSON** — Code node يستخلص JSON من رد Gemini (مع fallback graceful إذا الرد مو JSON صحيح)
6. **Respond to Webhook** — يرجّع الـ parsed object للـ API
7. **Respond Error Path** — إذا validation فشل أو Gemini رمى خطأ

**اختبار يدوي:**
```bash
curl -X POST http://localhost:5680/webhook/servix-ai-reception \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"t1","phone":"966501234567","message":"أبي أحجز صبغة شعر بكرة",
       "salonContext":{"name":"صالون تجريبي","services":[{"name":"صبغة","priceFrom":200}],
                       "hours":"09:00-22:00"},
       "history":[]}'
```

التوقّع: JSON فيه `intent: "book"`، `reply: "ما هي الخدمة تحديداً وكم الساعة؟"` أو proposedAction مع payload مكتمل.

**Commit:** `feat(n8n): ai reception workflow with gemini structured output`

---

### Phase 3 — AIContextBuilder + AIReceptionService

**الهدف:** NestJS service يتلقّى رسالة العميل، يبني السياق، يستدعي n8n.

**ملفات جديدة:**

```
apps/api/src/modules/salon/ai-reception/
  ai-reception.module.ts
  ai-reception.service.ts
  ai-context.builder.ts
  ai-conversation.repository.ts
  ai-reception.types.ts
  ai-reception.service.spec.ts
  ai-context.builder.spec.ts
```

**`ai-context.builder.ts`** — يجمع من tenant DB:
```typescript
interface SalonContext {
  name: string;
  services: Array<{ name: string; priceFrom: number; priceTo: number; durationMin: number }>;
  hours: Record<string, { open: string; close: string; closed: boolean }>;
  address: string;
  policies: { cancellationPolicyAr: string; bookingLeadHours: number };
  tone: 'formal' | 'friendly';
}

async buildForTenant(db: TenantPrismaClient): Promise<SalonContext>;
```

**`ai-reception.service.ts`** — orchestration:
```typescript
async handleCustomerMessage(params: {
  tenantId: string;
  tenantDb: TenantPrismaClient;
  instanceName: string;
  phone: string;         // customer normalized phone
  text: string;
}): Promise<void>;

// داخلياً:
// 1. conversation.upsert (append user message)
// 2. context = await builder.buildForTenant(db)
// 3. history = last 10 messages from conversation
// 4. resp = await n8nClient.callAIReception({ message, context, history })
// 5. if (resp.proposedAction) → create AIPendingAction + notify manager + interim reply to customer
//    else → sendText(customer, resp.reply) + append assistant message to conversation
```

**`n8n.client.ts`** (جديد، يوضع في `shared/` أو داخل module):
```typescript
class N8nClient {
  constructor(private readonly breaker: CircuitBreakerService, private readonly config: ConfigService) {}
  
  private readonly aiReceptionBreaker = this.breaker.createBreaker(
    'n8n-ai-reception',
    (payload) => this.callN8nAIReception(payload),
  );
  
  callAIReception(payload: AIReceptionRequest): Promise<AIReceptionResponse> {
    return this.aiReceptionBreaker.fire(payload);
  }
}
```

استخدم `fetch` مع timeout 15s + circuit breaker (كما في `whatsapp-evolution.service.ts`).

**Config جديدة:** `N8N_BASE_URL` (default `http://n8n:5678` إنتاج، `http://localhost:5680` محلي).

**Commit:** `feat(ai-reception): context builder + orchestration service + n8n client`

---

### Phase 4 — Webhook Dispatcher + Manager Approval Flow

**الهدف:** توسيع `whatsapp-evolution-webhook.controller.ts` ليوجّه الرسائل الواردة، ومعالجة ردود المديرة.

**تعديلات على:** `apps/api/src/modules/salon/whatsapp-evolution/whatsapp-evolution-webhook.controller.ts`

**Logic الجديد داخل `handleMessagesUpsert`:**
```typescript
// بعد فحص opt-out الموجود (ينفّذ كما هو):

const managerPhone = await settingsService.get(tenantDb, 'ai_manager_phone');
if (managerPhone && normalizedSender === normalizePhone(managerPhone)) {
  return this.managerReplyHandler.handle({ tenantDb, instanceName, text, fromPhone });
}

const aiEnabled = await settingsService.get(tenantDb, 'ai_reception_enabled');
if (aiEnabled === 'true') {
  return this.aiReceptionService.handleCustomerMessage({
    tenantId, tenantDb, instanceName, phone: normalizedSender, text,
  });
}
```

**ملف جديد:** `ai-reception/manager-reply.handler.ts`
- `parseManagerReply(text) → { decision: 'approve'|'reject'|'unknown', actionId?: number }`
  - regex: `/^(موافق|ok|نعم)(?:\s+#?(\d+))?\b/i` → approve
  - regex: `/^(رفض|ارفض|لا)(?:\s+#?(\d+))?\b/i` → reject
- `handle()`:
  1. parse النص
  2. إذا `actionId` محدد → fetch AIPendingAction by id + tenantId
  3. إلا → fetch latest awaiting_manager action لهذا tenant (خلال آخر 30 دقيقة)
  4. إذا approved → نفّذ (استدعاء `BookingService.createBooking` أو `AppointmentsService.changeStatus`)
  5. حدّث status + resolvedAt + resolvedBy
  6. sendText للعميل بالنتيجة
  7. sendText للمديرة: "تم تسجيل قرارك ✓"

**Scheduled job:** `ai-reception.expirer.ts` (باستخدام `@nestjs/schedule` Cron كل 5 دقائق):
- fetch actions where `status=awaiting_manager AND expiresAt < now()`
- mark as `expired`
- sendText للعميل: "نعتذر، لم نستطع تأكيد طلبك. يرجى التواصل مباشرة."

**Commit:** `feat(ai-reception): webhook dispatcher + manager approval flow + expiration job`

---

### Phase 5 — Auto-Onboarding للصالون الجديد

**الهدف:** كل tenant جديد ينشط له AI تلقائياً.

**الملفات المتأثرة:**
- `apps/api/src/modules/admin/subscriptions/subscription.service.ts` (إذا موجود) — بعد `activate(tenantId)`:
  ```typescript
  await this.eventBus.emit('tenant.activated', { tenantId });
  ```

- ملف جديد: `apps/api/src/modules/salon/ai-reception/ai-reception.onboarding.ts`
  ```typescript
  @OnEvent('tenant.activated')
  async handleTenantActivated({ tenantId }: { tenantId: string }) {
    const tenantDb = this.tenantFactory.getClient(tenantId);
    const tenant = await this.platformDb.tenant.findUnique({ where: { id: tenantId } });
    
    // 1. Ensure WhatsApp instance
    await this.whatsAppService.getOrCreateInstance(tenantId, tenant.slug);
    
    // 2. Enable AI defaults
    await this.settingsService.upsertMany(tenantDb, {
      ai_reception_enabled: 'true',
      ai_tone: 'friendly',
      ai_approval_timeout_minutes: '30',
    });
    
    this.logger.log(`AI reception auto-enabled for ${tenantId}`);
  }
  ```

- إذا EventBus غير موجود في المشروع: نادي `onboarding.service` الجديد مباشرة من `subscription.service`.

**Commit:** `feat(ai-reception): auto-onboarding on tenant activation`

---

### Phase 6 — Dashboard: `/settings/ai-reception`

**الهدف:** صفحة إعدادات AI.

**ملف جديد:** `apps/dashboard/src/app/(dashboard)/settings/ai-reception/page.tsx`

**العناصر:**
- **Toggle:** تفعيل/إيقاف AI
- **Input:** رقم جوال المديرة (validation: سعودي، placeholder `05XXXXXXXX`)
- **Radio:** نبرة الردود (`رسمية` / `ودّية`)
- **Textarea** (expandable, advanced): system prompt override (إذا فاضي، يُستخدم التمبلت الافتراضي)
- **Number input:** مدة انتهاء الطلب بالدقائق (default 30, min 5, max 120)
- **معاينة:** زر "معاينة السياق" — يستدعي `GET /salon/ai-reception/preview-context` يعرض الـ salonContext الحالي (شفافية)

**Service client جديد:** `apps/dashboard/src/services/ai-reception.service.ts`
- `getSettings(token)` / `updateSettings(token, patch)`
- `previewContext(token)` → returns SalonContext

**Endpoints جديدة في API:** `ai-reception.controller.ts`
- `GET /salon/ai-reception/settings`
- `PATCH /salon/ai-reception/settings`
- `GET /salon/ai-reception/preview-context`
- `GET /salon/ai-reception/conversations?limit=50` (للـ dashboard تاريخ المحادثات)
- `GET /salon/ai-reception/pending-actions?status=awaiting_manager` (للمديرة تشوف طلبات تنتظر)

**أضف بطاقة** في `/settings/page.tsx`: "الاستقبال الذكي" مع أيقونة `Bot` أو `Sparkles`.

**أضف رابط** في Sidebar: "الاستقبال الذكي" مع `Bot` icon، بعد "المستشار الذكي" المُقترح، قبل "الإعدادات".

**Commit:** `feat(dashboard): ai reception settings page + services + sidebar link`

---

### Phase 7 — Tests + QA

**Unit tests (jest):**

- `ai-context.builder.spec.ts`
  - يجمّع الخدمات النشطة فقط
  - يحوّل ساعات العمل إلى object صحيح
  - يتجاهل الخدمات المحذوفة
  
- `ai-reception.service.spec.ts`
  - `handleCustomerMessage` يحفظ الرسالة في conversation
  - يستدعي n8n مع السياق الصحيح
  - إذا n8n رجع proposedAction → ينشئ AIPendingAction + يرسل للمديرة + يرد على العميل
  - إذا n8n رجع رد بس → يرسل الرد للعميل
  - فشل n8n (circuit breaker open) → يرد رسالة fallback للعميل
  
- `manager-reply.handler.spec.ts`
  - `parseManagerReply` يلتقط جميع الصيغ (موافق/رفض/ok/نعم/لا) مع/بدون رقم
  - موافقة → تنفّذ `BookingService.createBooking`
  - رفض → تحدّث status فقط
  - طلب غير موجود → ترسل للمديرة "الطلب منتهي"
  
- `ai-reception.expirer.spec.ts`
  - الجوب يلتقط فقط `awaiting_manager AND expiresAt < now`
  - يحدّث status = expired
  - يرسل للعميل رسالة اعتذار

- `webhook.controller.spec.ts` (تحديث):
  - فاحص جديد: sender = manager phone → يذهب لـ ManagerReplyHandler
  - فاحص جديد: customer msg + AI enabled → يذهب لـ AIReceptionService
  - opt-out يبقى له الأولوية

**Integration test (اختياري):** E2E flow يحاكي webhook → AI → manager → booking creation.

**Manual QA checklist:**
1. صالون جديد يشترك → تلقائياً فيه WhatsAppInstance + AI=true
2. المديرة تدخل جوالها في الإعدادات
3. عميل يرسل "كم سعر الصبغة؟" → يرد AI فوراً من salonContext
4. عميل يرسل "أبي أحجز الصبغة الأحد الساعة 4" → يصل للمديرة "طلب #1..." + يرد على العميل "جاري التأكد"
5. المديرة ترد "موافق 1" → يُنشأ الحجز فعلياً + يصل العميل "تم التأكيد"
6. عميل يرسل طلب حجز آخر، المديرة تتأخر 31 دقيقة → Expirer يعلن للعميل اعتذار
7. عميل يرسل "الغاء" → opt-out يُضاف (مو AI) — السلوك القديم يحترم الأولوية

**Commit:** `test(ai-reception): unit tests + manager approval + expiration coverage`

---

## 7. معايير القبول (Acceptance Criteria)

✅ AI يرد على الاستفسارات المعلوماتية خلال < 3 ثواني دون موافقة
✅ AI لا يستطيع حجز/إلغاء/تعديل مباشرة — دائماً يمر بالمديرة
✅ المديرة تستلم الطلب برسالة منظمة تحوي رقم الطلب والتفاصيل
✅ ردّ المديرة بـ "موافق"/"رفض" (مع أو بدون رقم) ينفّذ الإجراء ويبلّغ العميل
✅ الطلبات المنتهية تُلغى تلقائياً بعد 30 دقيقة مع اعتذار للعميل
✅ كل صالون جديد يحصل على AI مُفعَّل دون تدخل يدوي
✅ 535 اختبار الحالية تبقى ناجحة + ≥30 اختبار جديد
✅ فشل Gemini/n8n لا يُسقط الـ webhook (fallback graceful)
✅ opt-out keyword يبقى له الأولوية على AI

---

## 8. محاذير (Gotchas) للمطور التالي

### A. تنظيم أرقام الطلبات
`autoincrement` في Postgres per-tenant DB — الرقم يعيد الصفر عبر tenants مختلفين، وهذا مقصود (كل صالون عنده sequence خاصة). إذا تبغى unique globally، استخدم `cuid()` + رقم human-friendly منفصل.

### B. تدوير المحادثات
لا تحتفظ بأكثر من آخر 10 رسائل في `AIConversation.messages` (قصّها عند كل append). وإلا الـ JSON سينتفخ وسيستهلك tokens Gemini بلا داعٍ.

### C. نبرة Gemini
بعد 2-3 محادثات تجريبية، عدّل system prompt بناءً على الملاحظات. احتفظ بالتعديلات في git حتى يتحسّن السلوك بمرور الوقت (اعتبره config يتطوّر).

### D. Rate limiting على AI
تجنّب إرسال > 3 رسائل AI لنفس رقم خلال دقيقة (منع loops أو spam attacks). استخدم `CacheService.incrementRateLimit` بنفس النمط الموجود في `WhatsAppAntiBanService`.

### E. التكلفة
Gemini API له تسعير per-token. راقب متوسط الرسائل اليومية. إذا تجاوز، فكّر في:
- caching للأسئلة المتكرّرة (نفس السؤال خلال ساعة → نفس الرد)
- hard limit يومي per tenant

### F. اختبار Evolution API في التطوير
الـ AI flow يحتاج Evolution container ليكون "حياً" لإرسال الرسائل فعلياً. للتطوير المحلي:
- أما تشغّل Evolution محلياً (يحتاج postgres + redis + container كامل)
- أو استخدم fake `WhatsAppEvolutionService` في dev mode (override في DI container)

### G. schema drift موجود
`tenant.prisma` فيه `refunded_at` و `refund_reason` في `Invoice` بدون migration. لازم تعمل `prisma migrate dev --name add_invoice_refund_fields` قبل تعمل migration AI، وإلا `db:seed:e2e` سيفشل.

### H. ملف `apps/api/scratch/n8n-local.yml`
موجود في repo غير مُتَتَبَّع (لتشغيل n8n محلياً على port 5680). احذفه أو انقله لـ `tooling/docker/docker-compose.dev.yml` رسمياً.

### I. Webhook ordering
ترتيب فحص الرسائل الواردة في الـ controller **مهم**:
1. opt-out أولاً (لأن العميل يريد الخروج)
2. manager phone ثانياً (قبل أي AI processing)
3. AI reception ثالثاً
لا تغيّر الترتيب.

### J. المديرة كعميلة
إذا المديرة نفسها عندها موعد شخصي في الصالون، رقمها قد يتعارض. حل: صفحة AI settings تحذّر إذا رقم المديرة = رقم عميلة موجودة.

---

## 9. التقدير الزمني (للمطور بخبرة متوسطة)

| Phase | التقدير |
|-------|---------|
| 1 — DB | 3-4 ساعات |
| 2 — n8n workflow | 4-6 ساعات (أطول لو أول مرة مع Gemini structured output) |
| 3 — Service + Context | 6-8 ساعات |
| 4 — Webhook + Manager + Expirer | 8-10 ساعات |
| 5 — Onboarding | 2-3 ساعات |
| 6 — Dashboard | 6-8 ساعات |
| 7 — Tests + QA | 8-10 ساعات |
| **الإجمالي** | **~40-50 ساعة (أسبوع عمل مركّز)** |

---

## 10. مراجع سريعة

- Evolution API docs: https://doc.evolution-api.com/
- n8n Gemini node: https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.googlegemini/
- كود مشابه يمكن الاقتباس منه:
  - `whatsapp-evolution.service.ts` (HTTP client + circuit breaker pattern)
  - `loyalty.service.ts` (settings-based feature toggles)
  - `whatsapp-anti-ban.service.ts` (opt-out + rate limit pattern)

---

**بالتوفيق — الأساس جاهز، الأنماط موجودة، الاختبارات واضحة. كل ما تحتاجه موجود في codebase — فقط اربط.**
