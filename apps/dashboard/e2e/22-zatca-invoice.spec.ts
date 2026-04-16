import { test, expect } from './fixtures';

test.describe('ZATCA invoice flow', () => {
  test('invoices page loads with SERVIX title', async ({ page }) => {
    await page.goto('/invoices');
    await expect(page).toHaveTitle(/SERVIX/i);
  });

  test('ZATCA surface exists under /zatca', async ({ page }) => {
    await page.goto('/zatca');
    await expect(page).toHaveURL(/\/zatca/);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });
});
