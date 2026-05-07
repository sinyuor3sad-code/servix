# 🏛️ NAEB — خطة الـ 14 نائب (المعمارية الكاملة)

> **الخطة المعتمدة لبناء فريق تقني افتراضي كامل لإدارة SERVIX**
> آخر تحديث: 2026-05-07
> الحالة: **معتمدة من المؤسس** — للتنفيذ المرحلي

---

## الفلسفة الأساسية

NAEB ليس نائباً واحداً — هو **شركة تقنية افتراضية** فيها 14 نائب متخصص، كل واحد يعادل موظفاً حقيقياً في فريق هندسي لـ SaaS بحجم SERVIX.

### المبدأ المعماري

```
نائب واحد عام  →  هلوسة شاملة + ضعف تخصص + ضرر غير محدود
80 نائب لكل module  →  فوضى تنسيق + تكلفة هندسية مستحيلة
14 نائب متخصص  →  الـ sweet spot المعماري الصحيح
```

### مرجعية التصميم

تحاكي بنية **شركة هندسية حقيقية** لـ SaaS بهذا التعقيد:
- 21 module عام في API
- 31 submodule في salon (قلب المنتج)
- 5 frontends (dashboard, booking, admin, landing, mobile)
- 25+ خدمة Docker في الإنتاج
- تكاملات: WhatsApp, ZATCA, Gemini, Payment Gateways, AI Reception

---

## الهيكل التنظيمي

```
                          المؤسس (CEO)
                              │
                       المنسّق (Coordinator)
                       — CTO الافتراضي —
                              │
   ┌──────────┬───────────────┼───────────────┬──────────┐
   │          │               │               │          │
 Backend   Frontend         Infra         Security    Customer
  (5)        (2)            (3)            (2)         (1)
                                            │
                                            ▼
                                    Sentinel (الحارس)
                                    — حق النقض على الكل —
```

---

## الـ 14 نائب — التفصيل الكامل

### الطبقة 1: التنسيق (1 نائب)

#### 1. المنسّق (Coordinator)
- **الدور:** CTO الافتراضي — نقطة الاستقبال الوحيدة من المؤسس
- **المسؤوليات:**
  - استقبال كل رسالة (نص/صوت/صورة) من المؤسس
  - فهم النية: سؤال، تنفيذ، طوارئ، استشارة
  - توزيع المهام على النائب المتخصص
  - حل النزاعات بين النواب (مثال: Code يبي ينشر، Ops يقول السيرفر تحت ضغط)
  - تصعيد القرارات الكبيرة للمؤسس
- **Model:** Claude Sonnet (دائم التشغيل)
- **MCP Tools:** orchestrator-mcp, memory-mcp (read all)
- **القيود:** لا ينفذ بنفسه — فقط يوزّع

---

### الطبقة 2: الباك إند (5 نواب)

> SERVIX backend ليس وحدة واحدة. ينقسم لـ 5 عوالم منفصلة فعلياً، كل عالم يحتاج عقلية مختلفة.

#### 2. نائب Core Platform
- **الدور:** مهندس البنية الأساسية
- **النطاق:**
  - `apps/api/src/modules/`: auth, users, businesses, settings, notifications, uploads, public, data-rights
  - `apps/api/src/shared/`: guards, decorators, filters, pipes, middleware, dto
- **الخبرة:** NestJS patterns, JWT auth, multi-tenant guards, RBAC
- **MCP Tools:** code-mcp (scoped), git-mcp, test-mcp
- **القيود:** لا يلمس business logic أو payments أو integrations

#### 3. نائب الحجوزات والمواعيد
- **الدور:** مهندس الـ scheduling
- **النطاق:** `apps/api/src/modules/salon/`:
  bookings, appointments, calendar, services, employees, shifts, attendance, self-orders
- **الخبرة:** time conflict resolution, recurring bookings, employee scheduling, calendar sync
- **MCP Tools:** code-mcp (scoped), git-mcp, test-mcp
- **القيود:** لا يلمس payments أو inventory

#### 4. نائب التجارة والمدفوعات
- **الدور:** مهندس الفلوس (الأكثر حساسية)
- **النطاق:** `apps/api/src/modules/salon/`:
  payments, pos-checkout, pos-shifts, invoices, debts, expenses
  + `apps/api/src/modules/zatca/`
