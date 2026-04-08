# ADR-005: K3s Lightweight Kubernetes

## التاريخ
2026-03-01

## الحالة
مقبول

## السياق
نحتاج container orchestration للتوسع التلقائي والنشر بدون توقف. الخيارات: managed K8s، self-hosted K8s، K3s، Docker Swarm.

## القرار
اخترنا **K3s** (Lightweight Kubernetes) على Hetzner Cloud.

## البدائل المدروسة

| البديل | المميزات | العيوب |
|--------|----------|--------|
| Managed K8s (GKE/EKS) | صيانة أقل | تكلفة $200+/شهر، vendor lock-in |
| Full K8s (kubeadm) | كامل الميزات | تعقيد إعداد عالي جداً |
| **K3s** ✅ | خفيف، سهل الإعداد، K8s متوافق | ميزات enterprise أقل |
| Docker Swarm | بسيط جداً | لا HPA، مجتمع أصغر |

## النتائج
### إيجابية
- توفير ~$200/شهر مقارنة بـ managed K8s
- إعداد في دقائق بدل ساعات
- 100% متوافق مع Kubernetes API
- HPA، NetworkPolicies، Ingress — كلها تعمل
- مثالي لفريق صغير (1-3 مطورين)

### سلبية
- لا managed control plane — نحن مسؤولون عن الصيانة
- إضافات مثل Istio قد تحتاج تعديلات
