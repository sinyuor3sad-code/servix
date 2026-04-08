# دليل الاستجابة للحوادث — SERVIX

## مستويات الخطورة

| المستوى | التعريف | مثال | وقت الاستجابة | التصعيد |
|---------|---------|------|-------------|---------|
| **P1 — حرج** | النظام بالكامل معطل | DB down, API 5xx 100% | 15 دقيقة | CTO + فريق كامل |
| **P2 — عالي** | خدمة رئيسية معطلة | الحجوزات لا تعمل | 30 دقيقة | مطور أول |
| **P3 — متوسط** | تدهور أداء | p95 > 2s, partial errors | 2 ساعة | المناوب |
| **P4 — منخفض** | مشكلة تجميلية | خطأ في ترجمة أو تنسيق | يوم عمل | Backlog |

## خطوات الاستجابة

### 1. الاكتشاف ⚡
- تنبيه Grafana/Prometheus
- تنبيه Uptime Kuma (خدمة لا تستجيب)
- بلاغ عميل

### 2. التقييم 🔍
```bash
# فحص سريع لحالة الخدمات
kubectl get pods -n servix
kubectl top pods -n servix
kubectl logs -l app=servix-api -n servix --tail=50

# فحص قاعدة البيانات
docker exec servix-postgres pg_isready -U servix

# فحص Redis
docker exec servix-redis redis-cli ping
```

### 3. التصنيف 📋
- حدد مستوى الخطورة (P1-P4)
- حدد الخدمات المتأثرة
- حدد عدد المستأجرين المتأثرين
- أبلغ الفريق المناسب

### 4. التواصل 📢
- أرسل رسالة في Slack #servix-incidents
- حدّث صفحة الحالة
- أرسل SMS للمستأجرين المتأثرين (P1/P2 فقط)

### 5. الحل 🔧

#### سيناريوهات شائعة:

**API لا يستجيب:**
```bash
kubectl rollout restart deployment/servix-api -n servix
# أو rollback
kubectl rollout undo deployment/servix-api -n servix
```

**قاعدة البيانات:**
```bash
# فحص الاتصالات
docker exec servix-postgres psql -U servix -c "SELECT count(*) FROM pg_stat_activity"
# إعادة تشغيل PgBouncer
docker restart servix-pgbouncer
```

**ذاكرة عالية:**
```bash
kubectl top pods -n servix
kubectl describe pod <pod-name> -n servix
kubectl delete pod <pod-name> -n servix  # K8s سيعيد إنشاءه
```

**DR Failover (P1 فقط):**
```bash
bash tooling/scripts/failover.sh
```

### 6. التحقق ✅
- تأكد من عودة الخدمة
- تحقق من المقاييس في Grafana
- تأكد من عدم فقدان بيانات

### 7. التوثيق 📝
- اكتب Post-mortem خلال 48 ساعة
- حدد الإجراءات التصحيحية
- حدّث هذا الدليل إذا لزم الأمر

---

## أرقام الطوارئ

| الدور | التواصل |
|-------|---------|
| المطور المناوب | SMS + Slack |
| مطور أول احتياطي | SMS |
| CTO | هاتف مباشر |
| Hetzner Support | support@hetzner.com |
| CloudFlare Support | via dashboard |
