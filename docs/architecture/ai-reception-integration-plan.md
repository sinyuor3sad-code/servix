# خطة الربط الجديد — الاستقبال الذكي SERVIX

> **الحالة**: مسودّة للمراجعة مع مختص  
> **التاريخ**: 2026-05-14  
> **المُعِدّ**: فريق SERVIX (sinyuor3sad-code) مع Claude  
> **المرحلة الحالية**: n8n حُذف بالكامل من الإنتاج (commits `632babf` + `668ae0d`)

---

## 1. الملخّص التنفيذي

يهدف هذا المستند إلى توثيق خطة بناء **استقبال ذكي متعدّد المزوّدين** للواتساب في منصّة SERVIX (نظام إدارة صالونات سعودي multi-tenant)، بعد قرار حذف منصّة n8n نهائياً.

### القرار الذي اتُّخذ بالفعل (مُنفّذ):
- **حذف n8n + gemini-proxy** من البنية التحتية (كانت غير مستخدمة — صفر تنفيذ خلال 3 أسابيع).
- توفير ~412 MiB RAM على VPS الإنتاج.
- الاستقبال الذكي الحالي يعمل عبر `WhatsAppBotService` + `GeminiService` داخل تطبيق NestJS مباشرة.

### القرار الذي لم يُتّخذ بعد (موضوع هذا المستند):
- هل ننتقل من **مزوّد واحد** (Cloudflare Workers AI كحالي) إلى **سلسلة مزوّدين بـ fallback**؟
- هل نستخدم **LangGraph** لبناء agent متعدّد الخطوات بقدرات حجز فعلية؟
- هل نستبدل Whisper بـ **Gemini Audio Native** للرسائل الصوتية؟
- كيف يندمج هذا مع معمارية **DB-per-tenant** الحالية؟

---

## 2. الوضع الحالي للنظام

### 2.1 المعمارية القائمة
```
PostgreSQL Server (servix-postgres)
├─ servix_platform                   ← قاعدة بيانات مشتركة
│   ├─ tenants
│   ├─ whatsapp_instances            (ربط رقم ↔ tenant)
│   ├─ users / subscriptions
│   └─ platform_settings
│
├─ servix_tenant_<uuid>              ← قاعدة بيانات لكل صالون
│   ├─ services / employees
│   ├─ bookings / clients
│   └─ ... (بيانات تشغيلية كاملة)
```

### 2.2 مكوّنات الاستقبال الذكي الحالية
| الملف | الدور |
|---|---|
| `apps/api/src/shared/whatsapp/whatsapp-webhook.controller.ts` | استقبال webhooks من Meta Cloud API |
| `apps/api/src/modules/salon/whatsapp-evolution/whatsapp-evolution-webhook.controller.ts` | استقبال webhooks من Evolution API (QR) |
| `apps/api/src/shared/whatsapp/tenant-resolver.service.ts` | تحديد التينانت بناءً على `phoneNumberId` |
| `apps/api/src/shared/whatsapp/whatsapp-bot.service.ts` | المعالج الرئيسي للرسائل الواردة |
| `apps/api/src/shared/ai/gemini.service.ts` | تواصل مع AI providers |
| `apps/api/src/shared/whatsapp/whatsapp.service.ts` | إرسال الردود عبر Meta Graph API |

