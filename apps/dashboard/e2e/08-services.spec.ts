import { test, expect } from './fixtures';

test.describe('Services management', () => {
  test('services page loads', async ({ page }) => {
    await page.goto('/services');
    await expect(page).toHaveURL(/\/services/);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });

  test('service-categories sub-route loads', async ({ page }) => {
    await page.goto('/services/categories');
    await expect(page).toHaveURL(/\/services/);
  });
});