- **الخبرة:** payment gateways, ZATCA compliance, double-entry accounting, refunds, settlements
- **MCP Tools:** code-mcp (scoped), git-mcp, test-mcp
- **مستوى أمان:** ⚡ مرتفع — كل تعديل يحتاج موافقة + تحقق Sentinel
- **القيود:** أي عملية مالية تمر على double-verify

#### 5. نائب الكتالوج والتسعير
- **الدور:** مهندس المنتجات والأسعار
- **النطاق:** `apps/api/src/modules/salon/`:
  inventory, services, packages, dynamic-pricing, coupons, loyalty, commitments, marketing
- **الخبرة:** pricing rules, stock management, package logic, loyalty math
- **MCP Tools:** code-mcp (scoped), git-mcp, test-mcp

#### 6. نائب التكاملات الخارجية
- **الدور:** مهندس الأنظمة الخارجية
- **النطاق:**
  - `apps/api/src/modules/salon/`: whatsapp-evolution, ai-reception, ai-consultant, healing, feedback, reviews, chat
  - `apps/api/src/shared/ai/`, `apps/api/src/shared/whatsapp/`
  - gemini-proxy, evolution-api integrations
- **الخبرة:** webhooks, retries, circuit breakers, rate limits, API versioning
- **العقلية المميزة:** يفترض الفشل دائماً (external = unreliable)
- **MCP Tools:** code-mcp (scoped), git-mcp, test-mcp, http-mcp

---

### الطبقة 3: الفرونت إند (2 نائب)

#### 7. نائب الـ Dashboard
- **الدور:** مهندس واجهة الصالون (الأعقد)
- **النطاق:** `apps/dashboard/` بالكامل
- **الخبرة:** complex forms, data tables, real-time updates, RTL, dark mode, i18n
- **MCP Tools:** code-mcp (scoped), playwright-mcp, computer-use-mcp

#### 8. نائب الواجهات العامة
- **الدور:** مهندس تجربة العميل النهائي
- **النطاق:** `apps/booking/`, `apps/landing/`, `apps/admin/`, `apps/mobile/`
- **الخبرة:** SEO, Core Web Vitals, conversion optimization, mobile UX
- **MCP Tools:** code-mcp (scoped), playwright-mcp, lighthouse-mcp
- **التطور المستقبلي:** ينقسم لاحقاً إلى booking-deputy + mobile-deputy عند نمو الموبايل

---

### الطبقة 4: البنية التحتية (3 نواب)

#### 9. نائب الـ DevOps
- **الدور:** مهندس الأنظمة
- **النطاق:**
  - `tooling/docker/`: docker-compose files, deployment scripts
  - `tooling/docker/nginx/`
  - 25+ خدمة Docker في الإنتاج
  - blue/green deployment pipeline
- **الخبرة:** Docker, nginx, deployment strategies, CI/CD
- **MCP Tools:** docker-mcp, ssh-mcp (scoped), nginx-mcp

#### 10. نائب قاعدة البيانات
- **الدور:** DBA متخصص
- **النطاق:** postgres + replica + pgbouncer + redis + minio + Prisma migrations
- **الخبرة:** query plans, indexes, replication lag, backup integrity, connection pooling
- **MCP Tools:** db-mcp (read), db-migration-mcp, redis-mcp
- **مستوى أمان:** ⚡ مرتفع جداً — أي DROP/TRUNCATE يحتاج موافقتين (المؤسس + Sentinel)

#### 11. نائب المراقبة (Observability)
- **الدور:** SRE (Site Reliability Engineer)
- **النطاق:** prometheus, grafana, alertmanager, uptime-kuma, jaeger, sentry, 4 exporters (node, postgres, redis, nginx)
- **الخبرة:** PromQL, alert tuning, SLOs/SLIs, distributed tracing
- **MCP Tools:** prometheus-mcp, grafana-mcp, alertmanager-mcp
- **آلية مضادة للهلوسة:** قاعدة "3 مصادر" — أي إنذار يتحقق منه عبر مصدرين مستقلين قبل التصرف

---

### الطبقة 5: الأمن والحماية (2 نواب)

#### 12. نائب الأمن السيبراني
- **الدور:** Security Engineer
- **النطاق:**
  - `apps/api/src/shared/security/`, encryption, guards
  - vault, SSL, rate limits, CSRF, CORS
  - مراقبة محاولات الاختراق و scraping و DDoS
