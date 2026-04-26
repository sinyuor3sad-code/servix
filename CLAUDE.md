# SERVIX — Claude Code Instructions

## المشروع
SERVIX هو منصة إدارة صالونات تجميل SaaS مبنية بـ NestJS (API) + Next.js (Dashboard/Booking/Admin/Landing).

## البنية
```
apps/
  api/          → NestJS backend (المهم لهذا المشروع)
  dashboard/    → Next.js dashboard للصالونات
  booking/      → صفحة الحجز العامة
  admin/        → لوحة تحكم المشرف
  landing/      → الموقع التسويقي
tooling/
  docker/       → Docker Compose configs
docs/
  features/     → وثائق الميزات (AI_RECEPTION_V2_PLAN.md هو المرجع الحالي)
```

## الاستقبال الذكي (AI Reception V2) — الملفات الأساسية
```
apps/api/src/modules/salon/ai-reception/
  ai-reception.service.ts          ← المحرك الرئيسي V2 (Router + AI + Safety Net)
  ai-reception.controller.ts       ← endpoint الإحصائيات (/salon/ai-reception/stats)
  ai-reception-booking.service.ts  ← إدارة الحجوزات
  ai-reception-settings.service.ts ← الإعدادات (incl. mode/tier/feature toggles)
  ai-reception.expirer.ts          ← تنظيف الطلبات المنتهية (Cron)
  ai-context.builder.ts            ← بناء سياق الصالون للـ AI
  manager-reply.handler.ts         ← معالجة ردود المديرة
  ai-safety-net.service.ts         ← فلترة الردود (أسعار، تأكيد وهمي، هوية)
  ai-client-memory.service.ts      ← ذاكرة العميل في Redis (90 يوم)
  ai-semantic-cache.service.ts     ← كاش الأسئلة الشائعة (Jaccard، 24س)
  ai-analytics.service.ts          ← تتبع + تقرير أسبوعي (Cron الأحد 9ص)
  ai-proactive.service.ts          ← Follow-up + Re-engagement (Cron)
  n8n.client.ts                    ← قديم — غير مستخدم في V2 (لا تعيد wiring)

apps/api/src/modules/salon/whatsapp-evolution/
  whatsapp-evolution-webhook.controller.ts ← استقبال رسائل واتساب (نص + صوت)
  whatsapp-evolution.service.ts            ← إرسال نص/media
  whatsapp-rich-media.service.ts           ← أزرار/قوائم/صور + تنزيل media وارد
  whatsapp-anti-ban.service.ts             ← حماية من الحظر

apps/api/src/shared/ai/
  ai-provider.service.ts           ← V2 router لـ GPT-5-nano/mini + Gemini fallback + Whisper
  gemini.service.ts                ← Gemini (يستخدم كـ fallback فقط في V2) + V2 prompt builder

apps/api/src/shared/whatsapp/
  whatsapp-bot.service.ts          ← النظام القديم (للحذف لاحقاً — لا تعدّل)
```

## قواعد التطوير
1. **اللغة:** TypeScript + NestJS patterns (Injectable, Module, Controller)
2. **Database:** Prisma ORM مع multi-tenant (كل صالون = DB مستقل)
3. **Cache:** Redis عبر `CacheService`
4. **الاختبار:** `pnpm --filter api exec tsc --noEmit` للتأكد من عدم وجود أخطاء TypeScript
5. **لا تحذف تعليقات موجودة** إلا إذا الكود المتعلق فيها اتحذف
6. **لا تعدّل ملفات Prisma schema** بدون إذن صريح
7. **الأسلوب:** NestJS dependency injection — كل service في ملفه الخاص

## النماذج المعتمدة للاستقبال الذكي V2
- **GPT-5-nano** ← الأساسي (80% من المحادثات)
- **GPT-5-mini** ← المعقد (شكاوى، تردد، باقة 399)
- **Gemini Flash** ← fallback فقط (لو OpenAI وقعت)
- **Whisper عبر Groq** ← تحويل صوتيات

## خطة التنفيذ
اقرأ الملف التالي قبل أي تنفيذ:
`docs/features/AI_RECEPTION_V2_PLAN.md`

## تنبيهات مهمة
1. **OpenAI SDK مثبت** (`openai@^6.34.0`) — استخدمه عبر `AIProviderService`، لا تستدعي `OpenAI` مباشرة
2. **GeminiService تستخدم ConfigService** (NestJS) لقراءة env vars — استخدم نفس النمط
3. **n8n.client.ts** غير مستخدم في V2 — أُزيل من providers و constructor injection. لا تعيد ربطه
4. **AIProviderResponse** معرّف في `ai-provider.service.ts` — يوسّع `AIReceptionResponse` (gemini.service.ts) بحقول V2 (action/extractedData/buttons/sentiment...)
5. **CircuitBreakerService** متاح كـ @Global module — استخدمه لأي HTTP call خارجي
6. **Env vars المطلوبة:** `OPENAI_API_KEY`, `GROQ_API_KEY` (لـ Whisper) — Gemini keys اختيارية للـ fallback

## أوامر مفيدة
```bash
# فحص TypeScript
pnpm --filter api exec tsc --noEmit

# تشغيل dev
pnpm dev

# فحص dashboard
pnpm --filter dashboard exec tsc --noEmit
```
