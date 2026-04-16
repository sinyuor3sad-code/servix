import { test, expect } from './fixtures';

test.describe('Bulk operations', () => {
  test('clients list is reachable for bulk actions', async ({ page }) => {
    await page.goto('/clients');
    await expect(page).toHaveURL(/\/clients/);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });

  test('appointments list is reachable for bulk actions', async ({ page }) => {
    await page.goto('/appointments');
    await expect(page).toHaveURL(/\/appointments/);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });
});
