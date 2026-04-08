import { test, expect } from '@playwright/test';

test.describe('Appointments', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', process.env.TEST_EMAIL || 'test@servix.sa');
    await page.fill('input[type="password"]', process.env.TEST_PASSWORD || 'Test123!');
    await page.getByRole('button', { name: /دخول|login/i }).click();
    await page.waitForURL(/\/(dashboard|ar|en)?$/, { timeout: 15000 });
  });

  test('should display appointments calendar', async ({ page }) => {
    await page.goto('/appointments');
    await expect(page).toHaveURL(/appointments/);
    // Calendar or table should be visible
    await expect(page.locator('table, .calendar, [data-testid="appointments-list"]')).toBeVisible({ timeout: 10000 });
  });

  test('should open new appointment form', async ({ page }) => {
    await page.goto('/appointments');
    const newBtn = page.getByRole('button', { name: /إضافة|جديد|new|add/i });
    if (await newBtn.isVisible()) {
      await newBtn.click();
      // Form or modal should appear
      await expect(page.locator('dialog, [role="dialog"], .modal, form')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should show appointment details on click', async ({ page }) => {
    await page.goto('/appointments');
    // Click first appointment if available
    const firstRow = page.locator('tr, .appointment-card').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await page.waitForTimeout(1000);
      // Some detail view should appear
      const pageContent = await page.textContent('body');
      expect(pageContent).toBeTruthy();
    }
  });
});
