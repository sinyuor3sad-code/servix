import { test, expect } from './fixtures';

test.describe('Reports', () => {
  test('reports page loads', async ({ page }) => {
    await page.goto('/reports');
    await expect(page).toHaveURL(/\/reports/);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });

  test('all report sub-pages are reachable', async ({ page }) => {
    const subPaths = [
      '/reports/appointments',
      '/reports/clients',
      '/reports/employees',
      '/reports/expenses',
      '/reports/revenue',
      '/reports/services',
    ];

    for (const sub of subPaths) {
      await page.goto(sub);
      await expect(page, `Failed on ${sub}`).toHaveURL(new RegExp(sub.replace('/', '\\/')));
    }
  });
});