- **الخبرة:** OWASP Top 10, intrusion patterns, CVE tracking, SAST/DAST
- **MCP Tools:** security-mcp, vault-mcp, firewall-mcp
- **الصلاحيات الفورية:** حظر IP مهاجم بدون موافقة (الأمن فقط له هذي الميزة)

#### 13. ⚡ نائب Sentinel (الحارس) ⚡
- **الدور:** المراقب الأعلى — حق النقض على كل النواب
- **هذا النائب هو الفرق بين نظام آمن ونظام خطير**
- **المسؤوليات:**
  - مراقبة كل action ينفذه أي نائب آخر
  - التحقق المستقل من ادعاءات النواب (كشف الهلوسة)
  - إيقاف أي action مدمّر قبل تنفيذه
  - تشغيل تمارين الكارثة الأسبوعية
- **الخصائص الفريدة:**
  - **Claude منفصل** عن البقية (يقلل خطر التواطؤ)
  - **قراءة فقط** — لا يكتب كود ولا يلمس infrastructure
  - **حق النقض المطلق** على أي action مدمّر
  - يصعّد للمؤسس مباشرة (يتجاوز Coordinator) إذا لزم
- **MCP Tools:** read-only-everywhere, audit-mcp, alert-mcp

---

### الطبقة 6: العملاء (1 نائب)

#### 14. نائب العملاء
- **الدور:** Customer Success — يتعامل مع الصالونات (عملاء SERVIX)
- **المسؤوليات:**
  - قراءة رسائل واتساب الواردة من الصالونات
  - بناء ملف ذكاء لكل صالون
  - التنبؤ بالإلغاء (churn prediction)
  - اقتراح تدخلات (لا ينفذها بدون موافقة)
- **MCP Tools:** whatsapp-mcp, db-mcp (read clients only), crm-mcp
- **القيود الصارمة:** ❌ لا يلمس DB write ❌ لا infrastructure ❌ لا يرسل بدون موافقة

---

## طبقة الحماية: 7 طبقات متراكمة

### القاعدة الذهبية
> **لا يوجد نائب يقدر فيزيائياً يدمّر النظام.**
> الحماية في الكود، مو في الـ AI prompt.

### الطبقة 1: Capability Isolation (عزل الصلاحيات)

كل نائب عنده قائمة أدوات صارمة في الكود (مو في prompt):

```typescript
// مثال
const codeDeputyCapabilities = [
  'git.read', 'git.commit:non-main',
  'code.read', 'code.write',
  'test.run',
];

const blockedForCode = [
  'docker.*', 'db.write', 'vault.*', 'network.*',
];

const customerDeputyCapabilities = [
  'whatsapp.send:approved',
  'db.read:clients_table_only',
];

const dbDeputyHardBlocked = [
  'db.drop', 'db.truncate',  // مرفوض على مستوى الكود
];
```

حتى لو هلوس النائب، **مايقدر فيزيائياً** يسوي شي خارج صلاحيته.

### الطبقة 2: Tripwire Rules (قواعد الكهرباء — في الكود)

قواعد if/else صلبة قبل أي tool execution:

| القاعدة | الإجراء |
|---------|---------|
| query يحذف > 100 row | رفض تلقائي |
| `DROP TABLE` أو `TRUNCATE` | رفض تلقائي + تنبيه فوري |
| إيقاف > 1 container في 60 ثانية | رفض تلقائي |
| تعديل prompt/memory نائب آخر | رفض تلقائي |
| deploy في وقت ذروة (10ص-8م) | رفض + تأجيل |
| تعديل secrets خارج Security Deputy | رفض تلقائي |

**هذي قرارات كود، مو AI.** الـ AI ما يشوف هذي القواعد ولا يقدر يتجاوزها.

### الطبقة 3: Approval Gates (بوابات الموافقة)

عمليات **دائماً** تحتاج موافقة المؤسس:

- ✋ أي migration على DB schema
- ✋ أي deploy للـ production
- ✋ أي تعديل لبيانات صالون/عميل (write operations)
- ✋ أي حذف لـ container
- ✋ أي تغيير في secrets/vault
- ✋ أي رسالة من نائب العملاء لعميل
- ✋ أي رسالة جماعية
- ✋ أي تعديل في rate limits أو security rules

### الطبقة 4: Backup-Before-Destruction

أي action مدمّر **معتمد** يمر على pipeline ملزم:

```
الموافقة من المؤسس
    ↓
Snapshot تلقائي (DB / file / config)
    ↓
30 ثانية hold (نافذة إلغاء فورية)
    ↓
تنفيذ الـ action
    ↓
تحقق من النتيجة (verify-after)
    ↓
[نجح] → سجل في audit log
[فشل] → rollback تلقائي للـ snapshot
```

