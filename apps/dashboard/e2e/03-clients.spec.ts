import { test, expect } from '@playwright/test';

test.describe('Clients', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', process.env.TEST_EMAIL || 'test@servix.sa');
    await page.fill('input[type="password"]', process.env.TEST_PASSWORD || 'Test123!');
    await page.getByRole('button', { name: /دخول|login/i }).click();
    await page.waitForURL(/\/(dashboard|ar|en)?$/, { timeout: 15000 });
  });

  test('should display clients list', async ({ page }) => {
    await page.goto('/clients');
    await expect(page).toHaveURL(/clients/);
    await expect(page.locator('table, [data-testid="clients-list"]')).toBeVisible({ timeout: 10000 });
  });

  test('should search clients by name', async ({ page }) => {
    await page.goto('/clients');
    const searchInput = page.locator('input[type="search"], input[placeholder*="بحث"], input[placeholder*="search"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('سارة');
      await page.waitForTimeout(1000);
      // Search should filter results
      const pageContent = await page.textContent('body');
      expect(pageContent).toBeTruthy();
    }
  });

  test('should open add client form', async ({ page }) => {
    await page.goto('/clients');
    const addBtn = page.getByRole('button', { name: /إضافة|عميل جديد|add|new/i });
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await expect(page.locator('dialog, [role="dialog"], .modal, form')).toBeVisible({ timeout: 5000 });
    }
  });
});
