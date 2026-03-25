# SERVIX — Complete Project Context Prompt

You are working on **SERVIX** — a multi-tenant SaaS platform for managing service-based businesses (beauty salons/spas), targeting the Saudi market (Arabic-first, RTL). Below is the **complete** technical specification of the existing codebase. Read every section carefully before making any changes.

---

## 1. HIGH-LEVEL ARCHITECTURE

SERVIX is a **Turborepo monorepo** with **database-per-tenant** multi-tenancy. Each salon gets its own isolated PostgreSQL database. There is one shared "platform" database that manages tenants, users, plans, subscriptions, RBAC, and billing.

```
Architecture Flow:
Client Apps (Next.js) → NestJS API (Port 4000) → PostgreSQL (Platform DB + N Tenant DBs)
                                                → Redis (Cache + BullMQ Queues)
                                                → MinIO (S3-compatible file storage)
                                                → WebSocket (Socket.io, real-time updates)
```

**Multi-tenancy model:** Every API request includes a tenant identifier (resolved via `TenantMiddleware`). The middleware connects to the correct tenant database via a `TenantClientFactory` that creates/caches Prisma clients per tenant. The platform database stores which tenant maps to which database name.

---

## 2. MONOREPO STRUCTURE

**Package manager:** pnpm 10.32.1
**Build system:** Turborepo v2

```
servix/
├── apps/
│   ├── api/            → NestJS 11 backend (Port 4000)
│   ├── dashboard/      → Next.js 15 salon management panel (Port 3000)
│   ├── admin/          → Next.js 15 platform admin panel (Port 3002)
│   ├── booking/        → Next.js 15 public booking widget (Port 3001)
│   └── landing/        → Next.js 15 marketing landing page (Port 3002)
│
├── packages/
│   ├── database/       → Shared DB-related code
│   ├── types/          → Shared TypeScript types (api.ts, enums.ts)
│   ├── utils/          → Shared utilities (formatters.ts)
│   ├── validations/    → Shared Zod/validation schemas
│   ├── constants/      → Shared constants (app.ts)
│   ├── email-templates/→ Email HTML templates
│   ├── ui/             → Shared React components
│   ├── eslint-config/  → ESLint configuration
│   └── tsconfig/       → Shared TypeScript configs (base.json, nestjs.json, nextjs.json)
│
└── tooling/
    ├── docker/         → docker-compose.yml, docker-compose.prod.yml, .env.example
    ├── scripts/        → create-tenant.ts, setup-db.ts, migrate-tenants.ts, backup, restore
    └── nginx/          → nginx.conf for production reverse proxy
```

---

## 3. TECH STACK (Exact Versions)

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | >=20.0.0 |
| Backend Framework | NestJS | 11.x |
| ORM | Prisma | 6.x |
| Database | PostgreSQL | 17 (Alpine) |
| Cache / Queues | Redis 8 + ioredis 5 + BullMQ 5 | — |
| File Storage | MinIO (S3-compatible) | latest |
| Auth | Passport + JWT (access + refresh tokens) | — |
| WebSocket | Socket.io via @nestjs/platform-socket.io | 11.x |
| Frontend Framework | Next.js | 15.x |
| React | React | 19.x |
| CSS | Tailwind CSS | 4.x |
| State Management | Zustand | 5.x |
| Data Fetching | TanStack React Query | 5.x |
| Forms | React Hook Form + Zod | 7.x / 3.x |
| Charts | Recharts | 2.x |
| Animations | Motion (Framer Motion) | 12.x |
| i18n | next-intl | 4.x |
| Themes | next-themes | 0.4.x |
| Toasts | Sonner | 2.x |
| Icons | Lucide React | 0.469+ |
| PDF Generation | PDFKit | 0.15.x |
| API Docs | @nestjs/swagger | 11.x |
| Image Processing | Sharp | 0.33.x |
| Logging | Winston + nest-winston | 3.x |
| Validation | class-validator + class-transformer | — |
| Security | Helmet + @nestjs/throttler | — |

---

## 4. DATABASE SCHEMAS

### 4A. Platform Database (`platform.prisma`)

**Purpose:** Shared across ALL tenants. Manages the SaaS platform itself.
**Connection:** `PLATFORM_DATABASE_URL`
**Prisma client output:** `../node_modules/.prisma/platform`