### الطبقة 5: Sentinel Watchdog

- وكيل **Claude مستقل** عن البقية
- لا يثق بكلام بقية النواب أبداً
- كل ادعاء يفحصه بأدواته الخاصة
- اكتشاف هلوسة → إيقاف فوري للنائب + تصعيد
- **الفصل الجوهري:** Sentinel يراقب لكن لا ينفذ. هذا الفصل يمنع تواطؤ الهلوسة.

### الطبقة 6: Audit Log (سجل لا يُمحى)

كل action يُسجّل في append-only log:

```json
{
  "timestamp": "2026-05-07T14:23:11Z",
  "deputy": "code-deputy",
  "intent": "تعديل لون زر الحجز",
  "observations": ["obs:abc123", "obs:def456"],
  "action": { "tool": "git.commit", "branch": "feat/button-color" },
  "result": "success",
  "sentinel_verification": "passed",
  "founder_approval": "msg:wapp:7891"
}
```

- ولا نائب عنده صلاحية حذف من السجل
- المؤسس يشوف 30 يوم سابقة لأي نائب
- استخدامات: debugging, audit, compliance, post-mortem

### الطبقة 7: Disaster Drills (تمارين كارثة أسبوعية)

كل أحد 3 صباحاً، Sentinel يشغّل محاكاة:

| السيناريو | المتوقع | لو فشل |
|-----------|---------|--------|
| نائب DB يحاول DROP TABLE | tripwire يرفض | تنبيه فوري للمؤسس |
| نائب الكود يحاول deploy بدون موافقة | gate يوقفه | تنبيه فوري |
| محاكاة هلوسة Coordinator | Sentinel يكتشف من السلوك الشاذ | تنبيه + lockdown |
| محاكاة capability bypass | يفشل (capabilities صلبة في الكود) | تنبيه |

نتائج التمارين تجي للمؤسس صباح الإثنين كتقرير: "12/12 نجحت."

---

## التنفيذ المرحلي

### بناء 14 نائب من اليوم الأول = فشل مضمون
كل نائب يحتاج: system prompt + MCP tools + memory namespace + eval suite + tuning.
**14 نائب = 14 أسبوع شغل قبل أي إطلاق.**

### الخطة الواقعية: 3 مراحل

#### Phase 1: MVP الـ 5 نواب (أسابيع 1-7)

| # | النائب | الدور المؤقت |
|---|--------|--------------|
| 1 | Coordinator | كما هو |
| 2 | Code-Deputy (Generic) | يدمج Backend + Frontend + Integrations |
| 3 | Ops-Deputy (Generic) | يدمج DevOps + DB + Observability |
| 4 | Security-Deputy | كما هو |
| 5 | Sentinel | كما هو — **لازم من اليوم الأول** |

**Customer Deputy مؤجل لـ Phase 2** — العملاء يرسلون لك مباشرة في البداية.

#### Phase 2: تقسيم الباك إند والفرونت (شهرين بعد Phase 1)

تنقسم Code-Deputy إلى:
- Core Platform Deputy
- Bookings Deputy (تأجل التجارة والكتالوج لـ Phase 3)
- Integrations Deputy
- Frontend Deputy (واحد مدمج)
- Customer Deputy ينضاف

النتيجة: 9 نواب

#### Phase 3: التخصص الكامل (شهر بعد Phase 2)

- تنقسم Ops إلى DevOps + DB + Observability
- تنقسم Backend إلى 5 (يضاف Commerce + Catalog)
- ينقسم Frontend إلى Dashboard + Public Frontends

النتيجة: **14 نائب — الهيكل الكامل المعتمد**

---

## مصفوفة الصلاحيات (Capability Matrix)

