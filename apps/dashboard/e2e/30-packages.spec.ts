import { test, expect } from './fixtures';

test.describe('Service packages', () => {
  test('packages page loads', async ({ page }) => {
    await page.goto('/packages');
    await expect(page).toHaveURL(/\/packages/);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });
});
