# ADR-011: Feature Flags

## التاريخ
2026-03-10

## الحالة
مقبول

## السياق
نحتاج القدرة على تفعيل/تعطيل ميزات لمستأجرين محددين أو نسبة من المستخدمين بدون deploy جديد.

## القرار
**Feature Flags مخصصة** مع Redis cache + database storage.

## البدائل المدروسة

| البديل | المميزات | العيوب |
|--------|----------|--------|
| LaunchDarkly | ناضج جداً، UI ممتاز | $$$، تبعية خارجية |
| Unleash | open-source | خادم منفصل |
| **مخصص** ✅ | بساطة، لا تبعيات | جهد صيانة |
| env vars | أبسط ممكن | يحتاج deploy لكل تغيير |

## الاستراتيجيات المدعومة
1. `ALL` — مفعل للجميع
2. `PERCENTAGE` — نسبة مئوية (MD5 hash-based bucketing)
3. `TENANT_LIST` — قائمة مستأجرين محددة
4. `USER_LIST` — قائمة مستخدمين محددة

## التنفيذ
- Database: جدول `FeatureFlag` في Platform DB
- Cache: Redis مع TTL 5 دقائق
- API: `FeatureFlagService.isEnabled(key, context)`
- Guard: `@RequireFeature('flag-key')` decorator