**Models:**

| Model | Purpose |
|-------|---------|
| `Tenant` | Each salon/business. Has: nameAr, nameEn, slug, logoUrl, primaryColor, theme, databaseName (unique — maps to tenant DB), status (active/suspended/trial/cancelled/pending_deletion), trial dates, location (lat/lng), contact info |
| `User` | Platform users. Has: fullName, email (unique), phone (unique), passwordHash (bcrypt), avatar, email/phone verification flags, lastLoginAt |
| `TenantUser` | Many-to-many: User ↔ Tenant with role. Has: roleId, isOwner flag, status |
| `Role` | RBAC roles: name (en), nameAr, isSystem flag |
| `Permission` | Granular permissions: code (unique), nameAr, group |
| `RolePermission` | Many-to-many: Role ↔ Permission |
| `Plan` | Subscription plans: name, nameAr, priceMonthly, priceYearly, maxEmployees, maxClients |
| `Feature` | Platform features: code (unique), nameAr |
| `PlanFeature` | Many-to-many: Plan ↔ Feature |
| `Subscription` | Tenant subscriptions: planId, status, billingCycle, period dates |
| `TenantFeature` | Feature overrides per tenant (enable/disable specific features) |
| `PlatformInvoice` | SaaS billing invoices: amount, tax, total, status, dueDate, invoiceNumber |
| `PlatformAuditLog` | Immutable audit trail: userId, action, entityType, entityId, old/newValues, IP |
| `PasswordReset` | Password reset tokens with expiry |

**Enums:** TenantStatus, TenantTheme, TenantUserStatus, SubscriptionStatus, BillingCycle, PlatformInvoiceStatus

### 4B. Tenant Database (`tenant.prisma`)

**Purpose:** One isolated instance PER tenant (salon). Complete data separation.
**Connection:** `TENANT_DATABASE_URL` (dynamically resolved per request)
**Prisma client output:** `../node_modules/.prisma/tenant`

**Models:**

| Model | Purpose |
|-------|---------|
| `SalonInfo` | Salon metadata: names (Ar/En), tagline, description, contact, workingDays (JSONB), openingTime, closingTime, slotDuration (default 30 min), bufferTime (default 10 min), currency (SAR), taxPercentage (15%), taxNumber |
| `ServiceCategory` | Service groupings: nameAr, nameEn, sortOrder, isActive |
| `Service` | Services offered: categoryId, names, description, price (Decimal 10,2), duration (minutes), isActive, sortOrder, imageUrl |
| `Employee` | Staff members: userId (optional link to platform User), fullName, phone, email, role (stylist/manager/receptionist/cashier), commissionType (percentage/fixed/none), commissionValue, isActive, avatarUrl |
| `EmployeeService` | Many-to-many: Employee ↔ Service (skills matrix) |
| `EmployeeSchedule` | Weekly template: employeeId, dayOfWeek (0-6), startTime, endTime, isDayOff. Unique per (employee, day) |
| `EmployeeBreak` | Break windows per day: employeeId, dayOfWeek, startTime, endTime |
| `Appointment` | Bookings: clientId, employeeId, date, startTime, endTime (HH:MM strings), status (pending/confirmed/in_progress/completed/cancelled/no_show), source (online/phone/walk_in/dashboard), notes, totalPrice, totalDuration, cancellation fields |
| `AppointmentService` | Line items per appointment: serviceId, employeeId, price, duration, status |
| `Client` | Customers: fullName, phone, email, gender, dateOfBirth, notes, source (walk_in/online/phone/referral), totalVisits, totalSpent, lastVisitAt, soft delete |
| `Invoice` | Financial records: appointmentId (optional), clientId, invoiceNumber (unique), subtotal, discountAmount, taxAmount, total, status (draft/paid/partially_paid/void/refunded), createdBy |
| `InvoiceItem` | Invoice line items: serviceId, description, quantity, unitPrice, totalPrice, employeeId |
| `Payment` | Payment records: invoiceId, amount, method (cash/card/bank_transfer/wallet), reference, status |
| `Discount` | Applied discounts: invoiceId, type (percentage/fixed), value, amount, reason |
| `Coupon` | Promotional codes: code (unique), type, value, minOrder, maxDiscount, usageLimit, usedCount, validity dates |
| `LoyaltyPoints` | Client point balance: clientId (unique), points, lifetimePoints |
| `LoyaltyTransaction` | Point history: clientId, type (earned/redeemed/expired/adjusted), points, invoiceId, description |
| `Expense` | Business expenses: category (rent/salary/supplies/utilities/marketing/other), description, amount, date, receiptUrl, createdBy |
| `Attendance` | Daily attendance: employeeId, date, checkIn, checkOut (HH:MM), isOnBreak, status (present/absent/on_break/off_duty/late/half_day/vacation). Unique per (employee, date) |
| `Notification` | In-app/push/SMS/WhatsApp/email notifications: recipientType (employee/client), recipientId, titleAr, bodyAr, type, channel, isRead, data (JSONB), sentAt, readAt |
| `ActivityLog` | Immutable tenant-level audit: userId, action, entityType, entityId, description, old/newValues, ipAddress |
| `Setting` | Key-value settings store: key (PK), value (Text), updatedBy |

