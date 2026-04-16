import { test, expect } from './fixtures';

/**
 * Responsive layout checks.
 *
 * This spec is scoped to the `authenticated-mobile` project in
 * playwright.config.ts, so the viewport is already an iPhone 14 and
 * auth state is already loaded. No manual login needed.
 */

test.describe('Responsive layout (mobile)', () => {
  test('login page has no horizontal overflow on mobile', async ({ page, context }) => {
    // Temporarily strip auth for this test so we can see /login.
    await context.clearCookies();
    await page.goto('/login');

    await expect(page.locator('input[autocomplete="email"]')).toBeVisible();

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });

  test('dashboard main pages do not overflow horizontally', async ({ page }) => {
    const paths = ['/appointments', '/clients', '/invoices', '/settings'];

    for (const pathname of paths) {
      await page.goto(pathname);
      await page.waitForLoadState('networkidle').catch(() => {
        /* best-effort */
      });

      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));

      expect(scrollWidth, `${pathname} overflows (${scrollWidth}px > ${clientWidth}px)`).toBeLessThanOrEqual(
        clientWidth + 10,
      );
    }
  });
});
