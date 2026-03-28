<p align="center">
  <img src="https://via.placeholder.com/200x80?text=SERVIX" alt="SERVIX Logo" width="200" />
</p>

<h1 align="center">SERVIX</h1>

<p align="center">
  <strong>منصة SaaS متكاملة لإدارة الصالونات والحجوزات</strong><br/>
  <em>The Ultimate Multi-Service Booking & Salon Management Platform</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/License-Proprietary-red?style=for-the-badge" alt="License" />
</p>

---

## نظرة عامة — Overview

**SERVIX** هي منصة SaaS هجينة مصممة لإدارة أعمال الخدمات، بدايةً من صالونات التجميل النسائية في المملكة العربية السعودية. كل صالون يحصل على لوحة تحكم كاملة، نقطة بيع، صفحة حجز عامة، ونظام إشعارات متعدد القنوات — الكل في اشتراك شهري واحد.

**SERVIX** is a Hybrid SaaS platform for service businesses, starting with women's salons in Saudi Arabia. Each salon gets a full management dashboard, POS system, public booking page, and multi-channel notifications — all under a single monthly subscription.

### Key Features

- **Multi-Tenant Architecture** — Database-per-tenant for complete data isolation
- **Salon Management Dashboard** — 36 pages covering appointments, clients, employees, services, invoices, and reports
- **Public Booking Page** — Mobile-first, SEO-optimized booking flow with OTP verification
- **POS / Cashier** — Fast invoicing with cash, card, and wallet payment methods
- **6 Customizable Themes** — Elegance, Modern, Vivid, Minimal, Corporate, Royal + custom branding
- **Arabic-First RTL** — Full right-to-left layout with English fallback
- **Role-Based Access Control** — Owner, Manager, Receptionist, Cashier, Staff with granular permissions
- **Feature Flags per Plan** — Basic (199 SAR), Pro (399 SAR), Premium (699 SAR)
- **Real-Time Notifications** — WebSocket + SMS + WhatsApp + Email via BullMQ
- **Platform Admin Panel** — Manage tenants, subscriptions, plans, and monitor the entire platform

### Screenshots

> *Screenshots will be added before public launch.*

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENTS                                    │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ Dashboard │  │ Booking Page │  │  Admin   │  │  Mobile App  │   │
│  │ :3000    │  │ :3001        │  │  :3002   │  │  (future)    │   │
│  └────┬─────┘  └──────┬───────┘  └────┬─────┘  └──────┬───────┘   │
│       │               │               │               │            │
│       └───────────────┴───────┬───────┴───────────────┘            │
│                               │                                     │
│                        ┌──────┴──────┐                              │
│                        │   Nginx /   │                              │
│                        │  CloudFlare │                              │
│                        └──────┬──────┘                              │
└───────────────────────────────┼─────────────────────────────────────┘
                                │