**Enums:** EmployeeRole, CommissionType, Gender, ClientSource, AppointmentStatus, AppointmentSource, AppointmentServiceStatus, InvoiceStatus, PaymentMethod, PaymentStatus, DiscountType, CouponType, LoyaltyTransactionType, ExpenseCategory, AttendanceStatus, NotificationRecipientType, NotificationType, NotificationChannel

---

## 5. NESTJS API ARCHITECTURE

### 5A. Module Organization

```
apps/api/src/
├── main.ts                          → Bootstrap (port 4000, CORS, Helmet, Swagger, validation pipes)
├── app.module.ts                    → Root module with global guards
│
├── core/                            → Platform-level modules (shared across tenants)
│   ├── auth/                        → JWT auth (login, register, refresh, forgot-password, strategies)
│   ├── tenants/                     → Tenant CRUD, onboarding
│   ├── subscriptions/               → Plan subscriptions management
│   ├── features/                    → Feature flags management
│   ├── roles/                       → RBAC roles & permissions
│   ├── audit/                       → Platform audit log queries
│   ├── users/                       → User management
│   ├── uploads/                     → File upload to MinIO (S3)
│   ├── notifications/               → Platform notification dispatch
│   ├── admin/                       → Super-admin dashboard APIs
│   └── health/                      → Health check endpoint
│
├── modules/
│   └── salon/                       → Tenant-level business modules
│       ├── salon.module.ts          → Aggregates all salon sub-modules
│       ├── salon-info/              → Salon profile, branding, working hours
│       ├── services/                → Service categories & services CRUD
│       ├── employees/               → Employee CRUD, schedules, breaks, service skills
│       ├── clients/                 → Client CRUD, search, history
│       ├── appointments/            → Appointment CRUD, calendar, available slots, status changes
│       ├── booking/                 → Public booking flow (no auth required)
│       ├── invoices/                → Invoice generation, payments, discounts, coupons, PDF, send
│       ├── coupons/                 → Coupon CRUD, validation
│       ├── loyalty/                 → Points system, transactions, settings
│       ├── expenses/                → Expense tracking CRUD
│       ├── attendance/              → Check-in/out, attendance records
│       ├── reports/                 → Revenue, appointments, clients, employees reports
│       ├── settings/                → Tenant settings (key-value)
│       └── account/                 → Account deletion (PDPL compliance)
│
└── shared/                          → Cross-cutting concerns
    ├── config/                      → Env validation (Joi), JWT config
    ├── database/                    → DatabaseModule, PlatformClient, TenantClientFactory
    ├── cache/                       → CacheModule + CacheService (ioredis, tenant-aware)
    ├── events/                      → EventsModule + EventsGateway (Socket.io WebSocket, namespace /ws)
    ├── jobs/                        → JobsModule + NotificationProcessor (BullMQ queues: notifications, emails, sms)
    ├── mail/                        → MailModule + MailService
    ├── sms/                         → SmsModule + SmsService
    ├── whatsapp/                    → WhatsAppModule + WhatsAppService
    ├── pdf/                         → PdfModule + PdfService (PDFKit)
    ├── security/                    → SecurityModule + RateLimitGuard (@nestjs/throttler)
    ├── guards/
    │   ├── jwt-auth.guard.ts        → Global JWT authentication (APP_GUARD)
    │   ├── tenant.guard.ts          → Tenant resolution guard
    │   ├── roles.guard.ts           → Role-based access control
    │   ├── feature.guard.ts         → Feature flag check
    │   └── subscription-write.guard.ts → Block writes on expired subscriptions (APP_GUARD)
    ├── middleware/
    │   └── tenant.middleware.ts     → Resolves tenant from request, provides tenant DB client (APP_GUARD)
    ├── decorators/
    │   ├── current-user.decorator.ts   → @CurrentUser() parameter decorator
    │   ├── current-tenant.decorator.ts → @CurrentTenant() parameter decorator
    │   ├── public.decorator.ts         → @Public() to skip auth
    │   ├── roles.decorator.ts          → @Roles('owner', 'manager') decorator
    │   └── require-feature.decorator.ts→ @RequireFeature('feature_code') decorator
    ├── filters/
    │   └── http-exception.filter.ts → Global exception filter
    ├── interceptors/
    │   └── response-transform.interceptor.ts → Standard API response wrapper
    ├── pipes/
    │   └── validation.pipe.ts       → Global validation pipe
    ├── dto/
    │   └── pagination.dto.ts        → Shared pagination DTO (page, limit, search, sortBy, sortOrder)
    └── types/
        ├── jwt-payload.interface.ts → JWT token payload shape
        ├── request.interface.ts     → Extended Express Request with user + tenant
        ├── tenant-context.interface.ts → Tenant context shape
        └── tenant-db.type.ts        → Tenant Prisma client type
```

