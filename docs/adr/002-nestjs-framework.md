# ADR-002: NestJS Framework

## التاريخ
2026-01-10

## الحالة
مقبول

## السياق
نحتاج إطار عمل خلفي لبناء API متعدد المستأجرين مع: DI، guards، interceptors، modules، WebSocket، queues.

## القرار
اخترنا **NestJS** كإطار عمل رئيسي.

## البدائل المدروسة

| البديل | المميزات | العيوب |
|--------|----------|--------|
| Express.js | بساطة، مرونة عالية | لا DI مدمج، لا بنية واضحة |
| Fastify | أداء عالي جداً | بيئة plugins أقل نضجاً |
| **NestJS** ✅ | DI مدمج، modules، guards، TypeScript-first | منحنى تعلم أعلى، overhead بسيط |
| Hono | خفيف جداً، edge-first | غير ناضج لـ enterprise |

## النتائج
### إيجابية
- بنية modular واضحة تدعم فرق كبيرة
- DI مدمج يسهل الاختبار (mocking)
- Guards/Interceptors/Pipes للأمان والتحقق
- دعم ممتاز لـ Swagger/OpenAPI
- دعم WebSocket و BullMQ مدمج

### سلبية
- overhead بسيط مقارنة بـ Express المباشر (~5%)
- decorator-heavy code قد يصعب قراءته أحياناً

## المراجع
- [NestJS Documentation](https://docs.nestjs.com)
- [NestJS vs Express Performance](https://medium.com/deno-the-complete-reference/nestjs-vs-express-performance-comparison)