┌───────────────────────────────┼─────────────────────────────────────┐
│                        ┌──────┴──────┐          SERVER              │
│                        │  NestJS API │                              │
│                        │   :4000     │                              │
│                        └──┬───┬───┬──┘                              │
│                           │   │   │                                 │
│              ┌────────────┘   │   └────────────┐                    │
│              │                │                │                    │
│     ┌────────┴────────┐  ┌───┴────┐  ┌────────┴────────┐          │
│     │  PostgreSQL 17  │  │Redis 8 │  │    MinIO / S3   │          │
│     │  ┌────────────┐ │  │        │  │                 │          │
│     │  │  Platform   │ │  │ Cache  │  │  File Storage   │          │
│     │  │  Database   │ │  │ Queue  │  │                 │          │
│     │  ├────────────┤ │  │ PubSub │  └─────────────────┘          │
│     │  │ Tenant DB 1 │ │  └────────┘                               │
│     │  ├────────────┤ │                                            │
│     │  │ Tenant DB 2 │ │    ┌───────────────────────┐              │
│     │  ├────────────┤ │    │       BullMQ           │              │
│     │  │ Tenant DB N │ │    │  ┌────┐ ┌────┐ ┌────┐ │              │
│     │  └────────────┘ │    │  │SMS │ │Mail│ │WApp│ │              │
│     └─────────────────┘    │  └────┘ └────┘ └────┘ │              │
│                            └───────────────────────┘              │
└───────────────────────────────────────────────────────────────────┘
```

### Database-per-Tenant

Every salon that subscribes to SERVIX gets its own isolated PostgreSQL database. A shared **Platform Database** manages tenants, users, subscriptions, plans, and feature flags. When a request arrives, the `TenantMiddleware` extracts the tenant from the JWT, looks up the tenant's database in the platform DB, and injects a tenant-scoped Prisma client into the request — ensuring zero cross-tenant data leakage.

### Monorepo Structure

| App / Package | Description |
|---|---|
| `apps/api` | NestJS backend — 196 source files, ~100 endpoints |
| `apps/dashboard` | Next.js salon management dashboard — 73 files, 36 pages |
| `apps/booking` | Next.js public booking page — 8 files, 3 pages |
| `apps/admin` | Next.js platform admin panel — 32 files, 10 pages |
| `packages/types` | Shared TypeScript types and interfaces |
| `packages/utils` | Shared utility functions |
| `packages/validations` | Shared Zod schemas |
| `packages/constants` | Shared enums and constants |
| `packages/ui` | Shared UI components |
| `packages/email-templates` | HTML email templates |

---

## Tech Stack

| Category | Technology | Purpose |
|---|---|---|
| **Backend Framework** | NestJS | REST API, WebSocket, background jobs |
| **Frontend Framework** | Next.js 15 (App Router) | Dashboard, Booking, Admin |
| **Language** | TypeScript (strict) | End-to-end type safety |
| **Database** | PostgreSQL 17 | Primary data store (multi-tenant) |
| **Cache / Queue** | Redis 8 | Caching, BullMQ queues, Pub/Sub |
| **ORM** | Prisma | Type-safe database access |
| **CSS** | Tailwind CSS v4 | Utility-first styling |
| **UI Components** | Shadcn/UI + Radix UI | Accessible, composable components |
| **State Management** | Zustand | Lightweight client state |
| **Data Fetching** | TanStack Query v5 | Server state, caching, mutations |
| **Forms** | React Hook Form + Zod | Validation and form handling |
| **Charts** | Recharts | Dashboard analytics |
| **Real-Time** | Socket.io + Redis Pub/Sub | WebSocket notifications |
| **Background Jobs** | BullMQ | SMS, email, WhatsApp, reminders |
| **Auth** | Passport.js + JWT | Access (15min) + Refresh (7d) tokens |
| **File Storage** | MinIO (dev) / S3 (prod) | Images, logos, documents |
| **Monorepo** | Turborepo + pnpm | Build orchestration, workspaces |
| **Containerization** | Docker + Docker Compose | Dev and production environments |
| **CI/CD** | GitHub Actions | Automated testing and deployment |
| **CDN / DNS** | CloudFlare | SSL, caching, DDoS protection |
| **Monitoring** | Sentry + Uptime Kuma | Error tracking, uptime monitoring |
| **i18n** | next-intl | Arabic / English localization |

---

## Getting Started

### Prerequisites

| Tool | Minimum Version | Install |
|---|---|---|
| Node.js | 22+ | [nodejs.org](https://nodejs.org) |
| pnpm | 10+ | `npm install -g pnpm` |
| Docker Desktop | Latest | [docker.com](https://www.docker.com/products/docker-desktop) |
| Git | Latest | [git-scm.com](https://git-scm.com) |

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-org/servix.git
cd servix

# 2. Run the automated setup script
# Linux / macOS:
bash tooling/scripts/setup.sh

# Windows (PowerShell):
.\tooling\scripts\setup.ps1
```

### Manual Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Start infrastructure (PostgreSQL, Redis, MinIO)
pnpm docker:up

# 3. Copy environment variables
cp .env.example apps/api/.env

# 4. Generate Prisma clients
cd apps/api
npx prisma generate --schema=./prisma/platform.prisma
npx prisma generate --schema=./prisma/tenant.prisma

# 5. Run database migrations
npx prisma migrate dev --schema=./prisma/platform.prisma --name init

# 6. Seed the database (roles, permissions, plans, features, super admin)
npx ts-node prisma/seed.ts
cd ../..

