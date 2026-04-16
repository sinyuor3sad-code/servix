import { test, expect } from './fixtures';

test.describe('Marketing', () => {
  test('marketing page loads', async ({ page }) => {
    await page.goto('/marketing');
    await expect(page).toHaveURL(/\/marketing/);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });
});
