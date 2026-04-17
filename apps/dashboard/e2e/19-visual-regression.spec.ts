import { test, expect } from './fixtures';

/**
 * Visual regression via Playwright screenshots.
 *
 * Baselines live in `e2e/19-visual-regression.spec.ts-snapshots/`. First
 * run after a UI change: `pnpm e2e:update` to refresh baselines.
 *
 * Gated behind RUN_VISUAL=1 — CI does not commit baselines and toHaveScreenshot
 * fails deterministically when none exist. Opt in locally with
 * `RUN_VISUAL=1 pnpm e2e` after running `pnpm e2e:update` once.
 */
test.skip(!process.env.RUN_VISUAL, 'Visual regression is opt-in (set RUN_VISUAL=1).');

const PUBLIC_PAGES = [
  { name: 'login', path: '/login' },
  { name: 'forgot-password', path: '/forgot-password' },
  { name: 'register', path: '/register' },
] as const;

for (const pageConfig of PUBLIC_PAGES) {
  test(`visual: ${pageConfig.name} (ar)`, async ({ page, context }) => {
    await context.clearCookies();
    await page.goto(pageConfig.path);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot(`${pageConfig.name}-ar.png`, {
      maxDiffPixelRatio: 0.02,
      fullPage: true,
    });
  });
}

test.describe('Visual: authenticated pages', () => {
  const AUTH_PAGES = [
    { name: 'home', path: '/' },
    { name: 'appointments', path: '/appointments' },
    { name: 'clients', path: '/clients' },
    { name: 'services', path: '/services' },
    { name: 'employees', path: '/employees' },
    { name: 'settings', path: '/settings' },
  ] as const;

  for (const pageConfig of AUTH_PAGES) {
    test(`visual: ${pageConfig.name}`, async ({ page }) => {
      await page.goto(pageConfig.path);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveScreenshot(`${pageConfig.name}-ar.png`, {
        maxDiffPixelRatio: 0.02,
        fullPage: true,
      });
    });
  }
});