### 5B. Global Guards (Applied to ALL routes via APP_GUARD)

1. **JwtAuthGuard** — Validates JWT access token. Skip with `@Public()` decorator.
2. **TenantMiddleware** — Extracts tenant from request (header/subdomain/token), resolves tenant DB, injects into request context.
3. **SubscriptionWriteGuard** — Blocks POST/PUT/PATCH/DELETE if tenant subscription is expired/cancelled.

### 5C. BullMQ Queues

| Queue | Purpose | Processor |
|-------|---------|-----------|
| `notifications` | In-app notification delivery | NotificationProcessor |
| `emails` | Email sending (via MailService) | NotificationProcessor |
| `sms` | SMS sending (via SmsService) | NotificationProcessor |

### 5D. WebSocket Gateway

- **Namespace:** `/ws`
- **Rooms:** `tenant:{tenantId}`, `user:{userId}`
- **Transport:** Socket.io
- **Used for:** Real-time calendar updates, new booking alerts, notification badges

### 5E. Each Module Pattern (Controller → Service → Prisma)

Every salon module follows this pattern:
```
module-name/
├── module-name.module.ts       → NestJS module definition
├── module-name.controller.ts   → REST endpoints (decorated with guards, validators)
├── module-name.service.ts      → Business logic (injects tenant Prisma client)
└── dto/
    ├── create-*.dto.ts         → Input validation for creation
    ├── update-*.dto.ts         → Input validation for updates
    └── query-*.dto.ts          → Query params (pagination, filters)
```

---

## 6. FRONTEND APPS

### 6A. Dashboard (`apps/dashboard` — Port 3000)

The main management panel for salon owners/managers. Next.js 15 App Router.

**Route Structure:**
```
(auth)/
  ├── login              → Email + password login
  ├── register           → New account registration
  └── forgot-password    → Password recovery

(dashboard)/
  ├── page               → Dashboard home (stats, today's appointments)
  ├── appointments/      → Calendar view, appointment list
  │   ├── new            → Create appointment form
  │   └── [id]           → Appointment detail
  ├── clients/           → Client list, search
  │   ├── new            → Add client form
  │   └── [id]           → Client profile & history
  ├── employees/         → Staff list
  │   ├── new            → Add employee form
  │   └── [id]           → Employee profile, schedule, performance
  ├── services/          → Service management
  │   ├── new            → Add service form
  │   └── categories     → Category management
  ├── invoices/          → Invoice list
  │   └── [id]           → Invoice detail / payment
  ├── expenses/          → Expense tracking
  │   └── new            → Add expense
  ├── coupons/           → Coupon management
  │   └── new            → Create coupon
  ├── loyalty/           → Loyalty program settings
  ├── attendance/        → Daily attendance view
  ├── pos/               → Point of sale
  │   └── quick          → Quick POS mode
  ├── reports/           → Reports hub
  │   ├── revenue        → Revenue analytics
  │   ├── appointments   → Booking analytics
  │   ├── clients        → Client analytics
  │   └── employees      → Staff performance
  ├── notifications/     → Notification center
  ├── settings/          → Settings hub
  │   ├── salon          → Salon info
  │   ├── branding       → Logo, colors, theme
  │   ├── working-hours  → Business hours
  │   ├── toggles        → Feature toggles
  │   ├── users          → Team access management
  │   ├── account        → Personal account
  │   └── subscription   → Plan & billing
  └── onboarding/        → First-time setup wizard
```

