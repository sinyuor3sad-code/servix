# قائمة التحقق قبل الإطلاق — Launch Checklist

> **SERVIX** — مارس 2026
>
> تأكد من إكمال كل بند قبل الإطلاق الرسمي. ✅ = موجود بالفعل في المشروع.

---

## 1. البنية التحتية (Infrastructure)
- [ ] حجز سيرفر Hetzner Cloud (CX31 minimum: 4 vCPU, 8GB RAM, 80GB SSD)
- [ ] إعداد نطاق servi-x.com والنطاقات الفرعية
  - [ ] api.servi-x.com → API
  - [ ] app.servi-x.com → Dashboard
  - [ ] admin.servi-x.com → Admin Panel
  - [ ] *.servi-x.com → Booking pages (wildcard)
- [ ] إعداد CloudFlare (DNS + CDN + SSL)
- [ ] تثبيت Docker + Docker Compose على السيرفر
- [ ] إعداد GitHub Container Registry
- [ ] إنشاء SSH key للنشر التلقائي

## 2. قاعدة البيانات (Database)
- [ ] تشغيل PostgreSQL 17 في الإنتاج
- [ ] تشغيل Redis 8 في الإنتاج
- [ ] تنفيذ migrations للـ platform database
- [ ] تشغيل seed للبيانات الأولية (roles, permissions, plans, features, super admin)
- [ ] إعداد النسخ الاحتياطي التلقائي (يومي)
- [ ] إعداد PgBouncer للـ connection pooling

## 3. الأمان (Security)
- [ ] تغيير كل المفاتيح السرية (JWT secrets, DB passwords, Redis password)
- [ ] تفعيل HTTPS عبر CloudFlare SSL
- [ ] إعداد CSP headers صحيح
- [ ] تفعيل rate limiting مناسب للإنتاج
- [ ] مراجعة CORS origins
- [ ] إخفاء أخطاء Prisma/Stack trace في الإنتاج
- [ ] حذف Swagger في الإنتاج أو حمايته بكلمة مرور

## 4. التكاملات (Integrations)
- [ ] ربط مزود SMS (Unifonic أو Twilio)
- [ ] ربط مزود البريد الإلكتروني (SendGrid أو Resend)
- [ ] ربط WhatsApp Business API (Meta Cloud API)
- [ ] إعداد MinIO/S3 للتخزين (أو CloudFlare R2)
- [ ] إعداد Sentry لتتبع الأخطاء
- [ ] إعداد Uptime Kuma للمراقبة

## 5. الاختبار (Testing)
- [ ] تشغيل جميع Unit Tests (pnpm test)
- [ ] تشغيل E2E Tests
- [ ] اختبار تسجيل مستخدم جديد
- [ ] اختبار إنشاء صالون + اشتراك
- [ ] اختبار الحجز العام (booking page)
- [ ] اختبار لوحة الأدمن
- [ ] اختبار multi-tenancy (صالونين مختلفين)
- [ ] اختبار RTL وجميع الثيمات
- [ ] اختبار على الجوال (responsive)

## 6. الأداء (Performance)
- [ ] تفعيل gzip في Nginx
- [ ] إعداد CDN caching لملفات الـ static
- [ ] تحسين صور Docker (multi-stage builds ✅)
- [ ] إعداد health checks ✅
- [ ] مراجعة Lighthouse score للصفحات

## 7. البيانات الأولية (Initial Data)
- [ ] إنشاء حساب Super Admin
- [ ] إعداد الباقات الثلاث (Basic 199, Pro 399, Premium 699)
- [ ] إعداد الميزات وربطها بالباقات
- [ ] إنشاء صالون تجريبي للعرض (demo)

## 8. التوثيق (Documentation)
- [x] README.md
- [x] CLAUDE.md
- [x] master-plan.md
- [x] Launch checklist
- [ ] API documentation (Swagger) ✅
- [ ] دليل المستخدم (User Guide) — يكتب لاحقاً

## 9. المراقبة (Monitoring)
- [ ] إعداد alerts في Sentry (errors > threshold)
- [ ] إعداد Uptime Kuma checks:
  - [ ] api.servi-x.com/api/v1/health
  - [ ] app.servi-x.com
  - [ ] admin.servi-x.com
- [ ] إعداد تنبيهات البريد/تيليجرام
- [ ] مراقبة استهلاك الموارد (CPU, RAM, Disk)

## 10. الإطلاق (Go Live)
- [ ] نشر التطبيق: `docker compose -f docker-compose.prod.yml up -d`
- [ ] التحقق من Health checks
- [ ] إنشاء أول صالون حقيقي
- [ ] اختبار الحجز الكامل
- [ ] مراقبة الأخطاء لمدة 24 ساعة
- [ ] 🎉 الإطلاق الرسمي!
