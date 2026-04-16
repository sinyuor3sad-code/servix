import { test, expect } from './fixtures';

test.describe('Loyalty points', () => {
  test('loyalty page loads', async ({ page }) => {
    await page.goto('/loyalty');
    await expect(page).toHaveURL(/\/loyalty/);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });
});