# 7. Start all apps in development mode
pnpm dev
```

### Development Ports

| App | URL | Description |
|---|---|---|
| API | http://localhost:4000 | NestJS backend |
| API Docs | http://localhost:4000/docs | Swagger UI |
| Dashboard | http://localhost:3000 | Salon management |
| Booking | http://localhost:3001 | Public booking page |
| Admin | http://localhost:3002 | Platform admin panel |
| MinIO Console | http://localhost:9001 | File storage UI |

---

## Project Structure

```
servix/
├── apps/
│   ├── api/                    # NestJS Backend
│   │   ├── src/
│   │   │   ├── core/           # Auth, Tenants, Subscriptions, RBAC, Notifications
│   │   │   ├── modules/salon/  # Services, Employees, Clients, Appointments, Invoices, ...
│   │   │   └── shared/         # Guards, Interceptors, Decorators, Database, Config
│   │   └── prisma/             # Platform + Tenant schemas, migrations, seed
│   ├── dashboard/              # Next.js — Salon Dashboard (36 pages)
│   ├── booking/                # Next.js — Public Booking (3 pages)
│   └── admin/                  # Next.js — Platform Admin (10 pages)
├── packages/
│   ├── types/                  # Shared TypeScript types
│   ├── utils/                  # Shared utilities
│   ├── validations/            # Shared Zod schemas
│   ├── constants/              # Shared enums + constants
│   ├── ui/                     # Shared UI components
│   ├── email-templates/        # HTML email templates
│   ├── eslint-config/          # Shared ESLint config
│   └── tsconfig/               # Shared TypeScript config
├── tooling/
│   ├── docker/                 # Docker Compose files
│   └── scripts/                # Setup, migration, tenant scripts
├── docs/
│   ├── architecture/           # Master plan, database design
│   ├── api/                    # Endpoint documentation
│   └── guides/                 # Developer guides, launch checklist
├── .github/workflows/          # CI/CD pipelines
├── .env.example
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

---

## API Documentation

Interactive API documentation is available via Swagger at:

```
http://localhost:4000/docs
```

### Endpoint Groups

| Group | Endpoints | Description |
|---|---|---|
| **Auth** | 10 | Register, login, JWT refresh, OTP, password reset |
| **Tenants** | 6 | Create salon, manage subscription, feature toggles |
| **Salon Info** | 6 | Salon profile, branding, working hours, settings |
| **Services** | 10 | Service CRUD, categories, reordering |
| **Employees** | 10 | Employee CRUD, schedules, availability |
| **Clients** | 9 | Client CRUD, search, visit history, loyalty points |
| **Appointments** | 11 | Booking CRUD, status flow, calendar, available slots |
| **Invoices / POS** | 10 | Invoice CRUD, payments, discounts, coupons, PDF |
| **Coupons** | 6 | Coupon CRUD, validation |
| **Loyalty** | 5 | Points settings, balance, adjustments, transactions |
| **Reports** | 8 | Revenue, appointments, clients, employees, export |
| **Notifications** | 5 | Notification list, read, settings |
| **Uploads** | 3 | Image upload, logo upload, file delete |
| **Booking (Public)** | 6 | Salon info, services, employees, slots, book, verify |
| **Admin** | 7 | Platform tenants, subscriptions, invoices, stats, audit |
| **Total** | **~100** | |

---

## Deployment

### Docker Build

```bash
# Build production images
docker build -t servix-api:latest -f apps/api/Dockerfile .
docker build -t servix-dashboard:latest -f apps/dashboard/Dockerfile .
docker build -t servix-booking:latest -f apps/booking/Dockerfile .
docker build -t servix-admin:latest -f apps/admin/Dockerfile .
```

### Production Docker Compose

```bash
# Start production stack
docker compose -f tooling/docker/docker-compose.prod.yml up -d --build

# Stop production stack
docker compose -f tooling/docker/docker-compose.prod.yml down
```

### CI/CD Pipeline

The project uses GitHub Actions with two workflows:

| Workflow | Trigger | Steps |
|---|---|---|
| **CI** (`ci.yml`) | Push / PR to `main` | Lint, type-check, test, build |
| **Deploy** (`deploy.yml`) | Push to `main` | Build images, push to GHCR, SSH deploy |

