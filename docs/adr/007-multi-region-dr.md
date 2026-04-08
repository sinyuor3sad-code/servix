# ADR-007: Multi-Region Disaster Recovery

## التاريخ
2026-03-20

## الحالة
مقبول

## السياق
نحتاج استراتيجية DR تضمن RTO < 30 دقيقة و RPO < 1 ساعة.

## القرار
**Active-Passive DR** مع PostgreSQL streaming replication في مركز بيانات مختلف.

## البدائل المدروسة

| البديل | المميزات | العيوب |
|--------|----------|--------|
| Active-Active | صفر توقف | تعقيد عالي جداً، conflict resolution |
| **Active-Passive** ✅ | بساطة، تكلفة معقولة | توقف قصير أثناء failover |
| Backup-only | أرخص | RPO طويل (ساعات) |

## النتائج
- Primary: Hetzner fsn1 (Frankfurt) — Active
- DR: Hetzner nbg1 (Nuremberg) — Passive standby
- PostgreSQL streaming replication (lag < 10s)
- DNS failover عبر CloudFlare API
- اختبار DR ربع سنوي
