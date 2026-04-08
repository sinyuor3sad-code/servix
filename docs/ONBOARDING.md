# 🚀 دليل المطور الجديد — SERVIX

> من الصفر إلى أول PR في أقل من ساعتين

## المتطلبات الأساسية

| الأداة | الإصدار | التحقق |
|--------|---------|--------|
| Node.js | >= 20 | `node -v` |
| pnpm | >= 9 | `pnpm -v` |
| Docker + Compose | Latest | `docker compose version` |
| Git | Latest | `git --version` |

## الخطوة 1: الاستنساخ والتثبيت (5 دقائق)

```bash
git clone <repo-url>
cd servix
pnpm install
cp .env.example .env
```

## الخطوة 2: البيئة المحلية (10 دقائق)

```bash
# تشغيل PostgreSQL + Redis + PgBouncer
docker compose -f tooling/docker/docker-compose.dev.yml up -d

# إعداد قاعدة البيانات
pnpm prisma:generate
pnpm prisma:migrate
pnpm seed
```

## الخطوة 3: تشغيل التطبيقات (5 دقائق)

```bash
# Terminal 1: API (http://localhost:4000)
cd apps/api && pnpm dev

# Terminal 2: Dashboard (http://localhost:3000)
cd apps/dashboard && pnpm dev

# Terminal 3: (اختياري) Admin Panel
cd apps/admin && pnpm dev
```

## الخطوة 4: فهم البنية (30 دقيقة)

```
servix/
├── apps/
│   ├── api/                 # NestJS API (multi-tenant)
│   │   ├── src/
│   │   │   ├── core/        # Platform-level: admin, auth, tenants, subscriptions
│   │   │   ├── modules/     # Business: bookings, clients, invoices, ZATCA
│   │   │   └── shared/      # Guards, interceptors, cache, metrics, encryption
│   │   └── test/            # E2E tests
│   ├── dashboard/           # Next.js 15 Dashboard (salon owners)
│   ├── booking/             # Public booking page
│   └── admin/               # Admin control panel
├── packages/
│   └── prisma/              # Prisma schema + migrations
├── tooling/
│   ├── docker/              # Docker Compose configs
│   ├── k8s/                 # Kubernetes manifests
│   ├── terraform/           # Infrastructure as Code
│   ├── k6/                  # Load tests
│   └── scripts/             # Deployment, migration, DR scripts
└── docs/
    ├── adr/                 # Architecture Decision Records
    ├── legal/               # Privacy policies, DPA
    ├── runbooks/            # Operational procedures
    └── guides/              # This guide and others
```

## الخطوة 5: المفاهيم الأساسية

### Multi-tenant Architecture
- **Platform DB** (platform_db): المستأجرون، الخطط، الاشتراكات
- **Tenant DB** (لكل مستأجر): المواعيد، العملاء، الفواتير
- كل طلب يحتوي `x-tenant-id` في الـ header
- `TenantGuard` يحدد قاعدة البيانات المستهدفة

### Authentication
- JWT Access Token (15 دقيقة) + Refresh Token (7 أيام)
- Guards: `JwtAuthGuard`, `RolesGuard`, `TenantGuard`

### Key Patterns
- **CorrelationId**: كل طلب يحمل معرف فريد للتتبع
- **CircuitBreaker**: حماية الخدمات الخارجية
- **DLQ**: Dead Letter Queue للمهام الفاشلة
- **Feature Flags**: `FeatureFlagService.isEnabled('flag-key', context)`

## الخطوة 6: أول مهمة تدريبية

### إضافة endpoint جديد
1. أنشئ branch: `git checkout -b feat/my-first-endpoint`
2. أضف service method في `apps/api/src/modules/salon/`
3. أضف controller endpoint
4. اكتب unit test مجاور (.spec.ts)
5. شغّل الاختبارات: `pnpm test`
6. تأكد من lint: `pnpm lint`

## الخطوة 7: إنشاء PR

```bash
git add .
git commit -m "feat: add new endpoint for [description]"
git push origin feat/my-first-endpoint
```

### Commit Convention
- `feat:` ميزة جديدة
- `fix:` إصلاح خطأ
- `test:` إضافة اختبارات
- `docs:` وثائق فقط
- `refactor:` إعادة هيكلة

## الأدوات المفيدة

| الأداة | الرابط | الوصف |
|--------|--------|-------|
| API Docs | http://localhost:4000/api/docs | Swagger UI |
| Grafana | http://localhost:3002 | مراقبة + لوحات |
| Uptime Kuma | http://localhost:3001 | مراقبة Uptime |
| Jaeger | http://localhost:16686 | تتبع موزع |

## المساعدة

- اقرأ ADRs في `docs/adr/` لفهم القرارات المعمارية
- اقرأ `docs/CONTRIBUTING.md` لمعايير الكود
- افتح Issue أو اسأل في Slack
