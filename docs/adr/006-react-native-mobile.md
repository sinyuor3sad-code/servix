# ADR-006: React Native for Mobile

## التاريخ
2026-03-15

## الحالة
مقبول

## السياق
نحتاج تطبيق موبايل يعمل على iOS و Android مع دعم offline-first و push notifications.

## القرار
اخترنا **React Native** مع Expo.

## البدائل المدروسة

| البديل | المميزات | العيوب |
|--------|----------|--------|
| Flutter | أداء عالي، UI مخصص بالكامل | لغة Dart مختلفة، فريق جديد |
| Native (Swift/Kotlin) | أفضل أداء ممكن | ضعف الميزانية لفريقين |
| **React Native** ✅ | مشاركة كود مع Dashboard، فريق واحد | أداء أقل من native |
| PWA | لا حاجة لمتاجر التطبيقات | دعم محدود لـ push/offline على iOS |

## النتائج
### إيجابية
- مشاركة الكود: hooks، types، API client مع Dashboard (Next.js)
- فريق واحد يعمل على Web + Mobile
- Expo يسهل CI/CD و OTA updates
- مجتمع كبير ومكتبات ناضجة

### سلبية
- أداء أقل قليلاً من native في animations معقدة
- bridge overhead لبعض العمليات
