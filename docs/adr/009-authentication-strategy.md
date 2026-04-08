# ADR-009: Authentication Strategy

## التاريخ
2026-01-10

## الحالة
مقبول

## السياق
نحتاج نظام مصادقة آمن يدعم: multi-tenant، refresh tokens، rate limiting.

## القرار
**JWT Access Token (15 دقيقة) + Refresh Token (7 أيام) + Redis Session Store.**

## التفاصيل
- Access Token: JWT مع `tenantId` + `role` في payload، 15 دقيقة
- Refresh Token: UUID عشوائي مخزن في Redis، 7 أيام
- Password: bcrypt (12 rounds)
- Rate Limiting: 5 محاولات فاشلة → حظر 15 دقيقة
- Force Logout: حذف refresh tokens + blacklist access tokens في Redis

## لماذا ليس Session-based
- Stateless API يتوسع أفقياً بدون sticky sessions
- مناسب لـ Mobile + Web + API consumers
- Redis فقط للـ refresh tokens (حمل أقل)

## النتائج
- أمان عالي مع token rotation
- توسع أفقي بدون session affinity
- Force logout ممكن عبر Redis blacklist
