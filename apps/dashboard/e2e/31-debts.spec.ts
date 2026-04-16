import { test, expect } from './fixtures';

/**
 * NOTE: A dedicated /debts route doesn't exist — debts are tracked under
 * /expenses in the current dashboard build. We verify the expenses surface
 * and document the expected location.
 */
test.describe('Debts (via expenses)', () => {
  test('expenses page (debts home) loads', async ({ page }) => {
    await page.goto('/expenses');
    await expect(page).toHaveURL(/\/expenses/);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });
});
