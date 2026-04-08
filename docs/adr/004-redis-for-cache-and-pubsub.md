# ADR-004: Redis for Cache, PubSub, and Queues

## التاريخ
2026-01-15

## الحالة
مقبول

## السياق
نحتاج حلول لثلاث مشاكل: تخزين مؤقت، نشر/اشتراك WebSocket، وطوابير مهام خلفية.

## القرار
اخترنا **Redis** كحل موحد لـ Cache + PubSub + BullMQ Queues.

## البدائل المدروسة

| البديل | الاستخدام | لماذا لم نختره |
|--------|----------|---------------|
| Memcached | Cache فقط | لا يدعم PubSub أو Queues |
| RabbitMQ | Queues | يحتاج خادم منفصل + تعقيد إضافي |
| AWS SQS | Queues | vendor lock-in + تكلفة |
| **Redis** ✅ | الثلاثة | حل موحد، أداء عالي، بيئة ناضجة |

## النتائج
### إيجابية
- خادم واحد يحل ثلاث مشاكل (تبسيط البنية)
- أداء عالي (sub-millisecond latency)
- BullMQ: delayed jobs، retry، DLQ، dashboard
- Redis Adapter لـ Socket.IO: scaling WebSocket عبر nodes
- Redis Sentinel: HA بدون تعقيد

### سلبية
- ذاكرة فقط — بيانات مؤقتة (ليست مشكلة لحالتنا)
- single-threaded — قد يصبح bottleneck (حُل بـ Sentinel)
