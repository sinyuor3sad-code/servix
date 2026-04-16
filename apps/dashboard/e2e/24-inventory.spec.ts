import { test, expect } from './fixtures';

test.describe('Inventory', () => {
  test('inventory page loads', async ({ page }) => {
    await page.goto('/inventory');
    await expect(page).toHaveURL(/\/inventory/);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });
});
