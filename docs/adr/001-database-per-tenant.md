# ADR-001: Database Per Tenant

## التاريخ
2026-01-15

## الحالة
مقبول

## السياق
SERVIX هي منصة SaaS متعددة المستأجرين لإدارة الصالونات. نحتاج استراتيجية لعزل بيانات كل مستأجر (صالون) بشكل آمن وقابل للتوسع. الخيارات المتاحة:
1. قاعدة بيانات مشتركة (Shared Database, Shared Schema)
2. مخطط لكل مستأجر (Shared Database, Separate Schema)
3. قاعدة بيانات لكل مستأجر (Separate Database)

## القرار
اخترنا **قاعدة بيانات منفصلة لكل مستأجر** (Database-per-tenant).

## البدائل المدروسة

| البديل | المميزات | العيوب |
|--------|----------|--------|
| Shared DB + Row-Level Security | بساطة، تكلفة أقل | خطر تسرب البيانات، صعوبة الـ backup الفردي |
| Schema-per-tenant | عزل جيد، migrations مركزية | حد PostgreSQL على عدد الـ schemas، تعقيد |
| **DB-per-tenant** ✅ | عزل كامل، backup/restore فردي | تعقيد إدارة الاتصالات، تكلفة أعلى |

## النتائج
### إيجابية
- عزل كامل — استحالة تسرب البيانات بين المستأجرين
- إمكانية backup/restore لكل مستأجر على حدة
- أداء أفضل (لا row-level filtering)
- سهولة حذف بيانات مستأجر (PDPL compliance)

### سلبية
- تعقيد إدارة الاتصالات (حُل بـ LRU Connection Pool)
- تكلفة ذاكرة أعلى لكل اتصال (حُل بـ PgBouncer)
- صعوبة تقارير cross-tenant (حُل بقاعدة Platform DB مركزية)

## المراجع
- [Multi-tenancy with PostgreSQL](https://www.citusdata.com/blog/2018/06/28/multi-tenant-saas-database-schema-decisions/)
- PDPL (نظام حماية البيانات الشخصية) — متطلبات العزل
