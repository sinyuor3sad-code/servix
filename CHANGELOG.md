# Changelog

All notable changes to SERVIX will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-04-11

### Added — Smart Menu & QR Invoice System
- **Smart Menu (المنيو الذكي)** — Public API for customers to browse services without login
- **Self-Order System (الطلب الذاتي)** — QR-based ordering with order codes (A001, B002, etc.)
- **Public Invoice Page** — Token-based invoice viewing for customers via QR/link
- **Feedback System** — Post-invoice rating with Google Maps review redirect for high scores
- **Order Expiry Service** — Automatic cleanup of expired self-orders via cron
- **WebSocket Order Notifications** — Real-time `order:new` and `order:status` events to POS

### Added — POS Enhancements
- **13 POS pages** in Dashboard — Full cashier experience
- **Smart Menu Settings** page — Configure menu visibility, order expiry, etc.

### Fixed
- **Race Condition (D1)** — Appointment creation now uses `$transaction` + `SELECT FOR UPDATE`
- **Graceful Shutdown (D3)** — SIGTERM/SIGINT handlers with 30s timeout in `main.ts`
- **Migration Safety (D4)** — Switched from `db push --accept-data-loss` to `prisma migrate deploy`
- **WebSocket Scaling (D7)** — Added Redis IO Adapter for multi-instance WebSocket support
- **Correlation IDs (D9)** — UUID/OpenTelemetry trace ID on every request via middleware
- **Batch Migrations (D19)** — Tenant schema sync uses configurable batch size with `Promise.allSettled`

## [1.0.0] - 2026-04-08

### Added — Enterprise Features
- **12 Architecture Decision Records** (ADRs) — database strategy, framework, ORM, caching, auth, versioning, feature flags, observability, etc.
- **Feature Flag System** — 4 strategies: ALL, PERCENTAGE, TENANT_LIST, USER_LIST
- **A/B Testing Framework** — Deterministic variant assignment
- **Advanced Analytics** — LTV, CAC, churn prediction, cohort analysis
- **Quota Guard** — Plan-based resource limits (basic/pro/premium/enterprise)
- **Tenant Status Guard** — Blocks suspended/deleted tenants
- **Admin Force Actions** — force-logout, force-password-reset

### Added — Security & Compliance
- **Encryption Service** — AES-256-GCM for sensitive data (phone, email) with searchable hashing
- **Circuit Breaker** — opossum-based with Prometheus metrics integration
- **Distributed Locks** — Redis-based SET NX PX with Lua atomic release
- **CSP Headers** — Custom Content-Security-Policy per environment
- **CORS Hardening** — Production blocks all non-configured origins

### Added — Observability
- **Prometheus Metrics** — HTTP request duration, active connections, circuit breaker states
- **OpenTelemetry Tracing** — Distributed tracing with OTLP exporter
- **Sentry Integration** — Error tracking with source maps
- **Winston Logging** — Structured JSON logging

### Added — Operations Docs
- **SLA Document** — 99.9% uptime target, p95<500ms, RTO<30min, RPO<1h
- **6 Runbooks** — DB unresponsive, Redis down, API 500 errors, backup/restore, SSL renewal, DR test
- **Compliance Checklists** — PDPL + ZATCA Phase 1 & 2
- **Developer Onboarding Guide** — Zero-to-PR in < 2 hours
- **Contributing Guide** — Code standards, conventional commits

### Added — Tests
- **46 backend unit tests** (spec files) covering all major services and guards
- **17 frontend component tests** — Badge, Button, Card, DataTable, Dialog, etc.
- **5 E2E test suites** — auth, booking, invoice, admin, tenant-isolation
- **K6 Load Tests** — Weekly ramp test config (1000 VUs), soak test config

## [0.9.0] - 2026-03-25

### Added
- **Commitment Engine** — Track employee/client commitments with state machine (pledged → confirmed → in_progress → fulfilled/broken/healed)
- **Healing Engine** — Auto-recovery for broken commitments: reassign → time_shift → compensate → escalate
- **OpenTelemetry Tracing** — Distributed tracing bootstrap in `main.ts`
- **ZATCA Module** — XML builder, crypto service, QR TLV encoding (not yet registered with ZATCA portal)
- **React Native skeleton** — `apps/mobile/` directory structure only

## [0.8.0] - 2026-03-01

### Added
- **Debts Module** — Client debt tracking and management
- **Dynamic Pricing** — Rule-based pricing with time/demand factors
- **Client DNA** — Customer behavior profiling
- **Shifts Module** — Daily employee shift management with status tracking

## [0.7.0] - 2026-02-15

### Added
- **WhatsApp Integration** — Meta Graph API v21.0 for text messages + PDF documents
- **SMS Integration** — Unifonic provider (credentials required to activate)
- **Push Notifications** — Firebase-based push notification service
- **Data Encryption** — AES-256-GCM with scrypt key derivation
- **CSP/CSRF Security Headers** — Helmet with custom directives

## [0.6.0] - 2026-02-01

### Added
- **Circuit Breaker Pattern** — opossum with state monitoring
- **i18n Support** — Arabic + English throughout Dashboard
- **Inventory Module** — Stock tracking with auto-deduct on appointment completion
- **Loyalty Program** — Points-based customer rewards
- **Packages Module** — Service bundles with pricing

## [0.5.0] - 2026-01-15

### Added
- **CI/CD Pipeline** — GitHub Actions: ci.yml, deploy.yml, backup.yml, load-test.yml
- **Docker Builds** — Multi-stage Dockerfiles for all apps
- **Redis WebSocket Adapter** — Socket.io multi-instance support
- **Backup Scripts** — Automated PostgreSQL backup + restore with retention

## [0.1.0] - 2026-01-01

### Added
- Initial multi-tenant architecture (database-per-tenant)
- NestJS API with Prisma ORM (platform + tenant schemas)
- Next.js 15 Dashboard + Booking + Admin + Landing apps
- Authentication (JWT access + refresh tokens, 2FA TOTP)
- RBAC — Role-based access control with guards
- Appointments, Clients, Services, Employees modules
- Invoice generation with PDF (PDFKit)
- WebSocket real-time updates (Socket.io)
- BullMQ background jobs
- MinIO/S3 file uploads
- Swagger API documentation (hidden in production)

---

> ⚠️ **ملاحظة:** هذا الملف تم تصحيحه في 2026-04-11 ليعكس الحالة الحقيقية المتحقق منها في الكود.
> الإصدارات السابقة لهذا التصحيح كانت تحتوي على عناصر مستقبلية/تخطيطية لم تُنفذ بعد.
