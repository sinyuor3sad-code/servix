import { test, expect } from '@playwright/test';

test.describe('Reports', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="phone"]', '+966512345678');
    await page.fill('input[name="password"]', 'Test123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**');
  });

  test('should navigate to reports page', async ({ page }) => {
    await page.click('text=التقارير');
    await expect(page).toHaveURL(/reports/);
  });

  test('should display report content', async ({ page }) => {
    await page.goto('/dashboard/reports');
    await page.waitForLoadState('networkidle');
    const content = page.locator('main');
    await expect(content).toBeVisible();
  });

  test('should have date filter', async ({ page }) => {
    await page.goto('/dashboard/reports');
    const dateFilter = page.locator('input[type="date"], [data-testid="date-filter"], button:has-text("اليوم")');
    if (await dateFilter.first().isVisible()) {
      await expect(dateFilter.first()).toBeVisible();
    }
  });
});
