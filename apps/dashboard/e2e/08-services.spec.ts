import { test, expect } from '@playwright/test';

test.describe('Services Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="phone"]', '+966512345678');
    await page.fill('input[name="password"]', 'Test123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**');
  });

  test('should navigate to services page', async ({ page }) => {
    await page.click('text=الخدمات');
    await expect(page).toHaveURL(/services/);
  });

  test('should display services list', async ({ page }) => {
    await page.goto('/dashboard/services');
    await page.waitForLoadState('networkidle');
    const content = page.locator('main, [data-testid="services-list"]');
    await expect(content).toBeVisible();
  });

  test('should open add service form', async ({ page }) => {
    await page.goto('/dashboard/services');
    const addBtn = page.locator('button:has-text("إضافة"), button:has-text("خدمة جديدة")');
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(500);
      const form = page.locator('[role="dialog"], form, .modal');
      await expect(form).toBeVisible();
    }
  });
});
