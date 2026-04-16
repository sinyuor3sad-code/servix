# Dashboard E2E (Playwright)

Browser-level tests for the SERVIX dashboard. Tests are written against real
user journeys and run headlessly by default.

## Running locally

```bash
# 1. One-time: install browser binaries
pnpm --filter @servix/dashboard e2e:install

# 2. Make sure the API + dashboard dev server are up
pnpm dev                                   # from repo root
# or run API and dashboard separately

# 3. Seed the database (provides servix@dev.local / adsf1324)
pnpm --filter @servix/api prisma:seed

# 4. Run the suite
pnpm --filter @servix/dashboard e2e              # headless
pnpm --filter @servix/dashboard e2e:ui           # Playwright UI mode
pnpm --filter @servix/dashboard e2e:debug        # step debugger
pnpm --filter @servix/dashboard e2e:report       # open last HTML report
```

## Project layout

```
e2e/
├── global-setup.ts          # Logs in once, saves storage state
├── fixtures.ts              # `test`, `expect` with page-object fixtures
├── helpers/
│   ├── auth.ts              # login() utility
│   ├── constants.ts         # TEST_CREDENTIALS, AUTH_STATE_PATH, TIMEOUTS
│   └── selectors.ts         # Shared CSS/role selectors
├── page-objects/
│   ├── login.page.ts
│   ├── appointments.page.ts
│   ├── clients.page.ts
│   └── invoices.page.ts
├── .auth/                   # (generated) Storage state files — gitignored
└── *.spec.ts                # Tests
```

## Projects (Playwright)

| Project                    | Runs                                   | Auth      |
| -------------------------- | -------------------------------------- | --------- |
| `anonymous-chromium`       | login, auth-flows, a11y, visual regs   | None      |
| `authenticated-chromium`   | all dashboard features (default)       | Owner     |
| `authenticated-mobile`     | `06-responsive.spec.ts` only           | Owner     |

Auth state is captured once by `global-setup.ts` and reused across every
`authenticated-*` project via `storageState`. Individual tests should **not**
log in manually — they receive an already-authenticated page.

## Writing a new test

```ts
import { test, expect } from './fixtures';

test('invoice list filters by status', async ({ invoicesPage, page }) => {
  await invoicesPage.goto();
  await expect(invoicesPage.list.first()).toBeVisible();
  // ...
});
```

Anything importing from `./fixtures` automatically inherits the right
authentication context based on the project that runs it.

## CI

Set `CI=1` + `PLAYWRIGHT_WEB_SERVER=1` and Playwright will boot the dashboard
dev server on its own:

```bash
pnpm --filter @servix/dashboard e2e:ci
```

Reports:
- HTML: `apps/dashboard/playwright-report/`
- JUnit: `apps/dashboard/test-results/junit.xml`
- Screenshots/trace on failure: `apps/dashboard/test-results/`

## Environment variables

See `.env.test.example` for the full list. The defaults match the dev seed
data, so local runs need no env configuration.
