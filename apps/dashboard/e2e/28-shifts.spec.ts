import { test, expect } from './fixtures';

test.describe('Shifts', () => {
  test('shifts page loads', async ({ page }) => {
    await page.goto('/shifts');
    await expect(page).toHaveURL(/\/shifts/);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });
});
