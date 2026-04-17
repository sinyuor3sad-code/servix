# SERVIX CI/CD Pipeline

End-to-end flow from PR → main → production. Single source of truth lives
in `.github/workflows/`; this doc explains *why* each piece is there.

## Workflows at a glance

| Workflow              | Triggers                              | Purpose                                                    |
| --------------------- | ------------------------------------- | ---------------------------------------------------------- |
| `ci.yml`              | push `main`/`develop`, PR to `main`   | Lint, type-check, tests, security scan, build, E2E, Lighthouse |
| `deploy.yml`          | push `main`, manual dispatch          | Build → Trivy scan → push GHCR → staging → production      |
| `codeql.yml`          | push, PR, weekly cron                 | GitHub-native SAST (JS/TS, security-extended queries)      |
| `pr-quality.yml`      | PR opened/edited/sync                 | Conventional-commit title check + dependency review + auto-label |
| `release.yml`         | tag `v*.*.*`, manual dispatch         | Generate changelog from commits + create GitHub Release    |
| `terraform.yml`       | changes under `tooling/terraform/**`  | `terraform plan` on PR, `apply` on merge to main           |
| `backup.yml`          | daily 03:00 UTC                       | Off-server pg_dump → S3                                    |
| `load-test.yml`       | weekly Sunday 03:00 UTC               | k6 weekly load test                                        |

## Quality gates (which jobs actually block)

These **fail the build** if they fail — don't add `continue-on-error` casually.

- `ci.yml › lint-and-typecheck` (lint + 4× type-check)
- `ci.yml › security` (`pnpm audit --audit-level=high`, Semgrep)
- `ci.yml › test` (Jest + 90% API coverage gate, dashboard Vitest)
- `ci.yml › build` (per-app, matrix)
- `ci.yml › e2e-tests` (Playwright against real Postgres + Redis service containers)
- `ci.yml › performance` (Lighthouse CI + 400 KB JS bundle budget)
- `codeql.yml › analyze` (security-extended queries)
- `pr-quality.yml › semantic-title` and `dependency-review`
- `deploy.yml › quality` and `deploy.yml › build` (Trivy CRITICAL/HIGH on each image)

Pact contract tests still allow failure (`continue-on-error: true`) because
both sides need to run together and the consumer/provider broker isn't
production-grade yet.

## Deploy flow

```
push main
   │
   ▼
┌──────────────┐
│ quality gate │  pnpm install · type-check · lint · API tests · audit
└──────┬───────┘
       ▼
┌──────────────────────────────┐
│ build × {api,dashboard,…}    │  build → Trivy CRITICAL/HIGH (gate) →
│ (4 jobs in parallel)          │  CycloneDX SBOM artifact → push to GHCR
└──────┬────────────────────────┘
       ▼
┌──────────────┐                  Skip with workflow_dispatch input
│ staging      │  pull image · compose up · 5× retry health probe
└──────┬───────┘
       ▼
┌──────────────┐
│ production   │  backup → snapshot prev image tags → rolling api-1/api-2 →
│              │  full stack up → health probe → on failure: pull prev tags
│              │  & restart → Slack notify
└──────────────┘
```

## Releases

- Cut a tag from `main`: `git tag -a v1.4.0 -m "v1.4.0" && git push --tags`
- `release.yml` regenerates `CHANGELOG.md`, commits it back to `main`
  with `[skip ci]`, and publishes a GitHub Release.
- Tags ending in `-rc.N`, `-beta.N`, etc. are auto-flagged as pre-releases.

The deploy workflow is **not** triggered by tags — it always deploys the
HEAD of `main`. Tags are just a documentation/release-notes mechanism.

## Required GitHub secrets

| Secret                       | Used by                  |
| ---------------------------- | ------------------------ |
| `REGISTRY_URL`               | deploy                   |
| `REGISTRY_USERNAME`          | deploy                   |
| `REGISTRY_PASSWORD`          | deploy                   |
| `SERVER_HOST`                | deploy, ci (legacy)      |
| `SERVER_USER`                | deploy                   |
| `SERVER_SSH_KEY`             | deploy                   |
| `SLACK_DEPLOY_WEBHOOK_URL`   | deploy notifications     |
| `STAGING_URL`                | load-test (optional)     |
| `S3_BUCKET` / `S3_*`         | backup                   |
| `PLATFORM_DATABASE_URL`      | backup                   |
| `HCLOUD_TOKEN`               | terraform                |
| `CLOUDFLARE_API_TOKEN`       | terraform                |
| `CLOUDFLARE_ZONE_ID`         | terraform                |
| `SSH_PUBLIC_KEY`             | terraform                |
| `DEPLOY_IP`                  | terraform                |

## Required GitHub environments

- `staging` — no approval gate, used by `deploy-staging`
- `production` — **enable "Required reviewers"** for manual approval on
  every prod deploy

## Branch protection (main)

Required status checks (all must pass before merge):

- `Lint & Type Check`
- `Security Audit`
- `Unit Tests`
- `Build (api)`, `Build (dashboard)`, `Build (booking)`, `Build (admin)`
- `E2E Tests (Playwright)`
- `Performance Budget (Lighthouse)`
- `Analyze (javascript-typescript)` (CodeQL)
- `Conventional commit title`
- `Dependency review`

Plus:
- Require a pull request, 1 approval, dismiss stale reviews
- Require review from Code Owners
- Require linear history (no merge commits)
- Require signed commits

## Rolling back a bad deploy

`deploy.yml` rolls back automatically when post-deploy health checks
fail (re-pulls the image tags captured before the deploy and restarts).

To roll back manually after the fact:

```bash
ssh root@130.94.57.77
cd /root/servix/tooling/docker
# Find a known-good sha
docker images | grep servix-api | head
export IMAGE_TAG=<sha>
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --remove-orphans
```

## Adding a new app

1. Add `apps/<name>/Dockerfile`.
2. Add to the matrix in `ci.yml › build` and `deploy.yml › build`.
3. Add a Trivy / push step is automatic once it's in the matrix.
4. Add a health-probe row in `deploy.yml › Verify full stack`.
5. Add a CODEOWNERS entry under `/apps/<name>/`.