**Frontend tech:** Next.js 15, React 19, Tailwind CSS 4, Zustand 5, TanStack Query 5, React Hook Form 7, Zod 3, Recharts 2, Motion 12, Socket.io-client, Sonner, Lucide icons, next-intl 4, next-themes.

### 6B. Admin Panel (`apps/admin` — Port 3002)

Super-admin panel for SERVIX platform operators.

**Routes:**
```
(auth)/login
(admin)/
  ├── dashboard          → Platform overview
  ├── tenants/           → All tenants list
  │   └── [id]           → Tenant detail
  ├── plans              → Subscription plans management
  ├── subscriptions      → Active subscriptions
  ├── features           → Feature flags management
  ├── invoices           → Platform billing invoices
  ├── audit-logs         → Platform audit trail
  └── settings           → Platform settings
```

### 6C. Public Booking (`apps/booking` — Port 3001)

Client-facing booking widget. Each salon has a unique slug.

**Routes:**
```
/                        → Entry / salon directory
/[slug]/                 → Salon landing page (info, services, reviews)
/[slug]/book             → Multi-step booking flow (select service → employee → time → confirm)
/[slug]/confirmation/[id]→ Booking confirmation page
```

### 6D. Landing Page (`apps/landing` — Port 3002)

Marketing website for SERVIX platform.

**Routes:** `/` (home), `/privacy` (privacy policy), `/terms` (terms of service)

---

## 7. INFRASTRUCTURE

### Docker Compose (Development)

```yaml
Services:
  - postgres:17-alpine  (Port 5432, user: servix, db: servix_platform)
  - redis:8-alpine      (Port 6379, password: servix_redis, AOF persistence)
  - minio/minio:latest  (Port 9000 API, 9001 console)
```

### Docker Compose (Production)

Adds:
- `api` container (NestJS, built from Dockerfile, port 4000)
- `dashboard` container (Next.js, port 3000)
- `booking` container (Next.js, port 3001)
- `admin` container (Next.js, port 3002)
- `nginx` reverse proxy (ports 80/443, SSL termination)
- All on `servix-network` bridge

### Environment Variables

```
Core:
  NODE_ENV, PORT (4000)
  PLATFORM_DATABASE_URL (postgresql://...)

Redis:
  REDIS_HOST, REDIS_PORT, REDIS_PASSWORD

Auth:
  JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
  JWT_ACCESS_EXPIRATION (15m), JWT_REFRESH_EXPIRATION (7d)

Security:
  CORS_ORIGINS (comma-separated)
  THROTTLE_TTL (60), THROTTLE_LIMIT (100)

Storage:
  S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET

Communication (placeholders):
  MAIL_API_KEY, MAIL_FROM
  SMS_API_KEY, SMS_SENDER_ID
  WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID

Frontend:
  NEXT_PUBLIC_API_URL (http://localhost:4000/api/v1)
  NEXT_PUBLIC_WS_URL (http://localhost:4000)
```

---

## 8. KEY DESIGN PATTERNS

1. **Multi-tenancy via DB-per-tenant:** TenantMiddleware resolves tenant → TenantClientFactory creates/caches Prisma client for that tenant's database → injected into service via `@CurrentTenant()`.

2. **Dual Prisma clients:** `platform.prisma` generates to `.prisma/platform`, `tenant.prisma` generates to `.prisma/tenant`. Both are separate `@prisma/client` instances with different models.

3. **Global guards chain:** JwtAuthGuard → TenantMiddleware → SubscriptionWriteGuard. Public routes opt out with `@Public()`.