### 2.3 المزوّدون المُستخدَمون حالياً
- **Primary**: Cloudflare Workers AI — `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
- **Fallback**: Google Gemini (مُكوّن لكن يندر استخدامه)
- **Audio**: Cloudflare Whisper (`@cf/openai/whisper`)

### 2.4 الفجوات الحالية
1. **مزوّد واحد فعلياً** — لو فشل Cloudflare AI طويلاً، الـ fallback إلى Gemini محدود.
2. **لا function calling** — البوت يردّ كلام فقط، ولا يحجز فعلياً في DB.
3. **لا state machine** — كل رسالة مستقلة، لا توجد إدارة محادثة متعددة الخطوات.
4. **لا إعدادات per-tenant** — كل الصالونات تشترك في نفس الـ system prompt والـ caps.
5. **مسار Evolution API لا يفعّل AI** — يكتفي بمعالجة opt-out كلمات. (المسار الرسمي Meta هو الوحيد الذي يستدعي AI حالياً).

---

## 3. المعمارية المقترحة

### 3.1 الصورة الكبيرة
```
                    [العميلة ترسل واتساب]
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
       Meta Cloud API                  Evolution API
       (للصالونات الرسمية)             (للصالونات الجديدة)
              │                               │
              └───────────────┬───────────────┘
                              ▼
              ┌──────────────────────────────┐
              │  servix-api (NestJS)         │
              │                              │
              │  [Webhook Controllers]       │
              │           │                  │
              │           ▼                  │
              │  [TenantResolver]            │
              │           │                  │
              │           ▼                  │
              │  [TenantDB Loader]           │
              │           │                  │
              │           ▼                  │
              │  ┌─────────────────────┐     │
              │  │ 🆕 ReceptionAgent   │     │
              │  │   (LangGraph)       │     │
              │  └──────────┬──────────┘     │
              │             ▼                │
              │  ┌─────────────────────┐     │
              │  │ 🆕 AIRouter         │     │
              │  │   (fallback chain)  │     │
              │  └──────────┬──────────┘     │
              │             ▼                │
              │  [WhatsAppService.send]      │
              └──────────────────────────────┘
                              │
                              ▼
                    [العميلة تستلم الرد]
```

### 3.2 المكوّنات الجديدة المطلوبة

#### A. AIProvider Interface (عقد موحّد)
```typescript
// apps/api/src/shared/ai/providers/ai-provider.interface.ts
export interface AIProvider {
  readonly name: 'gemini' | 'groq' | 'openai';
  readonly capabilities: {
    text: boolean;
    audio: boolean;
    image: boolean;
    functionCalling: boolean;
  };
  
  chat(input: ChatInput): Promise<ChatOutput>;
  chatWithAudio?(audio: Buffer, prompt: string): Promise<ChatOutput>;
  chatWithImage?(image: Buffer, prompt: string): Promise<ChatOutput>;
  
  estimateCost(input: ChatInput): { tokensIn: number; tokensOut: number; usd: number };
}
```

#### B. مزوّدون ثلاثة مستقلون
| الملف | المزوّد | الدور |
|---|---|---|
| `gemini.provider.ts` | Google Gemini 2.5 Flash | Primary — مجاني/رخيص + ممتاز بالعربية |
| `groq.provider.ts` | Groq Llama 3.3 70B | Fallback — الأسرع (<500ms) |
| `openai.provider.ts` | GPT-4o-mini | Last resort — مدفوع، الأشمل |

#### C. AIRouter (إدارة الـ fallback والحماية)
```typescript
// apps/api/src/shared/ai/router/ai-router.service.ts
@Injectable()
export class AIRouter {
  async chat(input: ChatInput, tenantId: string): Promise<ChatOutput> {
    // 1. حمّل تكوين الـ tenant (الترتيب المخصص + caps)
    const config = await this.tenantAIConfig.getConfig(tenantId);
    
    // 2. تحقق من cap اليومي
    if (!await this.checkLimit(tenantId)) {
      throw new TenantQuotaExceeded();
    }
    
    // 3. جرّب المزودين بالترتيب
    for (const providerName of config.fallbackChain) {
      const provider = this.providers[providerName];
      if (this.circuitBreaker.isOpen(providerName)) continue;
      
      try {
        const output = await provider.chat(input);
        await this.trackUsage(tenantId, provider, output);
        return output;
      } catch (err) {
        this.circuitBreaker.recordFailure(providerName, err);
        // ينتقل للمزود التالي
      }
    }
    
    throw new AllProvidersFailedError();
  }
}
```

#### D. ReceptionAgent (LangGraph)
```typescript
// apps/api/src/shared/ai/agent/reception-agent.service.ts
import { StateGraph, END } from '@langchain/langgraph';

