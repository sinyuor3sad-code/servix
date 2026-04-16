import { test, expect } from './fixtures';

test.describe('Expenses', () => {
  test('expenses list page loads', async ({ page }) => {
    await page.goto('/expenses');
    await expect(page).toHaveURL(/\/expenses/);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });

  test('new-expense page loads', async ({ page }) => {
    await page.goto('/expenses/new');
    await expect(page).toHaveURL(/\/expenses\/new/);
  });

  test('expense report under /reports is reachable', async ({ page }) => {
    await page.goto('/reports/expenses');
    await expect(page).toHaveURL(/\/reports/);
  });
});
