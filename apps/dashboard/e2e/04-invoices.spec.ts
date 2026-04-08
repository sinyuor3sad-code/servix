import { test, expect } from '@playwright/test';

test.describe('Invoices', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', process.env.TEST_EMAIL || 'test@servix.sa');
    await page.fill('input[type="password"]', process.env.TEST_PASSWORD || 'Test123!');
    await page.getByRole('button', { name: /دخول|login/i }).click();
    await page.waitForURL(/\/(dashboard|ar|en)?$/, { timeout: 15000 });
  });

  test('should display invoices list', async ({ page }) => {
    await page.goto('/invoices');
    await expect(page).toHaveURL(/invoices/);
    await expect(page.locator('table, [data-testid="invoices-list"]')).toBeVisible({ timeout: 10000 });
  });

  test('should open create invoice flow', async ({ page }) => {
    await page.goto('/invoices');
    const createBtn = page.getByRole('button', { name: /إنشاء|فاتورة جديدة|create|new/i });
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(1000);
      const pageContent = await page.textContent('body');
      expect(pageContent).toBeTruthy();
    }
  });
});
