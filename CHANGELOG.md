# Changelog

All notable changes to SERVIX will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-04-08

### Added
- **12 Architecture Decision Records** (ADRs) covering database strategy, framework, ORM, caching, K8s, mobile, DR, ZATCA, auth, versioning, feature flags, observability
- **Feature Flag System** with 4 strategies: ALL, PERCENTAGE, TENANT_LIST, USER_LIST
- **A/B Testing Framework** with deterministic variant assignment and conversion tracking
- **Advanced Analytics** — LTV, CAC, churn prediction (risk scoring), cohort analysis, MRR/ARR
- **Quota Guard** — Plan-based resource limits (employees, clients, appointments, services)
- **Tenant Status Guard** — Blocks suspended/deleted tenants
- **Admin Force Actions** — force-logout, force-password-reset for all tenant users
- **K6 Load Tests** — Weekly ramp test (1000 VUs), 48-hour soak test
- **SLA Document** — 99.9% uptime, p95<500ms, RTO<30min, RPO<1h, service credits
- **Compliance Reports** — PDPL + ZATCA Phase 1 & 2 detailed checklists
- **Incident Response Playbook** — P1-P4 severity, assessment commands, fix scenarios
- **Post-Mortem Template** — 5 Whys root cause analysis
- **On-Call Rotation Policy** — Weekly rotation, escalation chain
- **Pentest Scope Document** — OWASP Top 10 + tenant isolation tests
- **Performance Benchmark Report** — API latency, soak, Lighthouse, DB, HPA
- **Developer Onboarding Guide** — Zero-to-PR in < 2 hours
- **Contributing Guide** — Code standards, conventional commits, review process
- **Visual Regression Tests** — Playwright screenshot comparison for 9 pages
- **Accessibility Tests** — WCAG 2.1 AA checks (alt text, labels, headings, buttons)
- **30+ E2E Test Flows** — Covering all major user journeys
- **Comprehensive Unit Tests** — 14+ dashboard component tests, 8+ backend guard/service tests

### Changed
- **CI Coverage Gate** — Raised from 15% to 70% minimum
- **Jest Thresholds** — Raised to 90% statements/lines, 85% branches, 88% functions
- **CI Pipeline** — Added E2E test job, dashboard test step, Playwright report artifact
- **Deploy Dependencies** — E2E tests now required before staging deployment

### Security
- PDPL compliance verified across all data endpoints
- ZATCA Phase 2 integration fully tested (CSR, XML-DSIG, QR TLV)
- Pentest scope prepared for external audit

## [0.9.0] - 2026-03-25

### Added
- K3s Kubernetes cluster deployment
- Terraform infrastructure as code
- Blue-green deployment with auto-rollback
- OpenTelemetry distributed tracing
- ZATCA Phase 2 device onboarding
- React Native mobile app skeleton

## [0.8.0] - 2026-03-01

### Added
- Mutation testing with Stryker
- SLO/SLI with error budgets
- WCAG 2.1 accessibility audit
- 6+ Grafana dashboards

## [0.7.0] - 2026-02-15

### Added
- Chaos testing (5 scenarios)
- Data encryption (AES-256-GCM)
- CSP/CSRF security headers
- Penetration test preparation

## [0.6.0] - 2026-02-01

### Added
- Horizontal scaling (2+ API replicas)
- CDN for static assets
- Read replica for reports
- Circuit breaker pattern
- i18n (Arabic + English)

## [0.5.0] - 2026-01-15

### Added
- Payment gateway integration (Moyasar)
- CI/CD pipeline (GitHub Actions)
- Prometheus + Grafana monitoring
- Uptime Kuma external monitoring
- 60% test coverage

## [0.1.0] - 2026-01-01

### Added
- Initial multi-tenant architecture (database-per-tenant)
- NestJS API with Prisma ORM
- Next.js 15 Dashboard
- Authentication (JWT + Refresh Tokens)
- Appointments, Clients, Services, Employees modules
- Invoice generation with ZATCA Phase 1
- WebSocket real-time updates
- BullMQ background jobs
