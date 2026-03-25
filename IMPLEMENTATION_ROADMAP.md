# SERVIX — خارطة طريق التنفيذ الشاملة
# Implementation Roadmap: From Salon System → Autonomous Business OS

---

## الأولويات (مرتبة حسب التأثير والاعتماديات)

```
Phase 1 (أسابيع 1-4): الأساسيات الذكية
├── ✅ Schema Evolution (Commitment + Shift + Inventory + ClientDna + ZATCA + DomainEvent + DynamicPricing + Marketing)
├── ✅ Module Structure (NestJS modules for all new features)
├── ✅ Commitment Engine + Shift Service
├── ✅ Auto-Healing Engine (basic: reassign + time-shift)
└── ✅ ZATCA Phase 2 (QR + XML generation + sandbox)

Phase 2 (أسابيع 5-8): الذكاء والمخزون
├── ✅ Inventory System (products, service linking, auto-deduct)
├── ✅ Client DNA (scoring, churn detection, pCLV)
├── ✅ Dynamic Pricing (peak/off-peak, prayer times, demand)
├── ⏳ WhatsApp Real Integration (360dialog or Twilio)
└── ⏳ ZATCA Production (clearance API, production CSID)

Phase 3 (أسابيع 9-12): النمو والتسويق
├── ✅ Marketing Automation (gap-filling, churn interception, campaigns)
├── ✅ Dashboard Pages (Inventory, Shifts, Marketing, Pricing, ZATCA, Client DNA)
├── ⏳ Usage-Based Pricing (hybrid subscription model)
├── ⏳ Referral System (salon-to-salon referrals)
├── ⏳ Dashboard Intelligence (WIRE daily brief, pressure gauge)
└── ⏳ AI Onboarding (smart salon setup wizard)

Phase 4 (أسابيع 13-16): التنبؤ والأتمتة
├── ⏳ Predictive Analytics (cancellation probability, revenue forecast)
├── ⏳ AI WhatsApp Agent (client-facing bot)
├── ⏳ Cross-branch Intelligence (load balancing)
└── ⏳ Production Hardening (PDPL, security audit, performance)
```

---

## Phase 1: الأساسيات الذكية (4 أسابيع)

### الأسبوع 1: Commitment Engine + Shifts

| يوم | المهمة | الملفات المتأثرة | الاختبار |
|-----|--------|------------------|---------|
| 1-2 | **Prisma Migration** — تشغيل `db:generate` للتأكد من صحة السكيما الجديدة. إنشاء migration للـ tenant databases | `tenant.prisma`, `platform.prisma`, migration scripts | `pnpm db:generate` بدون أخطاء |
| 3 | **ShiftService** — توليد shifts يومية من `EmployeeSchedule` templates. CRON job أسبوعي | `shifts/shifts.service.ts`, `shifts/shifts.controller.ts` | إنشاء shifts لموظف → التحقق من وجودها في DB |
| 4 | **CommitmentService** — إنشاء/كسر/شفاء التزامات. ربط التزام الموعد بتزام الوردية | `commitments/commitments.service.ts` | إنشاء موعد → التحقق من وجود Commitment + CommitmentDependency |
| 5 | **ربط الحجز بالالتزامات** — تعديل `AppointmentsService.create()` ليُنشئ Commitment تلقائياً | `appointments/appointments.service.ts` | حجز موعد → Commitment created + linked to shift |
| 6-7 | **Check-in + Late Detection** — تعديل `AttendanceService.checkIn()` لتحديث Shift status وإطلاق event عند التأخر | `attendance/attendance.service.ts`, `shifts/shifts.service.ts` | Check-in بعد 15 دقيقة → event STAFF_DELAYED fired |

### الأسبوع 2: Auto-Healing Engine

| يوم | المهمة | الملفات المتأثرة | الاختبار |
|-----|--------|------------------|---------|
| 8-9 | **HealingEngine.tryReassign()** — البحث عن موظف بديل (نفس المهارة، وردية نشطة، لا تعارض) | `healing/healing.service.ts` | موظفة تأخرت → موعدها ينتقل لموظفة أخرى متاحة |
| 10 | **HealingEngine.tryTimeShift()** — تأخير الموعد ضمن حدود مقبولة (< 20 دقيقة) | `healing/healing.service.ts` | تأخر 5 دقائق + لا بديل = تعديل وقت الموعد |
| 11 | **HealingEngine.compensateClient()** — إنشاء كوبون تعويضي تلقائي | `healing/healing.service.ts`, `coupons/coupons.service.ts` | تأخر > 20 دقيقة = كوبون خصم 10% |
| 12 | **BullMQ Integration** — ربط events بالـ HealingEngine عبر queue `ops.intelligence` | `shared/jobs/`, healing service | STAFF_DELAYED event → healing cascade executed |
| 13-14 | **WebSocket + Dashboard** — إرسال تحديثات التقويم الفورية عند الشفاء | `shared/events/`, dashboard calendar | الداشبورد يُظهر badge "تم إعادة التوزيع" |

