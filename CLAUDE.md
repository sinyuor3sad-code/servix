# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project at a glance

**SERVIX** — multi-tenant SaaS for Saudi women's salons. Monorepo (Turborepo + pnpm@10.32.1, Node ≥20). One NestJS API + three Next.js 15 apps (dashboard, booking, admin) + shared packages. Production lives on a single Contabo VM (`194.163.158.70`) running Docker Compose (~20 containers); K8s manifests exist but are not the active deployment target — confirm with the owner before assuming K8s.

Stack: NestJS 11, Next.js 15 (App Router), TypeScript strict, Prisma 6, PostgreSQL 17, Redis 8, BullMQ, Socket.io, Tailwind v4, Zod, Sentry, OpenTelemetry, Helmet, Joi.

## The non-obvious architecture: database-per-tenant

A single **platform DB** (`servix_platform`) stores tenants, users, plans, subscriptions, RBAC, audit. Each tenant gets its own **isolated tenant DB**. Two Prisma schemas, two generated clients:

- `apps/api/prisma/platform.prisma` → platform client
- `apps/api/prisma/tenant.prisma` → tenant client (dynamically instantiated)

`TenantMiddleware` resolves the tenant from the JWT, looks up the connection string in the platform DB, and injects a tenant-scoped Prisma client onto the request. **Never query tenant data from the platform client and vice versa** — that is the data-isolation contract. When adding migrations, decide first which schema it belongs to; they evolve independently.

## Commands

Run from repo root unless noted. Turborepo orchestrates per-app scripts.

```bash
# Dev
pnpm dev                              # All apps in parallel
pnpm --filter @servix/api dev         # API only (also: dashboard, booking, admin)

# Quality (CI runs these — see "Quality gates" below)
pnpm lint                             # ESLint across workspace
pnpm type-check                       # tsc --noEmit per app
pnpm test                             # Jest (API) + Vitest (dashboard)
pnpm test:coverage                    # With coverage (API gate: 90%)
pnpm format / pnpm format:check       # Prettier

# API-specific (cd apps/api)
pnpm test -- path/to/file.spec.ts             # Single test file
pnpm test -- -t "describes this case"          # Single test by name
pnpm test:e2e                                  # E2E Jest config (test/jest-e2e.json)
pnpm test:chaos                                # Chaos tests (test/chaos/jest-chaos.json)
pnpm test:pact:verify                          # Provider Pact verification

# Database (apps/api)
pnpm db:generate    # Generates BOTH platform + tenant Prisma clients
pnpm db:migrate     # Dev migration on platform schema
pnpm db:migrate:deploy   # Production migration (platform schema)
pnpm db:seed        # prisma/seed.ts — roles, permissions, plans, super admin
pnpm db:seed:e2e    # Separate fixture seed for E2E
pnpm db:studio      # Prisma Studio on platform schema

# Infrastructure
pnpm docker:up / docker:down          # Local dev stack (Postgres, Redis, MinIO)
pnpm docker:prod                      # Production compose (tooling/docker/docker-compose.prod.yml)
pnpm create-tenant                    # tooling/scripts/create-tenant.ts
```

## Monorepo layout

```
apps/api          NestJS — core/ (auth, tenants, subscriptions, RBAC, notifications)
                       modules/salon/ (services, employees, clients, appointments, invoices, …)
                       shared/ (guards, interceptors, cache, metrics, database, config)
                       prisma/ (platform.prisma + tenant.prisma + migrations)
apps/dashboard    Next.js — salon management (36 pages, Vitest)
apps/booking      Next.js — public booking flow
apps/admin        Next.js — platform admin panel
packages/         types · utils · validations (Zod) · constants · ui · email-templates · eslint-config · tsconfig
tooling/docker    All compose variants: dev, single, blue, green, staging, prod
tooling/k8s       Manifests (not the active deployment target — verify with owner)
tooling/nginx · pgbouncer · postgres · prometheus · grafana · alertmanager · scripts
tooling/terraform Hetzner IaC (firewall, DNS) — runs via .github/workflows/terraform.yml
docs/             Architecture, API, guides, runbooks, audits
```

## Quality gates that block merge