interface ConversationState {
  message: IncomingMessage;
  tenant: Tenant;
  intent: 'booking' | 'inquiry' | 'cancel' | 'handoff' | null;
  extractedData: Record<string, any>;
  reply: string;
}

@Injectable()
export class ReceptionAgent {
  buildGraph() {
    return new StateGraph<ConversationState>({ channels: stateSchema })
      .addNode('classify', this.classifyNode)
      .addNode('understand', this.understandNode)
      .addNode('booking', this.bookingNode)
      .addNode('inquiry', this.inquiryNode)
      .addNode('cancel', this.cancelNode)
      .addNode('handoff', this.handoffNode)
      .addNode('reply', this.replyNode)
      
      .setEntryPoint('classify')
      .addEdge('classify', 'understand')
      .addConditionalEdges('understand', this.routeByIntent, {
        booking: 'booking',
        inquiry: 'inquiry',
        cancel: 'cancel',
        handoff: 'handoff',
      })
      .addEdge('booking', 'reply')
      .addEdge('inquiry', 'reply')
      .addEdge('cancel', 'reply')
      .addEdge('handoff', END)
      .addEdge('reply', END)
      .compile();
  }
}
```

#### E. AgentTools (يدا الـ AI، مربوطة بـ tenant DB)
```
apps/api/src/shared/ai/agent/tools/
├── get-services.tool.ts          ← يقرأ الخدمات المتاحة
├── get-prices.tool.ts            ← يجلب الأسعار
├── check-availability.tool.ts    ← يفحص توفر موظفة في وقت معين
├── create-booking.tool.ts        ← ينشئ حجز (مع validation صارم)
├── cancel-booking.tool.ts        ← يلغي حجز (مع confirmation)
├── reschedule-booking.tool.ts    ← يعيد جدولة
└── notify-staff.tool.ts          ← يخبر الموظفة بحالة تحتاج تدخل
```

**نقاط حرجة**:
- كل tool يستقبل `tenantDb` (Prisma client مربوط بـ DB الصالون المحدّد).
- كل input يُفحص بـ Zod schema قبل التنفيذ.
- العمليات المدمّرة (cancel/reschedule) تتطلب خطوة confirmation.

---

## 4. التغييرات على قاعدة البيانات

### 4.1 جدول جديد في `servix_platform`
```sql
CREATE TABLE tenant_ai_settings (
  tenant_id          UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  enabled            BOOLEAN NOT NULL DEFAULT false,
  primary_provider   VARCHAR(20) NOT NULL DEFAULT 'gemini',
  fallback_chain     JSONB NOT NULL DEFAULT '["gemini","groq","openai"]',
  language           VARCHAR(5) NOT NULL DEFAULT 'ar',
  system_prompt      TEXT NOT NULL,
  handoff_keywords   TEXT[] NOT NULL DEFAULT '{موظفة,شكوى,إنسان,human}',
  business_hours     JSONB,
  daily_request_cap  INT NOT NULL DEFAULT 500,
  monthly_budget_usd DECIMAL(10,2) NOT NULL DEFAULT 5.00,
  current_month_usd  DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 4.2 جدول جديد في كل `servix_tenant_*`
```sql
CREATE TABLE wa_conversations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_phone     VARCHAR(20) NOT NULL,
  messages         JSONB NOT NULL DEFAULT '[]',  -- آخر 20 رسالة
  current_intent   VARCHAR(50),
  agent_state      JSONB,                         -- LangGraph checkpoint
  last_active_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wa_conv_phone ON wa_conversations(client_phone);
CREATE INDEX idx_wa_conv_active ON wa_conversations(last_active_at DESC);
```

### 4.3 جدول metrics في `servix_platform`
```sql
CREATE TABLE ai_usage_logs (
  id              BIGSERIAL PRIMARY KEY,
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  provider        VARCHAR(20) NOT NULL,
  intent          VARCHAR(50),
  tokens_in       INT,
  tokens_out      INT,
  cost_usd        DECIMAL(10,6),
  latency_ms      INT,
  success         BOOLEAN NOT NULL,
  error_message   TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_usage_tenant_date ON ai_usage_logs(tenant_id, created_at DESC);
```

---

## 5. تدفّق ربط صالون جديد (Onboarding)

```
1. صاحبة الصالون تسجّل في landing.servi-x.com
2. تختار باقة + تدفع
3. (موجود) TenantProvisioningService ينشئ:
   - tenant في servix_platform
   - DB جديدة: servix_tenant_<uuid>
   - migrations + seed
4. 🆕 ينشئ tenant_ai_settings افتراضية:
   - enabled = false (تفعلها المالكة)
   - system_prompt مولّد تلقائياً باسم الصالون
   - fallback_chain = ["gemini","groq","openai"]
   - caps محافظة (500 req/day, $5/month)
5. تربط واتساب (Meta أو Evolution)
6. تفتح "الاستقبال الذكي" في dashboard:
   - تفعّل البوت
   - (اختياري) تخصّص البرومبت
   - تحدّد ساعات الرد
   - تحفظ
7. أوّل رسالة من عميلة → ReceptionAgent يردّ تلقائياً
```

---

## 6. طبقات الحماية والعزل

| الطبقة | الآلية |
|---|---|
| **Database isolation** | DB مستقلة لكل tenant — مفروض من PostgreSQL، AI لا يقدر يتجاوزه |
| **Tools scoping** | AI يستدعي functions typed، لا يكتب SQL مباشر |
| **Input validation** | Zod schemas على كل tool input |
| **Rate limiting per tenant** | عداد يومي في Redis، يتوقف عند الـ cap |
| **Cost guard** | حساب التكلفة لحظياً، تنبيه + إيقاف عند تخطّي الميزانية |
| **Circuit breaker per provider** | إيقاف مؤقت للمزوّد الفاشل |
| **Audit log** | تسجيل كل tool call (من، متى، tenant، بيانات) |
| **Handoff keywords** | كلمات تنقل المحادثة للموظفة البشرية |
| **Confirmation step** | عمليات حسّاسة (إلغاء، إعادة جدولة) تتطلّب تأكيد |
| **Data minimization** | حذف نص الرسائل بعد 90 يوم (PII compliance) |

---

## 7. التكاليف المتوقّعة

### 7.1 افتراضات
- متوسط الصالون: 50 رسالة/يوم = 1,500 رسالة/شهر
- متوسط tokens: 500 in + 200 out لكل رسالة
- Gemini 2.5 Flash: مجاني حتى 1,500 req/يوم على المنصة، ثم $0.10/$0.40 لكل 1M token
- Groq Llama 3.3 70B: مجاني حتى 14,400 req/يوم
- OpenAI GPT-4o-mini: $0.15/$0.60 لكل 1M token (بدون tier مجاني)

### 7.2 توقّعات شهرية
| عدد الصالونات | الرسائل الشهرية | Gemini | Groq | OpenAI | المجموع |
|---|---|---|---|---|---|
| 10 | 15,000 | $0 | $0 | $0 | **$0** |
| 50 | 75,000 | $3 | $0 | $0 | **$3** |
| 200 | 300,000 | $12 | $0 | ~$1 | **$13** |
| 1,000 | 1,500,000 | $60 | $0 | ~$10 | **$70** |

**الافتراض**: Fallback إلى OpenAI ~1% من الوقت (لحالات فشل Gemini + Groq معاً).

### 7.3 مقارنة مع البدائل
| البديل | التكلفة لـ 50 صالون | الأداء |
|---|---|---|
| **المُقترح (Gemini + Groq + OpenAI)** | $3-13/شهر | ممتاز |
| HuggingFace Inference Endpoints | $360+/شهر | جيد |
| Self-hosted Llama (GPU server) | $500+/شهر | ممتاز لكن صيانة |
| GPT-4 (الكامل) عند كل طلب | $200+/شهر | overkill |

---

## 8. الحزم البرمجية المطلوبة

```jsonc
{
  "dependencies": {
    "@langchain/langgraph": "^0.2.x",
    "@langchain/core": "^0.3.x",
    "@google/generative-ai": "^0.21.x",
    "openai": "^4.x",
    "groq-sdk": "^0.7.x"
  }
}
```

**استهلاك الذاكرة المقدّر**: +30-50 MiB داخل كل instance من `servix-api` (الإنتاج يشغّل instance-an).

---

## 9. خارطة التنفيذ (بطاقة واحدة لكل commit)

| # | البطاقة | الوقت | المخرج |
|---|---|---|---|
| ✅ 0 | حذف n8n + gemini-proxy | (مُنجز) | توفير 412 MiB RAM |
| A | الحصول على API keys (Gemini + Groq + OpenAI) | 15 دقيقة | تجهيز |
| B | `AIProvider` interface + ٣ providers | 1 يوم | بنية موحّدة |
| C | `AIRouter` مع fallback chain + tests | 1 يوم | مقاومة الأعطال |
| D | استبدال `GeminiService` بـ `AIRouter` | 0.5 يوم | تكامل |
| E | استبدال Cloudflare Whisper بـ Gemini Audio Native | 0.5 يوم | تبسيط الصوت |
| F | `tenant_ai_settings` table + migration | 0.5 يوم | إعدادات per-tenant |
| G | تحديث `TenantProvisioningService` | 0.5 يوم | onboarding تلقائي |
| H | تنصيب LangGraph + هيكل `ReceptionAgent` | 1 يوم | أساس الـ agent |
| I | nodes أساسية (classify, understand, reply) | 1 يوم | MVP agent |
| J | tools الحجز (3-4 tools) | 2 يوم | ميزة فعلية |
| K | `wa_conversations` + state persistence | 1 يوم | استئناف المحادثة |
| L | Dashboard UI لإعدادات AI | 2 يوم | تمكين المالكة |
| M | metrics + cost tracking + alerts | 1 يوم | observability |
| N | تجربة على tenant `test-ai-reception` | 1 أسبوع | validation |
| O | نشر تدريجي على باقي الصالونات | تدريجي | rollout |

**المجموع المقدّر**: ~3 أسابيع تطوير + 1 أسبوع تجربة = **شهر تقريباً**.

---

## 10. القرارات المعلّقة (تحتاج رأي المختص)

### 10.1 قرارات تقنية
1. **LangGraph أم كود بسيط؟**  
   LangGraph قوي لكن منحنى تعلّم. البديل: state machine مبني يدوياً مع `switch/case`. هل تستحق التعقيد للحالة الحالية؟

2. **Function calling للحجز الفعلي؟**  
   خطر متوسط — AI قد يحجز خطأ. الخيارات:  
   (أ) Confirmation step قبل كل عملية حجز.  
   (ب) Dry-run mode في البداية (AI يقترح، الموظفة تؤكد).  
   (ج) Full automation من اليوم الأول.

3. **Gemini Audio Native vs Whisper**  
   Gemini Audio Native: خطوة واحدة، يفهم النبرة. Whisper: دقّة نصّية أعلى لأرشفة.  
   الخيار: نستخدم Gemini للرد + Whisper للأرشيف؟ أم أحدهما؟

4. **LangGraph checkpointing**  
   إذا استخدمنا LangGraph، نحتاج backend لحفظ state. الخيارات:  
   (أ) PostgreSQL (موجود).  
   (ب) Redis (موجود، أسرع).  
   (ج) In-memory (يضيع على restart).

5. **توحيد المسارين (Meta + Evolution)**  
   حالياً مسار Evolution لا يستدعي AI. هل نوحّدهما بـ Agent واحد، أم نحافظ على فصلهما؟

### 10.2 قرارات منتجية
1. **هل OpenAI ضروري أم يكفي Gemini + Groq؟**  
   إضافته تستلزم بطاقة دفع. الفائدة: fallback إضافي لو فشل الاثنان معاً.

2. **متى نتيح الميزة للصالونات الفعلية؟**  
   بعد تجربة كم أسبوع على tenant واحد؟

3. **شخصية البوت — موحّدة أم مخصّصة لكل صالون؟**  
   هل المالكة تعدّل البرومبت بنفسها (يحتاج UI متقدّم)، أم نقدّم 3-4 قوالب جاهزة؟

4. **اللهجات السعودية**  
   هل نطلب من البوت لهجة سعودية بشكل صريح؟ أم نتركه بالفصحى مع مرونة؟

5. **التعامل مع الأخطاء الحسّاسة**  
   لو AI أعطى معلومة خاطئة عن سعر/خدمة، من المسؤول؟ نحتاج disclaimer واضح؟

### 10.3 قرارات قانونية/امتثال
1. **بيانات العملاء تذهب لـ Google/OpenAI/Groq** — يحتاج تحديث Terms of Service.
2. **PII (أرقام جوّال، أسماء)** في الـ prompts — هل نشفّر/نخفي قبل الإرسال؟
3. **Data retention** — كم نحتفظ بنصوص المحادثات؟ (مقترح: 90 يوم).
4. **GDPR / حماية البيانات السعودية** — هل المزوّدون الثلاثة يلتزمون؟

---

## 11. مخاطر معروفة

| المخاطرة | الاحتمال | الأثر | التخفيف |
|---|---|---|---|
| AI يحجز موعد خاطئ | متوسط | عالي | Confirmation step + validation |
| تجاوز ميزانية شهرية | منخفض | متوسط | Cost cap + circuit breaker |
| تسريب بيانات tenant لآخر | منخفض جداً | كارثي | DB isolation + tools scoping |
| مزوّد AI يقع طويلاً | متوسط | عالي | Fallback chain + circuit breaker |
| استجابة بطيئة (>5 ثوان) | متوسط | متوسط | Timeout + fallback للأسرع |
| رد مسيء/غير لائق من AI | منخفض | عالي | System prompt صارم + content filter |
| كذب AI على العميلة (hallucination) | متوسط | عالي | Grounding بـ DB، disclaimer واضح |

---

## 12. متطلّبات قبل البدء

### 12.1 من المالك (sinyuor3sad-code)
- [ ] فتح حسابات على المزوّدين الثلاثة والحصول على API keys
- [ ] قرار: OpenAI نعم/لا؟
- [ ] قرار: LangGraph من البداية أم تدريجياً؟
- [ ] قرار: Confirmation step قبل العمليات الحسّاسة نعم/لا؟
- [ ] مراجعة Terms of Service مع محامٍ

### 12.2 من المختص (هذه المراجعة)
- [ ] مراجعة المعمارية المقترحة
- [ ] التحقق من سلامة العزل بين الـ tenants
- [ ] اقتراح تحسينات على الـ AIRouter logic
- [ ] التحقق من ملاءمة LangGraph لحجم المشروع
- [ ] مراجعة نموذج التكلفة
- [ ] تقدير الجهد الواقعي للتنفيذ

---

## 13. المراجع والمستندات ذات الصلة

- `WHATSAPP_AI_DEVELOPER_GUIDE.md` — دليل التنفيذ الأوّل للواتساب (مرحلة 1-2)
- `MASTER_PLAN.md` — الخطة الكبرى للمنصّة
- `docs/architecture/master-plan.md` — معمارية SERVIX العامة
- `apps/api/src/shared/whatsapp/` — الكود الحالي للاستقبال
- `apps/api/src/shared/ai/` — خدمة AI الحالية

---

## 14. سجل التغييرات على هذا المستند

| التاريخ | التغيير | بواسطة |
|---|---|---|
| 2026-05-14 | إنشاء المسودّة الأولى بعد حذف n8n | Claude + sinyuor3sad-code |

---

> **ملاحظة للمختص**: هذا المستند مسودّة قابلة للتعديل بالكامل. الهدف الرئيسي: الحصول على رأي تقني محايد قبل صرف 3-4 أسابيع تطوير. الأسئلة في القسم 10 هي محور النقاش المطلوب.