### الأسبوع 3: ZATCA Phase 2

| يوم | المهمة | الملفات المتأثرة | الاختبار |
|-----|--------|------------------|---------|
| 15-16 | **UBL 2.1 XML Generator** — بناء XML متوافق مع ZATCA من بيانات الفاتورة | `zatca/zatca.service.ts`, `zatca/xml-builder.ts` | فاتورة → XML صالح (XSD validation) |
| 17 | **ECDSA-SHA256 Signing** — توقيع XML رقمياً باستخدام node-forge | `zatca/zatca.service.ts`, `zatca/signer.ts` | XML → signed XML + hash |
| 18 | **TLV QR Code** — إنشاء QR بتنسيق TLV (seller name, VAT, date, totals, hash) | `zatca/zatca.service.ts`, `zatca/qr-generator.ts` | فاتورة → QR code image |
| 19-20 | **Sandbox API** — CSR generation, compliance CSID, reporting/clearance API calls | `zatca/zatca.service.ts` | Submit invoice to sandbox → clearance response |
| 21 | **ZATCA Invoice Storage** — حفظ XML الموقع + PDF في MinIO | `zatca/zatca.service.ts`, uploads | فاتورة مقبولة → XML + PDF محفوظين |

### الأسبوع 4: Calendar Intelligence + Polish

| يوم | المهمة | الملفات المتأثرة | الاختبار |
|-----|--------|------------------|---------|
| 22-23 | **Calendar API Enhancement** — endpoint جديد يرجع مواعيد + commitment state + employee load% + healing badges | `appointments/appointments.controller.ts` | GET /calendar/day يرجع بيانات enriched |
| 24-25 | **Domain Events Infrastructure** — EventBusService يحفظ في DomainEvent table + يرسل لـ BullMQ | `shared/events/event-bus.service.ts` | كل event يُحفظ في الجدول + يُعالج |
| 26-27 | **Integration Testing** — سيناريو كامل: موظف → وردية → حجز → تأخر → healing → WhatsApp | test files | E2E test passes |
| 28 | **WIRE Dashboard Widget** — بطاقة "الموجز اليومي" تقرأ من DomainEvent | dashboard components | الموجز يظهر أحداث اليوم بتنسيق WIRE |

---

## Phase 2: الذكاء والمخزون (4 أسابيع)

### الأسبوع 5-6: Inventory System
- CRUD منتجات وفئات
- ربط ServiceProduct (كم يستهلك كل خدمة من كل منتج)
- InventoryMovement ledger (مشتريات، استهلاك، تعديل، هدر)
- Auto-deduct عند إتمام الموعد
- تنبيهات المخزون المنخفض (WhatsApp + in-app)
- حظر الحجز إذا المنتج نفذ (اختياري)

### الأسبوع 7: Client DNA
- ClientDnaService.computeForClient() — حساب كل المقاييس
- BullMQ repeatable job — يعيد حساب DNA كل ليلة
- صفحة ملف العميل في الداشبورد تعرض: CLV, churn risk, VIP score, preferred services
- Simple churn formula: if daysSinceLastVisit > 2× avgDaysBetweenVisits → high risk

### الأسبوع 8: Dynamic Pricing
- PricingRule CRUD (ساعات الذروة، خارج الذروة، نهاية الأسبوع، أوقات الصلاة)
- calculateEffectivePrice(serviceId, date, time, clientId) — يطبق القواعد بالترتيب
- عرض السعر المعدل في نموذج الحجز
- أوقات الصلاة السعودية: 5 أوقات يومياً → خصم تلقائي 15-30 دقيقة قبل/بعد الصلاة

---

## Phase 3: النمو والتسويق (4 أسابيع)

### الأسبوع 9-10: Marketing Automation
- كشف الفجوات في التقويم (slots فارغة > 2 ساعات)
- حملات آلية: gap → target high-pCLV clients → WhatsApp → book
- Win-back: client.churnRisk = 'high' + daysSinceLastVisit > threshold → auto-message
- Post-visit follow-up (24h بعد الزيارة → شكراً + طلب تقييم)
- Birthday campaigns (هدية/خصم يوم الميلاد)
- Capacity-aware: لا ترسل عروض إذا ما في slots فارغة

### الأسبوع 11: Usage-Based Pricing + Referral
- Platform Plan tiers: Free (محدود) / Pro (اشتراك + usage) / Enterprise
- Usage tracking: عداد مواعيد شهري + إيراد لكل tenant
- Revenue share calculation: إذا الإيراد > حد معين → SERVIX يأخذ 1-2%
- Referral system: كود إحالة لكل صالون → الصالون المُحال يحصل شهر مجاني