`.github/CICD.md` is authoritative. Gates that fail the build (don't add `continue-on-error: true` casually):

- `ci.yml › lint-and-typecheck` (lint + type-check for all 4 apps)
- `ci.yml › security` (`pnpm audit --audit-level=high`, Semgrep)
- `ci.yml › test` (Jest + **90% API coverage gate**, dashboard Vitest)
- `ci.yml › build` (per-app matrix)
- `ci.yml › e2e-tests` (Playwright with real Postgres + Redis service containers)
- `ci.yml › performance` (Lighthouse CI + **400 KB JS bundle budget**)
- `codeql.yml › analyze` (security-extended)
- `pr-quality.yml › semantic-title` (Conventional Commits required) and `dependency-review`
- `deploy.yml › build` (Trivy CRITICAL/HIGH per image)

Pact contract tests are intentionally `continue-on-error: true` (broker isn't production-grade yet).

## Production deploy flow

Push to `main` → `deploy.yml` → Trivy gate → push to GHCR → staging health probe → manual approval on `production` environment → SSH deploy: backup → snapshot previous image tags → rolling `api-1` then `api-2` → full stack up → health probe → auto-rollback on failure → Slack notify. Tags are documentation only; deploys always come from `main` HEAD. Manual rollback runbook is in `.github/CICD.md`.

## Conventions

- **Conventional Commits required** (`pr-quality.yml` enforces title). Types: feat, fix, chore, docs, refactor, test, style, perf. Scope examples: `core/auth`, `salon/appointments`, `dashboard/pos`, `infra`, `prod`.
- Branches: `feat/scope/desc`, `fix/scope/desc`, `chore/scope/desc`.
- Linear history required on `main` (no merge commits), signed commits required, CODEOWNERS review required.
- Strict TypeScript across the workspace. The API has Joi env validation at `apps/api/src/config/env.validation.ts` — boot fails on missing/weak secrets.

## Current state: audit-driven hardening in flight

`docs/principal-audit/` (currently untracked — owner is tracking it on a separate branch) holds the live remediation plan after a 2026-05-14 security audit. Work is split across four engineers:

| Engineer | Scope | Key files |
|---|---|---|
| **E1 — Platform/Infra** | E8 (prod server hardening) + E7 (IaC, CI/CD, containers, Vault) | `tooling/**`, `.github/workflows/**`, prod server `194.163.158.70` |
| **E2 — Database/Auth** | Prisma schemas, auth core | `apps/api/prisma/**`, `apps/api/src/core/auth/**` |
| **E3 — AppSec/Concurrency** | API src hardening, rate-limit, websockets | `apps/api/src/**` (non-money modules) |
| **E4 — Money/Compliance/Perf** | ZATCA, Moyasar, invoices, perf | `apps/api/src/modules/salon/invoices/**`, payments |

If you're acting as one of these engineers, **do not modify files outside your assigned scope** without explicit owner approval — silent cross-scope edits break the per-card review model. See `docs/principal-audit/execution/engineer-N-*.md` for per-engineer task lists, and `docs/principal-audit/synthesis-2026-05-14.md` (1624 lines) + `docs/principal-audit/a8-production-server-audit-2026-05-14.md` for the underlying findings.

## Production safety rules

- Never run destructive ops (`rm -rf`, `DROP`, `force push`, `git reset --hard`) without explicit owner approval AND a confirmed backup < 1h old.
- Never push to `main` without owner approval after a commit that touches production state (secrets, auth, DB, deploy config) — production state may differ from repo state in ways only the owner can verify.
- One card per commit. If you discover an unrelated bug while fixing a card, file it separately rather than bundling.
- Stash, don't discard. If the working tree has WIP that's not yours, `git stash push -m "..."` (without `-u` unless you've confirmed the untracked files are also WIP — `docs/` directories may be reference material).

## Reference docs to know

- `.github/CICD.md` — full pipeline, secrets, rollback
- `tooling/BACKUP.md` and `tooling/MONITORING.md` — operational runbooks
- `docs/architecture/` — master plan, database design
- `apps/api/src/shared/` — cache, metrics, config, database wiring (read before touching cross-cutting concerns)
