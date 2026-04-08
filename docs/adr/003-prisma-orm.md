# ADR-003: Prisma ORM

## التاريخ
2026-01-10

## الحالة
مقبول

## السياق
نحتاج ORM يدعم TypeScript بشكل ممتاز ويتعامل مع اتصالات متعددة (database-per-tenant).

## القرار
اخترنا **Prisma** كـ ORM رئيسي.

## البدائل المدروسة

| البديل | المميزات | العيوب |
|--------|----------|--------|
| TypeORM | decorator-based، علاقات مرنة | أخطاء runtime، ضعف TypeScript types |
| Drizzle | خفيف، SQL-like، أداء عالي | بيئة أصغر، أقل نضجاً |
| Knex.js | query builder مرن | لا auto-generated types |
| **Prisma** ✅ | type-safe 100%، migrations ممتاز، schema-first | N+1 بدون include، بطء في queries معقدة |

## النتائج
### إيجابية
- Type-safety كامل — صفر أخطاء runtime في queries
- Schema-first يوثق البنية تلقائياً
- Migration system ممتاز
- Prisma Studio للتصحيح
- دعم ممتاز لـ NestJS

### سلبية
- N+1 queries تحتاج انتباه (حُل بـ include/select)
- أداء أقل من raw SQL في queries معقدة جداً
- حجم Prisma Client كبير نسبياً

## المراجع
- [Prisma vs TypeORM](https://www.prisma.io/docs/concepts/more/comparisons/prisma-and-typeorm)