### الأسبوع 12: Dashboard Intelligence
- WIRE Daily Brief card (What/Insight/Risk/Effect)
- Pressure Gauge: نسبة الحمل اليومي على الفريق
- Revenue forecast (7 أيام قادمة بناءً على المواعيد المؤكدة)
- Expected visits (من Client DNA: العملاء المتوقع زيارتهم هذا الأسبوع)
- Gap alert: "عندك 3 ساعات فارغة يوم الخميس — أرسل عرض؟"

---

## Phase 4: التنبؤ والأتمتة (4 أسابيع)

### الأسبوع 13-14: Predictive Analytics
- Cancellation probability per appointment (بناءً على: no_show history, weather, day of week)
- Revenue prediction (30 day rolling forecast)
- Staff utilization prediction
- Stock-out prediction (بناءً على معدل الاستهلاك + المخزون الحالي)

### الأسبوع 15: AI WhatsApp Agent
- WhatsApp Business API integration (360dialog or Meta direct)
- Client-facing bot: حجز، إلغاء، استفسار، تأكيد
- Manager alerts: تأخرات، مخزون منخفض، فرص بيع

### الأسبوع 16: Production Hardening
- PDPL compliance audit (consent flows, data deletion, data minimization)
- Security audit (SQL injection, XSS, CSRF, rate limiting)
- Performance optimization (query caching, connection pooling)
- Error tracking (Sentry integration)
- Monitoring (health checks, uptime, response times)
- Documentation (API docs, deployment guide)

---

## الأفكار غير التقنية (تنفذ بالتوازي)

| # | الفكرة | متى نبدأ | الإجراء |
|---|--------|---------|---------|
| 5 | Vertical-first: صالونات نسائية — المنطقة الشرقية | الآن | تركيز أول 10 عملاء على الدمام/الخبر. أوقات الصلاة + خصوصية + STC Pay |
| 8 | مجتمع واتساب لأصحاب الصالونات | الأسبوع القادم | إنشاء مجموعة "أصحاب صالونات الشرقية" + محتوى أسبوعي |
| 9 | شراكات غرفة التجارة + الموردين | الشهر القادم | تواصل مع غرفة تجارة الشرقية + موردي مستحضرات التجميل |
| 11 | تسويق ZATCA ("النظام الوحيد اللي يحميك من غرامات زاتكا") | مع إطلاق ZATCA | حملة تسويقية مركزة على الامتثال الضريبي |
| 4 | NRR model + Success pricing | Phase 3 | تطبيق في نموذج الاشتراك |

---

## ملخص التغييرات على السكيما

### tenant.prisma (أُضيف)
| Model | الغرض |
|-------|-------|
| `Shift` | ورديات يومية ملموسة (مولدة من EmployeeSchedule) |
| `Commitment` | سجل الالتزامات (موعد/وردية/حجز مخزون) |
| `CommitmentDependency` | العلاقات بين الالتزامات (الموعد يعتمد على الوردية) |
| `ProductCategory` | فئات المنتجات |
| `Product` | المنتجات (مخزون) |
| `ServiceProduct` | ربط الخدمة بالمنتج (كمية الاستهلاك) |
| `InventoryMovement` | حركات المخزون (شراء، استهلاك، هدر) |
| `ClientDna` | الملف السلوكي للعميل (CLV, churn, VIP) |
| `ZatcaCertificate` | شهادات ZATCA (CSR, CSID) |
| `ZatcaInvoice` | فواتير ZATCA (XML, QR, حالة الإرسال) |
| `PricingRule` | قواعد التسعير الديناميكي |
| `Campaign` | حملات التسويق الآلية |
| `DomainEvent` | سجل الأحداث (event sourcing) |

### tenant.prisma (تعديلات على الموجود)
| Model | التعديل |
|-------|---------|
| `Employee` | + maxDailyAppointments, + shifts relation, + commitments relation |
| `EmployeeService` | + skillLevel (1-10) |
| `Client` | + dna relation, + commitments relation |
| `Appointment` | + healing fields (originalEmployeeId, reassignedAt, reassignmentReason, inventoryDeducted), + dynamic pricing fields |
| `Service` | + serviceProducts relation, + pricingRules relation |
| `Invoice` | + zatcaInvoice relation |
| `ClientSource` | + whatsapp, + campaign |
| `AppointmentSource` | + whatsapp |
| `PaymentMethod` | + stc_pay, + apple_pay |
| `NotificationType` | + booking_rescheduled, + healing, + marketing, + stock_alert, + zatca |

### platform.prisma (أُضيف)
| Model | الغرض |
|-------|-------|
| `Referral` | نظام الإحالة بين الصالونات |
| `TenantUsageLog` | تتبع الاستخدام الشهري (للتسعير الهجين) |

### platform.prisma (تعديلات)
| Model | التعديل |
|-------|---------|
| `Plan` | + maxAppointmentsMonth, + revenueSharePercent, + perAppointmentFee, + includedAppointments |
| `Tenant` | + usageLogs relation, + referralsMade/referralsReceived relations |
