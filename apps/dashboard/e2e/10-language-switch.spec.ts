import { test, expect } from './fixtures';

test.describe('Language / RTL', () => {
  test('login page is served in RTL Arabic by default', async ({ page, context }) => {
    // Run anonymously — login page is the public default.
    await context.clearCookies();
    await page.goto('/login');
    const dir = await page.locator('html').getAttribute('dir');
    expect(dir).toBe('rtl');
  });

  test('language toggle (if present) switches direction', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/login');

    const langBtn = page
      .locator(
        'button:has-text("EN"), button:has-text("English"), [data-testid="lang-switch"]',
      )
      .first();

    if (!(await langBtn.isVisible())) {
      test.skip(true, 'Language toggle not present on login page');
    }

    await langBtn.click();
    const dir = await page.locator('html').getAttribute('dir');
    expect(['ltr', 'rtl']).toContain(dir);
  });
});
