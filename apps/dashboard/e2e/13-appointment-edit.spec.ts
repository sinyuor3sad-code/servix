import { test, expect } from './fixtures';

test.describe('Appointment edit / calendar', () => {
  test('appointments list page loads', async ({ page }) => {
    await page.goto('/appointments');
    await expect(page).toHaveURL(/\/appointments/);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });

  test('new-appointment route loads', async ({ page }) => {
    await page.goto('/appointments/new');
    await expect(page).toHaveURL(/\/appointments\/new/);
  });
});