4. **RBAC:** Roles have many Permissions. TenantUser links to Role. Check with `@Roles()` decorator + RolesGuard.

5. **Feature flags:** Plans have features. Tenants can override with TenantFeature. Check with `@RequireFeature()` decorator + FeatureGuard.

6. **Subscription enforcement:** SubscriptionWriteGuard prevents mutations when subscription is expired.

7. **Real-time:** EventsGateway (Socket.io) pushes updates to tenant/user rooms.

8. **Background jobs:** BullMQ queues for notifications, emails, SMS. NotificationProcessor handles all three.

9. **Caching:** Redis-based tenant-aware caching via CacheService (ioredis).

10. **Arabic-first:** All user-facing fields have `nameAr` primary, `nameEn` optional. Currency SAR. Tax 15%.

---

## 9. WHAT DOES NOT EXIST YET (Gaps)

The following are NOT implemented yet and represent the next evolution:

1. **Commitment Fabric** — No concept of tracking appointments/shifts as "commitments" in a dependency graph.
2. **Auto-Healing Engine** — No automatic rescheduling when staff is late/absent.
3. **Concrete Shifts** — EmployeeSchedule is a weekly template, but there's no daily Shift instance that appointments bind to.
4. **Inventory System** — No products, no service-product consumption links, no stock tracking.
5. **Client DNA** — Client model has basic totalVisits/totalSpent but no predictive profile (CLV, churn risk, price sensitivity).
6. **Domain Events** — No event sourcing or domain event log.
7. **ZATCA Integration** — No e-invoicing, no UBL XML generation, no digital signatures, no QR codes.
8. **Marketing Automation** — No auto-campaigns, no gap-filling offers.
9. **Dynamic Pricing** — No peak/off-peak pricing.
10. **Predictive Analytics** — No forecasting, no cancellation probability.
11. **WhatsApp Integration** — Module exists but is a placeholder (no actual API integration).
12. **SMS Integration** — Module exists but is a placeholder.
13. **Cross-branch intelligence** — Schema supports multi-branch (Tenant = business, not branch) but no load balancing between locations.

---

## 10. CODING CONVENTIONS

- **Language:** TypeScript strict mode
- **Naming:** camelCase for variables/functions, PascalCase for classes/types/models, snake_case for database columns (via Prisma `@map`)
- **Backend pattern:** Controller (thin, validation) → Service (business logic) → Prisma client (data access)
- **DTO validation:** class-validator decorators on DTOs
- **API response:** Standardized via ResponseTransformInterceptor
- **Error handling:** HttpExceptionFilter for consistent error responses
- **Arabic-first:** All user-facing strings have Arabic primary (`nameAr`), English optional (`nameEn`)
- **Currency:** SAR, Decimal(10,2) for all monetary values
- **Time format:** HH:MM strings (VARCHAR 5) for times, DATE for dates, TIMESTAMPTZ for timestamps
- **IDs:** UUID v4 everywhere

---

## 11. HOW TO RUN

```bash
# Prerequisites: Node >= 20, pnpm >= 9, Docker

# 1. Start infrastructure
pnpm docker:up

# 2. Install dependencies
pnpm install

# 3. Generate Prisma clients
pnpm db:generate

# 4. Run platform migrations
cd apps/api && pnpm db:migrate

# 5. Seed initial data (roles, permissions, plans, features)
pnpm db:seed

# 6. Start all apps in dev mode
pnpm dev
```

**Port map:** API=4000, Dashboard=3000, Booking=3001, Admin=3002, PostgreSQL=5432, Redis=6379, MinIO=9000/9001

---

## IMPORTANT RULES FOR CONTRIBUTING

1. Never break multi-tenancy — every tenant query must go through the tenant Prisma client, never the platform client
2. Never expose platform database to tenant-level modules
3. All new salon features go under `apps/api/src/modules/salon/`
4. All shared infrastructure goes under `apps/api/src/shared/`
5. Keep Arabic-first: always have `nameAr` as required, `nameEn` as optional
6. All monetary values use `Decimal(10, 2)` and SAR currency
7. All mutations should create audit/activity logs
8. Follow existing DTO validation patterns (class-validator)
9. Add Swagger decorators to all new endpoints
10. WebSocket events should target tenant rooms (`tenant:{id}`)
