# ADR-010: API Versioning

## التاريخ
2026-02-01

## الحالة
مقبول

## السياق
نحتاج استراتيجية versioning تسمح بتطوير API بدون كسر التوافق مع العملاء الحاليين.

## القرار
**URI Versioning** (`/api/v1/...`) مع NestJS built-in versioning.

## البدائل المدروسة

| البديل | المميزات | العيوب |
|--------|----------|--------|
| **URI Versioning** ✅ | واضح، سهل الفهم | URLs أطول |
| Header Versioning | URLs نظيفة | غير مرئي، صعب التصحيح |
| Query Param | بسيط | غير قياسي، مشاكل CDN |

## سياسة الترحيل
1. إصدار جديد يُعلن عنه 3 أشهر مسبقاً
2. الإصدار القديم يبقى مدعوماً 6 أشهر بعد الإصدار الجديد
3. تحذير `Sunset` header في الإصدار القديم
4. ADR لكل تغيير breaking

## التنفيذ
```typescript
// main.ts
app.enableVersioning({
  type: VersioningType.URI,
  defaultVersion: '1',
  prefix: 'api/v',
});
```
