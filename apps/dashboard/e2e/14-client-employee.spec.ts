import { test, expect } from './fixtures';

test.describe('Client edit & history', () => {
  test('clients list page loads', async ({ page }) => {
    await page.goto('/clients');
    await expect(page).toHaveURL(/\/clients/);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });

  test('new-client route loads', async ({ page }) => {
    await page.goto('/clients/new');
    await expect(page).toHaveURL(/\/clients\/new/);
  });
});

test.describe('Employee schedule', () => {
  test('employees page loads', async ({ page }) => {
    await page.goto('/employees');
    await expect(page).toHaveURL(/\/employees/);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });
});
