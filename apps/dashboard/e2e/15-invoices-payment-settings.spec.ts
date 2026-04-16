import { test, expect } from './fixtures';

test.describe('Invoices & payments', () => {
  test('invoices list page loads', async ({ page }) => {
    await page.goto('/invoices');
    await expect(page).toHaveURL(/\/invoices/);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });
});

test.describe('Salon settings', () => {
  test('settings landing page loads', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });

  test('working-hours sub-page loads', async ({ page }) => {
    await page.goto('/settings/working-hours');
    await expect(page).toHaveURL(/\/settings/);
  });
});