Pipeline stages:
1. **Lint & Format** — ESLint + Prettier check
2. **Type Check** — TypeScript strict compilation
3. **Test** — Jest unit + integration tests
4. **Build** — Docker multi-stage production builds
5. **Push** — GitHub Container Registry
6. **Deploy** — SSH into server, pull images, docker compose up

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | API server port | `4000` |
| `PLATFORM_DATABASE_URL` | Platform PostgreSQL connection string | *required* |
| `POSTGRES_USER` | PostgreSQL username | `servix` |
| `POSTGRES_PASSWORD` | PostgreSQL password | `servix_secret` |
| `POSTGRES_DB` | Platform database name | `servix_platform` |
| `POSTGRES_PORT` | PostgreSQL port | `5432` |
| `REDIS_HOST` | Redis hostname | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD` | Redis password | `servix_redis` |
| `JWT_ACCESS_SECRET` | JWT access token secret | *required* |
| `JWT_REFRESH_SECRET` | JWT refresh token secret | *required* |
| `JWT_ACCESS_EXPIRATION` | Access token TTL | `15m` |
| `JWT_REFRESH_EXPIRATION` | Refresh token TTL | `7d` |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | `http://localhost:3000` |
| `THROTTLE_TTL` | Rate limit window (seconds) | `60` |
| `THROTTLE_LIMIT` | Max requests per window | `100` |
| `S3_ENDPOINT` | S3-compatible storage endpoint | `http://localhost:9000` |
| `S3_ACCESS_KEY` | S3 access key | `servix_minio` |
| `S3_SECRET_KEY` | S3 secret key | `servix_minio_secret` |
| `S3_BUCKET` | S3 bucket name | `servix-uploads` |
| `MINIO_ROOT_USER` | MinIO root username | `servix_minio` |
| `MINIO_ROOT_PASSWORD` | MinIO root password | `servix_minio_secret` |
| `MAIL_API_KEY` | Email provider API key (SendGrid / Resend) | — |
| `MAIL_FROM` | Sender email address | `noreply@servi-x.com` |
| `SMS_API_KEY` | SMS provider API key (Unifonic / Twilio) | — |
| `SMS_SENDER_ID` | SMS sender ID | `SERVIX` |
| `WHATSAPP_TOKEN` | WhatsApp Business API token | — |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp phone number ID | — |
| `REGISTRY_URL` | Docker registry URL (GHCR) | — |
| `SERVER_HOST` | Production server IP / hostname | — |
| `API_URL` | Public API base URL | `http://localhost:4000/api/v1` |

---

## Contributing

### Development Workflow

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feat/module-name/feature-description
   ```
2. Make changes following the coding standards in `CLAUDE.md`
3. Run checks:
   ```bash
   pnpm lint          # Lint all apps
   pnpm type-check    # TypeScript strict check
   pnpm test          # Run tests
   ```
4. Commit using conventional commit format
5. Open a pull request to `main`

### Commit Message Format

```
type(scope): description
```

| Type | Usage |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `chore` | Build, CI, config changes |
| `docs` | Documentation only |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or updating tests |
| `style` | Formatting, white-space, etc. |
| `perf` | Performance improvement |

**Scope examples:** `core/auth`, `salon/appointments`, `dashboard/pos`, `infra`

```
feat(salon/appointments): add conflict prevention for overlapping bookings
fix(core/auth): handle expired refresh token gracefully
chore(infra): update Docker Compose to PostgreSQL 17
docs(api): add Swagger descriptions for booking endpoints
```

### Branch Naming

```
feat/scope/short-description     # New feature
fix/scope/short-description      # Bug fix
chore/scope/short-description    # Maintenance
refactor/scope/short-description # Refactoring
```

**Examples:**

```
feat/salon/loyalty-system
fix/core/tenant-middleware-pool-leak
chore/infra/ci-cache-optimization
refactor/dashboard/extract-pos-hooks
```

---

## Useful Commands

```bash
# Development
pnpm dev                              # Start all apps
pnpm --filter @servix/api dev         # API only
pnpm --filter @servix/dashboard dev   # Dashboard only
pnpm --filter @servix/booking dev     # Booking only
pnpm --filter @servix/admin dev       # Admin only

# Quality
pnpm lint                             # Lint all
pnpm lint:fix                         # Auto-fix lint issues
pnpm format                           # Format all files
pnpm type-check                       # TypeScript check
pnpm test                             # Run all tests
pnpm test:coverage                    # Tests with coverage

# Database
pnpm db:generate                      # Generate Prisma clients
pnpm db:migrate                       # Run migrations
pnpm db:seed                          # Seed database
pnpm db:studio                        # Open Prisma Studio

# Infrastructure
pnpm docker:up                        # Start Docker services
pnpm docker:down                      # Stop Docker services
pnpm docker:prod                      # Start production stack
pnpm clean                            # Clean all build artifacts
```

---

## License

This project is **UNLICENSED** — proprietary software. All rights reserved.

Unauthorized copying, modification, distribution, or use of this software is strictly prohibited without explicit written permission from the SERVIX team.

---

<p align="center">
  <strong>SERVIX</strong> — صُنع بعناية في السعودية 🇸🇦
</p>