| النائب | DB Read | DB Write | Code Edit | Deploy Stg | Deploy Prod | Docker Restart | Docker Remove | Vault | WhatsApp Send |
|--------|---------|----------|-----------|------------|-------------|----------------|---------------|-------|---------------|
| Coordinator | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Core Platform | scoped | approval | ✅ | ✅ | approval | ❌ | ❌ | ❌ | ❌ |
| Bookings | scoped | approval | ✅ | ✅ | approval | ❌ | ❌ | ❌ | ❌ |
| Commerce | scoped | **2-approvals** | ✅ | ✅ | approval | ❌ | ❌ | ❌ | ❌ |
| Catalog | scoped | approval | ✅ | ✅ | approval | ❌ | ❌ | ❌ | ❌ |
| Integrations | scoped | approval | ✅ | ✅ | approval | ❌ | ❌ | scoped | ❌ |
| Dashboard FE | ❌ | ❌ | ✅ | ✅ | approval | ❌ | ❌ | ❌ | ❌ |
| Public FE | ❌ | ❌ | ✅ | ✅ | approval | ❌ | ❌ | ❌ | ❌ |
| DevOps | ❌ | ❌ | ❌ | ✅ | approval | ✅ | approval | ❌ | ❌ |
| DB | ✅ | **2-approvals** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Observability | ✅ read-only | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Security | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ scoped | approval | **only one** | ❌ |
| Sentinel | ✅ all | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Customer | scoped:clients | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | approval |

> **Legend:**
> - ✅ مسموح بدون موافقة
> - ❌ ممنوع منعاً باتاً (في الكود، ليس prompt)
> - approval = يحتاج موافقة المؤسس
> - 2-approvals = يحتاج موافقة المؤسس + تحقق Sentinel
> - scoped = محصور بنطاق محدد

---

## القانون الأعلى لـ NAEB (الـ 14 نائب)

> **1. لا يوجد نائب يقدر فيزيائياً يدمّر النظام.**
> الحماية في الكود (capabilities + tripwires)، مو في الـ AI.
>
> **2. كل ادعاء يحتاج دليل.**
> Anti-hallucination: tool call طازج، citations، confidence scores.
>
> **3. Sentinel هو الحارس النهائي.**
> حتى لو كل النواب اتفقوا، Sentinel يقدر يعترض.
>
> **4. كل شيء مسجّل في audit log لا يُمحى.**
> ولا نائب يقدر يحذف من السجل، حتى المنسّق.
>
> **5. القرارات الكبيرة دائماً للمؤسس.**
> Production, customers, money, DB schema — لا تنفيذ بدون موافقة صريحة.
>
> **6. النواب يخدمون المؤسس، ولا يحلون محله.**
> NAEB = نائب تقني، ليس بديلاً.

---

## ملاحظات للمطور المستلم

### ما هو هذا المستند
خطة معمارية معتمدة لبناء **فريق 14 نائب AI متخصص** يدير منصة SERVIX. الهدف: تمكين المؤسس السولو من إدارة SaaS كاملة من الجوال (مزرعة، قهوة، سفر) مع حماية النظام من الانهيار.

### ما هو غير موجود في هذا المستند
- تفاصيل MCP server implementations لكل أداة → يحتاج مستند منفصل لكل MCP
- system prompts الفعلية لكل نائب → يحتاج مستند منفصل
- eval cases التفصيلية → يحتاج مستند منفصل
- تفاصيل voice integration (Vapi / OpenAI Realtime) → في PHASES.md
- خطة memory layered (working/episodic/semantic/procedural) → ARCHITECTURE.md

### الترابط مع المستندات الأخرى

| المستند | العلاقة |
|---------|---------|
| `ARCHITECTURE.md` | البنية الأساسية للنظام (memory, MCP, sub-agents) |
| `PHASES.md` | المراحل التفصيلية للتنفيذ |
| `IMPLEMENTATION_PLAN.md` | خطة التنفيذ الواقعية |
| `PERMISSIONS.md` | تفاصيل نظام الصلاحيات |
| `ESCALATION.md` | سلسلة التصعيد |
| `COSTS.md` | الميزانية |

### القرار التصميمي الأهم
**Sentinel Deputy (#13)** غير قابل للتنازل. إذا حُذف، النظام يصبح خطراً على نفسه. أي مراجعة معمارية لاحقة لازم تحافظ على Sentinel.

### نقاط نقاش محتملة مع المطور
1. هل نبني MCP servers مخصصة لـ SERVIX، أم نستخدم community MCPs؟
2. Memory: pgvector فقط، أم نضيف Neo4j للـ knowledge graph؟
3. Voice: Vapi أم OpenAI Realtime API للعربي السعودي؟
4. Eval framework: نبني داخلياً، أم نستخدم Langfuse/Helicone؟
5. Computer Use API vs Playwright للاختبار التلقائي؟

---

**تم اعتماد هذي الخطة من المؤسس بتاريخ 2026-05-07 للتنفيذ المرحلي.**
